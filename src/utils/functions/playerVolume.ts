import type { Player } from 'lavashark';

import type { Bot } from '../../@types/index.js';

export function getTargetVolume(bot: Bot, player: Player): number {
    return player.setting?.volume ?? bot.guildVolumeManager?.get(player.guildId) ?? bot.config.bot.volume.default;
}

export function getEffectiveVolume(bot: Bot, player: Player): number {
    return player.filters.active.volume ?? getTargetVolume(bot, player);
}

export function applyPlayerVolume(bot: Bot, player: Player, volume?: number): number {
    const targetVolume = volume ?? getTargetVolume(bot, player);

    if (player.setting) {
        player.setting.volume = targetVolume;
    }

    player.filters.setVolume(targetVolume);
    return targetVolume;
}
