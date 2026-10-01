import { defineStore } from 'pinia';
import { ref } from 'vue';
import settingsService from '@/services/settings.service';
import { configureFormat } from '@/utils/format';

export const DEFAULT_SETTINGS = Object.freeze({ farm_name: 'My Farm', currency: 'KES', timezone: 'Africa/Nairobi', farm_location: null });

/**
 * Farm settings, loaded once per session. Loading them also points money and
 * date formatting at the farm's currency and time zone.
 */
export const useSettingsStore = defineStore('settings', () => {
    const settings = ref({ ...DEFAULT_SETTINGS });
    const loaded = ref(false);
    let loading = null;

    function apply(data) {
        settings.value = { ...DEFAULT_SETTINGS, ...data };
        configureFormat(settings.value);
    }

    /**
     * Fetch the settings unless they are already here. A failure keeps the
     * defaults, so pages still render.
     * @param {{force?: boolean}} [options]
     * @returns {Promise<Object>}
     */
    async function load({ force = false } = {}) {
        if (loaded.value && !force) return settings.value;
        loading ??= settingsService
            .get()
            .then((response) => {
                apply(response.data.data);
                loaded.value = true;
            })
            .catch((error) => console.error('Failed to load settings:', error))
            .finally(() => {
                loading = null;
            });
        await loading;
        return settings.value;
    }

    /**
     * Change some settings (owner only); errors are left to the caller
     * @param {Object} changes
     * @returns {Promise<Object>}
     */
    async function save(changes) {
        const response = await settingsService.update(changes);
        apply(response.data.data);
        loaded.value = true;
        return settings.value;
    }

    return { settings, loaded, load, save };
});
