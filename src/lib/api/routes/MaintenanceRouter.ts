import { embeds } from '../../../embeds/index.js';
import { ok, problem } from '../http.js';
import { BaseRouter } from './BaseRouter.js';

import type { Request, Response } from 'express';


/**
 * Handles maintenance broadcast routes:
 *   POST /api/maintenance/notices - Send a maintenance notice to all active players
 */
export class MaintenanceRouter extends BaseRouter {
    constructor(...args: ConstructorParameters<typeof BaseRouter>) {
        super(...args);
        this.registerRoutes();
    }

    protected registerRoutes(): void {
        this.router.post('/notices', this.#sendNotice.bind(this));
    }

    /**
     * POST /api/maintenance/notices
     * Broadcasts a maintenance embed to every channel with an active player.
     * Response: { sentGuildCount: number }
     */
    async #sendNotice(_req: Request, res: Response): Promise<Response> {
        const maintainEmbed = embeds.maintainNotice(this.bot);

        try {
            const sentCounts = await this.shardManager.broadcastEval(
                async (client, context) => {
                    const deliveries = await Promise.all(
                        Array.from(client.lavashark.players.values()).map(async (player) => {
                            const channel = player.metadata?.channel;
                            if (!channel || !('send' in channel)) {
                                return 0;
                            }

                            try {
                                await (channel as { send: (payload: unknown) => Promise<unknown> })
                                    .send({ embeds: [context.maintainEmbed] });
                                return 1;
                            }
                            catch {
                                return 0;
                            }
                        })
                    );

                    return deliveries.reduce<number>((total, count) => total + count, 0);
                },
                { context: { maintainEmbed } }
            );

            const sentGuildCount = sentCounts.reduce<number>((total, count) => total + count, 0);
            return ok(res, { sentGuildCount });
        }
        catch (error) {
            this.bot.logger.api( `Failed to broadcast maintenance notice: ${error}`);
            return problem(res, {
                status: 503,
                title: 'Maintenance notice failed',
                detail: 'The maintenance broadcast could not be completed.',
                code: 'MAINTENANCE_NOTICE_FAILED',
            });
        }
    }
}
