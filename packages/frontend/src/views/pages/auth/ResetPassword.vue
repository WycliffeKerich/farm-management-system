<script setup>
import AuthCard from '@/components/AuthCard.vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import authService from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { PASSWORD_MIN, validationMessage } from '@/utils/forms';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const password = ref('');
const confirm = ref('');
const submitting = ref(false);
const error = ref('');

const submit = async () => {
    error.value = '';
    if (password.value !== confirm.value) {
        error.value = 'Passwords do not match';
        return;
    }

    submitting.value = true;
    try {
        await authService.resetPassword(token.value, password.value);
        // Every session was revoked by the reset, including this browser's
        authStore.clearSession();
        toast.add({ severity: 'success', summary: 'Password reset', detail: 'Sign in with your new password', life: 4000 });
        router.replace({ name: 'login' });
    } catch (err) {
        error.value = validationMessage(err, 'Could not reset the password');
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
    <AuthCard subtitle="Choose a new password">
        <div v-if="!token" class="flex flex-col gap-6">
            <Message severity="error" :closable="false">This reset link is incomplete. Request a new one.</Message>
            <router-link :to="{ name: 'forgot-password' }" class="text-primary font-medium text-center">Request a new link</router-link>
        </div>
        <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
            <Message v-if="error" severity="error" :closable="false">
                {{ error }}
                <router-link :to="{ name: 'forgot-password' }" class="text-primary font-medium ml-1">Request a new link</router-link>
            </Message>
            <div class="flex flex-col gap-2">
                <label for="password" class="font-medium">New password</label>
                <Password inputId="password" v-model="password" toggleMask fluid :inputProps="{ autocomplete: 'new-password' }" />
                <small class="text-muted-color">At least {{ PASSWORD_MIN }} characters</small>
            </div>
            <div class="flex flex-col gap-2">
                <label for="confirm" class="font-medium">Confirm new password</label>
                <Password inputId="confirm" v-model="confirm" :feedback="false" toggleMask fluid :inputProps="{ autocomplete: 'new-password' }" />
            </div>
            <Button type="submit" label="Set new password" class="w-full mt-4" :loading="submitting" :disabled="!password || !confirm" />
        </form>
    </AuthCard>
</template>
