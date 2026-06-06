import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { LocalNodeProcessState, LocalNodeSummary } from '~/composables/useApi';

/**
 * Local Lavalink node store.
 * Manages the local node feature summary, process state, and control actions
 * (restart / stop) with loading and feedback states.
 */
export const useLocalNodeStore = defineStore('localNode', () => {
    const summary = ref<LocalNodeSummary | null>(null);
    const loading = ref(true);
    const error = ref('');
    const controlLoading = ref(false);
    const controlMessage = ref('');
    const controlSuccess = ref(true);

    async function fetchSummary(): Promise<void> {
        error.value = '';
        try {
            const api = useApi();
            const next = await api.getLocalNodeSummary();
            summary.value = next;
        } catch {
            // Only surface the error if we have never loaded successfully before
            if (!summary.value) {
                error.value = 'Unable to load local node status.';
            }
        } finally {
            loading.value = false;
        }
    }

    async function restart(): Promise<LocalNodeProcessState | null> {
        controlLoading.value = true;
        controlMessage.value = '';
        try {
            const api = useApi();
            const state = await api.ensureLocalNodeProcess(true);
            controlMessage.value = 'Local node restarted successfully.';
            controlSuccess.value = true;
            return state;
        } catch {
            controlMessage.value = 'Failed to restart the local node.';
            controlSuccess.value = false;
            return null;
        } finally {
            controlLoading.value = false;
        }
    }

    async function stop(): Promise<boolean> {
        controlLoading.value = true;
        controlMessage.value = '';
        try {
            const api = useApi();
            await api.stopLocalNodeProcess();
            controlMessage.value = 'Local node stopped.';
            controlSuccess.value = true;
            return true;
        } catch {
            controlMessage.value = 'Failed to stop the local node.';
            controlSuccess.value = false;
            return false;
        } finally {
            controlLoading.value = false;
        }
    }

    function clearControlMessage(): void {
        controlMessage.value = '';
    }

    return {
        summary,
        loading,
        error,
        controlLoading,
        controlMessage,
        controlSuccess,
        fetchSummary,
        restart,
        stop,
        clearControlMessage,
    };
});
