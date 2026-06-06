import { onMounted, onUnmounted, ref, type Ref } from 'vue';

/**
 * Auto-refresh composable with a live countdown timer.
 *
 * Calls `callback` immediately on mount (unless `immediate` is false),
 * then again every `intervalMs` milliseconds.
 * Returns a reactive `countdown` (seconds until the next refresh).
 *
 * Usage:
 * ```ts
 * const { countdown } = useAutoRefresh(10_000, fetchRuntime);
 * // In template: <span>Refresh in {{ countdown }}s</span>
 * ```
 */
export function useAutoRefresh(
    intervalMs: number,
    callback: () => Promise<void> | void,
    options: { immediate?: boolean } = { immediate: true },
): { countdown: Ref<number> } {
    const totalSeconds = Math.ceil(intervalMs / 1000);
    const countdown = ref(totalSeconds);

    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    let nextRefreshAt = 0;

    function resetCountdown(): void {
        nextRefreshAt = Date.now() + intervalMs;
        countdown.value = totalSeconds;
    }

    function startTimers(): void {
        resetCountdown();

        refreshTimer = setInterval(async () => {
            await callback();
            resetCountdown();
        }, intervalMs);

        // Tick every 500ms to keep the countdown accurate
        countdownTimer = setInterval(() => {
            countdown.value = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
        }, 500);
    }

    function stopTimers(): void {
        if (refreshTimer !== null) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        if (countdownTimer !== null) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    }

    onMounted(async () => {
        if (options.immediate !== false) {
            await callback();
        }
        startTimers();
    });

    onUnmounted(stopTimers);

    return { countdown };
}
