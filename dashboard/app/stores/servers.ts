import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ServerListItem } from '~/composables/useApi';

interface Pagination {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

/** Cached data is considered stale after this duration and will be re-fetched on next mount. */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Server (guild) list store.
 * Manages pagination state, filter state, and the fetched server list.
 * Pagination and filter settings persist across navigations so users
 * return to the same view when they come back from a detail page.
 */
export const useServersStore = defineStore('servers', () => {
    const items = ref<ServerListItem[]>([]);
    const pagination = ref<Pagination>({
        page: 1,
        pageSize: 24,
        totalItems: 0,
        totalPages: 0,
    });
    const loading = ref(false);
    const error = ref('');
    const page = ref(1);
    const pageSize = ref(24);
    const guildIdFilter = ref('');
    const playingFilter = ref<boolean | undefined>(undefined);
    /** Unix timestamp (ms) of the last successful fetch, or null if never fetched. */
    const fetchedAt = ref<number | null>(null);

    /** True when the cached data should be refreshed (never fetched, or TTL has expired). */
    const isStale = computed(() => {
        if (items.value.length === 0 || fetchedAt.value === null) return true;
        return Date.now() - fetchedAt.value > CACHE_TTL_MS;
    });

    async function fetch(): Promise<void> {
        loading.value = true;
        try {
            const api = useApi();
            const result = await api.getServers({
                page: page.value,
                pageSize: pageSize.value,
                guildId: guildIdFilter.value || undefined,
                playing: playingFilter.value,
            });
            items.value = result.items;
            pagination.value = result.pagination;
            fetchedAt.value = Date.now();
            error.value = '';
        } catch {
            error.value = 'Failed to load server list.';
        } finally {
            loading.value = false;
        }
    }

    function setPage(p: number): void {
        page.value = p;
    }

    function setFilters(options: { guildId?: string; playing?: boolean | undefined }): void {
        guildIdFilter.value = options.guildId ?? '';
        playingFilter.value = options.playing;
        // Reset to page 1 when filters change
        page.value = 1;
    }

    return {
        items,
        pagination,
        loading,
        error,
        page,
        pageSize,
        guildIdFilter,
        playingFilter,
        fetchedAt,
        isStale,
        fetch,
        setPage,
        setFilters,
    };
});
