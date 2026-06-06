import { IPBlocker } from './IPBlocker.js';

import type { IPBlockerConfig, SessionManagerConfig } from '../../@types/SessionManager.types.js';


export interface SessionData {
    createdAt: number;      // milliseconds
}


/**
 * Manages user sessions and IP-based brute-force blocking.
 *
 * The internal `IPBlocker` is fully encapsulated; callers interact with IP
 * blocking through the dedicated proxy methods on this class rather than
 * accessing the blocker directly.
 */
export class SessionManager {
    /** Encapsulated IP blocker — not exposed as a public property. */
    readonly #ipBlocker: IPBlocker;

    readonly #sessionMap: Map<string, SessionData>; // <sessionId, sessionData>
    readonly #validTime: number;
    readonly #cleanupInterval: number;


    /**
     * @param {SessionManagerConfig} config - Session manager configuration
     * @param {IPBlockerConfig} ipBlockerConfig - IP blocker configuration
     */
    constructor(config?: SessionManagerConfig, ipBlockerConfig?: IPBlockerConfig) {
        if (config) {
            this.#validTime = config.validTime;
            this.#cleanupInterval = config.cleanupInterval;
        }
        else {
            this.#validTime = 10 * 60 * 1000;
            this.#cleanupInterval = 5 * 60 * 1000;
        }

        this.#sessionMap = new Map<string, SessionData>();
        this.#ipBlocker = new IPBlocker(ipBlockerConfig);

        this.#autoCheckExpires(this.#cleanupInterval);
    }


    // -------------------------------------------------------------------------
    // Session methods
    // -------------------------------------------------------------------------

    /**
     * Create a new session.
     * @param sessionId - Session identifier
     */
    public createSession(sessionId: string): void {
        this.#sessionMap.set(sessionId, { createdAt: Date.now() });
    }

    /**
     * Check whether a session exists (without refreshing it).
     * @param {string} sessionId - Session identifier
     */
    public checkSession(sessionId: string): boolean {
        return this.#sessionMap.has(sessionId);
    }

    /**
     * Destroy a session by ID.
     * @param {string} sessionId - Session identifier
     */
    public destroySession(sessionId: string): boolean {
        return this.#sessionMap.delete(sessionId);
    }

    /**
     * Return the session data object if the session exists.
     * @param {string} sessionId - Session identifier
     * @returns {SessionData | false}
     */
    public getSession(sessionId: string): SessionData | false {
        return this.#sessionMap.get(sessionId) ?? false;
    }

    /**
     * Reset the TTL of an existing session.
     * @param {string} sessionId - Session identifier
     * @deprecated Use `verifyAndRefreshSession` which also enforces the TTL check.
     */
    public refreshSession(sessionId: string): boolean {
        return this.verifyAndRefreshSession(sessionId);
    }

    /**
     * Verify a session and refresh it in a single atomic operation.
     * Enforces the TTL inline — expired sessions are destroyed immediately
     * rather than waiting for the background cleanup timer.
     *
     * This is the preferred method for middleware that needs both operations.
     *
     * @param {string} sessionId - Session identifier
     * @returns {boolean} `true` when the session is valid (and was refreshed)
     */
    public verifyAndRefreshSession(sessionId: string): boolean {
        const session = this.#sessionMap.get(sessionId);
        if (!session) return false;

        // Enforce TTL at access time — the background timer runs on a schedule
        // and a session can live up to (validTime + cleanupInterval) without this check.
        if (Date.now() - session.createdAt >= this.#validTime) {
            this.#sessionMap.delete(sessionId);
            return false;
        }

        session.createdAt = Date.now();
        return true;
    }

    /**
     * Return all session entries for debugging / inspection.
     */
    public getAll(): [string, SessionData][] {
        return Array.from(this.#sessionMap.entries());
    }


    // -------------------------------------------------------------------------
    // IP blocking proxy methods (encapsulates IPBlocker)
    // -------------------------------------------------------------------------

    /**
     * Returns `true` if the given IP is currently blocked.
     * @param {string} ip - Client IP address
     */
    public checkBlocked(ip: string): boolean {
        return this.#ipBlocker.checkBlocked(ip);
    }

    /**
     * Records a failed attempt for the given IP.
     * Automatically blocks the IP once the retry limit is exceeded.
     * @param {string} ip - Client IP address
     */
    public blockIP(ip: string): void {
        this.#ipBlocker.add(ip);
    }

    /**
     * Removes the given IP from the block list and resets its retry counter.
     * @param {string} ip - Client IP address
     */
    public unblockIP(ip: string): void {
        this.#ipBlocker.delete(ip);
    }


    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** Periodically removes sessions that have exceeded `#validTime`. */
    #autoCheckExpires(cleanupInterval: number): void {
        setInterval(() => {
            const now = Date.now();
            for (const [sessionId, sessionData] of this.#sessionMap) {
                if (now - sessionData.createdAt >= this.#validTime) {
                    this.destroySession(sessionId);
                }
            }
        }, cleanupInterval);
    }
}
