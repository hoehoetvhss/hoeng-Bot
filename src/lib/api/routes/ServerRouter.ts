import { noContent, ok, problem } from '../http.js';
import { guildIdParamsSchema, serverListQuerySchema } from '../validators/schemas.js';
import { validateParams, validateQuery } from '../validators/validate.js';
import { BaseRouter } from './BaseRouter.js';

import type { Request, Response } from 'express';
import type { VoiceChannel } from 'discord.js';


/**
 * Handles Discord server (guild) management routes:
 *   GET    /api/servers          - List paginated guild summaries
 *   GET    /api/servers/:guildID - Guild detail, playback state, and voice snapshot
 *   DELETE /api/servers/:guildID - Make the bot leave a guild
 */
export class ServerRouter extends BaseRouter {
    constructor(...args: ConstructorParameters<typeof BaseRouter>) {
        super(...args);
        this.registerRoutes();
    }

    protected registerRoutes(): void {
        this.router.get('/', this.#list.bind(this));
        this.router.get('/:guildID', this.#detail.bind(this));
        this.router.delete('/:guildID', this.#leave.bind(this));
    }

    /**
     * GET /api/servers
     * Returns a paginated array of guilds with their metadata and whether music is active.
     */
    async #list(req: Request, res: Response): Promise<Response> {
        const query = validateQuery(serverListQuerySchema, req, res);
        if (!query) return res as unknown as Response;

        try {
            const results = await this.shardManager.broadcastEval((client) => {
                const allServers = client.guilds.cache.map((guild) => ({
                    id: guild.id,
                    name: guild.name,
                    memberCount: guild.memberCount,
                    iconUrl: guild.iconURL(),
                    shardId: client.shard?.ids[0] ?? -1,
                }));

                const playingServers = new Set(client.lavashark.players.keys());

                return allServers.map((server) => ({
                    ...server,
                    isPlaying: playingServers.has(server.id),
                }));
            });

            const servers = results
                .flat()
                .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));

            const filteredServers = servers.filter((server) => {
                if (query.playing !== undefined && server.isPlaying !== query.playing) {
                    return false;
                }

                if (query.guildId && server.id !== query.guildId) {
                    return false;
                }

                return true;
            });

            const totalItems = filteredServers.length;
            const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);
            const startIndex = (query.page - 1) * query.pageSize;
            const items = filteredServers.slice(startIndex, startIndex + query.pageSize);

            return ok(res, {
                items,
                pagination: {
                    page: query.page,
                    pageSize: query.pageSize,
                    totalItems,
                    totalPages,
                },
            });
        }
        catch (error) {
            this.bot.logger.api( `Failed to list guilds: ${error}`);
            return problem(res, {
                status: 503,
                title: 'Server list unavailable',
                detail: 'Failed to retrieve the guild list from the shard manager.',
                code: 'SERVER_LIST_UNAVAILABLE',
            });
        }
    }

    /**
     * GET /api/servers/:guildID
     * Returns a guild detail snapshot constrained by the current Discord intents.
     */
    async #detail(req: Request, res: Response): Promise<Response> {
        const params = validateParams(guildIdParamsSchema, req, res);
        if (!params) return res as unknown as Response;

        const guildID = params.guildID;
        const maxVolume = this.bot.config.bot.volume.max;

        try {
            const guildData = await this.shardManager.broadcastEval(
                async (client, context) => {
                    try {
                        // Only use the local guild cache to avoid returning partial data
                        // from shards that do not own this guild.
                        // client.guilds.fetch() would succeed on any shard the bot is in,
                        // but returns a BaseGuild with empty channels.cache and no memberCount.
                        const guild = client.guilds.cache.get(context.guildID as string);
                        if (!guild) return null;

                        const player = client.lavashark.getPlayer(context.guildID as string);
                        const voiceChannel = player
                            ? client.channels.cache.get(player.voiceChannelId) as VoiceChannel | undefined
                            : undefined;

                        let textChannels = 0;
                        let voiceChannels = 0;
                        guild.channels.cache.forEach((channel) => {
                            if (channel.isVoiceBased()) {
                                voiceChannels += 1;
                            }

                            if (channel.isTextBased() && !channel.isVoiceBased()) {
                                textChannels += 1;
                            }
                        });

                        const currentTrack = player?.current
                            ? {
                                title: player.current.title,
                                author: player.current.author,
                                url: player.current.uri,
                                durationMs: player.current.duration.value,
                                sourceName: player.current.source,
                                identifier: player.current.identifier,
                            }
                            : null;

                        const voiceMembers = voiceChannel
                            ? Array.from(voiceChannel.members.values()).map((member) => ({
                                id: member.id,
                                username: member.user.username,
                                displayName: member.displayName,
                                avatarUrl: member.displayAvatarURL(),
                                isBot: member.user.bot,
                                isMuted: member.voice.mute,
                                isDeafened: member.voice.deaf,
                                isStreaming: member.voice.streaming,
                                hasVideo: member.voice.selfVideo,
                            }))
                            : [];

                        const repeatMode = ['off', 'track', 'queue'][player?.repeatMode ?? 0] ?? 'off';
                        const toChannelReference = (channel: { id: string; name: string } | null | undefined) =>
                            channel ? { id: channel.id, name: channel.name } : null;

                        return {
                            guild: {
                                id: guild.id,
                                name: guild.name,
                                iconUrl: guild.iconURL(),
                                memberCount: guild.memberCount,
                                ownerId: guild.ownerId,
                                preferredLocale: guild.preferredLocale,
                                createdAt: guild.createdAt.toISOString(),
                                shardId: client.shard?.ids[0] ?? -1,
                                features: guild.features,
                                counts: {
                                    roles: guild.roles.cache.size,
                                    channels: guild.channels.cache.size,
                                    textChannels,
                                    voiceChannels,
                                },
                                channels: {
                                    system: toChannelReference(guild.systemChannel),
                                    rules: toChannelReference(guild.rulesChannel),
                                    publicUpdates: toChannelReference(guild.publicUpdatesChannel),
                                    afk: toChannelReference(guild.afkChannel),
                                },
                            },
                            botMember: {
                                joinedAt: guild.members.me?.joinedAt?.toISOString() ?? null,
                                nickname: guild.members.me?.nickname ?? null,
                            },
                            playback: {
                                active: Boolean(player && currentTrack),
                                status: !player || !currentTrack ? 'idle' : (player.paused ? 'paused' : 'playing'),
                                endpoint: player?.voiceState.event?.endpoint ?? null,
                                volume: {
                                    current: player ? player.volume : null,
                                    max: context.maxVolume as number,
                                },
                                repeatMode,
                                currentTrack,
                            },
                            voiceChannel: voiceChannel
                                ? {
                                    id: voiceChannel.id,
                                    name: voiceChannel.name,
                                    memberCount: voiceMembers.length,
                                    members: voiceMembers,
                                }
                                : null,
                            capabilities: {
                                voiceMemberSnapshot: true,
                                messageContent: true,
                            },
                        };
                    }
                    catch (_) {
                        return null;
                    }
                },
                { context: { guildID, maxVolume } }
            );

            const guild = guildData.find((data) => data !== null);
            if (!guild) {
                return problem(res, {
                    status: 404,
                    title: 'Server not found',
                    detail: 'The bot is not currently connected to the requested guild.',
                    code: 'GUILD_NOT_FOUND',
                });
            }

            return ok(res, guild);
        }
        catch (error) {
            this.bot.logger.api( `Failed to fetch guild detail: ${error}`);
            return problem(res, {
                status: 503,
                title: 'Server detail unavailable',
                detail: 'Failed to retrieve the requested guild detail snapshot.',
                code: 'SERVER_DETAIL_UNAVAILABLE',
            });
        }
    }

    /**
     * DELETE /api/servers/:guildID
     * Makes the bot leave the guild (and destroys the player if active).
     */
    async #leave(req: Request, res: Response): Promise<Response> {
        const params = validateParams(guildIdParamsSchema, req, res);
        if (!params) return res as unknown as Response;

        const guildID = params.guildID;

        try {
            const result = await this.shardManager.broadcastEval(
                async (client, context) => {
                    const guild = client.guilds.cache.get(context.guildID as string);
                    if (!guild) return false;

                    try {
                        const player = client.lavashark.getPlayer(context.guildID as string);
                        if (player) player.destroy();
                        await guild.leave();
                        return true;
                    }
                    catch (_) {
                        return false;
                    }
                },
                { context: { guildID } }
            );

            if (result.some((value) => value === true)) {
                return noContent(res);
            }

            return problem(res, {
                status: 404,
                title: 'Server not found',
                detail: 'The bot is not currently connected to the requested guild.',
                code: 'GUILD_NOT_FOUND',
            });
        }
        catch (error) {
            this.bot.logger.api( `Error processing leave request: ${error}`);
            return problem(res, {
                status: 500,
                title: 'Failed to leave server',
                detail: 'The bot could not leave the requested guild.',
                code: 'LEAVE_SERVER_FAILED',
            });
        }
    }
}
