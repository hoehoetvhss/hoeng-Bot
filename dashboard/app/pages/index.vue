<template>
    <div class="max-w-300">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
            <h1 class="font-display text-xl font-extrabold tracking-wide text-snow">Dashboard</h1>
            <span class="rounded-full bg-blurple/15 px-3 py-1 text-xs font-medium text-blurple-light">
                Refresh in {{ countdown }}s
            </span>
        </div>

        <!-- System Info + Guild Overview -->
        <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- System Info -->
            <div class="rounded-2xl bg-panel p-8 shadow">
                <h2 class="mb-4 text-[13px] font-semibold tracking-wide text-muted">System Information</h2>
                <div v-if="botStore.summaryLoading" class="flex min-h-30 items-center justify-center">
                    <span
                        class="inline-block size-7 animate-spin rounded-full border-[3px] border-line border-t-blurple"
                    />
                </div>
                <ul v-else-if="botStore.summary" class="flex flex-col gap-2.5">
                    <li class="flex justify-between text-sm">
                        <span class="text-muted">Music Disc</span>
                        <span class="font-medium text-snow">{{ botStore.summary.versions.bot }}</span>
                    </li>
                    <li class="flex justify-between text-sm">
                        <span class="text-muted">Node.js</span>
                        <span class="font-medium text-snow">{{ botStore.summary.versions.node }}</span>
                    </li>
                    <li class="flex justify-between text-sm">
                        <span class="text-muted">Discord.js</span>
                        <span class="font-medium text-snow">{{ botStore.summary.versions.discordJs }}</span>
                    </li>
                    <li class="flex justify-between text-sm">
                        <span class="text-muted">LavaShark</span>
                        <span class="font-medium text-snow">{{ botStore.summary.versions.lavashark }}</span>
                    </li>
                    <li class="flex justify-between text-sm">
                        <span class="text-muted">OS</span>
                        <span class="font-medium text-snow">{{ botStore.summary.environment.os }}</span>
                    </li>
                    <li class="flex justify-between text-sm">
                        <span class="text-muted">CPU</span>
                        <span class="font-medium text-snow">{{ botStore.summary.environment.cpu }}</span>
                    </li>
                    <li class="flex justify-between text-sm">
                        <span class="text-muted">Startup Time</span>
                        <span class="font-medium text-snow">{{ startupTimeStr }}</span>
                    </li>
                </ul>
                <p v-else class="text-sm text-danger">{{ botStore.summaryError || 'Failed to load.' }}</p>
            </div>

            <!-- Guild Overview -->
            <div class="rounded-2xl bg-panel p-8 shadow">
                <h2 class="mb-4 text-[13px] font-semibold tracking-wide text-muted">Guild Overview</h2>
                <div v-if="botStore.summaryLoading" class="flex min-h-30 items-center justify-center">
                    <span
                        class="inline-block size-7 animate-spin rounded-full border-[3px] border-line border-t-blurple"
                    />
                </div>
                <template v-else-if="botStore.summary">
                    <div class="mb-4 grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-[11px] font-semibold tracking-wide text-muted">Total Guilds</p>
                            <p class="text-2xl font-bold text-snow">{{ botStore.summary.guilds.total }}</p>
                        </div>
                        <div>
                            <p class="text-[11px] font-semibold tracking-wide text-muted">Shards</p>
                            <p class="text-2xl font-bold text-snow">
                                {{ botStore.summary.guilds.perShard.length || 1 }}
                            </p>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <div
                            v-for="(count, index) in botStore.summary.guilds.perShard"
                            :key="index"
                            class="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs"
                        >
                            <span class="text-muted">Shard {{ index }}</span>
                            <span class="font-semibold text-snow">{{ count }}</span>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- Runtime -->
        <div class="rounded-2xl bg-panel p-8 shadow">
            <h2 class="mb-4 text-[13px] font-semibold tracking-wide text-muted">Runtime</h2>
            <div v-if="botStore.runtimeLoading && !botStore.runtime" class="flex min-h-25 items-center justify-center">
                <span class="inline-block size-7 animate-spin rounded-full border-[3px] border-line border-t-blurple" />
            </div>
            <template v-else-if="botStore.runtime">
                <div class="mb-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <p class="text-[11px] font-semibold tracking-wide text-muted">Uptime</p>
                        <p class="mt-1 text-lg font-bold text-snow">{{ botStore.runtime.uptime }}</p>
                    </div>
                    <div>
                        <p class="text-[11px] font-semibold tracking-wide text-muted">CPU Load</p>
                        <ProgressBar :value="botStore.runtime.load.percent" :label="botStore.runtime.load.detail" />
                    </div>
                    <div>
                        <p class="text-[11px] font-semibold tracking-wide text-muted">RAM</p>
                        <ProgressBar :value="botStore.runtime.memory.percent" :label="botStore.runtime.memory.detail" />
                    </div>
                    <div>
                        <p class="text-[11px] font-semibold tracking-wide text-muted">Heap</p>
                        <ProgressBar :value="botStore.runtime.heap.percent" :label="botStore.runtime.heap.detail" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 border-t border-line pt-4">
                    <div>
                        <p class="text-[11px] font-semibold tracking-wide text-muted">Gateway Ping</p>
                        <p class="mt-0.5 text-sm font-medium text-snow">{{ pingStr }}</p>
                    </div>
                    <div>
                        <p class="text-[11px] font-semibold tracking-wide text-muted">Active Players</p>
                        <p class="mt-0.5 text-sm font-medium text-snow">
                            {{ botStore.runtime.players.total }} ({{ botStore.runtime.players.perShard.join(', ') }})
                        </p>
                    </div>
                </div>
            </template>
            <p v-else class="text-sm text-danger">{{ botStore.runtimeError || 'Failed to load.' }}</p>
        </div>

        <!-- Gateway Intents -->
        <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Standard (non-privileged) Intents -->
            <div class="rounded-2xl bg-panel p-8 shadow">
                <h2 class="mb-1 text-[13px] font-semibold tracking-wide text-muted">Gateway Intents</h2>
                <p class="mb-4 text-xs text-fog">Non-privileged intents required for the Bot</p>

                <div v-if="botStore.intentsLoading" class="flex min-h-20 items-center justify-center">
                    <span
                        class="inline-block size-7 animate-spin rounded-full border-[3px] border-line border-t-blurple"
                    />
                </div>
                <ul v-else-if="botStore.intents" class="flex flex-col divide-y divide-line">
                    <li
                        v-for="intent in standardIntents"
                        :key="intent.name"
                        class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                        <span class="text-sm font-medium text-snow">{{ intent.name }}</span>
                        <div class="flex items-center gap-1.5">
                            <span
                                v-if="intent.required"
                                class="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-sub"
                            >
                                Required
                            </span>
                            <span
                                class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                :class="intentStatusClass(intent, false)"
                            >
                                {{ intentStatusLabel(intent, false) }}
                            </span>
                        </div>
                    </li>
                </ul>
                <p v-else class="text-sm text-danger">{{ botStore.intentsError || 'Failed to load.' }}</p>
            </div>

            <!-- Privileged Intents -->
            <div class="rounded-2xl bg-panel p-8 shadow">
                <h2 class="mb-1 text-[13px] font-semibold tracking-wide text-muted">Privileged Intents</h2>
                <p class="mb-4 text-xs text-fog">High-access intents requiring explicit Discord portal approval</p>

                <!-- Warning banner -->
                <div
                    v-if="botStore.intents?.hasExtraPrivileged"
                    class="mb-4 flex items-start gap-3 rounded-xl bg-warning/10 px-4 py-3"
                >
                    <Icon name="lucide:triangle-alert" class="mt-px size-4 shrink-0 text-warning" />
                    <p class="text-xs text-warning">
                        One or more privileged intents are enabled but not required by the bot. Remove unnecessary
                        privileged intents from your Discord application to reduce security exposure.
                    </p>
                </div>

                <div v-if="botStore.intentsLoading" class="flex min-h-20 items-center justify-center">
                    <span
                        class="inline-block size-7 animate-spin rounded-full border-[3px] border-line border-t-blurple"
                    />
                </div>
                <ul v-else-if="botStore.intents" class="flex flex-col divide-y divide-line">
                    <li
                        v-for="intent in privilegedIntentsList"
                        :key="intent.name"
                        class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                        <span class="text-sm font-medium text-snow">{{ intent.name }}</span>
                        <div class="flex items-center gap-1.5">
                            <span
                                v-if="intent.required"
                                class="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-sub"
                            >
                                Required
                            </span>
                            <span
                                class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                :class="intentStatusClass(intent, true)"
                            >
                                {{ intentStatusLabel(intent, true) }}
                            </span>
                        </div>
                    </li>
                </ul>
                <p v-else class="text-sm text-danger">{{ botStore.intentsError || 'Failed to load.' }}</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { IntentStatus } from '~/composables/useApi';

const botStore = useBotStore();
const { countdown } = useAutoRefresh(3_000, botStore.fetchRuntime, { immediate: false });

const startupTimeStr = computed(() => formatISODateTime(botStore.summary?.startupTime));

const pingStr = computed(() => {
    if (!botStore.runtime) return '-';
    return '[' + botStore.runtime.ping.gateway.join(', ') + '] ms';
});

// Split intents into standard (non-privileged) and privileged for separate display
const standardIntents = computed(() => botStore.intents?.standard ?? []);
const privilegedIntentsList = computed(() => botStore.intents?.privileged ?? []);

function intentStatusClass(intent: IntentStatus, isPrivileged = false): string {
    if (!intent.enabled && intent.required) return 'bg-danger/15 text-danger';
    if (intent.enabled && !intent.required && isPrivileged) return 'bg-warning/15 text-warning';
    if (intent.enabled) return 'bg-online/15 text-online';
    return 'bg-surface text-sub';
}

function intentStatusLabel(intent: IntentStatus, isPrivileged = false): string {
    if (!intent.enabled && intent.required) return 'Missing';
    if (intent.enabled && !intent.required && isPrivileged) return 'Extra';
    if (intent.enabled) return 'Enabled';
    if (isPrivileged) return 'Not Required';
    return 'Inactive';
}

onMounted(async () => {
    await Promise.allSettled([botStore.fetchSummary(), botStore.fetchRuntime(), botStore.fetchIntents()]);
});
</script>
