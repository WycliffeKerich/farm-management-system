<script setup>
import { computed, onMounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { fieldErrors, settingsChanges, settingsFormErrors, supportedValues, toSettingsForm } from '@/utils/settings';
import { formatDateTime, formatMoney } from '@/utils/format';
import { validationMessage } from '@/utils/forms';

const toast = useToast();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const canEdit = computed(() => authStore.hasRole('owner'));

const loading = ref(true);
const saving = ref(false);
const form = ref(toSettingsForm(settingsStore.settings));
const errors = ref({});

const currencies = supportedValues('currency', ['KES', 'UGX', 'TZS', 'USD', 'EUR', 'GBP']);
const timezones = supportedValues('timeZone', ['Africa/Nairobi', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'UTC']);

const changes = computed(() => settingsChanges(settingsStore.settings, form.value));
const dirty = computed(() => Object.keys(changes.value).length > 0);

// How money and times will look with the form's choices
const preview = computed(() => {
    try {
        return {
            money: formatMoney(12500.5, { currency: form.value.currency || undefined }),
            time: formatDateTime(new Date(), { timeZone: form.value.timezone || undefined })
        };
    } catch {
        return null;
    }
});

const reset = () => {
    form.value = toSettingsForm(settingsStore.settings);
    errors.value = {};
};

const load = async () => {
    loading.value = true;
    await settingsStore.load({ force: true });
    reset();
    loading.value = false;
};

const save = async () => {
    errors.value = settingsFormErrors(form.value);
    if (Object.keys(errors.value).length > 0 || !dirty.value) return;

    saving.value = true;
    try {
        await settingsStore.save(changes.value);
        reset();
        toast.add({ severity: 'success', summary: 'Saved', detail: 'Farm settings updated', life: 3000 });
    } catch (error) {
        errors.value = fieldErrors(error);
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to save settings'), life: 5000 });
    } finally {
        saving.value = false;
    }
};

onMounted(load);
</script>

<template>
    <div class="card">
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Farm Settings</h2>
            <p class="text-surface-600 dark:text-surface-400">The farm's name, the currency for money and the time zone for dates</p>
        </div>

        <Message v-if="!canEdit" severity="info" class="mb-6">Only the owner can change these settings.</Message>

        <div v-if="loading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <form v-else class="flex flex-col gap-6 max-w-2xl" @submit.prevent="save">
            <div class="flex flex-col gap-2">
                <label for="farm_name" class="font-medium">Farm name *</label>
                <InputText id="farm_name" v-model="form.farm_name" maxlength="100" :disabled="!canEdit" :invalid="!!errors.farm_name" />
                <small v-if="errors.farm_name" class="text-red-500">{{ errors.farm_name }}</small>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="currency" class="font-medium">Currency *</label>
                    <Select inputId="currency" v-model="form.currency" :options="currencies" filter :disabled="!canEdit" :invalid="!!errors.currency" />
                    <small v-if="errors.currency" class="text-red-500">{{ errors.currency }}</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="timezone" class="font-medium">Time zone *</label>
                    <Select inputId="timezone" v-model="form.timezone" :options="timezones" filter :disabled="!canEdit" :invalid="!!errors.timezone" />
                    <small v-if="errors.timezone" class="text-red-500">{{ errors.timezone }}</small>
                </div>
            </div>

            <div v-if="preview" class="text-sm text-surface-600 dark:text-surface-400">
                Money shows as <strong>{{ preview.money }}</strong
                >; the time now is <strong>{{ preview.time }}</strong
                >.
            </div>

            <fieldset class="flex flex-col gap-2">
                <legend class="font-medium mb-2">Farm location (optional)</legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="latitude" class="text-sm">Latitude</label>
                        <InputNumber inputId="latitude" v-model="form.latitude" :min="-90" :max="90" :minFractionDigits="0" :maxFractionDigits="6" :disabled="!canEdit" :invalid="!!errors.farm_location" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="longitude" class="text-sm">Longitude</label>
                        <InputNumber inputId="longitude" v-model="form.longitude" :min="-180" :max="180" :minFractionDigits="0" :maxFractionDigits="6" :disabled="!canEdit" :invalid="!!errors.farm_location" />
                    </div>
                </div>
                <small v-if="errors.farm_location" class="text-red-500">{{ errors.farm_location }}</small>
                <small v-else class="text-surface-500">Decimal degrees, e.g. -1.2921 and 36.8219; leave both empty if not needed.</small>
            </fieldset>

            <div v-if="canEdit" class="flex gap-2">
                <Button type="submit" label="Save" icon="pi pi-check" :loading="saving" :disabled="!dirty" />
                <Button type="button" label="Discard changes" severity="secondary" :disabled="!dirty || saving" @click="reset" />
            </div>
        </form>
    </div>
</template>
