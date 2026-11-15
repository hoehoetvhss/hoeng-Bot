import type { Player } from 'lavashark';

import type { Bot } from '../../@types/index.js';

/**
 * Resolve the target volume for a player from player state, guild default, or bot config.
 */
export function getTargetVolume(bot: Bot, player: Player): number {
    return player.setting?.volume ?? bot.guildVolumeManager?.get(player.guildId) ?? bot.config.bot.volume.default;
}

/**
 * Resolve the effective volume without falling back to lavashark's hardcoded 100 default.
 */
export function getEffectiveVolume(bot: Bot, player: Player): number {
    return player.filters.active.volume ?? getTargetVolume(bot, player);
}

/**
 * Persist the target volume in player settings and send it to the Lavalink node.
 */
export function applyPlayerVolume(bot: Bot, player: Player, volume?: number): number {
    const targetVolume = volume ?? getTargetVolume(bot, player);

    if (player.setting) {
        player.setting.volume = targetVolume;
    }

    player.filters.setVolume(targetVolume);
    return targetVolume;
}
