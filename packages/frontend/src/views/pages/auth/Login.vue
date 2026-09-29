<script setup>
import AuthCard from '@/components/AuthCard.vue';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useToast } from 'primevue/usetoast';
import authService from '@/services/auth.service';
import { safeRedirect } from '@/router/guard';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();

const email = ref('');
const password = ref('');

// A fresh install has no users yet: send the visitor to create the owner account
onMounted(async () => {
    try {
        if (await authService.needsSetup()) {
            router.replace({ name: 'setup' });
        }
    } catch {
        // Login still works if the check fails
    }
});

const handleLogin = async () => {
    if (!email.value || !password.value) {
        toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please enter email and password', life: 3000 });
        return;
    }

    if (await authStore.login(email.value, password.value)) {
        router.push(safeRedirect(route.query.redirect));
    } else {
        toast.add({ severity: 'error', summary: 'Login Failed', detail: authStore.error || 'Invalid credentials', life: 5000 });
    }
};
</script>

<template>
    <AuthCard subtitle="Sign in to continue">
        <form @submit.prevent="handleLogin">
            <label for="email" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
            <InputText id="email" type="email" autocomplete="username" placeholder="Email address" class="w-full mb-8" v-model="email" :disabled="authStore.loading" />

            <label for="password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
            <Password inputId="password" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false" :disabled="authStore.loading" :inputProps="{ autocomplete: 'current-password' }" />

            <div class="flex items-center justify-end mt-2 mb-8">
                <router-link :to="{ name: 'forgot-password' }" class="font-medium no-underline text-right text-primary">Forgot password?</router-link>
            </div>
            <Button type="submit" label="Sign In" class="w-full" :loading="authStore.loading" />
        </form>
    </AuthCard>
</template>
