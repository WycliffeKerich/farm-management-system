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
    <div v-if="loading" class="col-span-12">
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
            <Button icon="pi pi-pencil" text rounded @click="editItem" v-tooltip.top="'Edit'" />
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
              <span class="font-medium">{{ item.unit_of_measure }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-surface-500">Unit Price</span>
              <span class="font-medium">{{ item.unit_price ? formatCurrency(item.unit_price) : '-' }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-surface-500">Supplier</span>
              <span class="font-medium">{{ item.supplier || '-' }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-surface-500">Storage Location</span>
              <span class="font-medium">{{ item.storage_location || '-' }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-surface-500">Expiry Date</span>
              <span class="font-medium" :class="{ 'text-red-500': isExpiringSoon(item.expiry_date) }">
                {{ item.expiry_date ? formatDate(item.expiry_date) : '-' }}
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
              <Button label="Add Stock" icon="pi pi-plus" size="small" severity="success" @click="openTransactionDialog('purchase')" />
              <Button label="Use Stock" icon="pi pi-minus" size="small" severity="warn" @click="openTransactionDialog('usage')" :disabled="item.current_stock <= 0" />
            </div>
          </div>

          <!-- Stock Stats -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="p-4 rounded-lg" :class="getStockBgClass(item)">
              <p class="text-sm font-medium mb-1" :class="getStockTextClass(item)">Current Stock</p>
              <p class="text-3xl font-bold" :class="getStockValueClass(item)">
                {{ item.current_stock }}
                <span class="text-lg font-normal">{{ item.unit_of_measure }}</span>
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
                {{ item.minimum_stock }}
                <span class="text-lg font-normal text-surface-500">{{ item.unit_of_measure }}</span>
              </p>
              <p class="text-sm text-surface-500 mt-2">Alert threshold</p>
            </div>

            <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
              <p class="text-sm font-medium mb-1 text-surface-600 dark:text-surface-400">Stock Value</p>
              <p class="text-3xl font-bold text-surface-900 dark:text-surface-0">
                {{ formatCurrency((item.current_stock || 0) * (item.unit_price || 0)) }}
              </p>
              <p class="text-sm text-surface-500 mt-2">{{ item.unit_price ? `@ ${formatCurrency(item.unit_price)}/unit` : 'No unit price set' }}</p>
            </div>
          </div>

          <!-- Stock Level Chart Placeholder -->
          <div class="p-4 bg-surface-50 dark:bg-surface-900 rounded-lg text-center">
            <i class="pi pi-chart-line text-4xl text-surface-400 mb-2"></i>
            <p class="text-surface-500">Stock level history chart</p>
            <p class="text-sm text-surface-400">Coming soon - Track stock trends over time</p>
          </div>
        </div>
      </div>

      <!-- Transaction History -->
      <div class="col-span-12 lg:col-span-8">
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h5 class="text-lg font-semibold m-0">Transaction History</h5>
            <div class="flex gap-2">
              <Select
                v-model="transactionFilters.type"
                :options="transactionTypeFilterOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="All Types"
                class="w-40"
                showClear
                @change="loadTransactions"
              />
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
                {{ formatDateTime(data.transaction_date) }}
              </template>
            </Column>
            <Column field="transaction_type" header="Type" sortable>
              <template #body="{ data }">
                <Tag :value="formatTransactionType(data.transaction_type)" :severity="getTransactionSeverity(data.transaction_type)" />
              </template>
            </Column>
            <Column field="quantity" header="Quantity" sortable>
              <template #body="{ data }">
                <span :class="{ 'text-green-500': isStockIncrease(data.transaction_type), 'text-red-500': !isStockIncrease(data.transaction_type) }">
                  {{ isStockIncrease(data.transaction_type) ? '+' : '-' }}{{ data.quantity }} {{ item.unit_of_measure }}
                </span>
              </template>
            </Column>
            <Column field="stock_after" header="Stock After">
              <template #body="{ data }">
                {{ data.stock_after !== undefined ? data.stock_after : '-' }}
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

      <!-- Batches Section -->
      <div class="col-span-12">
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h5 class="text-lg font-semibold m-0">Stock Batches</h5>
            <Button label="Add Batch" icon="pi pi-plus" size="small" @click="openBatchDialog" />
          </div>

          <div v-if="loadingBatches" class="text-center py-8">
            <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
          </div>

          <div v-else-if="!batches.length" class="text-center py-8">
            <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
            <p class="text-surface-500">No batches recorded yet</p>
            <p class="text-sm text-surface-400">Batches help track expiry dates and stock origins</p>
          </div>

          <DataTable v-else :value="batches" responsiveLayout="scroll" class="p-datatable-sm">
            <Column field="batch_number" header="Batch #" sortable>
              <template #body="{ data }">
                <span class="font-mono text-sm">{{ data.batch_number }}</span>
              </template>
            </Column>
            <Column field="quantity" header="Quantity" sortable>
              <template #body="{ data }">
                <span :class="{ 'text-red-500': data.quantity <= 0 }">
                  {{ data.quantity }} {{ data.unit_symbol || item.unit_of_measure }}
                </span>
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

      <!-- Usage by Reference -->
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
                <span class="text-surface-600 dark:text-surface-400">Total Used</span>
                <span class="font-bold text-red-500">-{{ usageReport.total_used || 0 }} {{ item.unit_of_measure }}</span>
              </div>
              <div class="flex justify-between p-3 bg-surface-100 dark:bg-surface-800 rounded">
                <span class="text-surface-600 dark:text-surface-400">Total Purchased</span>
                <span class="font-bold text-green-500">+{{ usageReport.total_purchased || 0 }} {{ item.unit_of_measure }}</span>
              </div>
              <div class="flex justify-between p-3 bg-surface-100 dark:bg-surface-800 rounded">
                <span class="text-surface-600 dark:text-surface-400">Net Change</span>
                <span class="font-bold" :class="{ 'text-green-500': usageReport.net_change >= 0, 'text-red-500': usageReport.net_change < 0 }">
                  {{ usageReport.net_change >= 0 ? '+' : '' }}{{ usageReport.net_change || 0 }} {{ item.unit_of_measure }}
                </span>
              </div>
            </div>

            <div v-if="usageReport.by_reference && usageReport.by_reference.length" class="mt-4">
              <p class="font-medium mb-2">Usage by Reference</p>
              <div class="flex flex-col gap-2">
                <div v-for="ref in usageReport.by_reference" :key="ref.reference_type" class="flex justify-between text-sm">
                  <span>{{ formatReferenceType(ref.reference_type) }}</span>
                  <span class="font-medium">{{ ref.quantity }} {{ item.unit_of_measure }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-4 text-surface-500">
            <p>Select a date range to generate report</p>
          </div>
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
          <p class="text-surface-500 text-sm">Current Stock: {{ item?.current_stock }} {{ item?.unit_of_measure }}</p>
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
          <small v-if="isReducingStock && transactionForm.quantity > item?.current_stock" class="text-red-500">
            Cannot exceed current stock ({{ item?.current_stock }})
          </small>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="trans_ref_type" class="font-medium">Reference Type</label>
            <Select
              id="trans_ref_type"
              v-model="transactionForm.reference_type"
              :options="referenceTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select"
              class="w-full"
              showClear
            />
          </div>
          <div class="flex flex-col gap-2">
            <label for="trans_ref_id" class="font-medium">Reference ID</label>
            <InputNumber id="trans_ref_id" v-model="transactionForm.reference_id" class="w-full" :disabled="!transactionForm.reference_type" />
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
            <label for="edit_unit" class="font-medium">Unit of Measure *</label>
            <Select id="edit_unit" v-model="editForm.unit_of_measure" :options="unitOptions" class="w-full" editable />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flex flex-col gap-2">
            <label for="edit_min_stock" class="font-medium">Minimum Stock</label>
            <InputNumber id="edit_min_stock" v-model="editForm.minimum_stock" :min="0" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="edit_reorder" class="font-medium">Reorder Qty</label>
            <InputNumber id="edit_reorder" v-model="editForm.reorder_quantity" :min="0" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="edit_price" class="font-medium">Unit Price</label>
            <InputNumber id="edit_price" v-model="editForm.unit_price" :min="0" :minFractionDigits="2" mode="currency" currency="USD" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="edit_supplier" class="font-medium">Supplier</label>
            <InputText id="edit_supplier" v-model="editForm.supplier" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="edit_expiry" class="font-medium">Expiry Date</label>
            <DatePicker id="edit_expiry" v-model="editForm.expiry_date" dateFormat="yy-mm-dd" class="w-full" />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label for="edit_location" class="font-medium">Storage Location</label>
          <InputText id="edit_location" v-model="editForm.storage_location" class="w-full" />
        </div>

        <div class="flex flex-col gap-2">
          <label for="edit_desc" class="font-medium">Description</label>
          <Textarea id="edit_desc" v-model="editForm.description" rows="2" class="w-full" />
        </div>

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

    <!-- Add Batch Dialog -->
    <Dialog v-model:visible="batchDialog" header="Add Stock Batch" :modal="true" :style="{ width: '550px' }" :closable="!saving">
      <div class="flex flex-col gap-4">
        <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
          <p class="font-medium">{{ item?.name }}</p>
          <p class="text-surface-500 text-sm">Adding a new batch will increase the stock level</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="batch_qty" class="font-medium">Quantity *</label>
            <InputNumber
              id="batch_qty"
              v-model="batchForm.quantity"
              :min="0.01"
              :minFractionDigits="0"
              :maxFractionDigits="2"
              class="w-full"
              :class="{ 'p-invalid': batchSubmitted && !batchForm.quantity }"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label for="batch_number" class="font-medium">Batch Number</label>
            <InputText id="batch_number" v-model="batchForm.batch_number" class="w-full" placeholder="Auto-generated if empty" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="batch_cost" class="font-medium">Unit Cost</label>
            <InputNumber id="batch_cost" v-model="batchForm.unit_cost" :min="0" :minFractionDigits="2" mode="currency" currency="USD" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="batch_received" class="font-medium">Received Date</label>
            <DatePicker id="batch_received" v-model="batchForm.received_date" dateFormat="yy-mm-dd" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="batch_mfg" class="font-medium">Manufacture Date</label>
            <DatePicker id="batch_mfg" v-model="batchForm.manufacture_date" dateFormat="yy-mm-dd" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="batch_expiry" class="font-medium">Expiry Date</label>
            <DatePicker id="batch_expiry" v-model="batchForm.expiry_date" dateFormat="yy-mm-dd" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="batch_supplier" class="font-medium">Supplier</label>
            <InputText id="batch_supplier" v-model="batchForm.supplier" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="batch_supplier_num" class="font-medium">Supplier Batch #</label>
            <InputText id="batch_supplier_num" v-model="batchForm.supplier_batch_number" class="w-full" />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label for="batch_location" class="font-medium">Storage Location</label>
          <InputText id="batch_location" v-model="batchForm.storage_location" class="w-full" />
        </div>

        <div class="flex flex-col gap-2">
          <label for="batch_notes" class="font-medium">Notes</label>
          <Textarea id="batch_notes" v-model="batchForm.notes" rows="2" class="w-full" />
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" severity="secondary" @click="batchDialog = false" :disabled="saving" />
        <Button label="Add Batch" @click="saveBatch" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import inventoryService from '@/services/inventory.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();

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
const batchDialog = ref(false);
const transactionSubmitted = ref(false);
const editSubmitted = ref(false);
const batchSubmitted = ref(false);

// Forms
const transactionForm = ref({
  transaction_type: null,
  quantity: null,
  reference_type: null,
  reference_id: null,
  notes: ''
});

const editForm = ref({});

// Filters
const transactionFilters = ref({ type: null });
const usageFilters = ref({
  date_from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
  date_to: new Date()
});

// Options
const transactionTypeOptions = [
  { label: 'Purchase', value: 'purchase' },
  { label: 'Usage', value: 'usage' },
  { label: 'Adjustment (Add)', value: 'adjustment_add' },
  { label: 'Adjustment (Remove)', value: 'adjustment_remove' },
  { label: 'Return', value: 'return' },
  { label: 'Waste/Expired', value: 'waste' }
];

const transactionTypeFilterOptions = [
  { label: 'All Types', value: null },
  ...transactionTypeOptions
];

const referenceTypeOptions = [
  { label: 'Crop Batch', value: 'crop_batch' },
  { label: 'Animal', value: 'animal' },
  { label: 'Animal Group', value: 'animal_group' },
  { label: 'Task', value: 'task' }
];

const unitOptions = ['pcs', 'kg', 'g', 'L', 'mL', 'bags', 'boxes', 'bottles', 'cans', 'rolls'];

// Computed
const isReducingStock = computed(() => {
  const type = transactionForm.value.transaction_type;
  return ['usage', 'adjustment_remove', 'transfer_out', 'waste'].includes(type);
});

const maxTransactionQuantity = computed(() => {
  if (!item.value || !isReducingStock.value) return 999999;
  return item.value.current_stock;
});

// Methods
const loadItem = async () => {
  loading.value = true;
  try {
    const response = await inventoryService.getItemById(route.params.id);
    item.value = response.data.data;
    loadTransactions();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load item', life: 3000 });
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
    const dateFrom = formatDateForApi(usageFilters.value.date_from);
    const dateTo = formatDateForApi(usageFilters.value.date_to);
    const response = await inventoryService.getUsageReport(route.params.id, dateFrom, dateTo);
    usageReport.value = response.data.data || {};
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load usage report', life: 3000 });
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

const openTransactionDialog = (type) => {
  transactionForm.value = {
    transaction_type: type,
    quantity: null,
    reference_type: null,
    reference_id: null,
    notes: ''
  };
  transactionSubmitted.value = false;
  transactionDialog.value = true;
};

const saveTransaction = async () => {
  transactionSubmitted.value = true;
  if (!transactionForm.value.transaction_type || !transactionForm.value.quantity) return;

  if (isReducingStock.value && transactionForm.value.quantity > item.value.current_stock) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Quantity cannot exceed current stock', life: 3000 });
    return;
  }

  saving.value = true;
  try {
    await inventoryService.createTransaction({
      inventory_item_id: item.value.id,
      ...transactionForm.value
    });
    toast.add({ severity: 'success', summary: 'Success', detail: 'Transaction recorded', life: 3000 });
    transactionDialog.value = false;
    loadItem();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to record transaction', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const editItem = () => {
  editForm.value = {
    ...item.value,
    expiry_date: item.value.expiry_date ? new Date(item.value.expiry_date) : null
  };
  editSubmitted.value = false;
  editDialog.value = true;
};

const saveItem = async () => {
  editSubmitted.value = true;
  if (!editForm.value.name) return;

  saving.value = true;
  try {
    const data = {
      ...editForm.value,
      expiry_date: formatDateForApi(editForm.value.expiry_date)
    };
    delete data.current_stock; // Don't update stock directly
    await inventoryService.updateItem(item.value.id, data);
    toast.add({ severity: 'success', summary: 'Success', detail: 'Item updated', life: 3000 });
    editDialog.value = false;
    loadItem();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to update item', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const goBack = () => {
  router.push({ name: 'inventory-items' });
};

// Utility functions
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString();
};

const formatDateForApi = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
};

const formatTransactionType = (type) => {
  const typeMap = {
    purchase: 'Purchase',
    usage: 'Usage',
    adjustment_add: 'Adjust +',
    adjustment_remove: 'Adjust -',
    transfer_in: 'Transfer In',
    transfer_out: 'Transfer Out',
    return: 'Return',
    waste: 'Waste'
  };
  return typeMap[type] || type;
};

const formatReferenceType = (type) => {
  const typeMap = {
    crop_batch: 'Crop Batch',
    animal: 'Animal',
    animal_group: 'Animal Group',
    task: 'Task'
  };
  return typeMap[type] || type;
};

const getTransactionSeverity = (type) => {
  if (['purchase', 'adjustment_add', 'transfer_in', 'return'].includes(type)) return 'success';
  if (['usage', 'transfer_out'].includes(type)) return 'info';
  if (['adjustment_remove', 'waste'].includes(type)) return 'danger';
  return 'secondary';
};

const isStockIncrease = (type) => {
  return ['purchase', 'adjustment_add', 'transfer_in', 'return'].includes(type);
};

const isExpiringSoon = (date) => {
  if (!date) return false;
  const expiryDate = new Date(date);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
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

const batchForm = ref({
  quantity: null,
  batch_number: '',
  unit_cost: null,
  manufacture_date: null,
  expiry_date: null,
  received_date: new Date(),
  supplier: '',
  supplier_batch_number: '',
  storage_location: '',
  notes: ''
});

const openBatchDialog = () => {
  batchForm.value = {
    quantity: null,
    batch_number: '',
    unit_cost: item.value?.unit_price || null,
    manufacture_date: null,
    expiry_date: null,
    received_date: new Date(),
    supplier: item.value?.supplier || '',
    supplier_batch_number: '',
    storage_location: item.value?.storage_location || '',
    notes: ''
  };
  batchSubmitted.value = false;
  batchDialog.value = true;
};

const saveBatch = async () => {
  batchSubmitted.value = true;
  if (!batchForm.value.quantity || batchForm.value.quantity <= 0) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Quantity is required', life: 3000 });
    return;
  }

  saving.value = true;
  try {
    await inventoryService.createBatch({
      inventory_item_id: parseInt(route.params.id),
      quantity: batchForm.value.quantity,
      batch_number: batchForm.value.batch_number || undefined,
      unit_cost: batchForm.value.unit_cost,
      manufacture_date: formatDateForApi(batchForm.value.manufacture_date),
      expiry_date: formatDateForApi(batchForm.value.expiry_date),
      received_date: formatDateForApi(batchForm.value.received_date),
      supplier: batchForm.value.supplier || undefined,
      supplier_batch_number: batchForm.value.supplier_batch_number || undefined,
      storage_location: batchForm.value.storage_location || undefined,
      notes: batchForm.value.notes || undefined
    });
    toast.add({ severity: 'success', summary: 'Success', detail: 'Batch created successfully', life: 3000 });
    batchDialog.value = false;
    loadBatches();
    loadItem(); // Refresh item to update stock
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to create batch', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const getBatchExpiryClass = (batch) => {
  if (isBatchExpired(batch)) return 'text-red-500 font-medium';
  if (isBatchExpiringSoon(batch)) return 'text-yellow-600 font-medium';
  return '';
};

const isBatchExpired = (batch) => {
  if (!batch.expiry_date) return false;
  return new Date(batch.expiry_date) < new Date();
};

const isBatchExpiringSoon = (batch) => {
  if (!batch.expiry_date) return false;
  const expiryDate = new Date(batch.expiry_date);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
};

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
