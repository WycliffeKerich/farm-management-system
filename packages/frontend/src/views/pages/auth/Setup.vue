<script setup>
import AuthCard from '@/components/AuthCard.vue';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import authService from '@/services/auth.service';
import { PASSWORD_MIN, validationMessage } from '@/utils/forms';

const router = useRouter();
const toast = useToast();

const form = reactive({ first_name: '', last_name: '', email: '', phone: '', password: '', confirm: '' });
const submitting = ref(false);
const error = ref('');

// Setup is only possible on an empty database
onMounted(async () => {
    try {
        if (!(await authService.needsSetup())) {
            router.replace({ name: 'login' });
        }
    } catch {
        // Let the submit report the problem
    }
});

const submit = async () => {
    error.value = '';
    if (form.password !== form.confirm) {
        error.value = 'Passwords do not match';
        return;
    }

    submitting.value = true;
    try {
        const { confirm, ...data } = form; // eslint-disable-line no-unused-vars
        await authService.bootstrap({ ...data, phone: data.phone || undefined });
        toast.add({ severity: 'success', summary: 'Owner account created', detail: 'Sign in with your new account', life: 4000 });
        router.replace({ name: 'login' });
    } catch (err) {
        error.value = validationMessage(err, 'Could not create the owner account');
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
    <AuthCard subtitle="Welcome! Create the owner account to get started.">
        <form class="flex flex-col gap-4" @submit.prevent="submit">
            <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="first_name" class="font-medium">First name</label>
                    <InputText id="first_name" v-model="form.first_name" autocomplete="given-name" required />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="last_name" class="font-medium">Last name</label>
                    <InputText id="last_name" v-model="form.last_name" autocomplete="family-name" required />
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <label for="email" class="font-medium">Email</label>
                <InputText id="email" type="email" v-model="form.email" autocomplete="username" required />
            </div>
            <div class="flex flex-col gap-2">
                <label for="phone" class="font-medium">Phone <span class="text-muted-color">(optional)</span></label>
                <InputText id="phone" v-model="form.phone" autocomplete="tel" />
            </div>
            <div class="flex flex-col gap-2">
                <label for="password" class="font-medium">Password</label>
                <Password inputId="password" v-model="form.password" toggleMask fluid :inputProps="{ autocomplete: 'new-password' }" />
                <small class="text-muted-color">At least {{ PASSWORD_MIN }} characters</small>
            </div>
            <div class="flex flex-col gap-2">
                <label for="confirm" class="font-medium">Confirm password</label>
                <Password inputId="confirm" v-model="form.confirm" :feedback="false" toggleMask fluid :inputProps="{ autocomplete: 'new-password' }" />
            </div>
            <Button type="submit" label="Create owner account" class="w-full mt-4" :loading="submitting" />
        </form>
    </AuthCard>
</template>
