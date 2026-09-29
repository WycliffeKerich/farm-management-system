<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import cropService from '@/services/crop.service';

const router = useRouter();

// State
const loading = ref(true);
const inputApplications = ref([]);
const batches = ref([]);
const cropTypes = ref([]);

// Filters
const filters = ref({
    search: '',
    batchId: null,
    cropTypeId: null,
    inputType: null,
    startDate: null,
    endDate: null
});

// Dialog state
const showViewDialog = ref(false);
const showAddDialog = ref(false);
const selectedApplication = ref(null);

// Form
const applicationForm = ref({
    batch_id: null,
    application_date: new Date(),
    input_type: 'fertilizer',
    product_name: '',
    quantity: null,
    unit: 'kg',
    application_method: '',
    target_pest_disease: '',
    notes: ''
});

const saving = ref(false);

// Input types
const inputTypes = [
    { label: 'Fertilizer', value: 'fertilizer' },
    { label: 'Pesticide', value: 'pesticide' },
    { label: 'Herbicide', value: 'herbicide' },
    { label: 'Fungicide', value: 'fungicide' },
    { label: 'Growth Regulator', value: 'growth_regulator' },
    { label: 'Other', value: 'other' }
];

const units = ['kg', 'g', 'L', 'ml', 'units'];

const applicationMethods = ['foliar spray', 'soil drench', 'broadcast', 'side dressing', 'fertigation', 'injection', 'dusting', 'other'];

// Load data
const loadData = async () => {
    loading.value = true;
    try {
        const [applicationsRes, batchesRes, cropTypesRes] = await Promise.all([cropService.getInputApplications(), cropService.getBatches(), cropService.getCropTypes()]);

        inputApplications.value = applicationsRes.data.data || [];
        batches.value = batchesRes.data.data || [];
        cropTypes.value = cropTypesRes.data.data || [];
    } catch (error) {
        console.error('Failed to load data:', error);
    } finally {
        loading.value = false;
    }
};

// Filtered applications
const filteredApplications = computed(() => {
    let result = inputApplications.value;

    if (filters.value.search) {
        const search = filters.value.search.toLowerCase();
        result = result.filter((app) => app.batch_code?.toLowerCase().includes(search) || app.crop_type_name?.toLowerCase().includes(search) || app.product_name?.toLowerCase().includes(search) || app.notes?.toLowerCase().includes(search));
    }

    if (filters.value.batchId) {
        result = result.filter((app) => app.batch_id === filters.value.batchId);
    }

    if (filters.value.cropTypeId) {
        result = result.filter((app) => app.crop_type_id === filters.value.cropTypeId);
    }

    if (filters.value.inputType) {
        result = result.filter((app) => app.input_type === filters.value.inputType);
    }

    if (filters.value.startDate) {
        result = result.filter((app) => new Date(app.application_date) >= new Date(filters.value.startDate));
    }

    if (filters.value.endDate) {
        result = result.filter((app) => new Date(app.application_date) <= new Date(filters.value.endDate));
    }

    return result;
});

// Statistics
const stats = computed(() => {
    const total = filteredApplications.value.length;
    const typeCounts = {};

    filteredApplications.value.forEach((app) => {
        if (app.input_type) {
            typeCounts[app.input_type] = (typeCounts[app.input_type] || 0) + 1;
        }
    });

    return {
        total,
        typeCounts,
        fertilizers: typeCounts['fertilizer'] || 0,
        pesticides: typeCounts['pesticide'] || 0,
        others: total - (typeCounts['fertilizer'] || 0) - (typeCounts['pesticide'] || 0)
    };
});

// View application details
const viewApplication = (application) => {
    selectedApplication.value = application;
    showViewDialog.value = true;
};

// Open add dialog
const openAddDialog = () => {
    applicationForm.value = {
        batch_id: null,
        application_date: new Date(),
        input_type: 'fertilizer',
        product_name: '',
        quantity: null,
        unit: 'kg',
        application_method: '',
        target_pest_disease: '',
        notes: ''
    };
    showAddDialog.value = true;
};

// Save application
const saveApplication = async () => {
    if (!applicationForm.value.batch_id || !applicationForm.value.product_name) {
        return;
    }

    saving.value = true;
    try {
        const payload = {
            ...applicationForm.value,
            application_date: applicationForm.value.application_date instanceof Date ? applicationForm.value.application_date.toISOString().split('T')[0] : applicationForm.value.application_date
        };

        await cropService.recordInputApplication(applicationForm.value.batch_id, payload);
        showAddDialog.value = false;
        await loadData();
    } catch (error) {
        console.error('Failed to save application:', error);
    } finally {
        saving.value = false;
    }
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
        inputType: null,
        startDate: null,
        endDate: null
    };
};

// Format date
const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
};

// Format input type
const formatInputType = (type) => {
    if (!type) return '-';
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

// Get input type severity
const getTypeSeverity = (type) => {
    switch (type) {
        case 'fertilizer':
            return 'success';
        case 'pesticide':
            return 'danger';
        case 'herbicide':
            return 'warn';
        case 'fungicide':
            return 'info';
        case 'growth_regulator':
            return 'info';
        default:
            return 'secondary';
    }
};

// Get active batches for dropdown
const activeBatches = computed(() => {
    return batches.value.filter((b) => ['planted', 'growing', 'harvesting'].includes(b.status));
});

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
                    <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">Input Applications</h1>
                    <p class="text-surface-600 dark:text-surface-400">Track fertilizers, pesticides, and other inputs applied to crop batches</p>
                </div>
                <Button label="Record Application" icon="pi pi-plus" @click="openAddDialog" />
            </div>
        </div>

        <!-- Stats Cards -->
        <div class="col-span-12 lg:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Total Applications</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : stats.total }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-list text-blue-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">All input records</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Fertilizers</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : stats.fertilizers }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-green-100 dark:bg-green-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-sparkles text-green-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-green-500 font-medium">Nutrient applications</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Pesticides</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : stats.pesticides }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-red-100 dark:bg-red-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-shield text-red-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-red-500 font-medium">Pest control</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Other Inputs</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : stats.others }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-gray-100 dark:bg-gray-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-box text-gray-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">Herbicides, fungicides, etc.</span>
            </div>
        </div>

        <!-- Filters -->
        <div class="col-span-12">
            <div class="card">
                <div class="flex flex-wrap gap-4 items-end">
                    <div class="flex-1 min-w-[200px]">
                        <label class="block text-sm font-medium mb-2">Search</label>
                        <InputText v-model="filters.search" placeholder="Search applications..." class="w-full" />
                    </div>
                    <div class="w-48">
                        <label class="block text-sm font-medium mb-2">Batch</label>
                        <Select v-model="filters.batchId" :options="batches" optionLabel="batch_code" optionValue="id" placeholder="All Batches" class="w-full" showClear />
                    </div>
                    <div class="w-48">
                        <label class="block text-sm font-medium mb-2">Crop Type</label>
                        <Select v-model="filters.cropTypeId" :options="cropTypes" optionLabel="name" optionValue="id" placeholder="All Types" class="w-full" showClear />
                    </div>
                    <div class="w-48">
                        <label class="block text-sm font-medium mb-2">Input Type</label>
                        <Select v-model="filters.inputType" :options="inputTypes" optionLabel="label" optionValue="value" placeholder="All Types" class="w-full" showClear />
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

        <!-- Applications Table -->
        <div class="col-span-12">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">All Input Applications</h5>
                    <span class="text-muted-color text-sm">{{ filteredApplications.length }} records</span>
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!filteredApplications.length" class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">No input applications found</p>
                    <Button label="Record Application" icon="pi pi-plus" class="mt-4" @click="openAddDialog" />
                </div>

                <DataTable v-else :value="filteredApplications" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 25, 50]" responsiveLayout="scroll" class="p-datatable-sm" sortField="application_date" :sortOrder="-1">
                    <Column field="application_date" header="Date" sortable>
                        <template #body="{ data }">
                            {{ formatDate(data.application_date) }}
                        </template>
                    </Column>
                    <Column field="batch_code" header="Batch" sortable>
                        <template #body="{ data }">
                            <router-link :to="{ name: 'crop-batch-detail', params: { id: data.batch_id } }" class="text-primary font-medium hover:underline">
                                {{ data.batch_code }}
                            </router-link>
                        </template>
                    </Column>
                    <Column field="crop_type_name" header="Crop" sortable />
                    <Column field="input_type" header="Type" sortable>
                        <template #body="{ data }">
                            <Tag :severity="getTypeSeverity(data.input_type)" :value="formatInputType(data.input_type)" />
                        </template>
                    </Column>
                    <Column field="product_name" header="Product" sortable />
                    <Column field="quantity" header="Quantity">
                        <template #body="{ data }"> {{ data.quantity }} {{ data.unit }} </template>
                    </Column>
                    <Column field="application_method" header="Method">
                        <template #body="{ data }">
                            {{ data.application_method || '-' }}
                        </template>
                    </Column>
                    <Column header="Actions" style="width: 100px">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button icon="pi pi-eye" severity="info" text rounded @click="viewApplication(data)" />
                                <Button icon="pi pi-external-link" severity="secondary" text rounded @click="goToBatch(data.batch_id)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- View Application Dialog -->
        <Dialog v-model:visible="showViewDialog" modal header="Application Details" :style="{ width: '500px' }">
            <div v-if="selectedApplication" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Batch</label>
                        <router-link :to="{ name: 'crop-batch-detail', params: { id: selectedApplication.batch_id } }" class="text-primary font-medium hover:underline">
                            {{ selectedApplication.batch_code }}
                        </router-link>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Date</label>
                        <p class="font-medium">{{ formatDate(selectedApplication.application_date) }}</p>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Crop</label>
                        <p class="font-medium">{{ selectedApplication.crop_type_name }}</p>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Input Type</label>
                        <Tag :severity="getTypeSeverity(selectedApplication.input_type)" :value="formatInputType(selectedApplication.input_type)" />
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Product Name</label>
                        <p class="font-medium">{{ selectedApplication.product_name }}</p>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Quantity</label>
                        <p class="font-medium">{{ selectedApplication.quantity }} {{ selectedApplication.unit }}</p>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Application Method</label>
                        <p class="font-medium">{{ selectedApplication.application_method || '-' }}</p>
                    </div>
                    <div v-if="selectedApplication.target_pest_disease">
                        <label class="block text-sm text-muted-color mb-1">Target Pest/Disease</label>
                        <p class="font-medium">{{ selectedApplication.target_pest_disease }}</p>
                    </div>
                </div>
                <div v-if="selectedApplication.notes">
                    <label class="block text-sm text-muted-color mb-1">Notes</label>
                    <p class="font-medium whitespace-pre-wrap">{{ selectedApplication.notes }}</p>
                </div>
            </div>
            <template #footer>
                <Button
                    label="Go to Batch"
                    icon="pi pi-external-link"
                    @click="
                        goToBatch(selectedApplication?.batch_id);
                        showViewDialog = false;
                    "
                />
                <Button label="Close" severity="secondary" @click="showViewDialog = false" />
            </template>
        </Dialog>

        <!-- Add Application Dialog -->
        <Dialog v-model:visible="showAddDialog" modal header="Record Input Application" :style="{ width: '600px' }">
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-2">Batch *</label>
                        <Select v-model="applicationForm.batch_id" :options="activeBatches" optionLabel="batch_code" optionValue="id" placeholder="Select Batch" class="w-full" filter>
                            <template #option="{ option }">
                                <div>
                                    <span class="font-medium">{{ option.batch_code }}</span>
                                    <span class="text-muted-color ml-2">{{ option.crop_type_name }}</span>
                                </div>
                            </template>
                        </Select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Application Date *</label>
                        <DatePicker v-model="applicationForm.application_date" class="w-full" showIcon />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Input Type *</label>
                        <Select v-model="applicationForm.input_type" :options="inputTypes" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-2">Product Name *</label>
                        <InputText v-model="applicationForm.product_name" class="w-full" placeholder="e.g., NPK 17-17-17" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Quantity</label>
                        <InputNumber v-model="applicationForm.quantity" class="w-full" :minFractionDigits="0" :maxFractionDigits="2" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Unit</label>
                        <Select v-model="applicationForm.unit" :options="units" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Application Method</label>
                        <Select v-model="applicationForm.application_method" :options="applicationMethods" class="w-full" showClear />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Target Pest/Disease</label>
                        <InputText v-model="applicationForm.target_pest_disease" class="w-full" placeholder="If applicable" />
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-2">Notes</label>
                        <Textarea v-model="applicationForm.notes" class="w-full" rows="3" />
                    </div>
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="showAddDialog = false" :disabled="saving" />
                <Button label="Save" icon="pi pi-check" @click="saveApplication" :loading="saving" :disabled="!applicationForm.batch_id || !applicationForm.product_name" />
            </template>
        </Dialog>
    </div>
</template>
