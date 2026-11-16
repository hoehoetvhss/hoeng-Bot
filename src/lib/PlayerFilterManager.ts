import { filtersConfig } from '../utils/constants.js';

import type { Player } from 'lavashark';
import type { FilterOptions } from 'lavashark/typings/src/@types/index.js';
import type { Bot } from '../@types/index.js';

export type PresetFilterName = keyof typeof filtersConfig;
export type PluginFilterKey = 'normalization' | 'high-pass' | 'low-pass' | 'echo';

export type NormalizationFilterConfig = {
    maxAmplitude: number;
    adaptive: boolean;
};

export type PassFilterConfig = {
    cutoffFrequency: number;
    boostFactor: number;
};

export type EchoFilterConfig = {
    echoLength: number;
    decay: number;
};

export type PluginFilterMap = {
    normalization?: NormalizationFilterConfig;
    'high-pass'?: PassFilterConfig;
    'low-pass'?: PassFilterConfig;
    echo?: EchoFilterConfig;
};

export type GuildFilterState = FilterOptions & {
    equalizer?: number[];
    pluginFilters?: PluginFilterMap;
};

export class PlayerFilterManager {
    readonly #activeFilters = new Map<string, GuildFilterState>();
    readonly #nodeFiltersCache = new Map<string, { filters: string[]; expiresAt: number }>();
    readonly #sessionInitialized = new Set<string>();
    static readonly #CACHE_TTL_MS = 60_000;

    public getActiveFilters(guildId: string): GuildFilterState {
        const state = this.#activeFilters.get(guildId);
        if (!state) return {};

        return {
            ...state,
            pluginFilters: state.pluginFilters ? { ...state.pluginFilters } : undefined,
        };
    }

    public hasActiveFilters(guildId: string): boolean {
        const state = this.#activeFilters.get(guildId);
        if (!state) return false;

        const hasStandard = Object.keys(state).some((key) => key !== 'pluginFilters' && key !== 'volume');
        const hasPlugin = state.pluginFilters ? Object.keys(state.pluginFilters).length > 0 : false;
        return hasStandard || hasPlugin;
    }

    public async getSupportedFilters(player: Player): Promise<string[] | null> {
        const node = player.node;
        if (!node) return null;

        const cached = this.#nodeFiltersCache.get(node.identifier);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.filters;
        }

        try {
            const info = await node.getInfo();
            const filters = Array.isArray(info?.filters) ? info.filters : [];
            this.#nodeFiltersCache.set(node.identifier, {
                filters,
                expiresAt: Date.now() + PlayerFilterManager.#CACHE_TTL_MS,
            });
            return filters;
        } catch {
            return null;
        }
    }

    public async isPluginFilterSupported(player: Player, filterKey: PluginFilterKey): Promise<boolean> {
        const supported = await this.getSupportedFilters(player);
        if (supported === null) return true;
        return supported.includes(filterKey);
    }

    public async applyPreset(player: Player, presetName: PresetFilterName): Promise<PluginFilterKey | null> {
        const preset = filtersConfig[presetName] as GuildFilterState;

        if (preset.pluginFilters) {
            for (const key of Object.keys(preset.pluginFilters) as PluginFilterKey[]) {
                const supported = await this.isPluginFilterSupported(player, key);
                if (!supported) {
                    return key;
                }
            }
        }

        const current = this.getActiveFilters(player.guildId);
        const preservedNormalization = current.pluginFilters?.normalization;
        const nextPluginFilters = preset.pluginFilters ? structuredClone(preset.pluginFilters) : undefined;
        const mergedPluginFilters =
            preservedNormalization && !nextPluginFilters?.normalization
                ? { ...nextPluginFilters, normalization: { ...preservedNormalization } }
                : nextPluginFilters;

        const nextState: GuildFilterState = {
            ...preset,
            equalizer: preset.equalizer ? [...preset.equalizer] : undefined,
            pluginFilters: mergedPluginFilters,
        };

        this.#activeFilters.set(player.guildId, nextState);
        await this.#sendFilters(player, nextState);
        return null;
    }

    public async setPluginFilter<K extends PluginFilterKey>(
        player: Player,
        filterKey: K,
        config: NonNullable<PluginFilterMap[K]>,
    ): Promise<boolean> {
        const supported = await this.isPluginFilterSupported(player, filterKey);
        if (!supported) {
            return false;
        }

        const current = this.getActiveFilters(player.guildId);
        const nextState: GuildFilterState = {
            ...current,
            pluginFilters: {
                ...current.pluginFilters,
                [filterKey]: config,
            },
        };

        this.#activeFilters.set(player.guildId, nextState);
        await this.#sendFilters(player, nextState);
        return true;
    }

    public async removePluginFilter(player: Player, filterKey: PluginFilterKey): Promise<void> {
        const current = this.getActiveFilters(player.guildId);
        if (!current.pluginFilters || !(filterKey in current.pluginFilters)) {
            return;
        }

        const nextPluginFilters = { ...current.pluginFilters };
        delete nextPluginFilters[filterKey];

        const hasRemainingPlugin = Object.keys(nextPluginFilters).length > 0;
        const nextState: GuildFilterState = {
            ...current,
            pluginFilters: hasRemainingPlugin ? nextPluginFilters : undefined,
        };

        const hasRemainingStandard = Object.keys(nextState).some((key) => key !== 'pluginFilters' && key !== 'volume');
        if (!hasRemainingPlugin && !hasRemainingStandard) {
            await this.clearFilters(player, false);
            return;
        }

        this.#activeFilters.set(player.guildId, nextState);
        await this.#sendFilters(player, nextState);
    }

    public async ensureDefaultNormalization(bot: Bot, player: Player): Promise<void> {
        if (this.#sessionInitialized.has(player.guildId)) {
            return;
        }
        this.#sessionInitialized.add(player.guildId);

        const defaultConfig = bot.guildNormalizationManager?.get(player.guildId);
        if (!defaultConfig) {
            return;
        }

        const current = this.getActiveFilters(player.guildId);
        if (current.pluginFilters?.normalization) {
            return;
        }

        await this.setPluginFilter(player, 'normalization', defaultConfig);
    }

    public async clearFilters(player: Player, preserveNormalization = false): Promise<void> {
        const current = this.getActiveFilters(player.guildId);
        const preservedNormalization = preserveNormalization ? current.pluginFilters?.normalization : undefined;

        if (preservedNormalization) {
            const nextState: GuildFilterState = {
                pluginFilters: {
                    normalization: { ...preservedNormalization },
                },
            };
            this.#activeFilters.set(player.guildId, nextState);
            await this.#sendFilters(player, nextState);
            return;
        }

        this.#activeFilters.delete(player.guildId);
        await player.node?.rest.updatePlayer(player.guildId, { filters: { pluginFilters: {} } });
    }

    public clearState(guildId: string): void {
        this.#activeFilters.delete(guildId);
        this.#sessionInitialized.delete(guildId);
    }

    async #sendFilters(player: Player, state: GuildFilterState): Promise<void> {
        const payload: FilterOptions = { ...state };
        delete payload.volume;

        if (state.equalizer) {
            Object.assign(payload, {
                equalizer: state.equalizer.map((gain, band) => ({ band, gain })),
            });
        }

        await player.node?.rest.updatePlayer(player.guildId, { filters: payload });
    }
}

export const playerFilterManager = new PlayerFilterManager();
export default PlayerFilterManager;
