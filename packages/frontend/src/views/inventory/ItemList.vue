<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import inventoryService from '@/services/inventory.service';
import PurchaseDialog from '@/components/inventory/PurchaseDialog.vue';
import ItemSupplyFields from '@/components/inventory/ItemSupplyFields.vue';
import { useSupplierOptions } from '@/composables/useSupplierOptions';
import { useAuthStore } from '@/stores/auth.store';
import { daysUntil, fromApiDate, toApiDate } from '@/utils/dates';
import { validationMessage } from '@/utils/forms';
import { MOVEMENT_OPTIONS, formatCurrency, isReducingMovement, itemSupplyFields, toTransactionPayload } from '@/utils/inventory';

const router = useRouter();
const route = useRoute();
const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();

const canManage = computed(() => authStore.hasRole(['owner', 'manager']));
const { suppliers, load: loadSuppliers } = useSupplierOptions();

// State
const loading = ref(false);
const saving = ref(false);
const submitted = ref(false);
const transactionSubmitted = ref(false);
const items = ref([]);
const categories = ref([]);
const itemDialog = ref(false);
const transactionDialog = ref(false);
const editingItem = ref(null);
const selectedItem = ref(null);
const purchaseDialog = ref(false);

// Filters
const filters = ref({
    search: '',
    category_id: null,
    stock_status: null
});

// Forms
const emptyItemForm = () => ({
    name: '',
    category_id: null,
    unit: '',
    current_stock: 0,
    minimum_stock: 0,
    cost_per_unit: null,
    expiry_date: null,
    location: '',
    description: '',
    is_active: true,
    ...itemSupplyFields()
});
const itemForm = ref(emptyItemForm());

const transactionForm = ref({
    movement: null,
    quantity: null,
    notes: ''
});

// Options
const stockStatusOptions = [
    { label: 'Low Stock', value: 'low' },
    { label: 'Out of Stock', value: 'out' },
    { label: 'Well Stocked', value: 'ok' }
];

const unitOptions = ['pcs', 'kg', 'g', 'L', 'mL', 'bags', 'boxes', 'bottles', 'cans', 'rolls'];

// Computed
const stockStatus = (item) => {
    if (item.current_stock <= 0) return 'out';
    if (item.current_stock <= item.minimum_stock) return 'low';
    return 'ok';
};

/** Same rule as the low-stock endpoint, so the dashboard link shows the same items */
const needsRestock = (item) => item.minimum_stock > 0 && item.current_stock <= item.minimum_stock;

/** The item list is small and unpaged, so stock levels are filtered here */
const filteredItems = computed(() => {
    const status = filters.value.stock_status;
    if (!status) return items.value;
    if (status === 'low') return items.value.filter(needsRestock);
    return items.value.filter((item) => stockStatus(item) === status);
});

const statistics = computed(() => {
    const counts = { total: items.value.length, ok: 0, low: 0, out: 0 };
    items.value.forEach((item) => counts[stockStatus(item)]++);
    return counts;
});

const isReducingStock = computed(() => isReducingMovement(transactionForm.value.movement));

const maxTransactionQuantity = computed(() => {
    if (!selectedItem.value || !isReducingStock.value) return undefined;
    return selectedItem.value.current_stock;
});

// Methods
const loadItems = async () => {
    loading.value = true;
    try {
        const params = {};
        if (filters.value.search) params.search = filters.value.search;
        if (filters.value.category_id) params.category_id = filters.value.category_id;

        const response = await inventoryService.getItems(params);
        items.value = response.data.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load items'), life: 3000 });
    } finally {
        loading.value = false;
    }
};

const loadCategories = async () => {
    try {
        const response = await inventoryService.getCategories();
        categories.value = response.data.data || [];
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
};

const openNewItemDialog = () => {
    editingItem.value = null;
    itemForm.value = emptyItemForm();
    submitted.value = false;
    itemDialog.value = true;
};

const editItem = (item) => {
    editingItem.value = item;
    itemForm.value = {
        name: item.name,
        category_id: item.category_id,
        unit: item.unit,
        current_stock: item.current_stock,
        minimum_stock: item.minimum_stock,
        cost_per_unit: item.cost_per_unit,
        expiry_date: fromApiDate(item.expiry_date),
        location: item.location,
        description: item.description,
        is_active: item.is_active,
        ...itemSupplyFields(item)
    };
    submitted.value = false;
    itemDialog.value = true;
};

const closeItemDialog = () => {
    itemDialog.value = false;
    editingItem.value = null;
};

const saveItem = async () => {
    submitted.value = true;
    if (!itemForm.value.name || !itemForm.value.category_id || !itemForm.value.unit) return;

    saving.value = true;
    try {
        const { current_stock, ...fields } = itemForm.value;
        const data = { ...fields, minimum_stock: fields.minimum_stock ?? 0, expiry_date: toApiDate(fields.expiry_date) };
        // The server names the supplier from its id; clearing the id clears the name
        if (!data.default_supplier_id && editingItem.value?.default_supplier_id) data.supplier = null;

        if (editingItem.value) {
            await inventoryService.updateItem(editingItem.value.id, data);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Item updated successfully', life: 3000 });
        } else {
            await inventoryService.createItem({ ...data, current_stock: current_stock || 0 });
            toast.add({ severity: 'success', summary: 'Success', detail: 'Item created successfully', life: 3000 });
        }

        closeItemDialog();
        loadItems();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to save item'), life: 4000 });
    } finally {
        saving.value = false;
    }
};

const viewItem = (item) => {
    router.push({ name: 'inventory-item-detail', params: { id: item.id } });
};

/** Owners and managers receive stock as a batch with its supplier and expiry; others record a plain purchase */
const openAddStock = (item) => {
    if (!canManage.value) {
        openTransactionDialog(item, 'purchase');
        return;
    }
    selectedItem.value = item;
    purchaseDialog.value = true;
};

const openTransactionDialog = (item, movement) => {
    selectedItem.value = item;
    transactionForm.value = { movement, quantity: null, notes: '' };
    transactionSubmitted.value = false;
    transactionDialog.value = true;
};

const saveTransaction = async () => {
    transactionSubmitted.value = true;
    const { movement, quantity, notes } = transactionForm.value;
    if (!movement || !quantity) return;

    if (isReducingStock.value && quantity > selectedItem.value.current_stock) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Quantity cannot exceed current stock', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        await inventoryService.createTransaction(toTransactionPayload(selectedItem.value.id, { movement, quantity, notes: notes || null }));
        toast.add({ severity: 'success', summary: 'Success', detail: 'Transaction recorded successfully', life: 3000 });
        transactionDialog.value = false;
        loadItems();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to record transaction'), life: 4000 });
    } finally {
        saving.value = false;
    }
};

const confirmDelete = (item) => {
    confirm.require({
        message: `Are you sure you want to delete "${item.name}"?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deleteItem(item)
    });
};

const deleteItem = async (item) => {
    try {
        await inventoryService.deleteItem(item.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Item deleted successfully', life: 3000 });
        loadItems();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to delete item'), life: 4000 });
    }
};

// Utility functions
const formatDate = (date) => {
    if (!date) return '-';
    return fromApiDate(date).toLocaleDateString();
};

const getStockSeverity = (item) => ({ out: 'danger', low: 'warn', ok: 'success' })[stockStatus(item)];

const isExpiringSoon = (date) => {
    const days = daysUntil(date);
    return days !== null && days >= 0 && days <= 30;
};

let searchTimeout = null;
const debouncedSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadItems();
    }, 300);
};

// Lifecycle
onMounted(() => {
    if (route.query.low_stock === 'true') {
        filters.value.stock_status = 'low';
    }
    loadItems();
    loadCategories();
    if (canManage.value) loadSuppliers();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Inventory Items</h2>
                <p class="text-surface-600 dark:text-surface-400">Manage all inventory items and stock levels</p>
            </div>
            <Button v-if="canManage" label="New Item" icon="pi pi-plus" @click="openNewItemDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="flex-1">
                <InputText v-model="filters.search" placeholder="Search by name or code..." class="w-full" @input="debouncedSearch" />
            </div>
            <Select v-model="filters.category_id" :options="categories" optionLabel="name" optionValue="id" placeholder="All Categories" class="w-full md:w-48" showClear @change="loadItems" />
            <Select v-model="filters.stock_status" :options="stockStatusOptions" optionLabel="label" optionValue="value" placeholder="All Stock Levels" class="w-full md:w-48" showClear />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Items</p>
                        <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ statistics.total }}</p>
                    </div>
                    <i class="pi pi-box text-3xl text-blue-400"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-600 dark:text-green-400 text-sm font-medium">Well Stocked</p>
                        <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ statistics.ok }}</p>
                    </div>
                    <i class="pi pi-check-circle text-3xl text-green-400"></i>
                </div>
            </div>
            <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-yellow-600 dark:text-yellow-400 text-sm font-medium">Low Stock</p>
                        <p class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{{ statistics.low }}</p>
                    </div>
                    <i class="pi pi-exclamation-triangle text-3xl text-yellow-400"></i>
                </div>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-red-600 dark:text-red-400 text-sm font-medium">Out of Stock</p>
                        <p class="text-2xl font-bold text-red-900 dark:text-red-100">{{ statistics.out }}</p>
                    </div>
                    <i class="pi pi-times-circle text-3xl text-red-400"></i>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <DataTable :value="filteredItems" :loading="loading" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No items found</p>
                </div>
            </template>

            <Column field="item_code" header="Code" sortable style="width: 100px">
                <template #body="{ data }">
                    <span class="font-mono text-sm">{{ data.item_code }}</span>
                </template>
            </Column>

            <Column field="name" header="Name" sortable>
                <template #body="{ data }">
                    <router-link :to="{ name: 'inventory-item-detail', params: { id: data.id } }" class="text-primary font-medium hover:underline">
                        {{ data.name }}
                    </router-link>
                </template>
            </Column>

            <Column field="category_name" header="Category" sortable>
                <template #body="{ data }">
                    <Tag :value="data.category_name || 'Uncategorized'" severity="info" />
                </template>
            </Column>

            <Column field="current_stock" header="Stock Level" sortable>
                <template #body="{ data }">
                    <div class="flex items-center gap-2">
                        <Tag :value="`${data.current_stock} ${data.unit || ''}`" :severity="getStockSeverity(data)" />
                        <i v-if="data.current_stock <= data.minimum_stock" class="pi pi-exclamation-triangle text-yellow-500" v-tooltip.top="'At or below minimum stock'" />
                    </div>
                </template>
            </Column>

            <Column field="minimum_stock" header="Min Stock" sortable>
                <template #body="{ data }"> {{ data.minimum_stock }} {{ data.unit || '' }} </template>
            </Column>

            <Column field="cost_per_unit" header="Cost per Unit" sortable>
                <template #body="{ data }">
                    {{ data.cost_per_unit ? formatCurrency(data.cost_per_unit) : '-' }}
                </template>
            </Column>

            <Column field="expiry_date" header="Expiry" sortable>
                <template #body="{ data }">
                    <span v-if="data.expiry_date" :class="{ 'text-red-500': isExpiringSoon(data.expiry_date) }">
                        {{ formatDate(data.expiry_date) }}
                        <i v-if="isExpiringSoon(data.expiry_date)" class="pi pi-clock ml-1" v-tooltip.top="'Expiring soon'" />
                    </span>
                    <span v-else>-</span>
                </template>
            </Column>

            <Column header="Actions" style="width: 180px">
                <template #body="{ data }">
                    <div class="flex gap-1">
                        <Button icon="pi pi-eye" severity="info" text rounded size="small" @click="viewItem(data)" v-tooltip.top="'View'" />
                        <Button icon="pi pi-plus" severity="success" text rounded size="small" @click="openAddStock(data)" v-tooltip.top="'Add Stock'" />
                        <Button icon="pi pi-minus" severity="warn" text rounded size="small" @click="openTransactionDialog(data, 'usage')" v-tooltip.top="'Use Stock'" :disabled="data.current_stock <= 0" />
                        <template v-if="canManage">
                            <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="editItem(data)" v-tooltip.top="'Edit'" />
                            <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                        </template>
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- New/Edit Item Dialog -->
        <Dialog v-model:visible="itemDialog" :header="editingItem ? 'Edit Item' : 'New Item'" :modal="true" :style="{ width: '650px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="item_name" class="font-medium">Name *</label>
                        <InputText id="item_name" v-model="itemForm.name" class="w-full" :class="{ 'p-invalid': submitted && !itemForm.name }" />
                        <small v-if="submitted && !itemForm.name" class="text-red-500">Name is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="item_code" class="font-medium">Item Code</label>
                        <InputText id="item_code" :modelValue="editingItem?.item_code" class="w-full" placeholder="Assigned when created" disabled />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="item_category" class="font-medium">Category *</label>
                        <Select id="item_category" v-model="itemForm.category_id" :options="categories" optionLabel="name" optionValue="id" placeholder="Select category" class="w-full" :class="{ 'p-invalid': submitted && !itemForm.category_id }" />
                        <small v-if="submitted && !itemForm.category_id" class="text-red-500">Category is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="item_unit" class="font-medium">Unit of Measure *</label>
                        <Select id="item_unit" v-model="itemForm.unit" :options="unitOptions" placeholder="Select unit" class="w-full" editable :class="{ 'p-invalid': submitted && !itemForm.unit }" />
                        <small v-if="submitted && !itemForm.unit" class="text-red-500">Unit is required</small>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="current_stock" class="font-medium">{{ editingItem ? 'Current Stock' : 'Opening Stock' }}</label>
                        <InputNumber id="current_stock" v-model="itemForm.current_stock" :min="0" :maxFractionDigits="2" class="w-full" :disabled="!!editingItem" />
                        <small v-if="editingItem" class="text-surface-500">Record a transaction to change stock</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="minimum_stock" class="font-medium">Minimum Stock</label>
                        <InputNumber id="minimum_stock" v-model="itemForm.minimum_stock" :min="0" :maxFractionDigits="2" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="cost_per_unit" class="font-medium">Cost per Unit</label>
                        <InputNumber id="cost_per_unit" v-model="itemForm.cost_per_unit" :min="0" :minFractionDigits="2" :maxFractionDigits="2" mode="currency" currency="KES" locale="en-KE" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="expiry_date" class="font-medium">Expiry Date</label>
                        <DatePicker id="expiry_date" v-model="itemForm.expiry_date" dateFormat="yy-mm-dd" class="w-full" showButtonBar />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="location" class="font-medium">Storage Location</label>
                    <InputText id="location" v-model="itemForm.location" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="description" class="font-medium">Description</label>
                    <Textarea id="description" v-model="itemForm.description" rows="2" class="w-full" />
                </div>

                <ItemSupplyFields v-model="itemForm" :suppliers="suppliers" :unit="itemForm.unit" idPrefix="item" />

                <div class="flex items-center gap-2">
                    <Checkbox id="is_active" v-model="itemForm.is_active" :binary="true" />
                    <label for="is_active">Active</label>
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="closeItemDialog" :disabled="saving" />
                <Button :label="editingItem ? 'Update' : 'Create'" @click="saveItem" :loading="saving" />
            </template>
        </Dialog>

        <!-- Transaction Dialog -->
        <Dialog v-model:visible="transactionDialog" header="Record Transaction" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg mb-2">
                    <p class="font-medium">{{ selectedItem?.name }}</p>
                    <p class="text-surface-500 text-sm">Current Stock: {{ selectedItem?.current_stock }} {{ selectedItem?.unit || '' }}</p>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="trans_type" class="font-medium">Transaction Type *</label>
                    <Select
                        id="trans_type"
                        v-model="transactionForm.movement"
                        :options="MOVEMENT_OPTIONS"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select type"
                        class="w-full"
                        :class="{ 'p-invalid': transactionSubmitted && !transactionForm.movement }"
                    />
                    <small v-if="transactionSubmitted && !transactionForm.movement" class="text-red-500">Type is required</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="trans_qty" class="font-medium">Quantity *</label>
                    <InputNumber id="trans_qty" v-model="transactionForm.quantity" :min="0.01" :max="maxTransactionQuantity" :maxFractionDigits="2" class="w-full" :class="{ 'p-invalid': transactionSubmitted && !transactionForm.quantity }" />
                    <small v-if="transactionSubmitted && !transactionForm.quantity" class="text-red-500">Quantity is required</small>
                    <small v-if="isReducingStock && transactionForm.quantity > selectedItem?.current_stock" class="text-red-500"> Cannot exceed current stock ({{ selectedItem?.current_stock }}) </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="trans_notes" class="font-medium">Notes</label>
                    <Textarea id="trans_notes" v-model="transactionForm.notes" rows="2" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="transactionDialog = false" :disabled="saving" />
                <Button label="Record" @click="saveTransaction" :loading="saving" />
            </template>
        </Dialog>

        <PurchaseDialog v-model:visible="purchaseDialog" :item="selectedItem" @saved="loadItems" />

        <!-- Delete Confirmation -->
        <ConfirmDialog />
    </div>
</template>
