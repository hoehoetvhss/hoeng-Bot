/**
 * Composable for showing a dismissible confirmation or alert dialog.
 *
 * Uses module-level state (safe for SPA / ssr:false) so any component can
 * trigger a dialog and await the user's choice without prop-drilling.
 *
 * Usage:
 * ```ts
 * const { confirm, alert } = useConfirm();
 *
 * if (await confirm({ title: 'Leave Server', message: 'Are you sure?' })) {
 *   await api.leaveServer(id);
 * }
 * ```
 */

import { readonly, ref } from 'vue';

export interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
}

export interface AlertOptions {
    title: string;
    message: string;
    okLabel?: string;
}

/** Internal dialog state — shared across the entire SPA instance. */
const isOpen = ref(false);
const isAlertMode = ref(false);
const dialogTitle = ref('');
const dialogMessage = ref('');
const confirmLabel = ref('Confirm');
const cancelLabel = ref('Cancel');
const okLabel = ref('OK');

let resolveCallback: ((result: boolean) => void) | null = null;

export const useConfirm = () => {
    /**
     * Shows a two-button confirmation dialog.
     * Resolves `true` when the user presses the confirm button,
     * `false` when they cancel or close the dialog.
     *
     * If called while another dialog is already open, the previous promise
     * is settled with `false` (cancel) before the new dialog opens.
     */
    const confirm = (opts: ConfirmOptions): Promise<boolean> => {
        // Settle any pending dialog to prevent orphaned promises (concurrent calls)
        if (isOpen.value && resolveCallback) {
            resolveCallback(false);
            resolveCallback = null;
        }

        dialogTitle.value = opts.title;
        dialogMessage.value = opts.message;
        confirmLabel.value = opts.confirmLabel ?? 'Confirm';
        cancelLabel.value = opts.cancelLabel ?? 'Cancel';
        isAlertMode.value = false;
        isOpen.value = true;

        return new Promise((resolve) => {
            resolveCallback = resolve;
        });
    };

    /**
     * Shows a single-button alert dialog.
     * Resolves when the user acknowledges (presses OK).
     *
     * If called while another dialog is already open, the previous promise
     * is settled with `false` (cancel) before the new dialog opens.
     */
    const alert = (opts: AlertOptions): Promise<void> => {
        // Settle any pending dialog to prevent orphaned promises (concurrent calls)
        if (isOpen.value && resolveCallback) {
            resolveCallback(false);
            resolveCallback = null;
        }

        dialogTitle.value = opts.title;
        dialogMessage.value = opts.message;
        okLabel.value = opts.okLabel ?? 'OK';
        isAlertMode.value = true;
        isOpen.value = true;

        return new Promise((resolve) => {
            resolveCallback = () => resolve();
        });
    };

    /** Called by the ConfirmModal component when the confirm / OK button is clicked. */
    const handleConfirm = () => {
        isOpen.value = false;
        resolveCallback?.(true);
        resolveCallback = null;
    };

    /** Called by the ConfirmModal component when the cancel button is clicked. */
    const handleCancel = () => {
        isOpen.value = false;
        resolveCallback?.(false);
        resolveCallback = null;
    };

    return {
        // Read-only state consumed by ConfirmModal.vue
        isOpen: readonly(isOpen),
        isAlertMode: readonly(isAlertMode),
        dialogTitle: readonly(dialogTitle),
        dialogMessage: readonly(dialogMessage),
        confirmLabel: readonly(confirmLabel),
        cancelLabel: readonly(cancelLabel),
        okLabel: readonly(okLabel),
        // Methods for pages
        confirm,
        alert,
        // Methods for ConfirmModal component
        handleConfirm,
        handleCancel,
    };
};
