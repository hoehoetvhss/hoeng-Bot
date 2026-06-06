import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BotIntents, BotRuntime, BotSummary } from '~/composables/useApi';

/**
 * Bot information store.
 * Caches the bot summary (static info) and runtime status (real-time metrics).
 * Pages use this store to share bot data without redundant API calls.
 */
export const useBotStore = defineStore('bot', () => {
    const summary = ref<BotSummary | null>(null);
    const runtime = ref<BotRuntime | null>(null);
    const intents = ref<BotIntents | null>(null);
    const summaryLoading = ref(false);
    const runtimeLoading = ref(false);
    const intentsLoading = ref(false);
    const summaryError = ref('');
    const runtimeError = ref('');
    const intentsError = ref('');

    async function fetchSummary(): Promise<void> {
        summaryLoading.value = true;
        summaryError.value = '';
        try {
            const api = useApi();
            summary.value = await api.getBotSummary();
        } catch {
            summaryError.value = 'Failed to load bot summary.';
        } finally {
            summaryLoading.value = false;
        }
    }

    async function fetchRuntime(): Promise<void> {
        runtimeLoading.value = true;
        runtimeError.value = '';
        try {
            const api = useApi();
            runtime.value = await api.getBotRuntime();
        } catch {
            runtimeError.value = 'Failed to load runtime status.';
        } finally {
            runtimeLoading.value = false;
        }
    }

    async function fetchIntents(): Promise<void> {
        intentsLoading.value = true;
        intentsError.value = '';
        try {
            const api = useApi();
            intents.value = await api.getBotIntents();
        } catch {
            intentsError.value = 'Failed to load intent configuration.';
        } finally {
            intentsLoading.value = false;
        }
    }

    return {
        summary,
        runtime,
        intents,
        summaryLoading,
        runtimeLoading,
        intentsLoading,
        summaryError,
        runtimeError,
        intentsError,
        fetchSummary,
        fetchRuntime,
        fetchIntents,
    };
});
