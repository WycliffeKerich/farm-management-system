/**
 * Create the global navigation guard.
 *
 * - Waits for the session to be restored from the refresh cookie (first navigation only)
 * - Sends signed-out users to login, remembering where they were going
 * - Keeps signed-in users away from guest-only pages (login, first-run setup)
 * - Sends users without a required role (`meta.roles` on any matched record) to /auth/access
 *
 * @param {() => Object} getAuthStore - Returns the auth store
 * @returns {Function} vue-router beforeEach guard
 */
export function createAuthGuard(getAuthStore) {
    return async (to) => {
        const auth = getAuthStore();
        await auth.initialize();

        const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
        if (requiresAuth && !auth.isAuthenticated) {
            return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
        }

        if (to.meta.guestOnly && auth.isAuthenticated) {
            return { name: 'dashboard' };
        }

        if (to.matched.some((record) => record.meta.roles && !auth.hasRole(record.meta.roles))) {
            return { name: 'accessDenied' };
        }

        return true;
    };
}

/**
 * Only follow same-app redirects, never to another origin
 * @param {unknown} redirect - The ?redirect= query value
 * @returns {string} A safe in-app path
 */
export function safeRedirect(redirect) {
    // '//host' and '/\host' are protocol-relative URLs to another origin
    return typeof redirect === 'string' && redirect.startsWith('/') && !/^\/[/\\]/.test(redirect) ? redirect : '/';
}
