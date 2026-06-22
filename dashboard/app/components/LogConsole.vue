<template>
    <div
        ref="scrollHost"
        class="relative rounded-lg bg-input-bg"
        :class="[
            stretch ? 'h-full' : 'min-h-80 max-h-145',
            nowrap ? 'overflow-auto' : 'overflow-y-auto',
            { 'overflow-hidden': initialLoading && entries.length === 0 },
        ]"
        @scroll="handleScroll"
    >
        <!-- Loading-older indicator -->
        <div
            v-if="loadingOlder"
            class="sticky top-0 z-10 flex items-center justify-center gap-2 border-b border-line bg-input-bg/90 px-4 py-2 text-xs text-sub"
        >
            <span class="inline-block size-3.5 animate-spin rounded-full border-2 border-line border-t-blurple" />
            Loading older logs...
        </div>

        <!-- Initial loading spinner (only shown when there are no entries yet) -->
        <div v-if="initialLoading && entries.length === 0" class="flex h-full min-h-80 items-center justify-center">
            <span class="inline-block size-8 animate-spin rounded-full border-[3px] border-line border-t-blurple" />
        </div>

        <!-- Empty state -->
        <div v-else-if="entries.length === 0" class="flex h-full min-h-80 items-center justify-center text-muted">
            {{ emptyText }}
        </div>

        <!-- Log output -->
        <pre
            v-else
            class="px-4 py-4 font-mono text-[13px] leading-[1.7] text-sub"
            :class="nowrap ? 'whitespace-pre' : 'whitespace-pre-wrap wrap-break-word'"
        ><code v-html="renderedLogs" /></pre>
    </div>
</template>

<script setup lang="ts">
import type { LogEntry } from '~/composables/useApi';

const TOP_THRESHOLD = 96;
const BOTTOM_THRESHOLD = 80;

const props = withDefaults(
    defineProps<{
        entries: LogEntry[];
        initialLoading: boolean;
        loadingOlder?: boolean;
        emptyText?: string;
        /** When true the scroll host fills its parent height instead of using a fixed max-height. */
        stretch?: boolean;
        /** When true disable line wrapping and enable horizontal scrolling (for verbose logs like Lavalink). */
        nowrap?: boolean;
    }>(),
    {
        loadingOlder: false,
        emptyText: 'No logs available.',
        stretch: false,
        nowrap: false,
    },
);

const emit = defineEmits<{
    (event: 'reach-top'): void;
}>();

const scrollHost = ref<HTMLDivElement | null>(null);

const renderedLogs = computed(() => props.entries.map((entry) => ansiToHtml(entry.message)).join('\n'));

function ansiToHtml(text: string): string {
    let result = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\x1B\[(\d+)m/g, (_match, code) => {
            const colorMap: Record<string, string> = {
                '0': '</span>',
                '30': '<span class="ansi-30">',
                '31': '<span class="ansi-31">',
                '32': '<span class="ansi-32">',
                '33': '<span class="ansi-33">',
                '34': '<span class="ansi-34">',
                '35': '<span class="ansi-35">',
                '36': '<span class="ansi-36">',
                '37': '<span class="ansi-37">',
                '1': '<span class="ansi-bold">',
            };
            return colorMap[code] ?? '';
        });
    // Close any spans left open by color codes that have no reset sequence
    const open = (result.match(/<span /g) ?? []).length;
    const close = (result.match(/<\/span>/g) ?? []).length;
    if (open > close) result += '</span>'.repeat(open - close);
    return result;
}

function handleScroll(): void {
    if (!scrollHost.value || props.initialLoading || props.loadingOlder) return;
    if (scrollHost.value.scrollTop <= TOP_THRESHOLD) {
        emit('reach-top');
    }
}

function scrollToBottom(): void {
    nextTick(() => {
        if (!scrollHost.value) return;
        scrollHost.value.scrollTop = scrollHost.value.scrollHeight;
    });
}

function isNearBottom(): boolean {
    if (!scrollHost.value) return true;
    const remaining = scrollHost.value.scrollHeight - scrollHost.value.scrollTop - scrollHost.value.clientHeight;
    return remaining <= BOTTOM_THRESHOLD;
}

function captureSnapshot() {
    if (!scrollHost.value) return { scrollHeight: 0, scrollTop: 0 };
    return { scrollHeight: scrollHost.value.scrollHeight, scrollTop: scrollHost.value.scrollTop };
}

function restoreSnapshot(snapshot: { scrollHeight: number; scrollTop: number }): void {
    nextTick(() => {
        if (!scrollHost.value) return;
        const newScrollHeight = scrollHost.value.scrollHeight;
        scrollHost.value.scrollTop = newScrollHeight - snapshot.scrollHeight + snapshot.scrollTop;
    });
}

defineExpose({ captureSnapshot, isNearBottom, restoreSnapshot, scrollToBottom });
</script>
