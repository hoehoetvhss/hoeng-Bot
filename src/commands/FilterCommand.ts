import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ButtonInteraction,
    Collection,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import i18next from 'i18next';

import { BaseCommand } from './base/BaseCommand.js';
import { CommandCategory, SelectButtonId } from '../@types/index.js';
import { embeds } from '../embeds/index.js';
import { playerFilterManager } from '../lib/PlayerFilterManager.js';
import { filtersConfig, PLUGIN_FILTER_LIMITS } from '../utils/constants.js';
import { applyPlayerVolume } from '../utils/functions/playerVolume.js';

import type { Client } from 'discord.js';
import type { Player } from 'lavashark';
import type { Bot, CommandMetadata } from '../@types/index.js';
import type { PluginFilterKey, PresetFilterName } from '../lib/PlayerFilterManager.js';
import type { CommandContext } from './base/CommandContext.js';

export class FilterCommand extends BaseCommand {
    public getMetadata(_bot: Bot, lng?: string): CommandMetadata {
        return {
            name: 'filter',
            aliases: ['eq', 'equalizer'],
            description: i18next.t('commands:CONFIG_FILTER_DESCRIPTION', { lng }),
            usage: i18next.t('commands:CONFIG_FILTER_USAGE', { lng }),
            category: CommandCategory.MUSIC,
            voiceChannel: true,
            showHelp: true,
            sendTyping: true,
            options: [
                {
                    name: 'preset',
                    description: i18next.t('commands:CONFIG_FILTER_SUBCOMMAND_PRESET', { lng }),
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'name',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_DESCRIPTION', { lng }),
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: [
                                ...Object.keys(filtersConfig).map((effectName) => ({
                                    name: effectName,
                                    value: effectName,
                                })),
                                { name: 'clear', value: 'clear' },
                            ],
                        },
                    ],
                },
                {
                    name: 'normalization',
                    description: i18next.t('commands:CONFIG_FILTER_SUBCOMMAND_NORMALIZATION', { lng }),
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'max_amplitude',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_MAX_AMPLITUDE', { lng }),
                            type: ApplicationCommandOptionType.Number,
                            required: false,
                            min_value: PLUGIN_FILTER_LIMITS.normalization.maxAmplitude.min,
                            max_value: PLUGIN_FILTER_LIMITS.normalization.maxAmplitude.max,
                        },
                        {
                            name: 'adaptive',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_ADAPTIVE', { lng }),
                            type: ApplicationCommandOptionType.Boolean,
                            required: false,
                        },
                    ],
                },
                {
                    name: 'highpass',
                    description: i18next.t('commands:CONFIG_FILTER_SUBCOMMAND_HIGHPASS', { lng }),
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'cutoff',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_CUTOFF', { lng }),
                            type: ApplicationCommandOptionType.Integer,
                            required: false,
                            min_value: PLUGIN_FILTER_LIMITS['high-pass'].cutoffFrequency.min,
                            max_value: PLUGIN_FILTER_LIMITS['high-pass'].cutoffFrequency.max,
                        },
                        {
                            name: 'boost',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_BOOST', { lng }),
                            type: ApplicationCommandOptionType.Number,
                            required: false,
                            min_value: PLUGIN_FILTER_LIMITS['high-pass'].boostFactor.min,
                            max_value: PLUGIN_FILTER_LIMITS['high-pass'].boostFactor.max,
                        },
                    ],
                },
                {
                    name: 'lowpass',
                    description: i18next.t('commands:CONFIG_FILTER_SUBCOMMAND_LOWPASS', { lng }),
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'cutoff',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_CUTOFF', { lng }),
                            type: ApplicationCommandOptionType.Integer,
                            required: false,
                            min_value: PLUGIN_FILTER_LIMITS['low-pass'].cutoffFrequency.min,
                            max_value: PLUGIN_FILTER_LIMITS['low-pass'].cutoffFrequency.max,
                        },
                        {
                            name: 'boost',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_BOOST', { lng }),
                            type: ApplicationCommandOptionType.Number,
                            required: false,
                            min_value: PLUGIN_FILTER_LIMITS['low-pass'].boostFactor.min,
                            max_value: PLUGIN_FILTER_LIMITS['low-pass'].boostFactor.max,
                        },
                    ],
                },
                {
                    name: 'echo',
                    description: i18next.t('commands:CONFIG_FILTER_SUBCOMMAND_ECHO', { lng }),
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'length',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_ECHO_LENGTH', { lng }),
                            type: ApplicationCommandOptionType.Number,
                            required: false,
                            min_value: PLUGIN_FILTER_LIMITS.echo.echoLength.min,
                            max_value: PLUGIN_FILTER_LIMITS.echo.echoLength.max,
                        },
                        {
                            name: 'decay',
                            description: i18next.t('commands:CONFIG_FILTER_OPTION_ECHO_DECAY', { lng }),
                            type: ApplicationCommandOptionType.Number,
                            required: false,
                            min_value: PLUGIN_FILTER_LIMITS.echo.decay.min,
                            max_value: PLUGIN_FILTER_LIMITS.echo.decay.max,
                        },
                    ],
                },
                {
                    name: 'status',
                    description: i18next.t('commands:CONFIG_FILTER_SUBCOMMAND_STATUS', { lng }),
                    type: ApplicationCommandOptionType.Subcommand,
                },
                {
                    name: 'clear',
                    description: i18next.t('commands:CONFIG_FILTER_SUBCOMMAND_CLEAR', { lng }),
                    type: ApplicationCommandOptionType.Subcommand,
                },
            ],
        };
    }

    protected async run(bot: Bot, client: Client, context: CommandContext): Promise<void> {
        const player = client.lavashark.getPlayer(context.guild!.id);

        if (!player || !player.playing) {
            await context.replyEphemeralError(bot, context.t('commands:ERROR_NO_PLAYING'));
            return;
        }

        if (context.isInteraction()) {
            await this.#handleInteraction(bot, context, player);
            return;
        }

        await this.#handleMessage(bot, context, player);
    }

    async #handleInteraction(bot: Bot, context: CommandContext, player: Player): Promise<void> {
        const subcommand = context.getSubcommand();

        switch (subcommand) {
            case 'preset': {
                const name = context.getStringOption('name')?.toLowerCase() ?? '';
                await this.#applyPresetOrClear(bot, context, player, name);
                break;
            }
            case 'normalization': {
                const maxAmplitude =
                    context.getNumberOption('max_amplitude') ?? PLUGIN_FILTER_LIMITS.normalization.maxAmplitude.default;
                const adaptive =
                    context.getBooleanOption('adaptive') ?? PLUGIN_FILTER_LIMITS.normalization.adaptive.default;
                await this.#applyNormalization(bot, context, player, maxAmplitude, adaptive);
                break;
            }
            case 'highpass': {
                const cutoff =
                    context.getIntegerOption('cutoff') ?? PLUGIN_FILTER_LIMITS['high-pass'].cutoffFrequency.default;
                const boost = context.getNumberOption('boost') ?? PLUGIN_FILTER_LIMITS['high-pass'].boostFactor.default;
                await this.#applyPassFilter(bot, context, player, 'high-pass', cutoff, boost);
                break;
            }
            case 'lowpass': {
                const cutoff =
                    context.getIntegerOption('cutoff') ?? PLUGIN_FILTER_LIMITS['low-pass'].cutoffFrequency.default;
                const boost = context.getNumberOption('boost') ?? PLUGIN_FILTER_LIMITS['low-pass'].boostFactor.default;
                await this.#applyPassFilter(bot, context, player, 'low-pass', cutoff, boost);
                break;
            }
            case 'echo': {
                const length = context.getNumberOption('length') ?? PLUGIN_FILTER_LIMITS.echo.echoLength.default;
                const decay = context.getNumberOption('decay') ?? PLUGIN_FILTER_LIMITS.echo.decay.default;
                await this.#applyEcho(bot, context, player, length, decay);
                break;
            }
            case 'status': {
                await this.#showStatus(bot, context, player);
                break;
            }
            case 'clear': {
                await this.#applyPresetOrClear(bot, context, player, 'clear');
                break;
            }
            default: {
                await context.replyEphemeralError(bot, context.t('commands:MESSAGE_FILTER_NOT_FOUND'));
                break;
            }
        }
    }

    async #handleMessage(bot: Bot, context: CommandContext, player: Player): Promise<void> {
        const [firstArg, secondArg, thirdArg] = context.args.map((arg) => arg.toLowerCase());

        if (!firstArg) {
            await this.#showFilterSelection(bot, context, player);
            return;
        }

        switch (firstArg) {
            case 'clear': {
                await this.#applyPresetOrClear(bot, context, player, 'clear');
                break;
            }
            case 'status': {
                await this.#showStatus(bot, context, player);
                break;
            }
            case 'normalization': {
                const maxAmplitude = this.#parseOptionalNumber(
                    secondArg,
                    PLUGIN_FILTER_LIMITS.normalization.maxAmplitude.default,
                );
                const adaptive = this.#parseOptionalBoolean(
                    thirdArg,
                    PLUGIN_FILTER_LIMITS.normalization.adaptive.default,
                );
                if (maxAmplitude === null || adaptive === null) {
                    await context.replyError(
                        bot,
                        context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                            param: 'maxAmplitude (0.01~1.0), adaptive (true/false)',
                        }),
                    );
                    return;
                }
                await this.#applyNormalization(bot, context, player, maxAmplitude, adaptive);
                break;
            }
            case 'highpass': {
                const cutoff = this.#parseOptionalNumber(
                    secondArg,
                    PLUGIN_FILTER_LIMITS['high-pass'].cutoffFrequency.default,
                );
                const boost = this.#parseOptionalNumber(
                    thirdArg,
                    PLUGIN_FILTER_LIMITS['high-pass'].boostFactor.default,
                );
                if (cutoff === null || boost === null) {
                    await context.replyError(
                        bot,
                        context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                            param: 'cutoff (1~20000), boost (0.1~5.0)',
                        }),
                    );
                    return;
                }
                await this.#applyPassFilter(bot, context, player, 'high-pass', Math.round(cutoff), boost);
                break;
            }
            case 'lowpass': {
                if (!secondArg && !thirdArg) {
                    await this.#applyPresetOrClear(bot, context, player, 'lowpass');
                    return;
                }
                const cutoff = this.#parseOptionalNumber(
                    secondArg,
                    PLUGIN_FILTER_LIMITS['low-pass'].cutoffFrequency.default,
                );
                const boost = this.#parseOptionalNumber(thirdArg, PLUGIN_FILTER_LIMITS['low-pass'].boostFactor.default);
                if (cutoff === null || boost === null) {
                    await context.replyError(
                        bot,
                        context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                            param: 'cutoff (1~20000), boost (0.1~5.0)',
                        }),
                    );
                    return;
                }
                await this.#applyPassFilter(bot, context, player, 'low-pass', Math.round(cutoff), boost);
                break;
            }
            case 'echo': {
                const length = this.#parseOptionalNumber(secondArg, PLUGIN_FILTER_LIMITS.echo.echoLength.default);
                const decay = this.#parseOptionalNumber(thirdArg, PLUGIN_FILTER_LIMITS.echo.decay.default);
                if (length === null || decay === null) {
                    await context.replyError(
                        bot,
                        context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                            param: 'length (0.05~5.0), decay (0.0~1.0)',
                        }),
                    );
                    return;
                }
                await this.#applyEcho(bot, context, player, length, decay);
                break;
            }
            default: {
                await this.#applyPresetOrClear(bot, context, player, firstArg);
                break;
            }
        }
    }

    async #applyPresetOrClear(bot: Bot, context: CommandContext, player: Player, effectName: string): Promise<void> {
        if (effectName === 'clear') {
            await playerFilterManager.clearFilters(player);
            applyPlayerVolume(bot, player);
            await this.#replyFilterApplied(bot, context, 'clear');
            return;
        }

        if (!Object.keys(filtersConfig).includes(effectName)) {
            await context.replyEphemeralError(bot, context.t('commands:MESSAGE_FILTER_NOT_FOUND'));
            return;
        }

        const unsupportedKey = await playerFilterManager.applyPreset(player, effectName as PresetFilterName);
        if (unsupportedKey) {
            await context.replyEphemeralError(
                bot,
                context.t('commands:MESSAGE_FILTER_PLUGIN_UNSUPPORTED', { filter: unsupportedKey }),
            );
            return;
        }

        applyPlayerVolume(bot, player);
        await this.#replyFilterApplied(bot, context, effectName);
    }

    async #applyNormalization(
        bot: Bot,
        context: CommandContext,
        player: Player,
        maxAmplitude: number,
        adaptive: boolean,
    ): Promise<void> {
        const limits = PLUGIN_FILTER_LIMITS.normalization.maxAmplitude;
        if (!this.#isInRange(maxAmplitude, limits.min, limits.max)) {
            await context.replyEphemeralError(
                bot,
                context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                    param: `maxAmplitude (${limits.min}~${limits.max})`,
                }),
            );
            return;
        }

        const applied = await playerFilterManager.setPluginFilter(player, 'normalization', {
            maxAmplitude,
            adaptive,
        });
        if (!applied) {
            await this.#replyPluginUnsupported(bot, context, 'normalization');
            return;
        }

        applyPlayerVolume(bot, player);
        await this.#replyFilterApplied(
            bot,
            context,
            `normalization (maxAmplitude: ${maxAmplitude}, adaptive: ${adaptive})`,
        );
    }

    async #applyPassFilter(
        bot: Bot,
        context: CommandContext,
        player: Player,
        filterKey: 'high-pass' | 'low-pass',
        cutoffFrequency: number,
        boostFactor: number,
    ): Promise<void> {
        const limits = PLUGIN_FILTER_LIMITS[filterKey];
        if (!this.#isInRange(cutoffFrequency, limits.cutoffFrequency.min, limits.cutoffFrequency.max)) {
            await context.replyEphemeralError(
                bot,
                context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                    param: `cutoff (${limits.cutoffFrequency.min}~${limits.cutoffFrequency.max})`,
                }),
            );
            return;
        }
        if (!this.#isInRange(boostFactor, limits.boostFactor.min, limits.boostFactor.max)) {
            await context.replyEphemeralError(
                bot,
                context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                    param: `boost (${limits.boostFactor.min}~${limits.boostFactor.max})`,
                }),
            );
            return;
        }

        const applied = await playerFilterManager.setPluginFilter(player, filterKey, {
            cutoffFrequency,
            boostFactor,
        });
        if (!applied) {
            await this.#replyPluginUnsupported(bot, context, filterKey);
            return;
        }

        applyPlayerVolume(bot, player);
        await this.#replyFilterApplied(
            bot,
            context,
            `${filterKey} (cutoff: ${cutoffFrequency}Hz, boost: ${boostFactor})`,
        );
    }

    async #applyEcho(
        bot: Bot,
        context: CommandContext,
        player: Player,
        echoLength: number,
        decay: number,
    ): Promise<void> {
        const limits = PLUGIN_FILTER_LIMITS.echo;
        if (!this.#isInRange(echoLength, limits.echoLength.min, limits.echoLength.max)) {
            await context.replyEphemeralError(
                bot,
                context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                    param: `length (${limits.echoLength.min}~${limits.echoLength.max})`,
                }),
            );
            return;
        }
        if (!this.#isInRange(decay, limits.decay.min, limits.decay.max)) {
            await context.replyEphemeralError(
                bot,
                context.t('commands:MESSAGE_FILTER_INVALID_PARAM', {
                    param: `decay (${limits.decay.min}~${limits.decay.max})`,
                }),
            );
            return;
        }

        const applied = await playerFilterManager.setPluginFilter(player, 'echo', {
            echoLength,
            decay,
        });
        if (!applied) {
            await this.#replyPluginUnsupported(bot, context, 'echo');
            return;
        }

        applyPlayerVolume(bot, player);
        await this.#replyFilterApplied(bot, context, `echo (length: ${echoLength}s, decay: ${decay})`);
    }

    async #showStatus(bot: Bot, context: CommandContext, player: Player): Promise<void> {
        if (!playerFilterManager.hasActiveFilters(player.guildId)) {
            await context.replyText(bot, context.t('commands:MESSAGE_FILTER_STATUS_EMPTY'));
            return;
        }

        const active = playerFilterManager.getActiveFilters(player.guildId);
        const lines: string[] = [];

        for (const [key, value] of Object.entries(active)) {
            if (value === undefined || key === 'volume') continue;
            if (key === 'pluginFilters' && typeof value === 'object' && value !== null) {
                for (const [pluginKey, pluginValue] of Object.entries(value)) {
                    if (pluginValue !== undefined) {
                        lines.push(`• **${pluginKey}**: \`${JSON.stringify(pluginValue)}\``);
                    }
                }
            } else if (key === 'equalizer' && Array.isArray(value)) {
                lines.push(`• **equalizer**: \`15 bands\``);
            } else {
                lines.push(`• **${key}**: \`${JSON.stringify(value)}\``);
            }
        }

        await context.replyText(bot, `${context.t('commands:MESSAGE_FILTER_STATUS_TITLE')}\n${lines.join('\n')}`);
    }

    async #showFilterSelection(bot: Bot, context: CommandContext, player: Player): Promise<void> {
        const select = new StringSelectMenuBuilder()
            .setCustomId(SelectButtonId.Filter)
            .setPlaceholder(context.t('commands:MESSAGE_FILTER_SELECT_MODE'))
            .setOptions([
                ...Object.keys(filtersConfig).map((effectName) => ({
                    label: effectName,
                    value: effectName,
                })),
                { label: context.t('commands:LABEL_FILTER_CLEAR'), value: 'clear' },
            ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
        const msg = await context.reply({
            embeds: [embeds.textMsg(bot, context.t('commands:MESSAGE_FILTER_SELECT_LIST'))],
            components: [row.toJSON()],
            allowedMentions: { repliedUser: false },
        });

        const collector = msg.createMessageComponentCollector({
            time: 20000,
            filter: (i) => i.user.id === context.user.id,
        });

        collector.on('collect', async (i: StringSelectMenuInteraction) => {
            if (i.customId !== SelectButtonId.Filter) return;

            const effectName = i.values[0];

            if (effectName === 'clear') {
                await playerFilterManager.clearFilters(player);
                applyPlayerVolume(bot, player);
            } else {
                if (!Object.keys(filtersConfig).includes(effectName)) {
                    await context.reply({
                        embeds: [embeds.textErrorMsg(bot, context.t('commands:MESSAGE_FILTER_NOT_FOUND'))],
                        allowedMentions: { repliedUser: false },
                    });
                    collector.stop();
                    return;
                }

                const unsupportedKey = await playerFilterManager.applyPreset(player, effectName as PresetFilterName);
                if (unsupportedKey) {
                    await i.deferUpdate();
                    await msg
                        .edit({
                            embeds: [
                                embeds.textErrorMsg(
                                    bot,
                                    context.t('commands:MESSAGE_FILTER_PLUGIN_UNSUPPORTED', { filter: unsupportedKey }),
                                ),
                            ],
                            components: [],
                            allowedMentions: { repliedUser: false },
                        })
                        .catch(() => bot.logger.discord(bot.shardId, 'Failed to edit deleted message.'));
                    collector.stop();
                    return;
                }

                applyPlayerVolume(bot, player);
            }

            if (context.isMessage()) {
                await context.react('👍');
            }

            await i.deferUpdate();
            await msg
                .edit({
                    embeds: [embeds.filterMsg(bot, effectName, context.language)],
                    components: [],
                    allowedMentions: { repliedUser: false },
                })
                .catch(() => bot.logger.discord(bot.shardId, 'Failed to edit deleted message.'));

            collector.stop();
        });

        collector.on('end', async (collected: Collection<string, ButtonInteraction>, reason: string) => {
            if (reason === 'time' && collected.size === 0) {
                await msg
                    .edit({
                        embeds: [embeds.textErrorMsg(bot, context.t('commands:ERROR_TIME_EXPIRED'))],
                        components: [],
                        allowedMentions: { repliedUser: false },
                    })
                    .catch(() => bot.logger.discord(bot.shardId, 'Failed to edit deleted message.'));
            }
        });
    }

    async #replyFilterApplied(bot: Bot, context: CommandContext, effectLabel: string): Promise<void> {
        if (context.isMessage()) {
            await context.react('👍');
        }

        await context
            .reply({
                embeds: [embeds.filterMsg(bot, effectLabel, context.language)],
                components: [],
                allowedMentions: { repliedUser: false },
            })
            .catch(() => bot.logger.discord(bot.shardId, 'Failed to edit message.'));
    }

    async #replyPluginUnsupported(bot: Bot, context: CommandContext, filterKey: PluginFilterKey): Promise<void> {
        await context.replyEphemeralError(
            bot,
            context.t('commands:MESSAGE_FILTER_PLUGIN_UNSUPPORTED', { filter: filterKey }),
        );
    }

    #parseOptionalNumber(raw: string | undefined, fallback: number): number | null {
        if (raw === undefined) return fallback;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }

    #parseOptionalBoolean(raw: string | undefined, fallback: boolean): boolean | null {
        if (raw === undefined) return fallback;
        if (raw === 'true' || raw === '1' || raw === 'on') return true;
        if (raw === 'false' || raw === '0' || raw === 'off') return false;
        return null;
    }

    #isInRange(value: number, min: number, max: number): boolean {
        return Number.isFinite(value) && value >= min && value <= max;
    }
}
