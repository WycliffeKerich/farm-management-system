import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import authService from '@/services/auth.service';

/**
 * Authentication store for managing user state
 */
export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref(null);
    const loading = ref(false);
    const error = ref(null);

    // Getters
    const isAuthenticated = computed(() => !!user.value);
    const userRole = computed(() => user.value?.role || null);
    const userName = computed(() => {
        if (!user.value) return '';
        return `${user.value.first_name} ${user.value.last_name}`;
    });

    // Check if user has a specific role
    const hasRole = (roles) => {
        if (!user.value) return false;
        if (Array.isArray(roles)) {
            return roles.includes(user.value.role);
        }
        return user.value.role === roles;
    };

    // Actions
    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<boolean>} Success status
     */
    async function login(email, password) {
        loading.value = true;
        error.value = null;

        try {
            const response = await authService.login(email, password);

            if (response.success) {
                user.value = response.data.user;
                localStorage.setItem('accessToken', response.data.accessToken);
                return true;
            }

            error.value = response.error?.message || 'Login failed';
            return false;
        } catch (err) {
            error.value = err.response?.data?.error?.message || 'Login failed. Please try again.';
            return false;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Logout user
     */
    async function logout() {
        try {
            await authService.logout();
        } finally {
            user.value = null;
            localStorage.removeItem('accessToken');
        }
    }

    /**
     * Fetch current user from API
     * @returns {Promise<boolean>} Success status
     */
    async function fetchUser() {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            user.value = null;
            return false;
        }

        loading.value = true;
        error.value = null;

        try {
            const response = await authService.getCurrentUser();
            if (response.success) {
                user.value = response.data;
                return true;
            }
            return false;
        } catch (err) {
            user.value = null;
            localStorage.removeItem('accessToken');
            return false;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Update user profile
     * @param {Object} data - Profile data to update
     * @returns {Promise<boolean>} Success status
     */
    async function updateProfile(data) {
        loading.value = true;
        error.value = null;

        try {
            const response = await authService.updateProfile(data);
            if (response.success) {
                user.value = { ...user.value, ...response.data };
                return true;
            }
            error.value = response.error?.message || 'Update failed';
            return false;
        } catch (err) {
            error.value = err.response?.data?.error?.message || 'Update failed';
            return false;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Initialize auth state on app load
     */
    async function initialize() {
        await fetchUser();
    }

    return {
        // State
        user,
        loading,
        error,
        // Getters
        isAuthenticated,
        userRole,
        userName,
        hasRole,
        // Actions
        login,
        logout,
        fetchUser,
        updateProfile,
        initialize
    };
});
