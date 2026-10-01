<script setup>
import { computed, onMounted, ref } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import enterpriseService from '@/services/enterprise.service';
import { useAuthStore } from '@/stores/auth.store';
import { useLazyTable } from '@/composables/useLazyTable';
import { validationMessage } from '@/utils/forms';

const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();

const canManage = computed(() => authStore.hasRole(['owner', 'manager']));

const ENTERPRISE_TYPES = ['crops', 'mushrooms', 'poultry', 'dairy', 'livestock', 'apiculture', 'aquaculture', 'other'];
const typeOptions = ENTERPRISE_TYPES.map((value) => ({ label: value.charAt(0).toUpperCase() + value.slice(1), value }));
const typeLabel = (value) => typeOptions.find((option) => option.value === value)?.label || value;
const activeOptions = [
    { label: 'Active', value: true },
    { label: 'Inactive', value: false }
];

const { data, totalRecords, loading, first, rows, sortField, sortOrder, filters, load, onPage, onSort } = useLazyTable((params) => enterpriseService.list(params), {
    sortField: 'name',
    filters: { enterprise_type: null, is_active: null },
    onError: (error) => toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load enterprises'), life: 4000 })
});

const dialog = ref(false);
const saving = ref(false);
const submitted = ref(false);
const editing = ref(null);
const counts = ref(null);

const emptyForm = () => ({ name: '', enterprise_type: null, unit_of_output: '', description: '', is_active: true });
const form = ref(emptyForm());

const openNew = () => {
    editing.value = null;
    counts.value = null;
    form.value = emptyForm();
    submitted.value = false;
    dialog.value = true;
};

const edit = async (enterprise) => {
    editing.value = enterprise;
    counts.value = null;
    form.value = Object.fromEntries(Object.keys(emptyForm()).map((field) => [field, enterprise[field] ?? emptyForm()[field]]));
    submitted.value = false;
    dialog.value = true;
    try {
        counts.value = (await enterpriseService.get(enterprise.id)).data.data;
    } catch {
        counts.value = null;
    }
};

const payload = () => ({
    name: form.value.name.trim(),
    enterprise_type: form.value.enterprise_type,
    unit_of_output: form.value.unit_of_output?.trim() || null,
    description: form.value.description?.trim() || null,
    is_active: form.value.is_active
});

const save = async () => {
    submitted.value = true;
    if (!form.value.name.trim() || !form.value.enterprise_type) return;

    saving.value = true;
    try {
        if (editing.value) {
            await enterpriseService.update(editing.value.id, payload());
            toast.add({ severity: 'success', summary: 'Success', detail: 'Enterprise updated', life: 3000 });
        } else {
            await enterpriseService.create(payload());
            toast.add({ severity: 'success', summary: 'Success', detail: 'Enterprise added', life: 3000 });
        }
        dialog.value = false;
        load();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to save the enterprise'), life: 5000 });
    } finally {
        saving.value = false;
    }
};

const confirmDelete = (enterprise) => {
    confirm.require({
        message: `Delete "${enterprise.name}"? An enterprise with batches, animals or activities cannot be deleted; deactivate it instead.`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await enterpriseService.delete(enterprise.id);
                toast.add({ severity: 'success', summary: 'Success', detail: 'Enterprise deleted', life: 3000 });
                load();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to delete the enterprise'), life: 5000 });
            }
        }
    });
};

onMounted(load);
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Enterprises</h2>
                <p class="text-surface-600 dark:text-surface-400">The farm's lines of business; batches, animals and activities belong to one for costing</p>
            </div>
            <Button v-if="canManage" label="New Enterprise" icon="pi pi-plus" @click="openNew" class="mt-4 md:mt-0" />
        </div>

        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <Select v-model="filters.enterprise_type" :options="typeOptions" optionLabel="label" optionValue="value" placeholder="All types" showClear class="w-full md:w-56" />
            <Select v-model="filters.is_active" :options="activeOptions" optionLabel="label" optionValue="value" placeholder="Active and inactive" showClear class="w-full md:w-56" />
        </div>

        <DataTable
            :value="data"
            lazy
            paginator
            :first="first"
            :rows="rows"
            :totalRecords="totalRecords"
            :loading="loading"
            :sortField="sortField"
            :sortOrder="sortOrder"
            dataKey="id"
            stripedRows
            responsiveLayout="scroll"
            class="p-datatable-sm"
            @page="onPage"
            @sort="onSort"
        >
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-briefcase text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No enterprises yet</p>
                </div>
            </template>

            <Column field="name" header="Name" sortable>
                <template #body="{ data: row }">
                    <span class="font-medium">{{ row.name }}</span>
                    <Tag v-if="!row.is_active" value="Inactive" severity="secondary" class="ml-2" />
                </template>
            </Column>
            <Column field="enterprise_type" header="Type" sortable>
                <template #body="{ data: row }">{{ typeLabel(row.enterprise_type) }}</template>
            </Column>
            <Column field="unit_of_output" header="Output unit">
                <template #body="{ data: row }">{{ row.unit_of_output || '-' }}</template>
            </Column>
            <Column field="description" header="Description">
                <template #body="{ data: row }">
                    <span class="truncate block max-w-md">{{ row.description || '-' }}</span>
                </template>
            </Column>
            <Column v-if="canManage" header="Actions" style="width: 110px">
                <template #body="{ data: row }">
                    <div class="flex gap-1">
                        <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="edit(row)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDelete(row)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="dialog" :header="editing ? 'Edit Enterprise' : 'New Enterprise'" :modal="true" :style="{ width: '560px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="enterprise_name" class="font-medium">Name *</label>
                    <InputText id="enterprise_name" v-model="form.name" maxlength="100" :invalid="submitted && !form.name.trim()" />
                    <small v-if="submitted && !form.name.trim()" class="text-red-500">Name is required</small>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="enterprise_type" class="font-medium">Type *</label>
                        <Select inputId="enterprise_type" v-model="form.enterprise_type" :options="typeOptions" optionLabel="label" optionValue="value" placeholder="Choose" :invalid="submitted && !form.enterprise_type" />
                        <small v-if="submitted && !form.enterprise_type" class="text-red-500">Type is required</small>
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="unit_of_output" class="font-medium">Output unit</label>
                        <InputText id="unit_of_output" v-model="form.unit_of_output" maxlength="20" placeholder="e.g. kg, egg, litre" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="enterprise_description" class="font-medium">Description</label>
                    <Textarea id="enterprise_description" v-model="form.description" rows="3" />
                </div>

                <div class="flex items-center gap-2">
                    <Checkbox inputId="enterprise_active" v-model="form.is_active" :binary="true" />
                    <label for="enterprise_active">Active</label>
                </div>

                <div v-if="counts" class="text-sm text-surface-600 dark:text-surface-400">
                    Holds {{ counts.crop_batch_count }} crop batches, {{ counts.animal_count }} animals, {{ counts.animal_group_count }} groups and {{ counts.activity_count }} activities.
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="dialog = false" :disabled="saving" />
                <Button :label="editing ? 'Update' : 'Create'" @click="save" :loading="saving" />
            </template>
        </Dialog>

        <ConfirmDialog />
    </div>
</template>
