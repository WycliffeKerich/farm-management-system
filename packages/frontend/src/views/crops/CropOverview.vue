<template>
  <div class="grid grid-cols-12 gap-6">
    <!-- Page Header -->
    <div class="col-span-12">
      <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">Crop Management</h1>
      <p class="text-surface-600 dark:text-surface-400">Overview of all crop operations, types, varieties, and locations</p>
    </div>

    <!-- Stats Cards -->
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
      <div class="card mb-0 h-full">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Crop Types</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
              {{ loading ? '...' : cropTypes.length }}
            </div>
          </div>
          <div class="flex items-center justify-center bg-green-100 dark:bg-green-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-th-large text-green-500 text-xl!"></i>
          </div>
        </div>
        <span class="text-muted-color">Registered crop types</span>
      </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
      <div class="card mb-0 h-full">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Varieties</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
              {{ loading ? '...' : varieties.length }}
            </div>
          </div>
          <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-list text-blue-500 text-xl!"></i>
          </div>
        </div>
        <span class="text-muted-color">Available varieties</span>
      </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
      <div class="card mb-0 h-full">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Locations</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
              {{ loading ? '...' : locations.length }}
            </div>
          </div>
          <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-map-marker text-orange-500 text-xl!"></i>
          </div>
        </div>
        <span class="text-primary font-medium">{{ activeLocations }}</span>
        <span class="text-muted-color"> active</span>
      </div>
    </div>

    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
      <div class="card mb-0 h-full">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Active Batches</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
              {{ loading ? '...' : totalActiveBatches }}
            </div>
          </div>
          <div class="flex items-center justify-center bg-purple-100 dark:bg-purple-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-seedling text-purple-500 text-xl!"></i>
          </div>
        </div>
        <router-link to="/crops/batches" class="text-primary hover:underline text-sm">
          View all batches <i class="pi pi-arrow-right text-xs"></i>
        </router-link>
      </div>
    </div>

    <!-- Crop Types Section -->
    <div class="col-span-12 xl:col-span-6">
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h5 class="text-lg font-semibold m-0">Crop Types</h5>
          <Button
            label="Add Type"
            icon="pi pi-plus"
            size="small"
            @click="openCropTypeDialog"
          />
        </div>

        <div v-if="loading" class="text-center py-8">
          <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
        </div>

        <div v-else-if="!cropTypes.length" class="text-center py-8">
          <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
          <p class="text-surface-500">No crop types defined yet</p>
          <Button label="Add First Crop Type" icon="pi pi-plus" @click="openCropTypeDialog" class="mt-2" />
        </div>

        <DataTable v-else :value="cropTypes" responsiveLayout="scroll" class="p-datatable-sm">
          <Column field="name" header="Name" sortable />
          <Column field="category" header="Category" sortable>
            <template #body="{ data }">
              <Tag :value="data.category" severity="info" />
            </template>
          </Column>
          <Column field="growing_season" header="Season" />
          <Column header="Actions" style="width: 100px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="editCropType(data)" />
                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDeleteCropType(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <!-- Varieties Section -->
    <div class="col-span-12 xl:col-span-6">
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h5 class="text-lg font-semibold m-0">Varieties</h5>
          <Button
            label="Add Variety"
            icon="pi pi-plus"
            size="small"
            @click="openVarietyDialog"
            :disabled="!cropTypes.length"
          />
        </div>

        <div v-if="loading" class="text-center py-8">
          <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
        </div>

        <div v-else-if="!varieties.length" class="text-center py-8">
          <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
          <p class="text-surface-500">No varieties defined yet</p>
          <p class="text-surface-400 text-sm" v-if="cropTypes.length">Add varieties for your crop types</p>
          <p class="text-surface-400 text-sm" v-else>Add crop types first</p>
        </div>

        <DataTable v-else :value="varieties" responsiveLayout="scroll" class="p-datatable-sm" :paginator="varieties.length > 5" :rows="5">
          <Column field="name" header="Variety" sortable />
          <Column field="crop_type_name" header="Crop Type" sortable />
          <Column field="days_to_maturity" header="Days to Maturity">
            <template #body="{ data }">
              {{ data.days_to_maturity || '-' }}
            </template>
          </Column>
          <Column header="Actions" style="width: 100px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="editVariety(data)" />
                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDeleteVariety(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <!-- Locations Section -->
    <div class="col-span-12">
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h5 class="text-lg font-semibold m-0">Growing Locations</h5>
          <Button
            label="Add Location"
            icon="pi pi-plus"
            size="small"
            @click="openLocationDialog"
          />
        </div>

        <div v-if="loading" class="text-center py-8">
          <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
        </div>

        <div v-else-if="!locations.length" class="text-center py-8">
          <i class="pi pi-map-marker text-4xl text-surface-400 mb-4"></i>
          <p class="text-surface-500">No locations defined yet</p>
          <Button label="Add First Location" icon="pi pi-plus" @click="openLocationDialog" class="mt-2" />
        </div>

        <DataTable v-else :value="locations" responsiveLayout="scroll" class="p-datatable-sm" :paginator="locations.length > 10" :rows="10">
          <Column field="name" header="Name" sortable />
          <Column field="type" header="Type" sortable>
            <template #body="{ data }">
              <Tag :value="formatLocationType(data.type)" :severity="getLocationTypeSeverity(data.type)" />
            </template>
          </Column>
          <Column field="size" header="Size">
            <template #body="{ data }">
              {{ data.size ? `${data.size} ${data.size_unit || 'sq m'}` : '-' }}
            </template>
          </Column>
          <Column field="soil_type" header="Soil Type">
            <template #body="{ data }">
              {{ data.soil_type || '-' }}
            </template>
          </Column>
          <Column field="is_active" header="Status" sortable>
            <template #body="{ data }">
              <Tag :value="data.is_active ? 'Active' : 'Inactive'" :severity="data.is_active ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column header="Actions" style="width: 100px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="editLocation(data)" />
                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDeleteLocation(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <!-- Crop Type Dialog -->
    <Dialog v-model:visible="cropTypeDialog" :header="editingCropType ? 'Edit Crop Type' : 'Add Crop Type'" :modal="true" :style="{ width: '450px' }" :closable="!saving">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="ct_name" class="font-medium">Name *</label>
          <InputText id="ct_name" v-model="cropTypeForm.name" class="w-full" :class="{ 'p-invalid': submitted && !cropTypeForm.name }" />
          <small v-if="submitted && !cropTypeForm.name" class="text-red-500">Name is required</small>
        </div>
        <div class="flex flex-col gap-2">
          <label for="ct_category" class="font-medium">Category *</label>
          <Select id="ct_category" v-model="cropTypeForm.category" :options="categoryOptions" placeholder="Select category" class="w-full" :class="{ 'p-invalid': submitted && !cropTypeForm.category }" />
          <small v-if="submitted && !cropTypeForm.category" class="text-red-500">Category is required</small>
        </div>
        <div class="flex flex-col gap-2">
          <label for="ct_season" class="font-medium">Growing Season</label>
          <InputText id="ct_season" v-model="cropTypeForm.growing_season" class="w-full" placeholder="e.g., Spring-Summer" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="ct_description" class="font-medium">Description</label>
          <Textarea id="ct_description" v-model="cropTypeForm.description" rows="3" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="cropTypeDialog = false" :disabled="saving" />
        <Button :label="editingCropType ? 'Update' : 'Create'" @click="saveCropType" :loading="saving" />
      </template>
    </Dialog>

    <!-- Variety Dialog -->
    <Dialog v-model:visible="varietyDialog" :header="editingVariety ? 'Edit Variety' : 'Add Variety'" :modal="true" :style="{ width: '450px' }" :closable="!saving">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="v_crop_type" class="font-medium">Crop Type *</label>
          <Select id="v_crop_type" v-model="varietyForm.crop_type_id" :options="cropTypes" optionLabel="name" optionValue="id" placeholder="Select crop type" class="w-full" :class="{ 'p-invalid': submitted && !varietyForm.crop_type_id }" />
          <small v-if="submitted && !varietyForm.crop_type_id" class="text-red-500">Crop type is required</small>
        </div>
        <div class="flex flex-col gap-2">
          <label for="v_name" class="font-medium">Variety Name *</label>
          <InputText id="v_name" v-model="varietyForm.name" class="w-full" :class="{ 'p-invalid': submitted && !varietyForm.name }" />
          <small v-if="submitted && !varietyForm.name" class="text-red-500">Name is required</small>
        </div>
        <div class="flex flex-col gap-2">
          <label for="v_days" class="font-medium">Days to Maturity</label>
          <InputNumber id="v_days" v-model="varietyForm.days_to_maturity" :min="1" class="w-full" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="v_yield" class="font-medium">Expected Yield</label>
          <InputText id="v_yield" v-model="varietyForm.expected_yield" class="w-full" placeholder="e.g., 2-3 tons/hectare" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="v_description" class="font-medium">Description</label>
          <Textarea id="v_description" v-model="varietyForm.description" rows="3" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="varietyDialog = false" :disabled="saving" />
        <Button :label="editingVariety ? 'Update' : 'Create'" @click="saveVariety" :loading="saving" />
      </template>
    </Dialog>

    <!-- Location Dialog -->
    <Dialog v-model:visible="locationDialog" :header="editingLocation ? 'Edit Location' : 'Add Location'" :modal="true" :style="{ width: '500px' }" :closable="!saving">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="l_name" class="font-medium">Name *</label>
          <InputText id="l_name" v-model="locationForm.name" class="w-full" :class="{ 'p-invalid': submitted && !locationForm.name }" />
          <small v-if="submitted && !locationForm.name" class="text-red-500">Name is required</small>
        </div>
        <div class="flex flex-col gap-2">
          <label for="l_type" class="font-medium">Type *</label>
          <Select id="l_type" v-model="locationForm.type" :options="locationTypeOptions" optionLabel="label" optionValue="value" placeholder="Select type" class="w-full" :class="{ 'p-invalid': submitted && !locationForm.type }" />
          <small v-if="submitted && !locationForm.type" class="text-red-500">Type is required</small>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="l_size" class="font-medium">Size</label>
            <InputNumber id="l_size" v-model="locationForm.size" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="l_size_unit" class="font-medium">Unit</label>
            <Select id="l_size_unit" v-model="locationForm.size_unit" :options="sizeUnitOptions" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <label for="l_soil" class="font-medium">Soil Type</label>
          <InputText id="l_soil" v-model="locationForm.soil_type" class="w-full" placeholder="e.g., Loamy, Clay, Sandy" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="l_description" class="font-medium">Description</label>
          <Textarea id="l_description" v-model="locationForm.description" rows="2" class="w-full" />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox id="l_active" v-model="locationForm.is_active" :binary="true" />
          <label for="l_active">Active</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="locationDialog = false" :disabled="saving" />
        <Button :label="editingLocation ? 'Update' : 'Create'" @click="saveLocation" :loading="saving" />
      </template>
    </Dialog>

    <!-- Confirm Dialog -->
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
const loading = ref(true);
const saving = ref(false);
const submitted = ref(false);
const cropTypes = ref([]);
const varieties = ref([]);
const locations = ref([]);
const batchStats = ref({});

// Dialogs
const cropTypeDialog = ref(false);
const varietyDialog = ref(false);
const locationDialog = ref(false);
const editingCropType = ref(null);
const editingVariety = ref(null);
const editingLocation = ref(null);

// Forms
const cropTypeForm = ref({ name: '', category: '', growing_season: '', description: '' });
const varietyForm = ref({ crop_type_id: null, name: '', days_to_maturity: null, expected_yield: '', description: '' });
const locationForm = ref({ name: '', type: '', size: null, size_unit: 'sq m', soil_type: '', description: '', is_active: true });

// Options
const categoryOptions = ['vegetables', 'fruits', 'grains', 'legumes', 'herbs', 'flowers', 'other'];
const locationTypeOptions = [
  { label: 'Field', value: 'field' },
  { label: 'Greenhouse', value: 'greenhouse' },
  { label: 'Nursery', value: 'nursery' },
  { label: 'Orchard', value: 'orchard' },
  { label: 'Garden', value: 'garden' },
  { label: 'Other', value: 'other' }
];
const sizeUnitOptions = ['sq m', 'sq ft', 'acres', 'hectares'];

// Computed
const activeLocations = computed(() => locations.value.filter(l => l.is_active).length);
const totalActiveBatches = computed(() => {
  return (batchStats.value.planted_count || 0) +
    (batchStats.value.growing_count || 0) +
    (batchStats.value.harvesting_count || 0);
});

// Load data
const loadData = async () => {
  loading.value = true;
  try {
    const [typesRes, varietiesRes, locationsRes, statsRes] = await Promise.all([
      cropService.getCropTypes(),
      cropService.getVarieties(),
      cropService.getLocations(),
      cropService.getBatchStatistics()
    ]);
    cropTypes.value = typesRes.data.data || [];
    varieties.value = varietiesRes.data.data || [];
    locations.value = locationsRes.data.data || [];
    batchStats.value = statsRes.data.data || {};
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load data', life: 3000 });
  } finally {
    loading.value = false;
  }
};

// Crop Type CRUD
const openCropTypeDialog = () => {
  editingCropType.value = null;
  cropTypeForm.value = { name: '', category: '', growing_season: '', description: '' };
  submitted.value = false;
  cropTypeDialog.value = true;
};

const editCropType = (ct) => {
  editingCropType.value = ct;
  cropTypeForm.value = { ...ct };
  submitted.value = false;
  cropTypeDialog.value = true;
};

const saveCropType = async () => {
  submitted.value = true;
  if (!cropTypeForm.value.name || !cropTypeForm.value.category) return;

  saving.value = true;
  try {
    if (editingCropType.value) {
      await cropService.updateCropType(editingCropType.value.id, cropTypeForm.value);
      toast.add({ severity: 'success', summary: 'Success', detail: 'Crop type updated', life: 3000 });
    } else {
      await cropService.createCropType(cropTypeForm.value);
      toast.add({ severity: 'success', summary: 'Success', detail: 'Crop type created', life: 3000 });
    }
    cropTypeDialog.value = false;
    loadData();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const confirmDeleteCropType = (ct) => {
  confirm.require({
    message: `Delete crop type "${ct.name}"? This may affect related varieties.`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await cropService.deleteCropType(ct.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Crop type deleted', life: 3000 });
        loadData();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to delete', life: 3000 });
      }
    }
  });
};

// Variety CRUD
const openVarietyDialog = () => {
  editingVariety.value = null;
  varietyForm.value = { crop_type_id: null, name: '', days_to_maturity: null, expected_yield: '', description: '' };
  submitted.value = false;
  varietyDialog.value = true;
};

const editVariety = (v) => {
  editingVariety.value = v;
  varietyForm.value = { ...v };
  submitted.value = false;
  varietyDialog.value = true;
};

const saveVariety = async () => {
  submitted.value = true;
  if (!varietyForm.value.name || !varietyForm.value.crop_type_id) return;

  saving.value = true;
  try {
    if (editingVariety.value) {
      await cropService.updateVariety(editingVariety.value.id, varietyForm.value);
      toast.add({ severity: 'success', summary: 'Success', detail: 'Variety updated', life: 3000 });
    } else {
      await cropService.createVariety(varietyForm.value);
      toast.add({ severity: 'success', summary: 'Success', detail: 'Variety created', life: 3000 });
    }
    varietyDialog.value = false;
    loadData();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const confirmDeleteVariety = (v) => {
  confirm.require({
    message: `Delete variety "${v.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await cropService.deleteVariety(v.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Variety deleted', life: 3000 });
        loadData();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to delete', life: 3000 });
      }
    }
  });
};

// Location CRUD
const openLocationDialog = () => {
  editingLocation.value = null;
  locationForm.value = { name: '', type: '', size: null, size_unit: 'sq m', soil_type: '', description: '', is_active: true };
  submitted.value = false;
  locationDialog.value = true;
};

const editLocation = (l) => {
  editingLocation.value = l;
  locationForm.value = { ...l };
  submitted.value = false;
  locationDialog.value = true;
};

const saveLocation = async () => {
  submitted.value = true;
  if (!locationForm.value.name || !locationForm.value.type) return;

  saving.value = true;
  try {
    if (editingLocation.value) {
      await cropService.updateLocation(editingLocation.value.id, locationForm.value);
      toast.add({ severity: 'success', summary: 'Success', detail: 'Location updated', life: 3000 });
    } else {
      await cropService.createLocation(locationForm.value);
      toast.add({ severity: 'success', summary: 'Success', detail: 'Location created', life: 3000 });
    }
    locationDialog.value = false;
    loadData();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const confirmDeleteLocation = (l) => {
  confirm.require({
    message: `Delete location "${l.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await cropService.deleteLocation(l.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Location deleted', life: 3000 });
        loadData();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to delete', life: 3000 });
      }
    }
  });
};

// Utilities
const formatLocationType = (type) => {
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : '';
};

const getLocationTypeSeverity = (type) => {
  switch (type) {
    case 'field': return 'success';
    case 'greenhouse': return 'info';
    case 'nursery': return 'warn';
    case 'orchard': return 'contrast';
    default: return 'secondary';
  }
};

onMounted(() => {
  loadData();
});
</script>
