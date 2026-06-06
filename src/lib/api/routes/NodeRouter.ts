import { NodeState } from 'lavashark';

import { ok, problem } from '../http.js';
import { BaseRouter } from './BaseRouter.js';

import type { Request, Response } from 'express';


/**
 * Handles Lavalink node status routes:
 *   GET /api/nodes - Returns status info for all configured nodes
 */
export class NodeRouter extends BaseRouter {
    constructor(...args: ConstructorParameters<typeof BaseRouter>) {
        super(...args);
        this.registerRoutes();
    }

    protected registerRoutes(): void {
        this.router.get('/', this.#list.bind(this));
    }

    /**
     * GET /api/nodes
     * Broadcasts an eval to shard 0 to collect per-node info, stats, and ping.
     */
    async #list(_req: Request, res: Response): Promise<Response> {
        try {
            const nodeStatuses = await this.shardManager.broadcastEval(
                async (client, context) => {
                    if (client.shard?.ids[0] !== 0) {
                        return null;
                    }

                    const nodesPromises = client.lavashark.nodes.map(async (node) => {
                        if (node.state !== context.NodeState.CONNECTED) {
                            return { id: node.identifier, state: node.state, info: {}, stats: {}, ping: -1 };
                        }

                        try {
                            const timeout = new Promise<never>((_, reject) =>
                                setTimeout(() => reject(new Error(`nodes_status "${node.identifier}" Timeout`)), 1500)
                            );

                            const [nodeInfo, nodeStats, nodePing] = await (Promise.race([
                                Promise.all([node.getInfo(), node.getStats(), client.lavashark.nodePing(node)]),
                                timeout,
                            ]) as Promise<[unknown, unknown, number]>);

                            return { id: node.identifier, state: node.state, info: nodeInfo, stats: nodeStats, ping: nodePing };
                        }
                        catch (_) {
                            return { id: node.identifier, state: node.state, info: {}, stats: {}, ping: -1 };
                        }
                    });

                    return Promise.all(nodesPromises);
                },
                { context: { NodeState } }
            );

            // Only shard 0 returns data; filter out nulls from other shards
            const nodesStatusList = nodeStatuses.find((result) => result !== null) ?? [];
            return ok(res, { items: nodesStatusList });
        }
        catch (error) {
            this.bot.logger.api( `Error while fetching node data: ${error}`);
            return problem(res, {
                status: 503,
                title: 'Node status unavailable',
                detail: 'Failed to retrieve Lavalink node status from the shard manager.',
                code: 'NODE_STATUS_UNAVAILABLE',
            });
        }
    }
}
