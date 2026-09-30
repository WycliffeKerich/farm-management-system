<script setup>
import { ref, computed, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import inventoryService from '@/services/inventory.service';
import PurchaseDialog from '@/components/inventory/PurchaseDialog.vue';
import { useAuthStore } from '@/stores/auth.store';
import { fromApiDate, toApiDate } from '@/utils/dates';
import { validationMessage } from '@/utils/forms';
import { MOVEMENT_OPTIONS, REFERENCE_TYPE_OPTIONS, formatCurrency, formatReferenceType, formatSignedQuantity, formatTransactionType, isReducingMovement, signedQuantity, toTransactionPayload, transactionSeverity } from '@/utils/inventory';

const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();

const canManage = computed(() => authStore.hasRole(['owner', 'manager']));

// State
const loading = ref(true);
const saving = ref(false);
const submitted = ref(false);
const transactionSubmitted = ref(false);
const summary = ref({});
const categories = ref([]);
const lowStockItems = ref([]);
const recentTransactions = ref([]);
const allItems = ref([]);

// Dialogs
const categoryDialog = ref(false);
const transactionDialog = ref(false);
const purchaseDialog = ref(false);
const purchaseItem = ref(null);
const editingCategory = ref(null);

// Forms
const categoryForm = ref({ name: '', description: '' });
const emptyTransactionForm = (itemId = null, movement = null) => ({
    item_id: itemId,
    movement,
    quantity: null,
    transaction_date: new Date(),
    reference_type: null,
    reference_id: null,
    notes: ''
});
const transactionForm = ref(emptyTransactionForm());

// Computed
const expiringCount = computed(() => (summary.value.expiring_count || 0) + (summary.value.expiring_batches_count || 0));

const selectedItem = computed(() => {
    if (!transactionForm.value.item_id) return null;
    return allItems.value.find((item) => item.id === transactionForm.value.item_id);
});

const isReducingStock = computed(() => isReducingMovement(transactionForm.value.movement));

const maxTransactionQuantity = computed(() => {
    if (!selectedItem.value || !isReducingStock.value) return undefined;
    return selectedItem.value.current_stock;
});

// Load data
const loadData = async () => {
    loading.value = true;
    try {
        const [summaryRes, categoriesRes, lowStockRes, transactionsRes, itemsRes] = await Promise.all([
            inventoryService.getSummary(),
            inventoryService.getCategories(),
            inventoryService.getLowStockItems(),
            inventoryService.getTransactions({ limit: 10 }),
            inventoryService.getItems()
        ]);
        summary.value = summaryRes.data.data || {};
        categories.value = categoriesRes.data.data || [];
        lowStockItems.value = lowStockRes.data.data || [];
        recentTransactions.value = transactionsRes.data.data || [];
        allItems.value = itemsRes.data.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load data'), life: 3000 });
    } finally {
        loading.value = false;
    }
};

// Category CRUD
const openCategoryDialog = () => {
    editingCategory.value = null;
    categoryForm.value = { name: '', description: '' };
    submitted.value = false;
    categoryDialog.value = true;
};

const editCategory = (category) => {
    editingCategory.value = category;
    categoryForm.value = { name: category.name, description: category.description };
    submitted.value = false;
    categoryDialog.value = true;
};

const saveCategory = async () => {
    submitted.value = true;
    if (!categoryForm.value.name) return;

    saving.value = true;
    try {
        if (editingCategory.value) {
            await inventoryService.updateCategory(editingCategory.value.id, categoryForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Category updated', life: 3000 });
        } else {
            await inventoryService.createCategory(categoryForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Category created', life: 3000 });
        }
        categoryDialog.value = false;
        loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to save'), life: 4000 });
    } finally {
        saving.value = false;
    }
};

const confirmDeleteCategory = (category) => {
    confirm.require({
        message: `Delete category "${category.name}"?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await inventoryService.deleteCategory(category.id);
                toast.add({ severity: 'success', summary: 'Success', detail: 'Category deleted', life: 3000 });
                loadData();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to delete'), life: 4000 });
            }
        }
    });
};

// Transaction methods

/** Owners and managers receive stock as a batch with its supplier and expiry; others record a plain purchase */
const openAddStock = (item) => {
    if (!canManage.value) {
        openTransactionDialog(item.id, 'purchase');
        return;
    }
    purchaseItem.value = item;
    purchaseDialog.value = true;
};

const openTransactionDialog = (itemId = null, movement = null) => {
    transactionForm.value = emptyTransactionForm(itemId, movement);
    transactionSubmitted.value = false;
    transactionDialog.value = true;
};

const saveTransaction = async () => {
    transactionSubmitted.value = true;
    const { item_id, movement, quantity, transaction_date, reference_type, reference_id, notes } = transactionForm.value;
    if (!item_id || !movement || !quantity) return;

    if (isReducingStock.value && quantity > selectedItem.value.current_stock) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Quantity cannot exceed current stock', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        await inventoryService.createTransaction(
            toTransactionPayload(item_id, {
                movement,
                quantity,
                transaction_date: toApiDate(transaction_date),
                reference_type,
                reference_id: reference_type ? reference_id : null,
                notes: notes || null
            })
        );
        toast.add({ severity: 'success', summary: 'Success', detail: 'Transaction recorded', life: 3000 });
        transactionDialog.value = false;
        loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to record transaction'), life: 4000 });
    } finally {
        saving.value = false;
    }
};

// Utilities
const formatDate = (date) => {
    if (!date) return '-';
    return fromApiDate(date).toLocaleDateString();
};

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="grid grid-cols-12 gap-6">
        <!-- Page Header -->
        <div class="col-span-12">
            <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">Inventory Management</h1>
            <p class="text-surface-600 dark:text-surface-400">Overview of stock levels, categories, and recent transactions</p>
        </div>

        <!-- Stats Cards -->
        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Total Items</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : summary.total_items || 0 }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-box text-blue-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">Registered inventory items</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Low Stock Alerts</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl" :class="{ 'text-red-500': summary.low_stock_count > 0 }">
                            {{ loading ? '...' : summary.low_stock_count || 0 }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-red-100 dark:bg-red-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-exclamation-triangle text-red-500 text-xl!"></i>
                    </div>
                </div>
                <router-link to="/inventory/items?low_stock=true" class="text-primary hover:underline text-sm" v-if="summary.low_stock_count > 0"> View low stock items <i class="pi pi-arrow-right text-xs"></i> </router-link>
                <span v-else class="text-muted-color">All items well stocked</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Expiring Soon</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl" :class="{ 'text-orange-500': expiringCount > 0 }">
                            {{ loading ? '...' : expiringCount }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-clock text-orange-500 text-xl!"></i>
                    </div>
                </div>
                <router-link v-if="canManage && expiringCount > 0" :to="{ name: 'inventory-reports', query: { tab: 'expiring' } }" class="text-primary hover:underline text-sm">
                    View expiring stock <i class="pi pi-arrow-right text-xs"></i>
                </router-link>
                <span v-else class="text-muted-color">Items and batches within 30 days</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Total Stock Value</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : formatCurrency(summary.total_value || 0) }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-green-100 dark:bg-green-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-wallet text-green-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">Current inventory value</span>
            </div>
        </div>

        <!-- Categories Section -->
        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Categories</h5>
                    <Button v-if="canManage" label="Add Category" icon="pi pi-plus" size="small" @click="openCategoryDialog" />
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!categories.length" class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">No categories defined yet</p>
                    <Button v-if="canManage" label="Add First Category" icon="pi pi-plus" @click="openCategoryDialog" class="mt-2" />
                </div>

                <DataTable v-else :value="categories" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column field="name" header="Name" sortable />
                    <Column field="description" header="Description">
                        <template #body="{ data }">
                            {{ data.description || '-' }}
                        </template>
                    </Column>
                    <Column field="item_count" header="Items">
                        <template #body="{ data }">
                            <Tag :value="data.item_count || 0" severity="info" />
                        </template>
                    </Column>
                    <Column v-if="canManage" header="Actions" style="width: 100px">
                        <template #body="{ data }">
                            <div class="flex gap-1">
                                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="editCategory(data)" />
                                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDeleteCategory(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Low Stock Items Section -->
        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Low Stock Items</h5>
                    <div class="flex gap-1">
                        <router-link v-if="canManage" :to="{ name: 'inventory-reports', query: { tab: 'reorder' } }">
                            <Button label="Reorder List" icon="pi pi-shopping-cart" size="small" text />
                        </router-link>
                        <router-link to="/inventory/items?low_stock=true">
                            <Button label="View All" icon="pi pi-arrow-right" size="small" text />
                        </router-link>
                    </div>
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!lowStockItems.length" class="text-center py-8">
                    <i class="pi pi-check-circle text-4xl text-green-500 mb-4"></i>
                    <p class="text-surface-500">All items are well stocked</p>
                </div>

                <DataTable v-else :value="lowStockItems.slice(0, 5)" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column field="name" header="Item" sortable>
                        <template #body="{ data }">
                            <router-link :to="`/inventory/items/${data.id}`" class="text-primary hover:underline font-medium">
                                {{ data.name }}
                            </router-link>
                        </template>
                    </Column>
                    <Column field="current_stock" header="Stock">
                        <template #body="{ data }">
                            <Tag :value="`${data.current_stock} ${data.unit || ''}`" severity="danger" />
                        </template>
                    </Column>
                    <Column field="minimum_stock" header="Minimum">
                        <template #body="{ data }"> {{ data.minimum_stock }} {{ data.unit || '' }} </template>
                    </Column>
                    <Column header="Action" style="width: 80px">
                        <template #body="{ data }">
                            <Button icon="pi pi-plus" severity="success" text rounded size="small" @click="openAddStock(data)" v-tooltip.top="'Add Stock'" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Recent Transactions Section -->
        <div class="col-span-12">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Recent Transactions</h5>
                    <div class="flex gap-2">
                        <Button label="New Transaction" icon="pi pi-plus" size="small" @click="openTransactionDialog()" />
                    </div>
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!recentTransactions.length" class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">No transactions recorded yet</p>
                </div>

                <DataTable v-else :value="recentTransactions" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column field="transaction_date" header="Date" sortable>
                        <template #body="{ data }">
                            {{ formatDate(data.transaction_date) }}
                        </template>
                    </Column>
                    <Column field="item_name" header="Item" sortable>
                        <template #body="{ data }">
                            <router-link :to="`/inventory/items/${data.item_id}`" class="text-primary hover:underline">{{ data.item_name }}</router-link>
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
                                {{ formatSignedQuantity(data, data.unit) }}
                            </span>
                        </template>
                    </Column>
                    <Column field="reference_type" header="Reference">
                        <template #body="{ data }">
                            {{ data.reference_type ? formatReferenceType(data.reference_type) : '-' }}
                        </template>
                    </Column>
                    <Column field="notes" header="Notes">
                        <template #body="{ data }">
                            {{ data.notes || '-' }}
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Category Dialog -->
        <Dialog v-model:visible="categoryDialog" :header="editingCategory ? 'Edit Category' : 'Add Category'" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="cat_name" class="font-medium">Name *</label>
                    <InputText id="cat_name" v-model="categoryForm.name" class="w-full" :class="{ 'p-invalid': submitted && !categoryForm.name }" />
                    <small v-if="submitted && !categoryForm.name" class="text-red-500">Name is required</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="cat_description" class="font-medium">Description</label>
                    <Textarea id="cat_description" v-model="categoryForm.description" rows="3" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="categoryDialog = false" :disabled="saving" />
                <Button :label="editingCategory ? 'Update' : 'Create'" @click="saveCategory" :loading="saving" />
            </template>
        </Dialog>

        <!-- Transaction Dialog -->
        <Dialog v-model:visible="transactionDialog" header="Record Transaction" :modal="true" :style="{ width: '500px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="trans_item" class="font-medium">Item *</label>
                    <Select
                        id="trans_item"
                        v-model="transactionForm.item_id"
                        :options="allItems"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Select item"
                        class="w-full"
                        filter
                        :class="{ 'p-invalid': transactionSubmitted && !transactionForm.item_id }"
                        @change="transactionForm.quantity = null"
                    >
                        <template #option="{ option }">
                            <div class="flex justify-between w-full">
                                <span>{{ option.name }}</span>
                                <span class="text-surface-500">Stock: {{ option.current_stock }} {{ option.unit }}</span>
                            </div>
                        </template>
                    </Select>
                    <small v-if="transactionSubmitted && !transactionForm.item_id" class="text-red-500">Item is required</small>
                </div>

                <div v-if="selectedItem" class="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
                    <div class="flex justify-between text-sm">
                        <span class="text-surface-600 dark:text-surface-400">Current Stock:</span>
                        <span class="font-medium">{{ selectedItem.current_stock }} {{ selectedItem.unit || '' }}</span>
                    </div>
                    <div class="flex justify-between text-sm mt-1">
                        <span class="text-surface-600 dark:text-surface-400">Minimum Stock:</span>
                        <span>{{ selectedItem.minimum_stock }} {{ selectedItem.unit || '' }}</span>
                    </div>
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
                    <small v-if="isReducingStock && selectedItem && transactionForm.quantity > selectedItem.current_stock" class="text-red-500"> Cannot exceed current stock ({{ selectedItem.current_stock }}) </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="trans_date" class="font-medium">Date</label>
                    <DatePicker id="trans_date" v-model="transactionForm.transaction_date" dateFormat="yy-mm-dd" :maxDate="new Date()" class="w-full" />
                </div>

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

        <!-- Confirm Dialog -->
        <ConfirmDialog />
        <PurchaseDialog v-model:visible="purchaseDialog" :item="purchaseItem" @saved="loadData" />
    </div>
</template>
