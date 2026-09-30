<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import inventoryService from '@/services/inventory.service';
import PurchaseDialog from '@/components/inventory/PurchaseDialog.vue';
import ItemSupplyFields from '@/components/inventory/ItemSupplyFields.vue';
import { useSupplierOptions } from '@/composables/useSupplierOptions';
import { useAuthStore } from '@/stores/auth.store';
import { daysUntil, fromApiDate, toApiDate } from '@/utils/dates';
import { validationMessage } from '@/utils/forms';
import {
    MOVEMENT_OPTIONS,
    REFERENCE_TYPE_OPTIONS,
    TRANSACTION_TYPE_OPTIONS,
    formatCurrency,
    formatReferenceType,
    formatSignedQuantity,
    formatTransactionType,
    isReducingMovement,
    itemSupplyFields,
    signedQuantity,
    summariseUsage,
    toTransactionPayload,
    transactionSeverity,
    withdrawalSummary
} from '@/utils/inventory';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const canManage = computed(() => authStore.hasRole(['owner', 'manager']));
const { suppliers, load: loadSuppliers } = useSupplierOptions();

// State
const loading = ref(true);
const loadingTransactions = ref(false);
const loadingUsage = ref(false);
const loadingBatches = ref(false);
const saving = ref(false);
const item = ref(null);
const transactions = ref([]);
const usageReport = ref(null);
const categories = ref([]);
const batches = ref([]);

// Dialogs
const transactionDialog = ref(false);
const editDialog = ref(false);
const purchaseDialog = ref(false);
const transactionSubmitted = ref(false);
const editSubmitted = ref(false);

// Forms
const emptyTransactionForm = (movement = null) => ({
    movement,
    quantity: null,
    transaction_date: new Date(),
    reference_type: null,
    reference_id: null,
    notes: ''
});
const transactionForm = ref(emptyTransactionForm());
const editForm = ref({});

// Filters
const transactionFilters = ref({ type: null });
const usageFilters = ref({
    date_from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    date_to: new Date()
});

const unitOptions = ['pcs', 'kg', 'g', 'L', 'mL', 'bags', 'boxes', 'bottles', 'cans', 'rolls'];

// Computed
const isReducingStock = computed(() => isReducingMovement(transactionForm.value.movement));

const maxTransactionQuantity = computed(() => {
    if (!item.value || !isReducingStock.value) return undefined;
    return item.value.current_stock;
});

/** Active batches with stock: usage then comes out of them, earliest expiry first */
const usableBatches = computed(() => batches.value.filter((batch) => batch.status === 'active' && batch.quantity > 0));
const usesBatches = computed(() => transactionForm.value.movement === 'usage' && usableBatches.value.length > 0);

const usage = computed(() => summariseUsage(usageReport.value));

const safetyIntervals = computed(() => [withdrawalSummary(item.value, 'crop'), withdrawalSummary(item.value, 'animal')].filter(Boolean).join(' · '));

// Methods
const loadItem = async () => {
    loading.value = true;
    try {
        const response = await inventoryService.getItemById(route.params.id);
        item.value = response.data.data;
        loadTransactions();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load item'), life: 3000 });
    } finally {
        loading.value = false;
    }
};

const loadTransactions = async () => {
    loadingTransactions.value = true;
    try {
        const params = {};
        if (transactionFilters.value.type) {
            params.transaction_type = transactionFilters.value.type;
        }
        const response = await inventoryService.getItemTransactions(route.params.id, params);
        transactions.value = response.data.data || [];
    } catch (error) {
        console.error('Failed to load transactions:', error);
    } finally {
        loadingTransactions.value = false;
    }
};

const loadUsageReport = async () => {
    loadingUsage.value = true;
    try {
        const dateFrom = toApiDate(usageFilters.value.date_from);
        const dateTo = toApiDate(usageFilters.value.date_to);
        const response = await inventoryService.getUsageReport(route.params.id, dateFrom, dateTo);
        usageReport.value = response.data.data || {};
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load usage report'), life: 3000 });
    } finally {
        loadingUsage.value = false;
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

/** Owners and managers receive stock as a batch with its supplier and expiry; others record a plain purchase */
const openAddStock = () => {
    if (canManage.value) purchaseDialog.value = true;
    else openTransactionDialog('purchase');
};

const onPurchased = () => {
    loadBatches();
    loadItem();
};

const openTransactionDialog = (movement) => {
    transactionForm.value = emptyTransactionForm(movement);
    transactionSubmitted.value = false;
    transactionDialog.value = true;
};

const saveTransaction = async () => {
    transactionSubmitted.value = true;
    const { movement, quantity } = transactionForm.value;
    if (!movement || !quantity) return;

    if (isReducingStock.value && quantity > item.value.current_stock) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Quantity cannot exceed current stock', life: 3000 });
        return;
    }

    const details = {
        transaction_date: toApiDate(transactionForm.value.transaction_date),
        reference_type: transactionForm.value.reference_type,
        reference_id: transactionForm.value.reference_type ? transactionForm.value.reference_id : null,
        notes: transactionForm.value.notes || null
    };

    saving.value = true;
    try {
        if (usesBatches.value) {
            const response = await inventoryService.useStock(item.value.id, { quantity, ...details });
            const used = response.data.data.batch_deductions.map((deduction) => `${deduction.quantity_deducted} from ${deduction.batch_number}`).join(', ');
            toast.add({ severity: 'success', summary: 'Stock used', detail: used, life: 4000 });
            loadBatches();
        } else {
            await inventoryService.createTransaction(toTransactionPayload(item.value.id, { movement, quantity, ...details }));
            toast.add({ severity: 'success', summary: 'Success', detail: 'Transaction recorded', life: 3000 });
        }
        transactionDialog.value = false;
        loadItem();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to record transaction'), life: 4000 });
    } finally {
        saving.value = false;
    }
};

const editItem = () => {
    const { name, item_code, category_id, unit, minimum_stock, cost_per_unit, location, expiry_date, description, notes, is_active } = item.value;
    editForm.value = { name, item_code, category_id, unit, minimum_stock, cost_per_unit, location, description, notes, is_active, expiry_date: fromApiDate(expiry_date), ...itemSupplyFields(item.value) };
    loadSuppliers();
    editSubmitted.value = false;
    editDialog.value = true;
};

const saveItem = async () => {
    editSubmitted.value = true;
    if (!editForm.value.name || !editForm.value.unit) return;

    saving.value = true;
    try {
        // eslint-disable-next-line no-unused-vars -- item codes are assigned by the server
        const { item_code, ...data } = editForm.value;
        // The server names the supplier from its id; clearing the id clears the name
        if (!data.default_supplier_id && item.value.default_supplier_id) data.supplier = null;
        await inventoryService.updateItem(item.value.id, { ...data, expiry_date: toApiDate(data.expiry_date) });
        toast.add({ severity: 'success', summary: 'Success', detail: 'Item updated', life: 3000 });
        editDialog.value = false;
        loadItem();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to update item'), life: 4000 });
    } finally {
        saving.value = false;
    }
};

const goBack = () => {
    router.push({ name: 'inventory-items' });
};

// Utility functions
const formatDate = (date) => {
    if (!date) return '-';
    return fromApiDate(date).toLocaleDateString();
};

const isExpiringSoon = (date) => {
    const days = daysUntil(date);
    return days !== null && days >= 0 && days <= 30;
};

const getStockBgClass = (item) => {
    if (item.current_stock <= 0) return 'bg-red-50 dark:bg-red-900/20';
    if (item.current_stock <= item.minimum_stock) return 'bg-yellow-50 dark:bg-yellow-900/20';
    return 'bg-green-50 dark:bg-green-900/20';
};

const getStockTextClass = (item) => {
    if (item.current_stock <= 0) return 'text-red-600 dark:text-red-400';
    if (item.current_stock <= item.minimum_stock) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
};

const getStockValueClass = (item) => {
    if (item.current_stock <= 0) return 'text-red-900 dark:text-red-100';
    if (item.current_stock <= item.minimum_stock) return 'text-yellow-900 dark:text-yellow-100';
    return 'text-green-900 dark:text-green-100';
};

// Batch methods
const loadBatches = async () => {
    loadingBatches.value = true;
    try {
        const response = await inventoryService.getItemBatches(route.params.id);
        batches.value = response.data.data || [];
    } catch (error) {
        console.error('Failed to load batches:', error);
    } finally {
        loadingBatches.value = false;
    }
};

const getBatchExpiryClass = (batch) => {
    if (isBatchExpired(batch)) return 'text-red-500 font-medium';
    if (isBatchExpiringSoon(batch)) return 'text-yellow-600 font-medium';
    return '';
};

const isBatchExpired = (batch) => {
    const days = daysUntil(batch.expiry_date);
    return days !== null && days < 0;
};

const isBatchExpiringSoon = (batch) => isExpiringSoon(batch.expiry_date);

const getBatchStatusSeverity = (status) => {
    const severityMap = {
        active: 'success',
        depleted: 'secondary',
        expired: 'danger',
        quarantine: 'warn',
        disposed: 'secondary'
    };
    return severityMap[status] || 'info';
};

onMounted(() => {
    loadItem();
    loadCategories();
    loadBatches();
});
</script>

<template>
    <div class="grid grid-cols-12 gap-6">
        <!-- Back Button and Header -->
        <div class="col-span-12">
            <div class="flex items-center gap-4 mb-4">
                <Button icon="pi pi-arrow-left" text rounded @click="goBack" />
                <div>
                    <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ item?.name || 'Loading...' }}</h1>
                    <p class="text-surface-600 dark:text-surface-400">
                        <span class="font-mono">{{ item?.item_code }}</span>
                        <span v-if="item?.category_name" class="ml-2">• {{ item.category_name }}</span>
                    </p>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading && !item" class="col-span-12">
            <div class="card text-center py-12">
                <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
                <p class="mt-4 text-surface-500">Loading item details...</p>
            </div>
        </div>

        <template v-else-if="item">
            <!-- Item Info Card -->
            <div class="col-span-12 lg:col-span-4">
                <div class="card h-full">
                    <div class="flex items-center justify-between mb-4">
                        <h5 class="text-lg font-semibold m-0">Item Details</h5>
                        <Button v-if="canManage" icon="pi pi-pencil" text rounded @click="editItem" v-tooltip.top="'Edit'" />
                    </div>

                    <div class="flex flex-col gap-4">
                        <div class="flex justify-between">
                            <span class="text-surface-500">Status</span>
                            <Tag :value="item.is_active ? 'Active' : 'Inactive'" :severity="item.is_active ? 'success' : 'secondary'" />
                        </div>

                        <div class="flex justify-between">
                            <span class="text-surface-500">Category</span>
                            <span class="font-medium">{{ item.category_name || 'Uncategorized' }}</span>
                        </div>

                        <div class="flex justify-between">
                            <span class="text-surface-500">Unit</span>
                            <span class="font-medium">{{ item.unit }}</span>
                        </div>

                        <div class="flex justify-between">
                            <span class="text-surface-500">Cost per Unit</span>
                            <span class="font-medium">{{ item.cost_per_unit ? formatCurrency(item.cost_per_unit) : '-' }}</span>
                        </div>

                        <div class="flex justify-between">
                            <span class="text-surface-500">Supplier</span>
                            <span class="font-medium">{{ item.supplier || '-' }}</span>
                        </div>

                        <div v-if="item.reorder_quantity" class="flex justify-between">
                            <span class="text-surface-500">Reorder Quantity</span>
                            <span class="font-medium">{{ item.reorder_quantity }} {{ item.unit }}</span>
                        </div>

                        <div v-if="safetyIntervals" class="flex justify-between gap-4">
                            <span class="text-surface-500">Safety Intervals</span>
                            <span class="font-medium text-right">{{ safetyIntervals }}</span>
                        </div>

                        <div class="flex justify-between">
                            <span class="text-surface-500">Storage Location</span>
                            <span class="font-medium">{{ item.location || '-' }}</span>
                        </div>

                        <div class="flex justify-between">
                            <span class="text-surface-500">Expiry Date</span>
                            <span class="font-medium" :class="{ 'text-red-500': isExpiringSoon(item.expiry_date) }">
                                {{ formatDate(item.expiry_date) }}
                            </span>
                        </div>

                        <div v-if="item.description" class="pt-4 border-t border-surface-200 dark:border-surface-700">
                            <span class="text-surface-500 text-sm">Description</span>
                            <p class="mt-1">{{ item.description }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stock Level Card -->
            <div class="col-span-12 lg:col-span-8">
                <div class="card h-full">
                    <div class="flex items-center justify-between mb-4">
                        <h5 class="text-lg font-semibold m-0">Stock Information</h5>
                        <div class="flex gap-2">
                            <Button label="Add Stock" icon="pi pi-plus" size="small" severity="success" @click="openAddStock" />
                            <Button label="Use Stock" icon="pi pi-minus" size="small" severity="warn" @click="openTransactionDialog('usage')" :disabled="item.current_stock <= 0" />
                        </div>
                    </div>

                    <!-- Stock Stats -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div class="p-4 rounded-lg" :class="getStockBgClass(item)">
                            <p class="text-sm font-medium mb-1" :class="getStockTextClass(item)">Current Stock</p>
                            <p class="text-3xl font-bold" :class="getStockValueClass(item)">
                                {{ item.current_stock }}
                                <span class="text-lg font-normal">{{ item.unit }}</span>
                            </p>
                            <div class="flex items-center gap-2 mt-2">
                                <Tag v-if="item.current_stock <= 0" value="Out of Stock" severity="danger" />
                                <Tag v-else-if="item.current_stock <= item.minimum_stock" value="Low Stock" severity="warn" />
                                <Tag v-else value="Well Stocked" severity="success" />
                            </div>
                        </div>

                        <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
                            <p class="text-sm font-medium mb-1 text-surface-600 dark:text-surface-400">Minimum Stock</p>
                            <p class="text-3xl font-bold text-surface-900 dark:text-surface-0">
                                {{ item.minimum_stock ?? 0 }}
                                <span class="text-lg font-normal text-surface-500">{{ item.unit }}</span>
                            </p>
                            <p class="text-sm text-surface-500 mt-2">Alert threshold</p>
                        </div>

                        <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
                            <p class="text-sm font-medium mb-1 text-surface-600 dark:text-surface-400">Stock Value</p>
                            <p class="text-3xl font-bold text-surface-900 dark:text-surface-0">
                                {{ formatCurrency((item.current_stock || 0) * (item.cost_per_unit || 0)) }}
                            </p>
                            <p class="text-sm text-surface-500 mt-2">{{ item.cost_per_unit ? `@ ${formatCurrency(item.cost_per_unit)}/${item.unit}` : 'No cost per unit set' }}</p>
                        </div>
                    </div>

                    <p v-if="usableBatches.length" class="text-sm text-surface-500">
                        <i class="pi pi-info-circle mr-1"></i>
                        Usage is taken from this item's batches, earliest expiry first.
                    </p>
                </div>
            </div>

            <!-- Transaction History -->
            <div class="col-span-12 lg:col-span-8">
                <div class="card">
                    <div class="flex items-center justify-between mb-4">
                        <h5 class="text-lg font-semibold m-0">Transaction History</h5>
                        <div class="flex gap-2">
                            <Select v-model="transactionFilters.type" :options="TRANSACTION_TYPE_OPTIONS" optionLabel="label" optionValue="value" placeholder="All Types" class="w-40" showClear @change="loadTransactions" />
                        </div>
                    </div>

                    <div v-if="loadingTransactions" class="text-center py-8">
                        <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                    </div>

                    <div v-else-if="!transactions.length" class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                        <p class="text-surface-500">No transactions recorded yet</p>
                    </div>

                    <DataTable v-else :value="transactions" responsiveLayout="scroll" class="p-datatable-sm">
                        <Column field="transaction_date" header="Date" sortable>
                            <template #body="{ data }">
                                {{ formatDate(data.transaction_date) }}
                            </template>
                        </Column>
                        <Column field="transaction_type" header="Type" sortable>
                            <template #body="{ data }">
                                <Tag :value="formatTransactionType(data.transaction_type)" :severity="transactionSeverity(data)" />
                            </template>
                        </Column>
                        <Column field="quantity" header="Quantity" sortable>
                            <template #body="{ data }">
                                <span :class="signedQuantity(data) >= 0 ? 'text-green-500' : 'text-red-500'">
                                    {{ formatSignedQuantity(data, item.unit) }}
                                </span>
                            </template>
                        </Column>
                        <Column field="stock_after" header="Stock After">
                            <template #body="{ data }">
                                {{ data.stock_after ?? '-' }}
                            </template>
                        </Column>
                        <Column field="reference_type" header="Reference">
                            <template #body="{ data }">
                                <span v-if="data.reference_type">
                                    {{ formatReferenceType(data.reference_type) }}
                                    <span v-if="data.reference_id" class="text-surface-500">#{{ data.reference_id }}</span>
                                </span>
                                <span v-else>-</span>
                            </template>
                        </Column>
                        <Column field="notes" header="Notes">
                            <template #body="{ data }">
                                {{ data.notes || '-' }}
                            </template>
                        </Column>
                        <Column field="created_by_name" header="By">
                            <template #body="{ data }">
                                {{ data.created_by_name || '-' }}
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>

            <!-- Usage Report -->
            <div class="col-span-12 lg:col-span-4">
                <div class="card">
                    <h5 class="text-lg font-semibold mb-4">Usage Report</h5>

                    <div class="flex flex-col gap-2 mb-4">
                        <label class="text-sm text-surface-500">Date Range</label>
                        <div class="flex gap-2">
                            <DatePicker v-model="usageFilters.date_from" placeholder="From" class="flex-1" dateFormat="yy-mm-dd" />
                            <DatePicker v-model="usageFilters.date_to" placeholder="To" class="flex-1" dateFormat="yy-mm-dd" />
                        </div>
                        <Button label="Generate Report" size="small" @click="loadUsageReport" :loading="loadingUsage" />
                    </div>

                    <div v-if="loadingUsage" class="text-center py-4">
                        <i class="pi pi-spin pi-spinner text-xl text-primary"></i>
                    </div>

                    <div v-else-if="usageReport">
                        <div class="flex flex-col gap-3">
                            <div class="flex justify-between p-3 bg-surface-100 dark:bg-surface-800 rounded">
                                <span class="text-surface-600 dark:text-surface-400">Used</span>
                                <span class="font-bold text-red-500">-{{ usage.used }} {{ item.unit }}</span>
                            </div>
                            <div class="flex justify-between p-3 bg-surface-100 dark:bg-surface-800 rounded">
                                <span class="text-surface-600 dark:text-surface-400">Purchased &amp; returned</span>
                                <span class="font-bold text-green-500">+{{ usage.received }} {{ item.unit }}</span>
                            </div>
                            <div class="flex justify-between p-3 bg-surface-100 dark:bg-surface-800 rounded">
                                <span class="text-surface-600 dark:text-surface-400">Net Change</span>
                                <span class="font-bold" :class="usage.net >= 0 ? 'text-green-500' : 'text-red-500'">{{ usage.net >= 0 ? '+' : '' }}{{ usage.net }} {{ item.unit }}</span>
                            </div>
                        </div>

                        <div v-if="usage.byReference.length" class="mt-4">
                            <p class="font-medium mb-2">Usage by Reference</p>
                            <div class="flex flex-col gap-2">
                                <div v-for="row in usage.byReference" :key="row.reference_type" class="flex justify-between text-sm">
                                    <span>{{ formatReferenceType(row.reference_type) }}</span>
                                    <span class="font-medium">{{ row.quantity }} {{ item.unit }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-else class="text-center py-4 text-surface-500">
                        <p>Select a date range to generate report</p>
                    </div>
                </div>
            </div>

            <!-- Batches Section -->
            <div class="col-span-12">
                <div class="card">
                    <div class="flex items-center justify-between mb-4">
                        <h5 class="text-lg font-semibold m-0">Stock Batches</h5>
                        <Button v-if="canManage" label="Receive Stock" icon="pi pi-plus" size="small" @click="purchaseDialog = true" />
                    </div>

                    <div v-if="loadingBatches" class="text-center py-8">
                        <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                    </div>

                    <div v-else-if="!batches.length" class="text-center py-8">
                        <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                        <p class="text-surface-500">No batches recorded yet</p>
                        <p class="text-sm text-surface-400">Batches track expiry dates and where stock came from</p>
                    </div>

                    <DataTable v-else :value="batches" responsiveLayout="scroll" class="p-datatable-sm">
                        <Column field="batch_number" header="Batch #" sortable>
                            <template #body="{ data }">
                                <span class="font-mono text-sm">{{ data.batch_number }}</span>
                            </template>
                        </Column>
                        <Column field="quantity" header="Remaining" sortable>
                            <template #body="{ data }">
                                <span :class="{ 'text-red-500': data.quantity <= 0 }">{{ data.quantity }} / {{ data.initial_quantity }} {{ data.unit_symbol || item.unit }}</span>
                            </template>
                        </Column>
                        <Column field="expiry_date" header="Expiry Date" sortable>
                            <template #body="{ data }">
                                <span v-if="data.expiry_date" :class="getBatchExpiryClass(data)">
                                    {{ formatDate(data.expiry_date) }}
                                    <Tag v-if="isBatchExpired(data)" value="Expired" severity="danger" class="ml-2" />
                                    <Tag v-else-if="isBatchExpiringSoon(data)" value="Expiring" severity="warn" class="ml-2" />
                                </span>
                                <span v-else class="text-surface-400">No expiry</span>
                            </template>
                        </Column>
                        <Column field="received_date" header="Received" sortable>
                            <template #body="{ data }">
                                {{ formatDate(data.received_date) }}
                            </template>
                        </Column>
                        <Column field="supplier" header="Supplier">
                            <template #body="{ data }">
                                {{ data.supplier || '-' }}
                            </template>
                        </Column>
                        <Column field="storage_location" header="Location">
                            <template #body="{ data }">
                                {{ data.storage_location || '-' }}
                            </template>
                        </Column>
                        <Column field="status" header="Status" sortable>
                            <template #body="{ data }">
                                <Tag :value="data.status" :severity="getBatchStatusSeverity(data.status)" />
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>
        </template>

        <!-- Not Found -->
        <div v-else class="col-span-12">
            <div class="card text-center py-12">
                <i class="pi pi-exclamation-circle text-4xl text-surface-400 mb-4"></i>
                <p class="text-surface-500">Item not found</p>
                <Button label="Back to List" icon="pi pi-arrow-left" class="mt-4" @click="goBack" />
            </div>
        </div>

        <!-- Transaction Dialog -->
        <Dialog v-model:visible="transactionDialog" header="Record Transaction" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
                    <p class="font-medium">{{ item?.name }}</p>
                    <p class="text-surface-500 text-sm">Current Stock: {{ item?.current_stock }} {{ item?.unit }}</p>
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
                    <small v-if="usesBatches" class="text-surface-500">Taken from batches, earliest expiry first</small>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="trans_qty" class="font-medium">Quantity *</label>
                        <InputNumber
                            id="trans_qty"
                            v-model="transactionForm.quantity"
                            :min="0.01"
                            :max="maxTransactionQuantity"
                            :maxFractionDigits="2"
                            :suffix="item?.unit ? ` ${item.unit}` : ''"
                            class="w-full"
                            :class="{ 'p-invalid': transactionSubmitted && !transactionForm.quantity }"
                        />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="trans_date" class="font-medium">Date</label>
                        <DatePicker id="trans_date" v-model="transactionForm.transaction_date" dateFormat="yy-mm-dd" :maxDate="new Date()" class="w-full" />
                    </div>
                </div>
                <small v-if="isReducingStock && transactionForm.quantity > item?.current_stock" class="text-red-500"> Cannot exceed current stock ({{ item?.current_stock }}) </small>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="trans_ref_type" class="font-medium">Reference Type</label>
                        <Select id="trans_ref_type" v-model="transactionForm.reference_type" :options="REFERENCE_TYPE_OPTIONS" optionLabel="label" optionValue="value" placeholder="Select" class="w-full" showClear />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="trans_ref_id" class="font-medium">Reference ID</label>
                        <InputNumber id="trans_ref_id" v-model="transactionForm.reference_id" class="w-full" :useGrouping="false" :disabled="!transactionForm.reference_type" />
                    </div>
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

        <!-- Edit Item Dialog -->
        <Dialog v-model:visible="editDialog" header="Edit Item" :modal="true" :style="{ width: '650px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="edit_name" class="font-medium">Name *</label>
                        <InputText id="edit_name" v-model="editForm.name" class="w-full" :class="{ 'p-invalid': editSubmitted && !editForm.name }" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="edit_code" class="font-medium">Item Code</label>
                        <InputText id="edit_code" v-model="editForm.item_code" class="w-full" disabled />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="edit_category" class="font-medium">Category *</label>
                        <Select id="edit_category" v-model="editForm.category_id" :options="categories" optionLabel="name" optionValue="id" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="edit_unit" class="font-medium">Unit *</label>
                        <Select id="edit_unit" v-model="editForm.unit" :options="unitOptions" class="w-full" editable :class="{ 'p-invalid': editSubmitted && !editForm.unit }" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="edit_min_stock" class="font-medium">Minimum Stock</label>
                        <InputNumber id="edit_min_stock" v-model="editForm.minimum_stock" :min="0" :maxFractionDigits="2" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="edit_price" class="font-medium">Cost per Unit</label>
                        <InputNumber id="edit_price" v-model="editForm.cost_per_unit" :min="0" :minFractionDigits="2" mode="currency" currency="KES" locale="en-KE" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="edit_location" class="font-medium">Storage Location</label>
                        <InputText id="edit_location" v-model="editForm.location" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="edit_expiry" class="font-medium">Expiry Date</label>
                        <DatePicker id="edit_expiry" v-model="editForm.expiry_date" dateFormat="yy-mm-dd" class="w-full" showButtonBar />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="edit_desc" class="font-medium">Description</label>
                    <Textarea id="edit_desc" v-model="editForm.description" rows="2" class="w-full" />
                </div>

                <ItemSupplyFields v-model="editForm" :suppliers="suppliers" :unit="editForm.unit" idPrefix="edit" />

                <div class="flex items-center gap-2">
                    <Checkbox id="edit_active" v-model="editForm.is_active" :binary="true" />
                    <label for="edit_active">Active</label>
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="editDialog = false" :disabled="saving" />
                <Button label="Update" @click="saveItem" :loading="saving" />
            </template>
        </Dialog>

        <PurchaseDialog v-model:visible="purchaseDialog" :item="item" @saved="onPurchased" />
    </div>
</template>
