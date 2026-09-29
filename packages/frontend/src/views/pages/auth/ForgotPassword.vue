<script setup>
import AuthCard from '@/components/AuthCard.vue';
import { ref } from 'vue';
import authService from '@/services/auth.service';
import { validationMessage } from '@/utils/forms';

const email = ref('');
const submitting = ref(false);
const sent = ref(false);
const error = ref('');

const submit = async () => {
    error.value = '';
    submitting.value = true;
    try {
        await authService.forgotPassword(email.value);
        // The API answers the same whether or not the account exists
        sent.value = true;
    } catch (err) {
        error.value = validationMessage(err, 'Could not send the reset link. Please try again.');
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
    <AuthCard subtitle="Reset your password">
        <div v-if="sent" class="flex flex-col gap-6">
            <Message severity="success" :closable="false"
                >If <strong>{{ email }}</strong> belongs to an active account, a reset link is on its way. It expires in 30 minutes.</Message
            >
            <router-link :to="{ name: 'login' }" class="text-primary font-medium text-center">Back to sign in</router-link>
        </div>
        <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
            <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
            <p class="text-muted-color m-0">Enter your account email and we will send you a link to choose a new password.</p>
            <div class="flex flex-col gap-2">
                <label for="email" class="font-medium">Email</label>
                <InputText id="email" type="email" v-model="email" autocomplete="username" required />
            </div>
            <Button type="submit" label="Send reset link" class="w-full mt-4" :loading="submitting" :disabled="!email" />
            <router-link :to="{ name: 'login' }" class="text-primary font-medium text-center">Back to sign in</router-link>
        </form>
    </AuthCard>
</template>
