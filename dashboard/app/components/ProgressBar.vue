<template>
    <div class="mt-2 flex flex-col gap-1">
        <div class="h-2 overflow-hidden rounded-full bg-bg">
            <div
                class="h-full rounded-full transition-[width] duration-300"
                :class="{
                    'bg-danger': value >= 90,
                    'bg-warning': value >= 70 && value < 90,
                    'bg-online': value < 70,
                }"
                :style="{ width: `${Math.min(value, 100)}%` }"
            />
        </div>
        <span v-if="label" class="text-xs text-muted">{{ label }}</span>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    value: number; // 0–100
    label?: string;
}>();
</script>
