import { ConnectionState } from 'lavashark';

import { sleep } from '../utils/functions/lavasharkRequest.js';

import type { Player, Track } from 'lavashark';
import type { Bot } from '../@types/index.js';

interface UnresolvedTrackLike {
    title: string;
    build(): Promise<Track>;
}

export class TrackPrefetcher {
    private static readonly MAX_RETRY_ATTEMPTS = 2;
    private static readonly RETRY_DELAY_MS = 1000;
    private static readonly pendingTracks = new WeakSet<object>();

    public static prefetchNext(bot: Bot, player: Player): void {
        if (!player?.queue?.tracks?.length) {
            return;
        }

        if (!player.node || player.state === ConnectionState.DISCONNECTED) {
            return;
        }

        const nextTrack = player.queue.tracks[0];
        if (!this.isUnresolvedTrack(nextTrack)) {
            return;
        }

        if (this.pendingTracks.has(nextTrack)) {
            return;
        }

        this.pendingTracks.add(nextTrack);
        void this.resolveAndReplace(bot, player, nextTrack);
    }

    private static isUnresolvedTrack(track: unknown): track is UnresolvedTrackLike {
        if (typeof track !== 'object' || track === null) {
            return false;
        }

        if ('encoded' in track && typeof (track as Track).encoded === 'string') {
            return false;
        }

        return 'build' in track && typeof (track as UnresolvedTrackLike).build === 'function';
    }

    private static async resolveAndReplace(bot: Bot, player: Player, targetTrack: UnresolvedTrackLike): Promise<void> {
        try {
            const resolvedTrack = await this.buildWithRetry(targetTrack);
            if (!resolvedTrack) {
                bot.logger.lavashark(
                    bot.shardId,
                    `[TrackPrefetcher] Failed to prefetch track "${targetTrack.title}" for guild "${player.guildId}"`,
                );
                return;
            }

            if (!player.node || player.state === ConnectionState.DISCONNECTED) {
                return;
            }

            const index = player.queue.tracks.indexOf(targetTrack as unknown as Track);
            if (index === -1) {
                return;
            }

            player.queue.tracks[index] = resolvedTrack;
            bot.logger.lavashark(
                bot.shardId,
                `[TrackPrefetcher] Prefetched next track "${resolvedTrack.title}" for guild "${player.guildId}"`,
            );
        } finally {
            this.pendingTracks.delete(targetTrack);
        }
    }

    private static async buildWithRetry(track: UnresolvedTrackLike): Promise<Track | null> {
        for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                return await track.build();
            } catch {
                if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
                    await sleep(this.RETRY_DELAY_MS);
                }
            }
        }

        return null;
    }
}
