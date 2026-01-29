<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const email = ref('');
const password = ref('');
const checked = ref(false);

const handleLogin = async () => {
    if (!email.value || !password.value) {
        toast.add({
            severity: 'warn',
            summary: 'Validation Error',
            detail: 'Please enter email and password',
            life: 3000
        });
        return;
    }

    const success = await authStore.login(email.value, password.value);

    if (success) {
        toast.add({
            severity: 'success',
            summary: 'Welcome',
            detail: `Logged in as ${authStore.userName}`,
            life: 3000
        });
        router.push('/');
    } else {
        toast.add({
            severity: 'error',
            summary: 'Login Failed',
            detail: authStore.error || 'Invalid credentials',
            life: 5000
        });
    }
};
</script>

<template>
    <FloatingConfigurator />
    <Toast />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <i class="pi pi-sun text-6xl text-primary mb-4"></i>
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Farm Management System</div>
                        <span class="text-muted-color font-medium">Sign in to continue</span>
                    </div>

                    <form @submit.prevent="handleLogin">
                        <label for="email1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
                        <InputText
                            id="email1"
                            type="email"
                            placeholder="Email address"
                            class="w-full md:w-[30rem] mb-8"
                            v-model="email"
                            :disabled="authStore.loading"
                        />

                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password
                            id="password1"
                            v-model="password"
                            placeholder="Password"
                            :toggleMask="true"
                            class="mb-4"
                            fluid
                            :feedback="false"
                            :disabled="authStore.loading"
                        ></Password>

                        <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="checked" id="rememberme1" binary class="mr-2"></Checkbox>
                                <label for="rememberme1">Remember me</label>
                            </div>
                            <span class="font-medium no-underline ml-2 text-right cursor-pointer text-primary">Forgot password?</span>
                        </div>
                        <Button
                            type="submit"
                            label="Sign In"
                            class="w-full"
                            :loading="authStore.loading"
                        />
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
