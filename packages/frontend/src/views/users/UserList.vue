<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import userService from '@/services/user.service';
import { useAuthStore } from '@/stores/auth.store';
import { PASSWORD_MIN, ROLE_OPTIONS, validationMessage } from '@/utils/forms';

const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();

const STATUS_OPTIONS = [
    { label: 'Active', value: true },
    { label: 'Inactive', value: false }
];

const users = ref([]);
const loading = ref(false);
const filters = reactive({ search: '', role: null, is_active: null });
let searchTimer = null;

const emptyForm = () => ({ id: null, first_name: '', last_name: '', email: '', phone: '', role: 'worker', is_active: true, password: '' });
const userDialog = ref(false);
const form = reactive(emptyForm());
const saving = ref(false);
const isNew = computed(() => !form.id);

const passwordDialog = ref(false);
const passwordTarget = ref(null);
const newPassword = ref('');

const isSelf = (user) => user.id === authStore.user?.id;
const roleSeverity = (role) => ({ owner: 'danger', manager: 'warn', worker: 'info' })[role] || 'secondary';
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'Never');

const loadUsers = async () => {
    loading.value = true;
    try {
        const params = {};
        if (filters.search.trim()) params.search = filters.search.trim();
        if (filters.role) params.role = filters.role;
        if (filters.is_active !== null) params.is_active = filters.is_active;
        users.value = await userService.list(params);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(err, 'Failed to load users'), life: 5000 });
    } finally {
        loading.value = false;
    }
};

const onSearch = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadUsers, 300);
};

const openNew = () => {
    Object.assign(form, emptyForm());
    userDialog.value = true;
};

const openEdit = (user) => {
    Object.assign(form, emptyForm(), {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        is_active: user.is_active
    });
    userDialog.value = true;
};

const saveUser = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
        toast.add({ severity: 'warn', summary: 'Validation Error', detail: 'Name and email are required', life: 3000 });
        return;
    }

    const data = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role
    };

    saving.value = true;
    try {
        if (isNew.value) {
            await userService.create({ ...data, password: form.password });
            toast.add({ severity: 'success', summary: 'User created', detail: `${data.first_name} can now sign in`, life: 3000 });
        } else {
            await userService.update(form.id, { ...data, is_active: form.is_active });
            toast.add({ severity: 'success', summary: 'User updated', life: 3000 });
        }
        userDialog.value = false;
        await loadUsers();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Save failed', detail: validationMessage(err, 'Could not save the user'), life: 5000 });
    } finally {
        saving.value = false;
    }
};

const toggleActive = (user) => {
    const activating = !user.is_active;
    confirm.require({
        message: activating ? `Allow ${user.first_name} ${user.last_name} to sign in again?` : `Deactivate ${user.first_name} ${user.last_name}? They will be signed out of every device immediately.`,
        header: activating ? 'Reactivate user' : 'Deactivate user',
        icon: 'pi pi-exclamation-triangle',
        rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
        acceptProps: { label: activating ? 'Reactivate' : 'Deactivate', severity: activating ? 'success' : 'danger' },
        accept: async () => {
            try {
                await userService.update(user.id, { is_active: activating });
                toast.add({ severity: 'success', summary: activating ? 'User reactivated' : 'User deactivated', life: 3000 });
                await loadUsers();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Update failed', detail: validationMessage(err, 'Could not change the user status'), life: 5000 });
            }
        }
    });
};

const openPassword = (user) => {
    passwordTarget.value = user;
    newPassword.value = '';
    passwordDialog.value = true;
};

const savePassword = async () => {
    saving.value = true;
    try {
        await userService.setPassword(passwordTarget.value.id, newPassword.value);
        toast.add({ severity: 'success', summary: 'Password set', detail: `${passwordTarget.value.first_name} has been signed out everywhere`, life: 4000 });
        passwordDialog.value = false;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Password not set', detail: validationMessage(err, 'Could not set the password'), life: 5000 });
    } finally {
        saving.value = false;
    }
};

const confirmRevoke = (user) => {
    confirm.require({
        message: `Sign ${user.first_name} ${user.last_name} out of every device?`,
        header: 'Sign out everywhere',
        icon: 'pi pi-sign-out',
        rejectProps: { label: 'Cancel', severity: 'secondary', outlined: true },
        acceptProps: { label: 'Sign out', severity: 'danger' },
        accept: async () => {
            try {
                const revoked = await userService.revokeSessions(user.id);
                toast.add({ severity: 'success', summary: 'Signed out', detail: `${revoked} session${revoked === 1 ? '' : 's'} ended`, life: 3000 });
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(err, 'Could not sign the user out'), life: 5000 });
            }
        }
    });
};

onMounted(loadUsers);
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Users</h2>
                <p class="text-surface-600 dark:text-surface-400">Who can sign in to the farm, and what they can do</p>
            </div>
            <Button label="Add User" icon="pi pi-plus" class="mt-4 md:mt-0" @click="openNew" />
        </div>

        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <IconField class="w-full md:w-72">
                <InputIcon class="pi pi-search" />
                <InputText v-model="filters.search" placeholder="Search name or email" class="w-full" @input="onSearch" />
            </IconField>
            <Select v-model="filters.role" :options="ROLE_OPTIONS" optionLabel="label" optionValue="value" placeholder="All roles" class="w-full md:w-48" showClear @change="loadUsers" />
            <Select v-model="filters.is_active" :options="STATUS_OPTIONS" optionLabel="label" optionValue="value" placeholder="Any status" class="w-full md:w-48" showClear @change="loadUsers" />
        </div>

        <DataTable :value="users" :loading="loading" dataKey="id" :paginator="users.length > 15" :rows="15" stripedRows class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8 text-surface-600 dark:text-surface-400">No users found</div>
            </template>

            <Column header="Name" sortable sortField="first_name">
                <template #body="{ data }">
                    <div class="font-medium">
                        {{ data.first_name }} {{ data.last_name }}
                        <span v-if="isSelf(data)" class="text-muted-color font-normal">(you)</span>
                    </div>
                    <div class="text-sm text-surface-500">{{ data.phone }}</div>
                </template>
            </Column>
            <Column field="email" header="Email" sortable />
            <Column field="role" header="Role" sortable style="width: 120px">
                <template #body="{ data }">
                    <Tag :value="data.role" :severity="roleSeverity(data.role)" />
                </template>
            </Column>
            <Column field="is_active" header="Status" sortable style="width: 120px">
                <template #body="{ data }">
                    <Tag :value="data.is_active ? 'Active' : 'Inactive'" :severity="data.is_active ? 'success' : 'secondary'" />
                </template>
            </Column>
            <Column field="last_login" header="Last sign-in" sortable style="width: 200px">
                <template #body="{ data }">{{ formatDateTime(data.last_login) }}</template>
            </Column>
            <Column header="Actions" style="width: 200px">
                <template #body="{ data }">
                    <div class="flex gap-1">
                        <Button icon="pi pi-pencil" severity="info" text rounded v-tooltip.top="'Edit'" @click="openEdit(data)" />
                        <Button icon="pi pi-key" severity="secondary" text rounded v-tooltip.top="'Set password'" :disabled="isSelf(data)" @click="openPassword(data)" />
                        <Button icon="pi pi-sign-out" severity="warn" text rounded v-tooltip.top="'Sign out everywhere'" :disabled="isSelf(data)" @click="confirmRevoke(data)" />
                        <Button
                            :icon="data.is_active ? 'pi pi-ban' : 'pi pi-check-circle'"
                            :severity="data.is_active ? 'danger' : 'success'"
                            text
                            rounded
                            v-tooltip.top="data.is_active ? 'Deactivate' : 'Reactivate'"
                            :disabled="isSelf(data)"
                            @click="toggleActive(data)"
                        />
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="userDialog" :header="isNew ? 'Add User' : 'Edit User'" modal :style="{ width: '36rem' }" :breakpoints="{ '575px': '90vw' }">
            <form id="user-form" class="flex flex-col gap-4 mt-2" @submit.prevent="saveUser">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="first_name">First name *</label>
                        <InputText id="first_name" v-model="form.first_name" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="last_name">Last name *</label>
                        <InputText id="last_name" v-model="form.last_name" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="email">Email *</label>
                    <InputText id="email" type="email" v-model="form.email" autocomplete="off" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="phone">Phone</label>
                    <InputText id="phone" v-model="form.phone" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="role">Role *</label>
                    <Select id="role" v-model="form.role" :options="ROLE_OPTIONS" optionLabel="label" optionValue="value" :disabled="!isNew && form.id === authStore.user?.id" />
                    <small class="text-muted-color">Owners manage users; managers run the farm records; workers record day-to-day work.</small>
                </div>
                <div v-if="isNew" class="flex flex-col gap-2">
                    <label for="password">Initial password *</label>
                    <Password inputId="password" v-model="form.password" toggleMask fluid :inputProps="{ autocomplete: 'new-password' }" />
                    <small class="text-muted-color">At least {{ PASSWORD_MIN }} characters. Share it privately; they can change it from their profile.</small>
                </div>
                <div v-else-if="form.id !== authStore.user?.id" class="flex items-center gap-2">
                    <ToggleSwitch inputId="is_active" v-model="form.is_active" />
                    <label for="is_active">Can sign in</label>
                </div>
            </form>
            <template #footer>
                <Button label="Cancel" severity="secondary" text @click="userDialog = false" />
                <Button type="submit" form="user-form" :label="isNew ? 'Create' : 'Save'" icon="pi pi-check" :loading="saving" />
            </template>
        </Dialog>

        <Dialog v-model:visible="passwordDialog" header="Set Password" modal :style="{ width: '28rem' }" :breakpoints="{ '575px': '90vw' }">
            <form id="password-form" class="flex flex-col gap-4 mt-2" @submit.prevent="savePassword">
                <p class="m-0">
                    Set a new password for <strong>{{ passwordTarget?.first_name }} {{ passwordTarget?.last_name }}</strong
                    >. They will be signed out of every device.
                </p>
                <div class="flex flex-col gap-2">
                    <label for="new_password">New password</label>
                    <Password inputId="new_password" v-model="newPassword" toggleMask fluid :inputProps="{ autocomplete: 'new-password' }" />
                    <small class="text-muted-color">At least {{ PASSWORD_MIN }} characters</small>
                </div>
            </form>
            <template #footer>
                <Button label="Cancel" severity="secondary" text @click="passwordDialog = false" />
                <Button type="submit" form="password-form" label="Set password" icon="pi pi-key" :loading="saving" :disabled="newPassword.length < PASSWORD_MIN" />
            </template>
        </Dialog>

        <ConfirmDialog />
    </div>
</template>
