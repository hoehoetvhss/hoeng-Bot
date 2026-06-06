import { ApiError } from '~/composables/useApi';

/**
 * Global route middleware that enforces authentication.
 *
 * The verified state is cached in Pinia's `useAuthStore` so that
 * only the first page navigation triggers a network round-trip to /api/auth/verify.
 * Subsequent navigations within the same SPA session skip the request entirely.
 *
 * Only a genuine 401 redirects to /login.
 * Network / server errors are silently ignored so that a transient outage
 * does not lock users out of pages they are already authenticated for.
 */
export default defineNuxtRouteMiddleware(async (to) => {
    // Skip the auth check on the login page itself to avoid redirect loops
    if (to.path === '/login') return;

    const authStore = useAuthStore();
    if (authStore.isAuthenticated) return;

    const api = useApi();

    try {
        const session = await api.getSession();
        authStore.setAuthenticated(session.authenticated);

        if (!session.authenticated) {
            return navigateTo('/login');
        }
    } catch (err) {
        authStore.setAuthenticated(false);
        if (err instanceof ApiError && err.isUnauthorized) {
            return navigateTo('/login');
        }
        // For non-401 errors (network failure, 5xx, etc.) do not redirect —
        // the user may still be authenticated; let the page handle the error.
    }
});
