import { BasePlaylistSubcommand } from './BasePlaylistSubcommand.js';
import { DJManager } from '../../lib/DjManager.js';

import type {
    PlaylistSubcommandContext,
    PlaylistSubcommandName,
} from './BasePlaylistSubcommand.js';


/**
 * Delete a stored playlist from the current guild
 */
export class DeletePlaylistSubcommand extends BasePlaylistSubcommand {
    public readonly name: PlaylistSubcommandName = 'delete';

    /**
     * Validate the playlist name and delete the matching playlist
     */
    public async execute(context: PlaylistSubcommandContext): Promise<void> {
        const userId = context.command.user.id;
        const member = context.command.member;
        const player = context.client.lavashark.getPlayer(context.command.guild!.id);

        if (!DJManager.isDJ(context.bot, userId, member, player ?? undefined)) {
            await context.command.replyEphemeralError(
                context.bot,
                context.command.t('events:ERROR_REQUIRE_DJ'),
            );
            return;
        }

        const name = this.getPlaylistName(context.command);
        if (!name) {
            await context.command.replyEphemeralError(
                context.bot,
                context.command.t('commands:ERROR_PLAYLIST_NAME_REQUIRED'),
            );
            return;
        }

        const deleted = context.playlistManager.deletePlaylist(
            context.command.guild!.id,
            name,
        );
        if (!deleted) {
            await context.command.replyEphemeralError(
                context.bot,
                context.command.t('commands:ERROR_PLAYLIST_NOT_FOUND', { name }),
            );
            return;
        }

        await context.command.replySuccess(
            context.bot,
            context.command.t('commands:MESSAGE_PLAYLIST_DELETE_SUCCESS', { name }),
        );
    }
}
