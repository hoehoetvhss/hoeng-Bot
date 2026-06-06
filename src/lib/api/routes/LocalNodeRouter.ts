import { paginateLogLines } from '../logs.js';
import { noContent, ok, problem } from '../http.js';
import { localNodeProcessSchema, paginatedLogsQuerySchema } from '../validators/schemas.js';
import { validateBody, validateQuery } from '../validators/validate.js';
import { BaseRouter } from './BaseRouter.js';

import type { Request, Response } from 'express';


/**
 * Handles local Lavalink node control routes:
 *   GET    /api/localnode         - Local node summary
 *   GET    /api/localnode/logs    - Cursor-paginated local node logs
 *   PUT    /api/localnode/process - Ensure the process is running, optionally restarting it
 *   DELETE /api/localnode/process - Stop the process
 */
export class LocalNodeRouter extends BaseRouter {
    constructor(...args: ConstructorParameters<typeof BaseRouter>) {
        super(...args);
        this.registerRoutes();
    }

    protected registerRoutes(): void {
        this.router.get('/', this.#summary.bind(this));
        this.router.get('/logs', this.#getLogs.bind(this));
        this.router.put('/process', this.#putProcess.bind(this));
        this.router.delete('/process', this.#deleteProcess.bind(this));
    }

    /**
     * GET /api/localnode
     * Response: summary of the local node feature and current process state.
     */
    #summary(_req: Request, res: Response): Response {
        return ok(res, this.#buildSummary());
    }

    /**
     * GET /api/localnode/logs
     * Response: cursor-paginated log entries ordered by newest first.
     */
    #getLogs(req: Request, res: Response): Response {
        const query = validateQuery(paginatedLogsQuerySchema, req, res);
        if (!query) return res as unknown as Response;

        return ok(res, paginateLogLines(this.localNodeController.lavalinkLogs, query, this.localNodeController.getLogSourceId()));
    }

    /**
     * PUT /api/localnode/process
     * Ensures the process is running. When `forceRestart` is true, the process is restarted.
     */
    async #putProcess(req: Request, res: Response): Promise<Response> {
        const body = validateBody(localNodeProcessSchema, req, res);
        if (!body) return res as unknown as Response;

        if (!this.bot.config.localNode.enabled) {
            return problem(res, {
                status: 409,
                title: 'Local node disabled',
                detail: 'The local node feature is disabled in the current bot configuration.',
                code: 'LOCAL_NODE_DISABLED',
            });
        }

        try {
            if (body.forceRestart) {
                if (this.localNodeController.isStarting()) {
                    return problem(res, {
                        status: 409,
                        title: 'Local node startup in progress',
                        detail: 'The local node is still starting and cannot be restarted yet.',
                        code: 'LOCAL_NODE_STARTING',
                    });
                }

                const restarted = await this.localNodeController.restart();
                if (!restarted) {
                    return problem(res, {
                        status: 409,
                        title: 'Restart already in progress',
                        detail: 'The local node process could not be restarted at this time.',
                        code: 'LOCAL_NODE_RESTART_CONFLICT',
                    });
                }
            }
            else {
                await this.localNodeController.initialize();
            }

            return ok(res, this.#buildProcessState());
        }
        catch (error) {
            this.bot.logger.api( `Failed to upsert local node process: ${error}`);
            return problem(res, {
                status: 503,
                title: 'Local node process unavailable',
                detail: 'The local node process could not be started or restarted.',
                code: 'LOCAL_NODE_PROCESS_UNAVAILABLE',
            });
        }
    }

    /**
     * DELETE /api/localnode/process
     * Stops the current process when it is active.
     */
    async #deleteProcess(_req: Request, res: Response): Promise<Response> {
        if (!this.bot.config.localNode.enabled) {
            return problem(res, {
                status: 409,
                title: 'Local node disabled',
                detail: 'The local node feature is disabled in the current bot configuration.',
                code: 'LOCAL_NODE_DISABLED',
            });
        }

        if (!this.localNodeController.isProcessActive()) {
            return problem(res, {
                status: 409,
                title: 'Local node not running',
                detail: 'There is no active local node process to stop.',
                code: 'LOCAL_NODE_NOT_RUNNING',
            });
        }

        if (this.localNodeController.isStarting()) {
            return problem(res, {
                status: 409,
                title: 'Local node startup in progress',
                detail: 'The local node is still starting and cannot be stopped yet.',
                code: 'LOCAL_NODE_STARTING',
            });
        }

        try {
            const stopped = await this.localNodeController.stop();
            if (!stopped) {
                return problem(res, {
                    status: 503,
                    title: 'Failed to stop local node',
                    detail: 'The local node process did not stop successfully.',
                    code: 'LOCAL_NODE_STOP_FAILED',
                });
            }

            return noContent(res);
        }
        catch (error) {
            this.bot.logger.api( `Failed to stop local node process: ${error}`);
            return problem(res, {
                status: 503,
                title: 'Failed to stop local node',
                detail: 'The local node process could not be stopped.',
                code: 'LOCAL_NODE_STOP_FAILED',
            });
        }
    }

    #buildSummary() {
        return {
            enabled: this.bot.config.localNode.enabled,
            process: this.#buildProcessState(),
        };
    }

    #buildProcessState() {
        return {
            active: this.localNodeController.lavalinkPid !== null,
            starting: this.localNodeController.isStarting(),
            pid: this.localNodeController.lavalinkPid,
            port: this.localNodeController.port,
            autoRestart: this.localNodeController.autoRestart,
        };
    }
}
