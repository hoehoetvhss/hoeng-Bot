import i18next from 'i18next';

import { BaseCommand } from './base/BaseCommand.js';
import { CommandCategory } from '../@types/index.js';
import { embeds } from '../embeds/index.js';

import type { Client } from 'discord.js';
import type { CommandContext } from './base/CommandContext.js';
import type { Bot, CommandMetadata } from '../@types/index.js';

/**
 * Ping command - Shows bot latency
 */
export class PingCommand extends BaseCommand {
    getMetadata(_bot: Bot, lng?: string): CommandMetadata {
        return {
            name: 'ping',
            aliases: [],
            description: i18next.t('commands:CONFIG_PING_DESCRIPTION', { lng }),
            usage: i18next.t('commands:CONFIG_PING_USAGE', { lng }),
            category: CommandCategory.UTILITY,
            voiceChannel: false,
            showHelp: true,
            sendTyping: false,
            options: [],
        };
    }

    protected async run(bot: Bot, client: Client, context: CommandContext): Promise<void> {
        const apiPing = client.ws.ping > 0 ? Math.round(client.ws.ping).toString() : '0';

        if (context.isMessage()) {
            context.react('👍').catch(() => {});
        }

        const startTime = Date.now();
        const sent = await context.reply({
            embeds: [embeds.ping(bot, '...', apiPing, context.language)],
        });

        const roundtrip = sent.createdTimestamp - context.createdTimestamp;
        const latency = roundtrip > 0 ? roundtrip : Math.max(1, Date.now() - startTime);
        const botPing = `${latency}ms`;

        await sent.edit({
            embeds: [embeds.ping(bot, botPing, apiPing, context.language)],
        });
    }
}
