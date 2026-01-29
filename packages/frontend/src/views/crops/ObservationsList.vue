<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import cropService from '@/services/crop.service';

const router = useRouter();

// State
const loading = ref(true);
const observations = ref([]);
const batches = ref([]);
const cropTypes = ref([]);

// Filters
const filters = ref({
  search: '',
  batchId: null,
  cropTypeId: null,
  growthStage: null,
  startDate: null,
  endDate: null
});

// Dialog state
const showViewDialog = ref(false);
const selectedObservation = ref(null);

// Growth stages
const growthStages = [
  'germination',
  'seedling',
  'vegetative',
  'flowering',
  'fruiting',
  'ripening',
  'harvest_ready'
];

// Load data
const loadData = async () => {
  loading.value = true;
  try {
    const [batchesRes, cropTypesRes] = await Promise.all([
      cropService.getBatches(),
      cropService.getCropTypes()
    ]);

    batches.value = batchesRes.data.data || [];
    cropTypes.value = cropTypesRes.data.data || [];

    // Load observations from all batches
    await loadAllObservations();
  } catch (error) {
    console.error('Failed to load data:', error);
  } finally {
    loading.value = false;
  }
};

const loadAllObservations = async () => {
  try {
    // Get observations from all batches
    const allObservations = [];

    for (const batch of batches.value) {
      try {
        const res = await cropService.getBatchObservations(batch.id);
        const batchObservations = res.data.data || [];
        // Add batch info to each observation
        batchObservations.forEach(obs => {
          allObservations.push({
            ...obs,
            batch_id: batch.id,
            batch_code: batch.batch_code,
            crop_type_id: batch.crop_type_id,
            crop_type_name: batch.crop_type_name,
            variety_name: batch.variety_name
          });
        });
      } catch (err) {
        console.error(`Failed to load observations for batch ${batch.id}:`, err);
      }
    }

    // Sort by date descending
    observations.value = allObservations.sort((a, b) =>
      new Date(b.observation_date) - new Date(a.observation_date)
    );
  } catch (error) {
    console.error('Failed to load observations:', error);
  }
};

// Filtered observations
const filteredObservations = computed(() => {
  let result = observations.value;

  if (filters.value.search) {
    const search = filters.value.search.toLowerCase();
    result = result.filter(obs =>
      obs.batch_code?.toLowerCase().includes(search) ||
      obs.crop_type_name?.toLowerCase().includes(search) ||
      obs.notes?.toLowerCase().includes(search)
    );
  }

  if (filters.value.batchId) {
    result = result.filter(obs => obs.batch_id === filters.value.batchId);
  }

  if (filters.value.cropTypeId) {
    result = result.filter(obs => obs.crop_type_id === filters.value.cropTypeId);
  }

  if (filters.value.growthStage) {
    result = result.filter(obs => obs.growth_stage === filters.value.growthStage);
  }

  if (filters.value.startDate) {
    result = result.filter(obs => new Date(obs.observation_date) >= new Date(filters.value.startDate));
  }

  if (filters.value.endDate) {
    result = result.filter(obs => new Date(obs.observation_date) <= new Date(filters.value.endDate));
  }

  return result;
});

// Statistics
const stats = computed(() => {
  const total = filteredObservations.value.length;
  const stageCounts = {};
  const healthCounts = { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 };

  filteredObservations.value.forEach(obs => {
    if (obs.growth_stage) {
      stageCounts[obs.growth_stage] = (stageCounts[obs.growth_stage] || 0) + 1;
    }
    if (obs.health_status) {
      healthCounts[obs.health_status] = (healthCounts[obs.health_status] || 0) + 1;
    }
  });

  return { total, stageCounts, healthCounts };
});

// View observation details
const viewObservation = (observation) => {
  selectedObservation.value = observation;
  showViewDialog.value = true;
};

// Navigate to batch
const goToBatch = (batchId) => {
  router.push({ name: 'crop-batch-detail', params: { id: batchId } });
};

// Clear filters
const clearFilters = () => {
  filters.value = {
    search: '',
    batchId: null,
    cropTypeId: null,
    growthStage: null,
    startDate: null,
    endDate: null
  };
};

// Format date
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

// Format growth stage
const formatGrowthStage = (stage) => {
  if (!stage) return '-';
  return stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Get health status severity
const getHealthSeverity = (status) => {
  switch (status) {
    case 'excellent': return 'success';
    case 'good': return 'info';
    case 'fair': return 'warn';
    case 'poor': return 'danger';
    case 'critical': return 'danger';
    default: return 'secondary';
  }
};

// Get stage severity
const getStageSeverity = (stage) => {
  switch (stage) {
    case 'germination': return 'info';
    case 'seedling': return 'info';
    case 'vegetative': return 'success';
    case 'flowering': return 'warn';
    case 'fruiting': return 'warn';
    case 'ripening': return 'success';
    case 'harvest_ready': return 'success';
    default: return 'secondary';
  }
};

// Lifecycle
onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="grid grid-cols-12 gap-6">
    <!-- Page Header -->
    <div class="col-span-12">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">Growth Observations</h1>
          <p class="text-surface-600 dark:text-surface-400">View and track growth observations across all crop batches</p>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="col-span-12 lg:col-span-3">
      <div class="card mb-0 h-full">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Total Observations</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
              {{ loading ? '...' : stats.total }}
            </div>
          </div>
          <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-eye text-blue-500 text-xl!"></i>
          </div>
        </div>
        <span class="text-muted-color">Across all batches</span>
      </div>
    </div>

    <div class="col-span-12 lg:col-span-3">
      <div class="card mb-0 h-full">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Excellent Health</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
              {{ loading ? '...' : stats.healthCounts.excellent }}
            </div>
          </div>
          <div class="flex items-center justify-center bg-green-100 dark:bg-green-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-check-circle text-green-500 text-xl!"></i>
          </div>
        </div>
        <span class="text-green-500 font-medium">{{ stats.healthCounts.good }} good</span>
      </div>
    </div>

    <div class="col-span-12 lg:col-span-3">
      <div class="card mb-0 h-full">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Needs Attention</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
              {{ loading ? '...' : stats.healthCounts.fair }}
            </div>
          </div>
          <div class="flex items-center justify-center bg-yellow-100 dark:bg-yellow-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-exclamation-circle text-yellow-500 text-xl!"></i>
          </div>
        </div>
        <span class="text-muted-color">Fair condition</span>
      </div>
    </div>

    <div class="col-span-12 lg:col-span-3">
      <div class="card mb-0 h-full">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Critical</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
              {{ loading ? '...' : (stats.healthCounts.poor + stats.healthCounts.critical) }}
            </div>
          </div>
          <div class="flex items-center justify-center bg-red-100 dark:bg-red-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-exclamation-triangle text-red-500 text-xl!"></i>
          </div>
        </div>
        <span class="text-red-500 font-medium">Requires immediate action</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="col-span-12">
      <div class="card">
        <div class="flex flex-wrap gap-4 items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="block text-sm font-medium mb-2">Search</label>
            <InputText v-model="filters.search" placeholder="Search observations..." class="w-full" />
          </div>
          <div class="w-48">
            <label class="block text-sm font-medium mb-2">Batch</label>
            <Select
              v-model="filters.batchId"
              :options="batches"
              optionLabel="batch_code"
              optionValue="id"
              placeholder="All Batches"
              class="w-full"
              showClear
            />
          </div>
          <div class="w-48">
            <label class="block text-sm font-medium mb-2">Crop Type</label>
            <Select
              v-model="filters.cropTypeId"
              :options="cropTypes"
              optionLabel="name"
              optionValue="id"
              placeholder="All Types"
              class="w-full"
              showClear
            />
          </div>
          <div class="w-48">
            <label class="block text-sm font-medium mb-2">Growth Stage</label>
            <Select
              v-model="filters.growthStage"
              :options="growthStages.map(s => ({ label: formatGrowthStage(s), value: s }))"
              optionLabel="label"
              optionValue="value"
              placeholder="All Stages"
              class="w-full"
              showClear
            />
          </div>
          <div class="w-40">
            <label class="block text-sm font-medium mb-2">From Date</label>
            <DatePicker v-model="filters.startDate" placeholder="Start" class="w-full" showIcon />
          </div>
          <div class="w-40">
            <label class="block text-sm font-medium mb-2">To Date</label>
            <DatePicker v-model="filters.endDate" placeholder="End" class="w-full" showIcon />
          </div>
          <Button label="Clear" icon="pi pi-filter-slash" severity="secondary" @click="clearFilters" />
        </div>
      </div>
    </div>

    <!-- Observations Table -->
    <div class="col-span-12">
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h5 class="text-lg font-semibold m-0">All Observations</h5>
          <span class="text-muted-color text-sm">{{ filteredObservations.length }} records</span>
        </div>

        <div v-if="loading" class="text-center py-8">
          <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
        </div>

        <div v-else-if="!filteredObservations.length" class="text-center py-8">
          <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
          <p class="text-surface-500">No observations found</p>
        </div>

        <DataTable
          v-else
          :value="filteredObservations"
          :paginator="true"
          :rows="10"
          :rowsPerPageOptions="[10, 25, 50]"
          responsiveLayout="scroll"
          class="p-datatable-sm"
          sortField="observation_date"
          :sortOrder="-1"
        >
          <Column field="observation_date" header="Date" sortable>
            <template #body="{ data }">
              {{ formatDate(data.observation_date) }}
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
          <Column field="crop_type_name" header="Crop" sortable />
          <Column field="variety_name" header="Variety" />
          <Column field="growth_stage" header="Growth Stage" sortable>
            <template #body="{ data }">
              <Tag v-if="data.growth_stage" :severity="getStageSeverity(data.growth_stage)" :value="formatGrowthStage(data.growth_stage)" />
              <span v-else class="text-surface-400">-</span>
            </template>
          </Column>
          <Column field="health_status" header="Health" sortable>
            <template #body="{ data }">
              <Tag v-if="data.health_status" :severity="getHealthSeverity(data.health_status)" :value="data.health_status" />
              <span v-else class="text-surface-400">-</span>
            </template>
          </Column>
          <Column field="height_cm" header="Height (cm)">
            <template #body="{ data }">
              {{ data.height_cm || '-' }}
            </template>
          </Column>
          <Column header="Actions" style="width: 100px">
            <template #body="{ data }">
              <div class="flex gap-2">
                <Button icon="pi pi-eye" severity="info" text rounded @click="viewObservation(data)" />
                <Button icon="pi pi-external-link" severity="secondary" text rounded @click="goToBatch(data.batch_id)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <!-- View Observation Dialog -->
    <Dialog v-model:visible="showViewDialog" modal header="Observation Details" :style="{ width: '500px' }">
      <div v-if="selectedObservation" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-muted-color mb-1">Batch</label>
            <router-link
              :to="{ name: 'crop-batch-detail', params: { id: selectedObservation.batch_id } }"
              class="text-primary font-medium hover:underline"
            >
              {{ selectedObservation.batch_code }}
            </router-link>
          </div>
          <div>
            <label class="block text-sm text-muted-color mb-1">Date</label>
            <p class="font-medium">{{ formatDate(selectedObservation.observation_date) }}</p>
          </div>
          <div>
            <label class="block text-sm text-muted-color mb-1">Crop</label>
            <p class="font-medium">{{ selectedObservation.crop_type_name }}</p>
          </div>
          <div>
            <label class="block text-sm text-muted-color mb-1">Variety</label>
            <p class="font-medium">{{ selectedObservation.variety_name || '-' }}</p>
          </div>
          <div>
            <label class="block text-sm text-muted-color mb-1">Growth Stage</label>
            <Tag v-if="selectedObservation.growth_stage" :severity="getStageSeverity(selectedObservation.growth_stage)" :value="formatGrowthStage(selectedObservation.growth_stage)" />
            <span v-else>-</span>
          </div>
          <div>
            <label class="block text-sm text-muted-color mb-1">Health Status</label>
            <Tag v-if="selectedObservation.health_status" :severity="getHealthSeverity(selectedObservation.health_status)" :value="selectedObservation.health_status" />
            <span v-else>-</span>
          </div>
          <div>
            <label class="block text-sm text-muted-color mb-1">Height</label>
            <p class="font-medium">{{ selectedObservation.height_cm ? selectedObservation.height_cm + ' cm' : '-' }}</p>
          </div>
          <div>
            <label class="block text-sm text-muted-color mb-1">Leaf Count</label>
            <p class="font-medium">{{ selectedObservation.leaf_count || '-' }}</p>
          </div>
        </div>
        <div v-if="selectedObservation.notes">
          <label class="block text-sm text-muted-color mb-1">Notes</label>
          <p class="font-medium whitespace-pre-wrap">{{ selectedObservation.notes }}</p>
        </div>
      </div>
      <template #footer>
        <Button label="Go to Batch" icon="pi pi-external-link" @click="goToBatch(selectedObservation?.batch_id); showViewDialog = false" />
        <Button label="Close" severity="secondary" @click="showViewDialog = false" />
      </template>
    </Dialog>
  </div>
</template>
