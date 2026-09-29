import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import authService from '@/services/auth.service';
import { setAccessToken } from '@/services/api';

const errorMessage = (err, fallback) => err?.response?.data?.error?.message || fallback;

/**
 * Authentication state. The access token is held by the api module (memory only);
 * this store holds the signed-in user.
 */
export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const initialized = ref(false);
    let initializing = null;

    // user and the in-memory token are always set and cleared together
    const isAuthenticated = computed(() => !!user.value);
    const userRole = computed(() => user.value?.role || null);
    const userName = computed(() => (user.value ? `${user.value.first_name} ${user.value.last_name}` : ''));

    /**
     * @param {string|string[]} roles
     * @returns {boolean}
     */
    const hasRole = (roles) => {
        if (!user.value) return false;
        return Array.isArray(roles) ? roles.includes(user.value.role) : user.value.role === roles;
    };

    /**
     * @returns {Promise<boolean>} Success
     */
    async function login(email, password) {
        loading.value = true;
        error.value = null;
        try {
            const data = await authService.login(email, password);
            user.value = data.user;
            initialized.value = true;
            return true;
        } catch (err) {
            error.value = errorMessage(err, 'Login failed. Please try again.');
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function logout() {
        try {
            await authService.logout();
        } catch {
            // The local session is cleared regardless
        } finally {
            clearSession();
        }
    }

    async function logoutAll() {
        try {
            await authService.logoutAll();
        } finally {
            clearSession();
        }
    }

    /**
     * Forget the session locally (e.g. after the refresh token was rejected)
     */
    function clearSession() {
        user.value = null;
        setAccessToken(null);
    }

    /**
     * Restore the session from the refresh cookie. Runs once; later calls share the result.
     * @returns {Promise<boolean>} Whether a session was restored
     */
    function initialize() {
        if (initialized.value) return Promise.resolve(isAuthenticated.value);
        if (!initializing) {
            initializing = authService
                .refresh()
                .then((data) => {
                    user.value = data.user;
                    return true;
                })
                .catch(() => {
                    clearSession();
                    return false;
                })
                .finally(() => {
                    initialized.value = true;
                    initializing = null;
                });
        }
        return initializing;
    }

    /**
     * @param {Object} data - { first_name, last_name, phone }
     * @returns {Promise<boolean>} Success
     */
    async function updateProfile(data) {
        loading.value = true;
        error.value = null;
        try {
            user.value = { ...user.value, ...(await authService.updateProfile(data)) };
            return true;
        } catch (err) {
            error.value = errorMessage(err, 'Update failed');
            return false;
        } finally {
            loading.value = false;
        }
    }

    return {
        user,
        loading,
        error,
        initialized,
        isAuthenticated,
        userRole,
        userName,
        hasRole,
        login,
        logout,
        logoutAll,
        clearSession,
        initialize,
        updateProfile
    };
});
