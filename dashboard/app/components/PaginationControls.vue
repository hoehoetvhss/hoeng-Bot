<template>
    <div class="flex items-center justify-between gap-4">
        <button
            class="flex min-w-[110px] items-center justify-center gap-2 rounded-xl bg-hover px-5 py-2 text-sm font-medium text-snow transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="disabled || page <= 1"
            @click="$emit('change', page - 1)"
        >
            <Icon name="lucide:chevron-left" class="size-4" />
            이전
        </button>

        <span class="text-sm text-sub">
            <template v-if="totalPages > 0">{{ page }} / {{ totalPages }} 페이지</template>
            <template v-else>페이지 없음</template>
        </span>

        <button
            class="flex min-w-[110px] items-center justify-center gap-2 rounded-xl bg-hover px-5 py-2 text-sm font-medium text-snow transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="disabled || totalPages === 0 || page >= totalPages"
            @click="$emit('change', page + 1)"
        >
            다음
            <Icon name="lucide:chevron-right" class="size-4" />
        </button>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    page: number;
    totalPages: number;
    disabled?: boolean;
}>();

defineEmits<{
    (event: 'change', page: number): void;
}>();
</script>
