import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { NodeStatus } from '~/composables/useApi';

/**
 * Lavalink nodes store.
 * Holds the current list of node statuses fetched from /api/nodes.
 */
export const useNodesStore = defineStore('nodes', () => {
    const items = ref<NodeStatus[]>([]);
    const loading = ref(true);
    const error = ref('');

    async function fetch(): Promise<void> {
        // Only show full-page loader on the very first fetch
        if (items.value.length === 0) loading.value = true;
        error.value = '';

        try {
            const api = useApi();
            items.value = (await api.getNodes()).items;
        } catch {
            error.value = 'Failed to load node status.';
        } finally {
            loading.value = false;
        }
    }

    return { items, loading, error, fetch };
});
