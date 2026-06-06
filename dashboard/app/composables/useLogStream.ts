import { nextTick, ref } from 'vue';
import type { LogEntry, LogQuery, LogsPage } from './useApi';

export type LogScrollSnapshot = { scrollHeight: number; scrollTop: number };

const PAGE_SIZE = 100;

/**
 * Log streaming composable.
 *
 * Encapsulates cursor-based pagination for both the bot log page and the
 * local node log panel, handling:
 *  - Initial fetch (newest PAGE_SIZE entries, descending → reversed to ascending)
 *  - Load-older (scrolling up triggers loading the previous page)
 *  - Periodic refresh (appending only genuinely new entries at the bottom)
 *  - Source-ID change detection (full reset when the log file rotates)
 *
 * DOM scroll interactions are delegated back to the caller via callbacks,
 * keeping this composable free of any component references.
 *
 * @param fetcher - Async function that maps a LogQuery to a LogsPage response.
 */
export function useLogStream(fetcher: (query: LogQuery) => Promise<LogsPage>) {
    const logs = ref<LogEntry[]>([]);
    const loading = ref(true);
    const loadingOlder = ref(false);
    const refreshing = ref(false);
    const hasOlder = ref(false);
    const totalItems = ref(0);
    const sourceId = ref('');

    // Convert descending API order (newest-first) to ascending display order
    function toAscending(entries: LogEntry[]): LogEntry[] {
        return [...entries].reverse();
    }

    /**
     * Fetches the initial page of log entries and calls `onReady` once the
     * component DOM has updated (so the caller can scroll to the bottom).
     *
     * IMPORTANT: `loading.value = false` must be set before calling `onReady`
     * so that the log `<pre>` is rendered in the DOM (not the spinner) when
     * `scrollToBottom()` measures scrollHeight.
     */
    async function fetchInitial(onReady?: () => void): Promise<void> {
        loading.value = true;
        try {
            const page = await fetcher({ limit: PAGE_SIZE });
            logs.value = toAscending(page.items);
            hasOlder.value = page.pagination.hasOlder;
            totalItems.value = page.pagination.totalItems;
            sourceId.value = page.sourceId;
        } catch {
            // Keep the empty state; next auto-refresh may succeed
        } finally {
            loading.value = false;
        }
        // Logs are now visible in DOM — wait one tick then invoke the callback
        await nextTick();
        onReady?.();
    }

    /**
     * Loads the next older page and restores the scroll position so the user
     * stays at the same visual point (content shifts upward as new rows are prepended).
     */
    async function loadOlder(
        captureSnapshot: () => LogScrollSnapshot,
        restoreSnapshot: (s: LogScrollSnapshot) => void,
    ): Promise<void> {
        if (loading.value || loadingOlder.value || !hasOlder.value) return;

        const oldestCursor = logs.value[0]?.cursor;
        if (oldestCursor == null) return;

        const snapshot = captureSnapshot();
        loadingOlder.value = true;
        try {
            const page = await fetcher({ before: oldestCursor, limit: PAGE_SIZE });

            if (sourceId.value && page.sourceId !== sourceId.value) {
                await reset();
                return;
            }

            if (page.items.length === 0) {
                hasOlder.value = false;
                totalItems.value = page.pagination.totalItems;
                return;
            }

            logs.value = [...toAscending(page.items), ...logs.value];
            hasOlder.value = page.pagination.hasOlder;
            totalItems.value = page.pagination.totalItems;
            restoreSnapshot(snapshot);
        } finally {
            loadingOlder.value = false;
        }
    }

    /**
     * Polls for new entries since the current tail cursor.
     * Appends genuinely new entries and optionally scrolls to the bottom if
     * `isNearBottom()` returns true at the time of the call.
     */
    async function refreshLatest(isNearBottom: () => boolean, scrollToBottom: () => void): Promise<void> {
        if (loading.value || refreshing.value) return;

        const latestCursor = logs.value.at(-1)?.cursor ?? 0;
        const shouldScroll = isNearBottom();
        refreshing.value = true;
        try {
            const result = await collectLatestEntries(latestCursor);

            // Source changed — full reset
            if (sourceId.value && result.sourceId !== sourceId.value) {
                await reset();
                if (shouldScroll) {
                    await nextTick();
                    scrollToBottom();
                }
                return;
            }

            totalItems.value = result.totalItems;

            // Total items decreased — log file was rotated or truncated
            if (result.totalItems < latestCursor) {
                await reset();
                if (shouldScroll) {
                    await nextTick();
                    scrollToBottom();
                }
                return;
            }

            if (result.items.length === 0) return;

            const existingCursors = new Set(logs.value.map((e) => e.cursor));
            const newEntries = toAscending(result.items).filter((e) => !existingCursors.has(e.cursor));
            if (newEntries.length === 0) return;

            logs.value = [...logs.value, ...newEntries];
            if (shouldScroll) {
                await nextTick();
                scrollToBottom();
            }
        } catch {
            // Ignore transient refresh failures; the next tick will retry
        } finally {
            refreshing.value = false;
        }
    }

    /** Full reset: re-fetch the latest PAGE_SIZE entries from scratch. */
    async function reset(): Promise<void> {
        loading.value = true;
        try {
            const page = await fetcher({ limit: PAGE_SIZE });
            logs.value = toAscending(page.items);
            hasOlder.value = page.pagination.hasOlder;
            totalItems.value = page.pagination.totalItems;
            sourceId.value = page.sourceId;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Collects all new entries since `latestCursor` by following the
     * descending pagination cursor chain until `hasOlder` is false or the
     * oldest cursor is null (no more entries to fetch).
     * Capped at MAX_REFRESH_PAGES to prevent runaway fetches.
     */
    async function collectLatestEntries(
        latestCursor: number,
    ): Promise<{ items: LogEntry[]; totalItems: number; sourceId: string }> {
        const MAX_REFRESH_PAGES = 10;
        const items: LogEntry[] = [];
        let beforeCursor: number | null = null;
        let collectedTotal = logs.value.length;
        let collectedSourceId = sourceId.value;

        for (let page_n = 0; page_n < MAX_REFRESH_PAGES; page_n++) {
            const page =
                beforeCursor === null
                    ? await fetcher({ after: latestCursor, limit: PAGE_SIZE })
                    : await fetcher({ before: beforeCursor, limit: PAGE_SIZE });

            collectedTotal = page.pagination.totalItems;
            collectedSourceId = page.sourceId;

            if (sourceId.value && page.sourceId !== sourceId.value) break;
            if (page.items.length > 0) items.push(...page.items);
            if (!page.pagination.hasOlder || page.pagination.oldestCursor == null) break;

            beforeCursor = page.pagination.oldestCursor;
        }

        return { items, totalItems: collectedTotal, sourceId: collectedSourceId };
    }

    return {
        logs,
        loading,
        loadingOlder,
        refreshing,
        hasOlder,
        totalItems,
        fetchInitial,
        loadOlder,
        refreshLatest,
    };
}
