import { BasePlaylistSubcommand } from './BasePlaylistSubcommand.js';
import { DJManager } from '../../lib/DjManager.js';

import type { PlaylistSubcommandContext, PlaylistSubcommandName } from './BasePlaylistSubcommand.js';

/**
 * Remove one track from a stored playlist
 */
export class RemovePlaylistTrackSubcommand extends BasePlaylistSubcommand {
    public readonly name: PlaylistSubcommandName = 'remove-track';

    /**
     * Validate the one-based track index and remove the matching track
     */
    public async execute(context: PlaylistSubcommandContext): Promise<void> {
        const userId = context.command.user.id;
        const member = context.command.member;
        const player = context.client.lavashark.getPlayer(context.command.guild!.id);

        if (!DJManager.isDJ(context.bot, userId, member, player ?? undefined)) {
            await context.command.replyEphemeralError(context.bot, context.command.t('events:ERROR_REQUIRE_DJ'));
            return;
        }

        const args = this.getRemoveTrackArguments(context.command);
        if (!args || args.index <= 0) {
            await context.command.replyEphemeralError(
                context.bot,
                context.command.t('commands:ERROR_PLAYLIST_REMOVE_FAILED'),
            );
            return;
        }

        const playlist = context.playlistManager.getPlaylist(context.command.guild!.id, args.name);
        if (!playlist) {
            await context.command.replyEphemeralError(
                context.bot,
                context.command.t('commands:ERROR_PLAYLIST_NOT_FOUND', {
                    name: args.name,
                }),
            );
            return;
        }

        const removed = context.playlistManager.removeTrackFromPlaylist(playlist.id, args.index - 1);
        if (!removed) {
            await context.command.replyEphemeralError(
                context.bot,
                context.command.t('commands:ERROR_PLAYLIST_REMOVE_FAILED'),
            );
            return;
        }

        await context.command.replySuccess(
            context.bot,
            context.command.t('commands:MESSAGE_PLAYLIST_REMOVE_SUCCESS', {
                index: args.index,
                name: args.name,
            }),
        );
    }
}
