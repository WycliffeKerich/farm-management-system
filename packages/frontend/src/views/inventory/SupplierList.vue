<script setup>
import { ref, computed, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import inventoryService from '@/services/inventory.service';
import { useAuthStore } from '@/stores/auth.store';
import { validationMessage } from '@/utils/forms';

const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();

const canManage = computed(() => authStore.hasRole(['owner', 'manager']));

const loading = ref(false);
const saving = ref(false);
const submitted = ref(false);
const suppliers = ref([]);
const dialog = ref(false);
const editing = ref(null);

const filters = ref({ search: '', include_inactive: false });

const emptyForm = () => ({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    kra_pin: '',
    address: '',
    notes: '',
    is_active: true
});
const form = ref(emptyForm());

const loadSuppliers = async () => {
    loading.value = true;
    try {
        const params = {};
        if (filters.value.search) params.search = filters.value.search;
        if (filters.value.include_inactive) params.include_inactive = true;

        const response = await inventoryService.getSuppliers(params);
        suppliers.value = response.data.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load suppliers'), life: 3000 });
    } finally {
        loading.value = false;
    }
};

const openNew = () => {
    editing.value = null;
    form.value = emptyForm();
    submitted.value = false;
    dialog.value = true;
};

const edit = (supplier) => {
    editing.value = supplier;
    form.value = Object.fromEntries(Object.keys(emptyForm()).map((field) => [field, supplier[field] ?? emptyForm()[field]]));
    submitted.value = false;
    dialog.value = true;
};

const save = async () => {
    submitted.value = true;
    if (!form.value.name.trim()) return;

    saving.value = true;
    try {
        if (editing.value) {
            await inventoryService.updateSupplier(editing.value.id, form.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Supplier updated', life: 3000 });
        } else {
            await inventoryService.createSupplier(form.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Supplier added', life: 3000 });
        }
        dialog.value = false;
        loadSuppliers();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to save supplier'), life: 4000 });
    } finally {
        saving.value = false;
    }
};

const confirmDelete = (supplier) => {
    confirm.require({
        message: `Delete "${supplier.name}"?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => remove(supplier)
    });
};

const remove = async (supplier) => {
    try {
        await inventoryService.deleteSupplier(supplier.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Supplier deleted', life: 3000 });
        loadSuppliers();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to delete supplier'), life: 5000 });
    }
};

let searchTimeout = null;
const debouncedSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadSuppliers, 300);
};

onMounted(loadSuppliers);
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Suppliers</h2>
                <p class="text-surface-600 dark:text-surface-400">Who the farm buys inputs, feed and medicines from</p>
            </div>
            <Button v-if="canManage" label="New Supplier" icon="pi pi-plus" @click="openNew" class="mt-4 md:mt-0" />
        </div>

        <div class="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <InputText v-model="filters.search" placeholder="Search by name, contact or phone..." class="w-full md:flex-1" @input="debouncedSearch" />
            <div class="flex items-center gap-2">
                <Checkbox inputId="include_inactive" v-model="filters.include_inactive" :binary="true" @change="loadSuppliers" />
                <label for="include_inactive">Show inactive</label>
            </div>
        </div>

        <DataTable :value="suppliers" :loading="loading" :paginator="suppliers.length > 10" :rows="10" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-truck text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No suppliers found</p>
                </div>
            </template>

            <Column field="name" header="Name" sortable>
                <template #body="{ data }">
                    <span class="font-medium">{{ data.name }}</span>
                    <Tag v-if="!data.is_active" value="Inactive" severity="secondary" class="ml-2" />
                </template>
            </Column>
            <Column field="contact_person" header="Contact" sortable>
                <template #body="{ data }">{{ data.contact_person || '-' }}</template>
            </Column>
            <Column field="phone" header="Phone">
                <template #body="{ data }">
                    <a v-if="data.phone" :href="`tel:${data.phone}`" class="text-primary hover:underline">{{ data.phone }}</a>
                    <span v-else>-</span>
                </template>
            </Column>
            <Column field="email" header="Email">
                <template #body="{ data }">
                    <a v-if="data.email" :href="`mailto:${data.email}`" class="text-primary hover:underline">{{ data.email }}</a>
                    <span v-else>-</span>
                </template>
            </Column>
            <Column field="kra_pin" header="KRA PIN">
                <template #body="{ data }">{{ data.kra_pin || '-' }}</template>
            </Column>
            <Column field="item_count" header="Items" sortable style="width: 90px" />
            <Column field="batch_count" header="Batches" sortable style="width: 90px" />
            <Column v-if="canManage" header="Actions" style="width: 110px">
                <template #body="{ data }">
                    <div class="flex gap-1">
                        <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="edit(data)" v-tooltip.top="'Edit'" />
                        <Button
                            icon="pi pi-trash"
                            severity="danger"
                            text
                            rounded
                            size="small"
                            :disabled="data.item_count > 0 || data.batch_count > 0"
                            @click="confirmDelete(data)"
                            v-tooltip.top="data.item_count > 0 || data.batch_count > 0 ? 'In use: deactivate instead' : 'Delete'"
                        />
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="dialog" :header="editing ? 'Edit Supplier' : 'New Supplier'" :modal="true" :style="{ width: '600px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="supplier_name" class="font-medium">Name *</label>
                    <InputText id="supplier_name" v-model="form.name" class="w-full" :class="{ 'p-invalid': submitted && !form.name.trim() }" />
                    <small v-if="submitted && !form.name.trim()" class="text-red-500">Name is required</small>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="contact_person" class="font-medium">Contact Person</label>
                        <InputText id="contact_person" v-model="form.contact_person" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="supplier_phone" class="font-medium">Phone</label>
                        <InputText id="supplier_phone" v-model="form.phone" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="supplier_email" class="font-medium">Email</label>
                        <InputText id="supplier_email" v-model="form.email" type="email" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="kra_pin" class="font-medium">KRA PIN</label>
                        <InputText id="kra_pin" v-model="form.kra_pin" class="w-full" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="supplier_address" class="font-medium">Address</label>
                    <Textarea id="supplier_address" v-model="form.address" rows="2" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="supplier_notes" class="font-medium">Notes</label>
                    <Textarea id="supplier_notes" v-model="form.notes" rows="2" class="w-full" />
                </div>

                <div class="flex items-center gap-2">
                    <Checkbox inputId="supplier_active" v-model="form.is_active" :binary="true" />
                    <label for="supplier_active">Active</label>
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
