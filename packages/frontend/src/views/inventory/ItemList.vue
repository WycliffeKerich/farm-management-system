<template>
  <div class="card">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Inventory Items</h2>
        <p class="text-surface-600 dark:text-surface-400">Manage all inventory items and stock levels</p>
      </div>
      <Button
        label="New Item"
        icon="pi pi-plus"
        @click="openNewItemDialog"
        class="mt-4 md:mt-0"
      />
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="flex-1">
        <InputText
          v-model="filters.search"
          placeholder="Search by name or code..."
          class="w-full"
          @input="debouncedSearch"
        />
      </div>
      <Select
        v-model="filters.category_id"
        :options="categories"
        optionLabel="name"
        optionValue="id"
        placeholder="All Categories"
        class="w-full md:w-48"
        showClear
        @change="loadItems"
      />
      <Select
        v-model="filters.stock_status"
        :options="stockStatusOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="All Stock Levels"
        class="w-full md:w-48"
        showClear
        @change="loadItems"
      />
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Items</p>
            <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ statistics.total || 0 }}</p>
          </div>
          <i class="pi pi-box text-3xl text-blue-400"></i>
        </div>
      </div>
      <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-600 dark:text-green-400 text-sm font-medium">Well Stocked</p>
            <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ statistics.well_stocked || 0 }}</p>
          </div>
          <i class="pi pi-check-circle text-3xl text-green-400"></i>
        </div>
      </div>
      <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-yellow-600 dark:text-yellow-400 text-sm font-medium">Low Stock</p>
            <p class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{{ statistics.low_stock || 0 }}</p>
          </div>
          <i class="pi pi-exclamation-triangle text-3xl text-yellow-400"></i>
        </div>
      </div>
      <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-red-600 dark:text-red-400 text-sm font-medium">Out of Stock</p>
            <p class="text-2xl font-bold text-red-900 dark:text-red-100">{{ statistics.out_of_stock || 0 }}</p>
          </div>
          <i class="pi pi-times-circle text-3xl text-red-400"></i>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <DataTable
      :value="items"
      :loading="loading"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[10, 20, 50]"
      stripedRows
      responsiveLayout="scroll"
      class="p-datatable-sm"
    >
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
          <router-link
            :to="{ name: 'inventory-item-detail', params: { id: data.id } }"
            class="text-primary font-medium hover:underline"
          >
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
            <Tag :value="`${data.current_stock} ${data.unit_of_measure || ''}`" :severity="getStockSeverity(data)" />
            <i v-if="data.current_stock <= data.minimum_stock" class="pi pi-exclamation-triangle text-yellow-500" v-tooltip.top="'Below minimum stock'" />
          </div>
        </template>
      </Column>

      <Column field="minimum_stock" header="Min Stock" sortable>
        <template #body="{ data }">
          {{ data.minimum_stock }} {{ data.unit_of_measure || '' }}
        </template>
      </Column>

      <Column field="unit_price" header="Unit Price" sortable>
        <template #body="{ data }">
          {{ data.unit_price ? formatCurrency(data.unit_price) : '-' }}
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
            <Button
              icon="pi pi-eye"
              severity="info"
              text
              rounded
              size="small"
              @click="viewItem(data)"
              v-tooltip.top="'View'"
            />
            <Button
              icon="pi pi-plus"
              severity="success"
              text
              rounded
              size="small"
              @click="openTransactionDialog(data, 'purchase')"
              v-tooltip.top="'Add Stock'"
            />
            <Button
              icon="pi pi-minus"
              severity="warn"
              text
              rounded
              size="small"
              @click="openTransactionDialog(data, 'usage')"
              v-tooltip.top="'Use Stock'"
              :disabled="data.current_stock <= 0"
            />
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              size="small"
              @click="editItem(data)"
              v-tooltip.top="'Edit'"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              size="small"
              @click="confirmDelete(data)"
              v-tooltip.top="'Delete'"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- New/Edit Item Dialog -->
    <Dialog
      v-model:visible="itemDialog"
      :header="editingItem ? 'Edit Item' : 'New Item'"
      :modal="true"
      :style="{ width: '650px' }"
      :closable="!saving"
    >
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="item_name" class="font-medium">Name *</label>
            <InputText
              id="item_name"
              v-model="itemForm.name"
              class="w-full"
              :class="{ 'p-invalid': submitted && !itemForm.name }"
            />
            <small v-if="submitted && !itemForm.name" class="text-red-500">Name is required</small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="item_code" class="font-medium">Item Code</label>
            <InputText
              id="item_code"
              v-model="itemForm.item_code"
              class="w-full"
              placeholder="Auto-generated if empty"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="item_category" class="font-medium">Category *</label>
            <Select
              id="item_category"
              v-model="itemForm.category_id"
              :options="categories"
              optionLabel="name"
              optionValue="id"
              placeholder="Select category"
              class="w-full"
              :class="{ 'p-invalid': submitted && !itemForm.category_id }"
            />
            <small v-if="submitted && !itemForm.category_id" class="text-red-500">Category is required</small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="unit_of_measure" class="font-medium">Unit of Measure *</label>
            <Select
              id="unit_of_measure"
              v-model="itemForm.unit_of_measure"
              :options="unitOptions"
              placeholder="Select unit"
              class="w-full"
              editable
              :class="{ 'p-invalid': submitted && !itemForm.unit_of_measure }"
            />
            <small v-if="submitted && !itemForm.unit_of_measure" class="text-red-500">Unit is required</small>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flex flex-col gap-2">
            <label for="current_stock" class="font-medium">Current Stock</label>
            <InputNumber
              id="current_stock"
              v-model="itemForm.current_stock"
              :min="0"
              class="w-full"
              :disabled="editingItem"
            />
            <small v-if="editingItem" class="text-surface-500">Use transactions to adjust stock</small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="minimum_stock" class="font-medium">Minimum Stock *</label>
            <InputNumber
              id="minimum_stock"
              v-model="itemForm.minimum_stock"
              :min="0"
              class="w-full"
              :class="{ 'p-invalid': submitted && itemForm.minimum_stock === null }"
            />
            <small v-if="submitted && itemForm.minimum_stock === null" class="text-red-500">Required</small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="reorder_quantity" class="font-medium">Reorder Quantity</label>
            <InputNumber
              id="reorder_quantity"
              v-model="itemForm.reorder_quantity"
              :min="0"
              class="w-full"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="unit_price" class="font-medium">Unit Price</label>
            <InputNumber
              id="unit_price"
              v-model="itemForm.unit_price"
              :min="0"
              :minFractionDigits="2"
              :maxFractionDigits="2"
              mode="currency"
              currency="USD"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="expiry_date" class="font-medium">Expiry Date</label>
            <DatePicker
              id="expiry_date"
              v-model="itemForm.expiry_date"
              dateFormat="yy-mm-dd"
              class="w-full"
              :minDate="new Date()"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label for="supplier" class="font-medium">Supplier</label>
          <InputText id="supplier" v-model="itemForm.supplier" class="w-full" />
        </div>

        <div class="flex flex-col gap-2">
          <label for="storage_location" class="font-medium">Storage Location</label>
          <InputText id="storage_location" v-model="itemForm.storage_location" class="w-full" />
        </div>

        <div class="flex flex-col gap-2">
          <label for="description" class="font-medium">Description</label>
          <Textarea id="description" v-model="itemForm.description" rows="2" class="w-full" />
        </div>

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
    <Dialog
      v-model:visible="transactionDialog"
      header="Record Transaction"
      :modal="true"
      :style="{ width: '450px' }"
      :closable="!saving"
    >
      <div class="flex flex-col gap-4">
        <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg mb-2">
          <p class="font-medium">{{ selectedItem?.name }}</p>
          <p class="text-surface-500 text-sm">Current Stock: {{ selectedItem?.current_stock }} {{ selectedItem?.unit_of_measure || '' }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <label for="trans_type" class="font-medium">Transaction Type *</label>
          <Select
            id="trans_type"
            v-model="transactionForm.transaction_type"
            :options="transactionTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select type"
            class="w-full"
            :class="{ 'p-invalid': transactionSubmitted && !transactionForm.transaction_type }"
          />
          <small v-if="transactionSubmitted && !transactionForm.transaction_type" class="text-red-500">Type is required</small>
        </div>

        <div class="flex flex-col gap-2">
          <label for="trans_qty" class="font-medium">Quantity *</label>
          <InputNumber
            id="trans_qty"
            v-model="transactionForm.quantity"
            :min="1"
            :max="maxTransactionQuantity"
            class="w-full"
            :class="{ 'p-invalid': transactionSubmitted && !transactionForm.quantity }"
          />
          <small v-if="transactionSubmitted && !transactionForm.quantity" class="text-red-500">Quantity is required</small>
          <small v-if="isReducingStock && transactionForm.quantity > selectedItem?.current_stock" class="text-red-500">
            Cannot exceed current stock ({{ selectedItem?.current_stock }})
          </small>
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

    <!-- Delete Confirmation -->
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import inventoryService from '@/services/inventory.service';

const router = useRouter();
const route = useRoute();
const confirm = useConfirm();
const toast = useToast();

// State
const loading = ref(false);
const saving = ref(false);
const submitted = ref(false);
const transactionSubmitted = ref(false);
const items = ref([]);
const categories = ref([]);
const statistics = ref({});
const itemDialog = ref(false);
const transactionDialog = ref(false);
const editingItem = ref(null);
const selectedItem = ref(null);

// Filters
const filters = ref({
  search: '',
  category_id: null,
  stock_status: null
});

// Forms
const itemForm = ref({
  name: '',
  item_code: '',
  category_id: null,
  unit_of_measure: '',
  current_stock: 0,
  minimum_stock: 0,
  reorder_quantity: null,
  unit_price: null,
  expiry_date: null,
  supplier: '',
  storage_location: '',
  description: '',
  is_active: true
});

const transactionForm = ref({
  transaction_type: null,
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

const transactionTypeOptions = [
  { label: 'Purchase', value: 'purchase' },
  { label: 'Usage', value: 'usage' },
  { label: 'Adjustment (Add)', value: 'adjustment_add' },
  { label: 'Adjustment (Remove)', value: 'adjustment_remove' },
  { label: 'Return', value: 'return' },
  { label: 'Waste/Expired', value: 'waste' }
];

// Computed
const isReducingStock = computed(() => {
  const type = transactionForm.value.transaction_type;
  return ['usage', 'adjustment_remove', 'transfer_out', 'waste'].includes(type);
});

const maxTransactionQuantity = computed(() => {
  if (!selectedItem.value || !isReducingStock.value) return 999999;
  return selectedItem.value.current_stock;
});

// Methods
const loadItems = async () => {
  loading.value = true;
  try {
    const params = { ...filters.value };

    // Handle low_stock filter from URL
    if (route.query.low_stock === 'true') {
      params.low_stock = true;
    }

    // Convert stock_status to appropriate filter
    if (params.stock_status === 'low') {
      params.low_stock = true;
    } else if (params.stock_status === 'out') {
      params.out_of_stock = true;
    }
    delete params.stock_status;

    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === '') {
        delete params[key];
      }
    });

    const response = await inventoryService.getItems(params);
    items.value = response.data.data || [];
    calculateStatistics();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to load items',
      life: 3000
    });
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

const calculateStatistics = () => {
  const total = items.value.length;
  const lowStock = items.value.filter(i => i.current_stock > 0 && i.current_stock <= i.minimum_stock).length;
  const outOfStock = items.value.filter(i => i.current_stock <= 0).length;
  const wellStocked = total - lowStock - outOfStock;

  statistics.value = {
    total,
    low_stock: lowStock,
    out_of_stock: outOfStock,
    well_stocked: wellStocked
  };
};

const openNewItemDialog = () => {
  editingItem.value = null;
  itemForm.value = {
    name: '',
    item_code: '',
    category_id: null,
    unit_of_measure: '',
    current_stock: 0,
    minimum_stock: 0,
    reorder_quantity: null,
    unit_price: null,
    expiry_date: null,
    supplier: '',
    storage_location: '',
    description: '',
    is_active: true
  };
  submitted.value = false;
  itemDialog.value = true;
};

const editItem = (item) => {
  editingItem.value = item;
  itemForm.value = {
    ...item,
    expiry_date: item.expiry_date ? new Date(item.expiry_date) : null
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

  if (!itemForm.value.name || !itemForm.value.category_id || !itemForm.value.unit_of_measure || itemForm.value.minimum_stock === null) {
    return;
  }

  saving.value = true;
  try {
    const data = {
      ...itemForm.value,
      expiry_date: formatDateForApi(itemForm.value.expiry_date)
    };

    if (editingItem.value) {
      // Don't update current_stock on edit - use transactions
      delete data.current_stock;
      await inventoryService.updateItem(editingItem.value.id, data);
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Item updated successfully',
        life: 3000
      });
    } else {
      await inventoryService.createItem(data);
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Item created successfully',
        life: 3000
      });
    }

    closeItemDialog();
    loadItems();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to save item',
      life: 3000
    });
  } finally {
    saving.value = false;
  }
};

const viewItem = (item) => {
  router.push({ name: 'inventory-item-detail', params: { id: item.id } });
};

const openTransactionDialog = (item, type) => {
  selectedItem.value = item;
  transactionForm.value = {
    transaction_type: type,
    quantity: null,
    notes: ''
  };
  transactionSubmitted.value = false;
  transactionDialog.value = true;
};

const saveTransaction = async () => {
  transactionSubmitted.value = true;

  if (!transactionForm.value.transaction_type || !transactionForm.value.quantity) {
    return;
  }

  if (isReducingStock.value && transactionForm.value.quantity > selectedItem.value.current_stock) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Quantity cannot exceed current stock', life: 3000 });
    return;
  }

  saving.value = true;
  try {
    await inventoryService.createTransaction({
      inventory_item_id: selectedItem.value.id,
      ...transactionForm.value
    });
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Transaction recorded successfully',
      life: 3000
    });
    transactionDialog.value = false;
    loadItems();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to record transaction',
      life: 3000
    });
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
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Item deleted successfully',
      life: 3000
    });
    loadItems();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to delete item',
      life: 3000
    });
  }
};

// Utility functions
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const formatDateForApi = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
};

const getStockSeverity = (item) => {
  if (item.current_stock <= 0) return 'danger';
  if (item.current_stock <= item.minimum_stock) return 'warn';
  return 'success';
};

const isExpiringSoon = (date) => {
  if (!date) return false;
  const expiryDate = new Date(date);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
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
  // Check for URL filters
  if (route.query.low_stock === 'true') {
    filters.value.stock_status = 'low';
  }
  loadItems();
  loadCategories();
});
</script>
