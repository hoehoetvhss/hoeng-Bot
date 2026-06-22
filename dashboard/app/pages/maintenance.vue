<template>
    <div>
        <h1 class="mb-6 font-display text-xl font-extrabold tracking-wide text-snow">Maintenance</h1>

        <div class="max-w-140 rounded-2xl bg-panel p-8 shadow">
            <h2 class="mb-1 text-[13px] font-semibold tracking-wide text-muted">Broadcast Maintenance Notice</h2>
            <p class="mb-6 text-sm leading-relaxed text-sub">
                Send a maintenance notice embed to all active voice channels. This will notify users in every channel
                where Music Bot is currently playing.
            </p>

            <button
                class="flex items-center gap-2 rounded-xl bg-blurple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blurple-dark disabled:opacity-50"
                :disabled="loading"
                @click="sendNotice"
            >
                <span
                    v-if="loading"
                    class="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                />
                <Icon v-else name="lucide:megaphone" class="size-4" />
                Send Maintenance Notice
            </button>

            <p
                v-if="resultMsg"
                class="mt-4 flex items-center gap-2 text-sm"
                :class="resultSuccess ? 'text-online' : 'text-danger'"
            >
                <Icon :name="resultSuccess ? 'lucide:check-circle' : 'lucide:alert-circle'" class="size-4 shrink-0" />
                {{ resultMsg }}
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useConfirm } from '~/composables/useConfirm';

const api = useApi();
const { confirm } = useConfirm();

const loading = ref(false);
const resultMsg = ref('');
const resultSuccess = ref(true);

async function sendNotice() {
    const confirmed = await confirm({
        title: 'Send Maintenance Notice',
        message: 'Send a maintenance notice to all active voice channels?',
        confirmLabel: 'Send',
        cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    loading.value = true;
    resultMsg.value = '';

    try {
        const res = await api.createMaintenanceNotice();
        resultMsg.value = `Delivered to ${res.sentGuildCount} active guild${res.sentGuildCount === 1 ? '' : 's'}.`;
        resultSuccess.value = true;
    } catch {
        resultMsg.value = 'Failed to send maintenance notice.';
        resultSuccess.value = false;
    } finally {
        loading.value = false;
    }
}
</script>
