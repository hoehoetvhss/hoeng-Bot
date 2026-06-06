<template>
    <div>
        <h1 class="mb-6 font-display text-xl font-extrabold tracking-wide text-snow">시스템 관리</h1>

        <div class="max-w-140 rounded-2xl bg-panel p-8 shadow">
            <h2 class="mb-1 text-[13px] font-semibold tracking-wide text-muted">점검 공지 브로드캐스트</h2>
            <p class="mb-6 text-sm leading-relaxed text-sub">
                현재 음악이 재생 중인 모든 음성 채널에 점검 공지 임베드를 전송합니다. 봇을 점검하거나 재시작하기 전에 사용자에게 알리는 용도로 사용하세요.
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
                점검 공지 전송
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
        title: '점검 공지 전송',
        message: '모든 활성 음성 채널에 점검 공지를 전송하시겠습니까?',
        confirmLabel: '전송',
        cancelLabel: '취소',
    });
    if (!confirmed) return;

    loading.value = true;
    resultMsg.value = '';

    try {
        const res = await api.createMaintenanceNotice();
        resultMsg.value = `${res.sentGuildCount}개의 서버에 공지를 전송했습니다.`;
        resultSuccess.value = true;
    } catch {
        resultMsg.value = '점검 공지 전송에 실패했습니다.';
        resultSuccess.value = false;
    } finally {
        loading.value = false;
    }
}
</script>
