import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Global authentication store.
 * Persists the verified session flag across client-side navigation
 * so only the first page load triggers a network round-trip.
 */
export const useAuthStore = defineStore('auth', () => {
    const isAuthenticated = ref(false);

    function setAuthenticated(value: boolean): void {
        isAuthenticated.value = value;
    }

    return { isAuthenticated, setAuthenticated };
});
