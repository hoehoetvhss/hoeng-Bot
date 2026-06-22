<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="isOpen"
                class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 p-4"
                @click.self="onOverlayClick"
                @keydown.escape.stop="onEscape"
            >
                <Transition
                    enter-active-class="transition duration-150 ease-out"
                    enter-from-class="scale-95 opacity-0"
                    enter-to-class="scale-100 opacity-100"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="scale-100 opacity-100"
                    leave-to-class="scale-95 opacity-0"
                >
                    <div
                        v-if="isOpen"
                        ref="dialogRef"
                        class="w-full max-w-[460px] overflow-hidden rounded-2xl bg-panel shadow-xl"
                        role="dialog"
                        :aria-labelledby="titleId"
                        aria-modal="true"
                        tabindex="-1"
                    >
                        <!-- Header -->
                        <div class="flex items-center justify-between px-6 pb-4 pt-6">
                            <h2 :id="titleId" class="font-display text-lg font-bold text-snow">{{ dialogTitle }}</h2>
                            <button
                                class="flex items-center justify-center rounded p-1 text-muted transition hover:text-snow"
                                aria-label="Close"
                                @click="handleCancel"
                            >
                                <Icon name="lucide:x" class="size-5" />
                            </button>
                        </div>

                        <!-- Body -->
                        <div class="px-6 pb-6">
                            <p class="text-sm leading-relaxed text-sub">{{ dialogMessage }}</p>
                        </div>

                        <!-- Footer -->
                        <div class="flex justify-end gap-3 border-t border-line px-6 py-4">
                            <button
                                v-if="!isAlertMode"
                                class="rounded-xl bg-hover px-5 py-2 text-sm font-medium text-snow transition hover:bg-surface"
                                @click="handleCancel"
                            >
                                {{ cancelLabel }}
                            </button>
                            <button
                                ref="primaryButtonRef"
                                class="rounded-xl px-5 py-2 text-sm font-medium text-white transition"
                                :class="isAlertMode ? 'bg-blurple hover:bg-blurple-dark' : 'bg-danger hover:opacity-85'"
                                @click="handleConfirm"
                            >
                                {{ isAlertMode ? okLabel : confirmLabel }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue';
import { useConfirm } from '~/composables/useConfirm';

const {
    isOpen,
    isAlertMode,
    dialogTitle,
    dialogMessage,
    confirmLabel,
    cancelLabel,
    okLabel,
    handleConfirm,
    handleCancel,
} = useConfirm();

// Unique id for aria-labelledby — prevents collisions if multiple modals ever render
const titleId = useId();

const dialogRef = ref<HTMLElement | null>(null);
const primaryButtonRef = ref<HTMLButtonElement | null>(null);

// Track previously focused element to restore focus on close
let previousFocus: HTMLElement | null = null;

// Move focus into the modal when it opens; restore when it closes
watch(isOpen, async (opened) => {
    if (opened) {
        previousFocus = document.activeElement as HTMLElement | null;
        await nextTick();
        primaryButtonRef.value?.focus();
    } else {
        previousFocus?.focus();
        previousFocus = null;
    }
});

// Clicking the overlay dismisses (cancel) for confirm dialogs, not for alert dialogs
function onOverlayClick() {
    if (!isAlertMode.value) handleCancel();
}

// Escape key dismisses confirm dialogs; alert dialogs require explicit acknowledgement
function onEscape() {
    if (!isAlertMode.value) handleCancel();
}
</script>
