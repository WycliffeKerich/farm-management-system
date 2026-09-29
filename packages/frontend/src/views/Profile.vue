<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import authService from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { PASSWORD_MIN, validationMessage } from '@/utils/forms';

const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();

const profile = reactive({
    first_name: authStore.user?.first_name || '',
    last_name: authStore.user?.last_name || '',
    phone: authStore.user?.phone || ''
});

const passwords = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const changingPassword = ref(false);

const saveProfile = async () => {
    if (!profile.first_name.trim() || !profile.last_name.trim()) {
        toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'First and last name are required', life: 3000 });
        return;
    }
    const ok = await authStore.updateProfile({ first_name: profile.first_name.trim(), last_name: profile.last_name.trim(), phone: profile.phone.trim() || null });
    if (ok) {
        toast.add({ severity: 'success', summary: 'Profile updated', life: 3000 });
    } else {
        toast.add({ severity: 'error', summary: 'Update failed', detail: authStore.error, life: 5000 });
    }
};

const changePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
        toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'New passwords do not match', life: 3000 });
        return;
    }

    changingPassword.value = true;
    try {
        await authService.changePassword(passwords.currentPassword, passwords.newPassword, passwords.confirmPassword);
        Object.assign(passwords, { currentPassword: '', newPassword: '', confirmPassword: '' });
        toast.add({ severity: 'success', summary: 'Password changed', detail: 'Your other devices have been signed out', life: 4000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Password not changed', detail: validationMessage(err, 'Could not change the password'), life: 5000 });
    } finally {
        changingPassword.value = false;
    }
};

const confirmLogoutAll = () => {
    confirm.require({
        message: 'Sign out of every device, including this one?',
        header: 'Sign out everywhere',
        icon: 'pi pi-exclamation-triangle',
        rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
        acceptProps: { label: 'Sign out', severity: 'danger' },
        accept: async () => {
            try {
                await authStore.logoutAll();
            } catch {
                // The local session is cleared either way
            }
            router.push({ name: 'login' });
        }
    });
};
</script>

<template>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div class="card flex flex-col gap-4">
            <div class="font-semibold text-xl">Profile</div>
            <form class="flex flex-col gap-4" @submit.prevent="saveProfile">
                <div class="flex flex-col gap-2">
                    <label for="email">Email</label>
                    <InputText id="email" :modelValue="authStore.user?.email" disabled />
                    <small class="text-muted-color">Ask an owner to change your email address</small>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="first_name">First name</label>
                        <InputText id="first_name" v-model="profile.first_name" autocomplete="given-name" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="last_name">Last name</label>
                        <InputText id="last_name" v-model="profile.last_name" autocomplete="family-name" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="phone">Phone</label>
                    <InputText id="phone" v-model="profile.phone" autocomplete="tel" />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Role</label>
                    <div><Tag :value="authStore.userRole" /></div>
                </div>
                <div class="flex justify-end">
                    <Button type="submit" label="Save profile" icon="pi pi-check" :loading="authStore.loading" />
                </div>
            </form>
        </div>

        <div class="flex flex-col gap-8">
            <div class="card flex flex-col gap-4">
                <div class="font-semibold text-xl">Change password</div>
                <form class="flex flex-col gap-4" @submit.prevent="changePassword">
                    <div class="flex flex-col gap-2">
                        <label for="currentPassword">Current password</label>
                        <Password inputId="currentPassword" v-model="passwords.currentPassword" :feedback="false" toggleMask fluid :inputProps="{ autocomplete: 'current-password' }" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="newPassword">New password</label>
                        <Password inputId="newPassword" v-model="passwords.newPassword" toggleMask fluid :inputProps="{ autocomplete: 'new-password' }" />
                        <small class="text-muted-color">At least {{ PASSWORD_MIN }} characters</small>
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="confirmPassword">Confirm new password</label>
                        <Password inputId="confirmPassword" v-model="passwords.confirmPassword" :feedback="false" toggleMask fluid :inputProps="{ autocomplete: 'new-password' }" />
                    </div>
                    <div class="flex justify-end">
                        <Button type="submit" label="Change password" icon="pi pi-lock" :loading="changingPassword" :disabled="!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword" />
                    </div>
                </form>
            </div>

            <div class="card flex flex-col gap-4">
                <div class="font-semibold text-xl">Sessions</div>
                <p class="m-0 text-muted-color">Lost a phone or signed in on a shared computer? Sign out everywhere and sign back in here.</p>
                <div class="flex justify-end">
                    <Button label="Sign out of all devices" icon="pi pi-sign-out" severity="danger" outlined @click="confirmLogoutAll" />
                </div>
            </div>
        </div>
    </div>
    <ConfirmDialog />
</template>
