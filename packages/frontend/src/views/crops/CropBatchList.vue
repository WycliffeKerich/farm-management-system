<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import cropService from '@/services/crop.service';

const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

// State
const loading = ref(false);
const saving = ref(false);
const batches = ref([]);
const cropTypes = ref([]);
const varieties = ref([]);
const locations = ref([]);
const statistics = ref({});
const batchDialog = ref(false);
const editingBatch = ref(null);
const submitted = ref(false);
const availableCarePlans = ref([]);
const loadingCarePlans = ref(false);

// Filters
const filters = ref({
    search: '',
    status: null,
    crop_type_id: null,
    location_id: null
});

// Form
const batchForm = ref({
    crop_type_id: null,
    crop_variety_id: null,
    location_id: null,
    planting_date: null,
    quantity_planted: null,
    unit: null,
    status: 'planted',
    notes: '',
    care_plan_id: null
});

// Options
const statusOptions = [
    { label: 'Planted', value: 'planted' },
    { label: 'Growing', value: 'growing' },
    { label: 'Harvesting', value: 'harvesting' },
    { label: 'Completed', value: 'completed' }
];

const unitOptions = ['seedlings', 'seeds', 'plants', 'trays', 'bags', 'kg'];

// Computed
const filteredVarieties = computed(() => {
    if (!batchForm.value.crop_type_id) return [];
    return varieties.value.filter((v) => v.crop_type_id === batchForm.value.crop_type_id);
});

// Methods
const loadBatches = async () => {
    loading.value = true;
    try {
        const params = { ...filters.value };
        Object.keys(params).forEach((key) => {
            if (params[key] === null || params[key] === '') {
                delete params[key];
            }
        });

        const response = await cropService.getBatches(params);
        batches.value = response.data.data;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to load batches',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const loadStatistics = async () => {
    try {
        const response = await cropService.getBatchStatistics();
        statistics.value = response.data.data;
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
};

const loadCropTypes = async () => {
    try {
        const response = await cropService.getCropTypes();
        cropTypes.value = response.data.data;
    } catch (error) {
        console.error('Failed to load crop types:', error);
    }
};

const loadVarieties = async () => {
    try {
        const response = await cropService.getVarieties();
        varieties.value = response.data.data;
    } catch (error) {
        console.error('Failed to load varieties:', error);
    }
};

const loadLocations = async () => {
    try {
        const response = await cropService.getLocations(true);
        locations.value = response.data.data;
    } catch (error) {
        console.error('Failed to load locations:', error);
    }
};

const loadCarePlans = async () => {
    loadingCarePlans.value = true;
    try {
        const response = await cropService.getCarePlans({ status: 'active' });
        availableCarePlans.value = (response.data.data || []).map((p) => ({
            ...p,
            display_name: `${p.name} (${p.task_count} tasks)`
        }));
    } catch (error) {
        console.error('Failed to load care plans:', error);
    } finally {
        loadingCarePlans.value = false;
    }
};

const openNewBatchDialog = async () => {
    editingBatch.value = null;
    batchForm.value = {
        crop_type_id: null,
        crop_variety_id: null,
        location_id: null,
        planting_date: new Date(),
        quantity_planted: null,
        unit: null,
        status: 'planted',
        notes: '',
        care_plan_id: null
    };
    submitted.value = false;
    batchDialog.value = true;
    // Load care plans when opening new batch dialog
    await loadCarePlans();
};

const editBatch = (batch) => {
    editingBatch.value = batch;
    const cropType = cropTypes.value.find((ct) => ct.name === batch.crop_type_name);

    batchForm.value = {
        crop_type_id: cropType?.id || null,
        crop_variety_id: batch.crop_variety_id,
        location_id: batch.location_id,
        planting_date: new Date(batch.planting_date),
        quantity_planted: batch.quantity_planted,
        unit: batch.unit,
        status: batch.status,
        notes: batch.notes || ''
    };
    submitted.value = false;
    batchDialog.value = true;
};

const closeBatchDialog = () => {
    batchDialog.value = false;
    editingBatch.value = null;
};

const onCropTypeChange = () => {
    batchForm.value.crop_variety_id = null;
};

const saveBatch = async () => {
    submitted.value = true;

    if (!batchForm.value.crop_variety_id || !batchForm.value.planting_date || !batchForm.value.quantity_planted || !batchForm.value.unit) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            crop_variety_id: batchForm.value.crop_variety_id,
            location_id: batchForm.value.location_id,
            planting_date: formatDateForApi(batchForm.value.planting_date),
            quantity_planted: batchForm.value.quantity_planted,
            unit: batchForm.value.unit,
            notes: batchForm.value.notes
        };

        if (editingBatch.value) {
            data.status = batchForm.value.status;
            await cropService.updateBatch(editingBatch.value.id, data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Batch updated successfully',
                life: 3000
            });
        } else {
            // Create the batch
            const response = await cropService.createBatch(data);
            const newBatchId = response.data.data?.id;

            // If a care plan was selected, apply it to the new batch
            if (batchForm.value.care_plan_id && newBatchId) {
                try {
                    await cropService.applyCarePlanToBatch(newBatchId, batchForm.value.care_plan_id);
                    toast.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Batch created and care plan applied successfully',
                        life: 3000
                    });
                } catch (carePlanError) {
                    // Batch was created but care plan failed
                    toast.add({
                        severity: 'warn',
                        summary: 'Partial Success',
                        detail: 'Batch created but failed to apply care plan. You can apply it from the batch detail page.',
                        life: 5000
                    });
                }
            } else {
                toast.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'Batch created successfully',
                    life: 3000
                });
            }
        }

        closeBatchDialog();
        loadBatches();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to save batch',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const viewBatch = (batch) => {
    router.push({ name: 'crop-batch-detail', params: { id: batch.id } });
};

const confirmDelete = (batch) => {
    confirm.require({
        message: `Are you sure you want to delete batch ${batch.batch_code}?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deleteBatch(batch)
    });
};

const deleteBatch = async (batch) => {
    try {
        await cropService.deleteBatch(batch.id);
        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Batch deleted successfully',
            life: 3000
        });
        loadBatches();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to delete batch',
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

const formatStatus = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
};

const getStatusSeverity = (status) => {
    switch (status) {
        case 'planted':
            return 'info';
        case 'growing':
            return 'success';
        case 'harvesting':
            return 'warn';
        case 'completed':
            return 'secondary';
        default:
            return 'info';
    }
};

let searchTimeout = null;
const debouncedSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadBatches();
    }, 300);
};

// Lifecycle
onMounted(() => {
    loadBatches();
    loadStatistics();
    loadCropTypes();
    loadVarieties();
    loadLocations();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Crop Batches</h2>
                <p class="text-surface-600 dark:text-surface-400">Manage your crop plantings and track their progress</p>
            </div>
            <Button label="New Batch" icon="pi pi-plus" @click="openNewBatchDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="flex-1">
                <InputText v-model="filters.search" placeholder="Search batches..." class="w-full" @input="debouncedSearch" />
            </div>
            <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="All Statuses" class="w-full md:w-48" showClear @change="loadBatches" />
            <Select v-model="filters.crop_type_id" :options="cropTypes" optionLabel="name" optionValue="id" placeholder="All Crop Types" class="w-full md:w-48" showClear @change="loadBatches" />
            <Select v-model="filters.location_id" :options="locations" optionLabel="name" optionValue="id" placeholder="All Locations" class="w-full md:w-48" showClear @change="loadBatches" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Planted</p>
                        <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ statistics.planted_count || 0 }}</p>
                    </div>
                    <i class="pi pi-seedling text-3xl text-blue-400"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-600 dark:text-green-400 text-sm font-medium">Growing</p>
                        <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ statistics.growing_count || 0 }}</p>
                    </div>
                    <i class="pi pi-sun text-3xl text-green-400"></i>
                </div>
            </div>
            <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-yellow-600 dark:text-yellow-400 text-sm font-medium">Harvesting</p>
                        <p class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{{ statistics.harvesting_count || 0 }}</p>
                    </div>
                    <i class="pi pi-box text-3xl text-yellow-400"></i>
                </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 dark:text-gray-400 text-sm font-medium">Completed</p>
                        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ statistics.completed_count || 0 }}</p>
                    </div>
                    <i class="pi pi-check-circle text-3xl text-gray-400"></i>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <DataTable :value="batches" :loading="loading" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No batches found</p>
                </div>
            </template>

            <Column field="batch_code" header="Batch Code" sortable>
                <template #body="{ data }">
                    <router-link :to="{ name: 'crop-batch-detail', params: { id: data.id } }" class="text-primary font-medium hover:underline">
                        {{ data.batch_code }}
                    </router-link>
                </template>
            </Column>

            <Column field="crop_type_name" header="Crop Type" sortable />

            <Column field="variety_name" header="Variety" sortable />

            <Column field="location_name" header="Location" sortable>
                <template #body="{ data }">
                    {{ data.location_name || 'Not assigned' }}
                </template>
            </Column>

            <Column field="planting_date" header="Planted" sortable>
                <template #body="{ data }">
                    {{ formatDate(data.planting_date) }}
                </template>
            </Column>

            <Column field="quantity_planted" header="Quantity" sortable>
                <template #body="{ data }"> {{ data.quantity_planted }} {{ data.unit }} </template>
            </Column>

            <Column field="status" header="Status" sortable>
                <template #body="{ data }">
                    <Tag :severity="getStatusSeverity(data.status)" :value="formatStatus(data.status)" />
                </template>
            </Column>

            <Column header="Actions" style="width: 120px">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-eye" severity="info" text rounded @click="viewBatch(data)" v-tooltip.top="'View'" />
                        <Button icon="pi pi-pencil" severity="secondary" text rounded @click="editBatch(data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- New/Edit Batch Dialog -->
        <Dialog v-model:visible="batchDialog" :header="editingBatch ? 'Edit Batch' : 'New Crop Batch'" :modal="true" :style="{ width: '600px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="crop_type" class="font-medium">Crop Type *</label>
                        <Select
                            id="crop_type"
                            v-model="batchForm.crop_type_id"
                            :options="cropTypes"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Select crop type"
                            class="w-full"
                            @change="onCropTypeChange"
                            :class="{ 'p-invalid': submitted && !batchForm.crop_type_id }"
                        />
                        <small v-if="submitted && !batchForm.crop_type_id" class="text-red-500"> Crop type is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="variety" class="font-medium">Variety *</label>
                        <Select
                            id="variety"
                            v-model="batchForm.crop_variety_id"
                            :options="filteredVarieties"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Select variety"
                            class="w-full"
                            :disabled="!batchForm.crop_type_id"
                            :class="{ 'p-invalid': submitted && !batchForm.crop_variety_id }"
                        />
                        <small v-if="submitted && !batchForm.crop_variety_id" class="text-red-500"> Variety is required </small>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="location" class="font-medium">Location</label>
                        <Select id="location" v-model="batchForm.location_id" :options="locations" optionLabel="name" optionValue="id" placeholder="Select location" class="w-full" showClear />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="planting_date" class="font-medium">Planting Date *</label>
                        <DatePicker id="planting_date" v-model="batchForm.planting_date" dateFormat="yy-mm-dd" class="w-full" :class="{ 'p-invalid': submitted && !batchForm.planting_date }" />
                        <small v-if="submitted && !batchForm.planting_date" class="text-red-500"> Planting date is required </small>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="quantity" class="font-medium">Quantity Planted *</label>
                        <InputNumber id="quantity" v-model="batchForm.quantity_planted" :min="1" class="w-full" :class="{ 'p-invalid': submitted && !batchForm.quantity_planted }" />
                        <small v-if="submitted && !batchForm.quantity_planted" class="text-red-500"> Quantity is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="unit" class="font-medium">Unit *</label>
                        <Select id="unit" v-model="batchForm.unit" :options="unitOptions" placeholder="Select unit" class="w-full" :class="{ 'p-invalid': submitted && !batchForm.unit }" />
                        <small v-if="submitted && !batchForm.unit" class="text-red-500"> Unit is required </small>
                    </div>
                </div>

                <div v-if="editingBatch" class="flex flex-col gap-2">
                    <label for="status" class="font-medium">Status</label>
                    <Select id="status" v-model="batchForm.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>

                <!-- Care Plan Selection (only for new batches) -->
                <div v-if="!editingBatch" class="flex flex-col gap-2">
                    <label for="care_plan" class="font-medium">
                        Care Plan
                        <span class="text-surface-500 font-normal">(optional)</span>
                    </label>
                    <Select
                        id="care_plan"
                        v-model="batchForm.care_plan_id"
                        :options="availableCarePlans"
                        optionLabel="display_name"
                        optionValue="id"
                        placeholder="Select a care plan to apply"
                        class="w-full"
                        showClear
                        filter
                        :loading="loadingCarePlans"
                    >
                        <template #option="{ option }">
                            <div>
                                <div class="font-medium">{{ option.name }}</div>
                                <div class="text-surface-500 text-sm">{{ option.task_count }} tasks · {{ option.total_duration_days || 'N/A' }} days</div>
                            </div>
                        </template>
                    </Select>
                    <small class="text-surface-500"> Tasks will be scheduled based on the planting date </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="notes" class="font-medium">Notes</label>
                    <Textarea id="notes" v-model="batchForm.notes" rows="3" class="w-full" placeholder="Optional notes about this batch..." />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="closeBatchDialog" :disabled="saving" />
                <Button :label="editingBatch ? 'Update' : 'Create'" @click="saveBatch" :loading="saving" />
            </template>
        </Dialog>

        <!-- Delete Confirmation -->
        <ConfirmDialog />
    </div>
</template>
