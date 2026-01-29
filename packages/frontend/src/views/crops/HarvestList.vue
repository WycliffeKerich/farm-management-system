<template>
  <div class="card">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Harvests</h2>
        <p class="text-surface-600 dark:text-surface-400">Track and manage all harvest records</p>
      </div>
      <Button
        label="Record Harvest"
        icon="pi pi-plus"
        @click="openNewHarvestDialog"
        class="mt-4 md:mt-0"
      />
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="flex-1">
        <InputText
          v-model="filters.search"
          placeholder="Search harvests..."
          class="w-full"
          @input="debouncedSearch"
        />
      </div>
      <Select
        v-model="filters.crop_type_id"
        :options="cropTypes"
        optionLabel="name"
        optionValue="id"
        placeholder="All Crop Types"
        class="w-full md:w-48"
        showClear
        @change="loadHarvests"
      />
      <DatePicker
        v-model="filters.dateRange"
        selectionMode="range"
        placeholder="Date Range"
        class="w-full md:w-56"
        dateFormat="yy-mm-dd"
        showButtonBar
        @date-select="loadHarvests"
      />
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-600 dark:text-green-400 text-sm font-medium">Total Harvests</p>
            <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ summary.total_harvests || 0 }}</p>
          </div>
          <i class="pi pi-box text-3xl text-green-400"></i>
        </div>
      </div>
      <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Quantity</p>
            <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ formatNumber(summary.total_quantity || 0) }}</p>
          </div>
          <i class="pi pi-chart-bar text-3xl text-blue-400"></i>
        </div>
      </div>
      <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-yellow-600 dark:text-yellow-400 text-sm font-medium">Avg Quantity</p>
            <p class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{{ formatNumber(summary.avg_quantity || 0) }}</p>
          </div>
          <i class="pi pi-calculator text-3xl text-yellow-400"></i>
        </div>
      </div>
      <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-purple-600 dark:text-purple-400 text-sm font-medium">Unique Batches</p>
            <p class="text-2xl font-bold text-purple-900 dark:text-purple-100">{{ summary.unique_batches || 0 }}</p>
          </div>
          <i class="pi pi-hashtag text-3xl text-purple-400"></i>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <DataTable
      :value="harvests"
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
          <p class="text-surface-600 dark:text-surface-400">No harvests found</p>
        </div>
      </template>

      <Column field="harvest_date" header="Date" sortable>
        <template #body="{ data }">
          {{ formatDate(data.harvest_date) }}
        </template>
      </Column>

      <Column field="batch_code" header="Batch" sortable>
        <template #body="{ data }">
          <router-link
            :to="{ name: 'crop-batch-detail', params: { id: data.batch_id } }"
            class="text-primary font-medium hover:underline"
          >
            {{ data.batch_code }}
          </router-link>
        </template>
      </Column>

      <Column field="crop_type_name" header="Crop Type" sortable />

      <Column field="variety_name" header="Variety" sortable />

      <Column field="quantity" header="Quantity" sortable>
        <template #body="{ data }">
          <span class="font-medium">{{ formatNumber(data.quantity) }}</span> {{ data.unit }}
        </template>
      </Column>

      <Column field="quality_grade" header="Quality" sortable>
        <template #body="{ data }">
          <Tag v-if="data.quality_grade" :severity="getQualityColor(data.quality_grade)" :value="'Grade ' + data.quality_grade" />
          <span v-else class="text-surface-400">-</span>
        </template>
      </Column>

      <Column field="harvested_by" header="Harvested By" sortable>
        <template #body="{ data }">
          {{ data.harvested_by || '-' }}
        </template>
      </Column>

      <Column header="Actions" style="width: 100px">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="pi pi-eye"
              severity="info"
              text
              rounded
              @click="viewHarvest(data)"
              v-tooltip.top="'View Details'"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="confirmDelete(data)"
              v-tooltip.top="'Delete'"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- New Harvest Dialog -->
    <Dialog
      v-model:visible="harvestDialog"
      header="Record Harvest"
      :modal="true"
      :style="{ width: '500px' }"
      :closable="!saving"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="batch" class="font-medium">Crop Batch *</label>
          <Select
            id="batch"
            v-model="harvestForm.batch_id"
            :options="activeBatches"
            optionLabel="display_name"
            optionValue="id"
            placeholder="Select batch"
            class="w-full"
            filter
            :class="{ 'p-invalid': submitted && !harvestForm.batch_id }"
          />
          <small v-if="submitted && !harvestForm.batch_id" class="text-red-500">
            Batch is required
          </small>
        </div>

        <div class="flex flex-col gap-2">
          <label for="harvest_date" class="font-medium">Harvest Date *</label>
          <DatePicker
            id="harvest_date"
            v-model="harvestForm.harvest_date"
            dateFormat="yy-mm-dd"
            class="w-full"
            :class="{ 'p-invalid': submitted && !harvestForm.harvest_date }"
          />
          <small v-if="submitted && !harvestForm.harvest_date" class="text-red-500">
            Harvest date is required
          </small>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="quantity" class="font-medium">Quantity *</label>
            <InputNumber
              id="quantity"
              v-model="harvestForm.quantity"
              :min="0.01"
              :minFractionDigits="0"
              :maxFractionDigits="2"
              class="w-full"
              :class="{ 'p-invalid': submitted && !harvestForm.quantity }"
            />
            <small v-if="submitted && !harvestForm.quantity" class="text-red-500">
              Quantity is required
            </small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="unit" class="font-medium">Unit *</label>
            <Select
              id="unit"
              v-model="harvestForm.unit"
              :options="unitOptions"
              placeholder="Select unit"
              class="w-full"
              :class="{ 'p-invalid': submitted && !harvestForm.unit }"
            />
            <small v-if="submitted && !harvestForm.unit" class="text-red-500">
              Unit is required
            </small>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label for="quality_grade" class="font-medium">Quality Grade</label>
          <Select
            id="quality_grade"
            v-model="harvestForm.quality_grade"
            :options="qualityOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select grade"
            class="w-full"
            showClear
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="harvested_by" class="font-medium">Harvested By</label>
          <InputText
            id="harvested_by"
            v-model="harvestForm.harvested_by"
            placeholder="Name of person who harvested"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="notes" class="font-medium">Notes</label>
          <Textarea
            id="notes"
            v-model="harvestForm.notes"
            rows="3"
            class="w-full"
            placeholder="Additional notes about this harvest..."
          />
        </div>
      </div>

      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          @click="closeHarvestDialog"
          :disabled="saving"
        />
        <Button
          label="Record"
          @click="saveHarvest"
          :loading="saving"
        />
      </template>
    </Dialog>

    <!-- View Harvest Dialog -->
    <Dialog
      v-model:visible="viewDialog"
      header="Harvest Details"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div v-if="selectedHarvest" class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm text-surface-500">Batch</label>
            <p class="font-medium">{{ selectedHarvest.batch_code }}</p>
          </div>
          <div>
            <label class="text-sm text-surface-500">Date</label>
            <p class="font-medium">{{ formatDate(selectedHarvest.harvest_date) }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm text-surface-500">Crop Type</label>
            <p class="font-medium">{{ selectedHarvest.crop_type_name }}</p>
          </div>
          <div>
            <label class="text-sm text-surface-500">Variety</label>
            <p class="font-medium">{{ selectedHarvest.variety_name }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm text-surface-500">Quantity</label>
            <p class="font-medium">{{ formatNumber(selectedHarvest.quantity) }} {{ selectedHarvest.unit }}</p>
          </div>
          <div>
            <label class="text-sm text-surface-500">Quality Grade</label>
            <Tag
              v-if="selectedHarvest.quality_grade"
              :severity="getQualityColor(selectedHarvest.quality_grade)"
              :value="'Grade ' + selectedHarvest.quality_grade"
            />
            <p v-else class="text-surface-400">Not graded</p>
          </div>
        </div>

        <div v-if="selectedHarvest.harvested_by">
          <label class="text-sm text-surface-500">Harvested By</label>
          <p class="font-medium">{{ selectedHarvest.harvested_by }}</p>
        </div>

        <div v-if="selectedHarvest.notes">
          <label class="text-sm text-surface-500">Notes</label>
          <p class="text-surface-700 dark:text-surface-300">{{ selectedHarvest.notes }}</p>
        </div>
      </div>

      <template #footer>
        <Button label="Close" @click="viewDialog = false" />
      </template>
    </Dialog>

    <!-- Delete Confirmation -->
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import cropService from '@/services/crop.service';

const confirm = useConfirm();
const toast = useToast();

// State
const loading = ref(false);
const saving = ref(false);
const harvests = ref([]);
const activeBatches = ref([]);
const cropTypes = ref([]);
const summary = ref({});
const harvestDialog = ref(false);
const viewDialog = ref(false);
const selectedHarvest = ref(null);
const submitted = ref(false);

// Filters
const filters = ref({
  search: '',
  crop_type_id: null,
  dateRange: null
});

// Form
const harvestForm = ref({
  batch_id: null,
  harvest_date: new Date(),
  quantity: null,
  unit: null,
  quality_grade: null,
  harvested_by: '',
  notes: ''
});

// Options
const unitOptions = ['kg', 'tons', 'bunches', 'pieces', 'crates', 'bags'];

const qualityOptions = [
  { label: 'Grade A - Premium', value: 'A' },
  { label: 'Grade B - Good', value: 'B' },
  { label: 'Grade C - Standard', value: 'C' },
  { label: 'Grade D - Below Standard', value: 'D' }
];

// Methods
const loadHarvests = async () => {
  loading.value = true;
  try {
    const params = {};

    if (filters.value.search) {
      params.search = filters.value.search;
    }
    if (filters.value.crop_type_id) {
      params.crop_type_id = filters.value.crop_type_id;
    }
    if (filters.value.dateRange && filters.value.dateRange.length === 2) {
      params.start_date = formatDateForApi(filters.value.dateRange[0]);
      params.end_date = formatDateForApi(filters.value.dateRange[1]);
    }

    const response = await cropService.getHarvests(params);
    harvests.value = response.data.data || [];

    // Calculate summary
    calculateSummary();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to load harvests',
      life: 3000
    });
  } finally {
    loading.value = false;
  }
};

const calculateSummary = () => {
  const data = harvests.value;
  const uniqueBatchIds = new Set(data.map(h => h.batch_id));
  const totalQty = data.reduce((sum, h) => sum + (parseFloat(h.quantity) || 0), 0);

  summary.value = {
    total_harvests: data.length,
    total_quantity: totalQty,
    avg_quantity: data.length > 0 ? totalQty / data.length : 0,
    unique_batches: uniqueBatchIds.size
  };
};

const loadActiveBatches = async () => {
  try {
    const response = await cropService.getBatches({ status: 'growing,harvesting' });
    activeBatches.value = (response.data.data || []).map(batch => ({
      ...batch,
      display_name: `${batch.batch_code} - ${batch.crop_type_name} (${batch.variety_name})`
    }));
  } catch (error) {
    console.error('Failed to load batches:', error);
  }
};

const loadCropTypes = async () => {
  try {
    const response = await cropService.getCropTypes();
    cropTypes.value = response.data.data || [];
  } catch (error) {
    console.error('Failed to load crop types:', error);
  }
};

const openNewHarvestDialog = () => {
  harvestForm.value = {
    batch_id: null,
    harvest_date: new Date(),
    quantity: null,
    unit: 'kg',
    quality_grade: null,
    harvested_by: '',
    notes: ''
  };
  submitted.value = false;
  harvestDialog.value = true;
};

const closeHarvestDialog = () => {
  harvestDialog.value = false;
};

const saveHarvest = async () => {
  submitted.value = true;

  if (!harvestForm.value.batch_id || !harvestForm.value.harvest_date ||
      !harvestForm.value.quantity || !harvestForm.value.unit) {
    return;
  }

  saving.value = true;
  try {
    const data = {
      harvest_date: formatDateForApi(harvestForm.value.harvest_date),
      quantity: harvestForm.value.quantity,
      unit: harvestForm.value.unit,
      quality_grade: harvestForm.value.quality_grade,
      harvested_by: harvestForm.value.harvested_by,
      notes: harvestForm.value.notes
    };

    await cropService.recordHarvest(harvestForm.value.batch_id, data);

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Harvest recorded successfully',
      life: 3000
    });

    closeHarvestDialog();
    loadHarvests();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to record harvest',
      life: 3000
    });
  } finally {
    saving.value = false;
  }
};

const viewHarvest = (harvest) => {
  selectedHarvest.value = harvest;
  viewDialog.value = true;
};

const confirmDelete = (harvest) => {
  confirm.require({
    message: `Are you sure you want to delete this harvest record?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteHarvest(harvest)
  });
};

const deleteHarvest = async (harvest) => {
  try {
    await cropService.deleteHarvest(harvest.id);
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Harvest deleted successfully',
      life: 3000
    });
    loadHarvests();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to delete harvest',
      life: 3000
    });
  }
};

// Utility functions
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString();
};

const formatDateForApi = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const getQualityColor = (grade) => {
  switch (grade) {
    case 'A': return 'success';
    case 'B': return 'info';
    case 'C': return 'warn';
    case 'D': return 'danger';
    default: return 'secondary';
  }
};

let searchTimeout = null;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadHarvests();
  }, 300);
};

// Lifecycle
onMounted(() => {
  loadHarvests();
  loadActiveBatches();
  loadCropTypes();
});
</script>
