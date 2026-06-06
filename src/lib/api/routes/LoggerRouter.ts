import { paginateLogLines } from '../logs.js';
import { ok, problem } from '../http.js';
import { paginatedLogsQuerySchema } from '../validators/schemas.js';
import { validateQuery } from '../validators/validate.js';
import { BaseRouter } from './BaseRouter.js';

import type { Request, Response } from 'express';


/**
 * Handles bot logger routes:
 *   GET /api/logs/bot - Return a cursor-paginated slice of bot log lines
 */
export class LoggerRouter extends BaseRouter {
    constructor(...args: ConstructorParameters<typeof BaseRouter>) {
        super(...args);
        this.registerRoutes();
    }

    protected registerRoutes(): void {
        this.router.get('/bot', this.#getLogs.bind(this));
    }

    /**
     * GET /api/logs/bot
     * Response: cursor-paginated log entries ordered by newest first.
     *
     * Routing strategy:
     *  - No cursor   → full disk read via getAllLogs() for a complete initial snapshot.
     *  - after=N     → getLogsAfterLine(N) from cache (fast; used by periodic refresh).
     *  - before=N    → getLogsBeforeLine(N) from cache (fast; used by load-older scroll).
     */
    async #getLogs(req: Request, res: Response): Promise<Response> {
        const query = validateQuery(paginatedLogsQuerySchema, req, res);
        if (!query) return res as unknown as Response;

        const sourceId = this.bot.logger.getActiveLogSourceId();

        // --- after=N: refresh path (new entries since cursor N) ---
        if (query.after !== undefined) {
            const lines = this.bot.logger.getLogsAfterLine(query.after);

            if (lines === false) {
                return problem(res, {
                    status: 503,
                    title: 'Log cache unavailable',
                    detail: 'Failed to read logs from the in-process cache.',
                    code: 'BOT_LOG_UNAVAILABLE',
                });
            }

            const totalLines = this.bot.logger.getLogsCount();
            return ok(res, paginateLogLines(lines, query, sourceId, query.after, totalLines));
        }

        // --- before=N: load-older path (entries preceding cursor N) ---
        if (query.before !== undefined) {
            const lines = this.bot.logger.getLogsBeforeLine(query.before);

            if (lines === false) {
                return problem(res, {
                    status: 503,
                    title: 'Log cache unavailable',
                    detail: 'Failed to read logs from the in-process cache.',
                    code: 'BOT_LOG_UNAVAILABLE',
                });
            }

            const totalLines = this.bot.logger.getLogsCount();
            return ok(res, paginateLogLines(lines, query, sourceId, 0, totalLines));
        }

        // --- no cursor: initial load — read from disk for a complete snapshot ---
        const botLogs = await this.bot.logger.getAllLogs();

        if (!botLogs) {
            return problem(res, {
                status: 503,
                title: 'Log file unavailable',
                detail: 'Failed to read the bot log file from disk.',
                code: 'BOT_LOG_UNAVAILABLE',
            });
        }

        return ok(res, paginateLogLines(botLogs, query, sourceId));
    }
}
