import type { LavaShark, Track } from 'lavashark';

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;

type SearchResult = Awaited<ReturnType<LavaShark['search']>>;

/**
 * Only retry transient rate-limit, server, or network errors so permanent failures fall back immediately.
 */
const isRetryableError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const err = error as {
        status?: number;
        statusCode?: number;
        code?: string;
        message?: string;
        response?: { status?: number };
    };
    const status = err.status ?? err.statusCode ?? err.response?.status;

    if (status === 429 || (typeof status === 'number' && status >= 500)) {
        return true;
    }

    const code = err.code ?? '';
    if (['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) {
        return true;
    }

    const message = err.message ?? '';
    return /\b(429|502|503|504)\b|too many requests|fetch failed|timeout/i.test(message);
};

/**
 * Wait for the given number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Search a track with retries.
 * Lavalink nodes enforce REST rate limits (HTTP 429); a single retry after a
 * short delay lets transient rate limiting resolve without skipping tracks.
 */
export async function searchWithRetry(
    lavashark: LavaShark,
    query: string,
    attempts: number = DEFAULT_RETRY_ATTEMPTS,
    retryDelayMs: number = DEFAULT_RETRY_DELAY_MS,
): Promise<SearchResult | null> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await lavashark.search(query);
        } catch (error) {
            if (!isRetryableError(error) || attempt >= attempts - 1) {
                return null;
            }
            await sleep(retryDelayMs);
        }
    }
    return null;
}

/**
 * Decode a track from its encoded string with retries
 */
export async function decodeTrackWithRetry(
    lavashark: LavaShark,
    encoded: string,
    attempts: number = DEFAULT_RETRY_ATTEMPTS,
    retryDelayMs: number = DEFAULT_RETRY_DELAY_MS,
): Promise<Track | null> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await lavashark.decodeTrack(encoded);
        } catch (error) {
            if (!isRetryableError(error) || attempt >= attempts - 1) {
                return null;
            }
            await sleep(retryDelayMs);
        }
    }
    return null;
}

/**
 * Decode many tracks in a single request.
 * Lavalink rate limits REST calls (HTTP 429) aggressively; bulk-decoding a
 * whole saved queue with one `/decodetracks` request avoids exhausting the
 * node's request budget entirely.
 */
export async function decodeTracksWithRetry(
    lavashark: LavaShark,
    encodedTracks: string[],
    attempts: number = DEFAULT_RETRY_ATTEMPTS,
    retryDelayMs: number = DEFAULT_RETRY_DELAY_MS,
): Promise<Track[] | null> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await lavashark.decodeTracks(encodedTracks);
        } catch (error) {
            if (!isRetryableError(error) || attempt >= attempts - 1) {
                return null;
            }
            await sleep(retryDelayMs);
        }
    }
    return null;
}
