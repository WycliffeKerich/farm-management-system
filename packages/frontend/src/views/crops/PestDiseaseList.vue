<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import cropService from '@/services/crop.service';

const router = useRouter();

// State
const loading = ref(true);
const pestsDiseases = ref([]);
const batches = ref([]);
const cropTypes = ref([]);

// Filters
const filters = ref({
    search: '',
    batchId: null,
    cropTypeId: null,
    type: null,
    severity: null,
    status: null,
    startDate: null,
    endDate: null
});

// Dialog state
const showViewDialog = ref(false);
const showReportDialog = ref(false);
const showUpdateDialog = ref(false);
const selectedIncident = ref(null);

// Form
const reportForm = ref({
    batch_id: null,
    detected_date: new Date(),
    type: 'pest',
    name: '',
    severity: 'medium',
    affected_area: '',
    symptoms: '',
    control_measures: '',
    notes: ''
});

const updateForm = ref({
    status: '',
    control_measures: ''
});

const saving = ref(false);

// Options
const incidentTypes = [
    { label: 'Pest', value: 'pest' },
    { label: 'Disease', value: 'disease' }
];

const severityLevels = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' }
];

const statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Monitoring', value: 'monitoring' },
    { label: 'Controlled', value: 'controlled' },
    { label: 'Resolved', value: 'resolved' }
];

// Load data
const loadData = async () => {
    loading.value = true;
    try {
        const [pestsRes, batchesRes, cropTypesRes] = await Promise.all([cropService.getPestsDiseases(), cropService.getBatches(), cropService.getCropTypes()]);

        pestsDiseases.value = pestsRes.data.data || [];
        batches.value = batchesRes.data.data || [];
        cropTypes.value = cropTypesRes.data.data || [];
    } catch (error) {
        console.error('Failed to load data:', error);
    } finally {
        loading.value = false;
    }
};

// Filtered incidents
const filteredIncidents = computed(() => {
    let result = pestsDiseases.value;

    if (filters.value.search) {
        const search = filters.value.search.toLowerCase();
        result = result.filter((inc) => inc.batch_code?.toLowerCase().includes(search) || inc.crop_type_name?.toLowerCase().includes(search) || inc.name?.toLowerCase().includes(search) || inc.symptoms?.toLowerCase().includes(search));
    }

    if (filters.value.batchId) {
        result = result.filter((inc) => inc.batch_id === filters.value.batchId);
    }

    if (filters.value.cropTypeId) {
        result = result.filter((inc) => inc.crop_type_id === filters.value.cropTypeId);
    }

    if (filters.value.type) {
        result = result.filter((inc) => inc.type === filters.value.type);
    }

    if (filters.value.severity) {
        result = result.filter((inc) => inc.severity === filters.value.severity);
    }

    if (filters.value.status) {
        result = result.filter((inc) => inc.status === filters.value.status);
    }

    if (filters.value.startDate) {
        result = result.filter((inc) => new Date(inc.detected_date) >= new Date(filters.value.startDate));
    }

    if (filters.value.endDate) {
        result = result.filter((inc) => new Date(inc.detected_date) <= new Date(filters.value.endDate));
    }

    return result;
});

// Statistics
const stats = computed(() => {
    const total = filteredIncidents.value.length;
    const active = filteredIncidents.value.filter((i) => i.status === 'active' || i.status === 'monitoring').length;
    const critical = filteredIncidents.value.filter((i) => i.severity === 'critical' || i.severity === 'high').length;
    const resolved = filteredIncidents.value.filter((i) => i.status === 'resolved' || i.status === 'controlled').length;
    const pests = filteredIncidents.value.filter((i) => i.type === 'pest').length;
    const diseases = filteredIncidents.value.filter((i) => i.type === 'disease').length;

    return { total, active, critical, resolved, pests, diseases };
});

// View incident details
const viewIncident = (incident) => {
    selectedIncident.value = incident;
    showViewDialog.value = true;
};

// Open report dialog
const openReportDialog = () => {
    reportForm.value = {
        batch_id: null,
        detected_date: new Date(),
        type: 'pest',
        name: '',
        severity: 'medium',
        affected_area: '',
        symptoms: '',
        control_measures: '',
        notes: ''
    };
    showReportDialog.value = true;
};

// Open update dialog
const openUpdateDialog = (incident) => {
    selectedIncident.value = incident;
    updateForm.value = {
        status: incident.status,
        control_measures: incident.control_measures || ''
    };
    showUpdateDialog.value = true;
};

// Save report
const saveReport = async () => {
    if (!reportForm.value.batch_id || !reportForm.value.name) {
        return;
    }

    saving.value = true;
    try {
        const payload = {
            ...reportForm.value,
            detected_date: reportForm.value.detected_date instanceof Date ? reportForm.value.detected_date.toISOString().split('T')[0] : reportForm.value.detected_date
        };

        await cropService.reportPestDisease(reportForm.value.batch_id, payload);
        showReportDialog.value = false;
        await loadData();
    } catch (error) {
        console.error('Failed to save report:', error);
    } finally {
        saving.value = false;
    }
};

// Update status
const updateStatus = async () => {
    if (!selectedIncident.value) return;

    saving.value = true;
    try {
        await cropService.updatePestDiseaseStatus(selectedIncident.value.id, updateForm.value.status, updateForm.value.control_measures);
        showUpdateDialog.value = false;
        await loadData();
    } catch (error) {
        console.error('Failed to update status:', error);
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
        type: null,
        severity: null,
        status: null,
        startDate: null,
        endDate: null
    };
};

// Format date
const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
};

// Get type severity
const getTypeSeverity = (type) => {
    return type === 'pest' ? 'danger' : 'warn';
};

// Get severity color
const getSeveritySeverity = (severity) => {
    switch (severity) {
        case 'low':
            return 'info';
        case 'medium':
            return 'warn';
        case 'high':
            return 'danger';
        case 'critical':
            return 'danger';
        default:
            return 'secondary';
    }
};

// Get status severity
const getStatusSeverity = (status) => {
    switch (status) {
        case 'active':
            return 'danger';
        case 'monitoring':
            return 'warn';
        case 'controlled':
            return 'info';
        case 'resolved':
            return 'success';
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
                    <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">Pest & Disease Management</h1>
                    <p class="text-surface-600 dark:text-surface-400">Monitor and manage pest and disease incidents across all crop batches</p>
                </div>
                <Button label="Report Incident" icon="pi pi-plus" severity="danger" @click="openReportDialog" />
            </div>
        </div>

        <!-- Stats Cards -->
        <div class="col-span-12 lg:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Total Incidents</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : stats.total }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-list text-blue-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">{{ stats.pests }} pests | {{ stats.diseases }} diseases</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Active Alerts</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : stats.active }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-exclamation-circle text-orange-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-orange-500 font-medium">Requires attention</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Critical/High</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : stats.critical }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-red-100 dark:bg-red-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-exclamation-triangle text-red-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-red-500 font-medium">Urgent action needed</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Resolved</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : stats.resolved }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-green-100 dark:bg-green-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-check-circle text-green-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-green-500 font-medium">Successfully managed</span>
            </div>
        </div>

        <!-- Filters -->
        <div class="col-span-12">
            <div class="card">
                <div class="flex flex-wrap gap-4 items-end">
                    <div class="flex-1 min-w-[200px]">
                        <label class="block text-sm font-medium mb-2">Search</label>
                        <InputText v-model="filters.search" placeholder="Search incidents..." class="w-full" />
                    </div>
                    <div class="w-40">
                        <label class="block text-sm font-medium mb-2">Batch</label>
                        <Select v-model="filters.batchId" :options="batches" optionLabel="batch_code" optionValue="id" placeholder="All" class="w-full" showClear />
                    </div>
                    <div class="w-40">
                        <label class="block text-sm font-medium mb-2">Crop Type</label>
                        <Select v-model="filters.cropTypeId" :options="cropTypes" optionLabel="name" optionValue="id" placeholder="All" class="w-full" showClear />
                    </div>
                    <div class="w-32">
                        <label class="block text-sm font-medium mb-2">Type</label>
                        <Select v-model="filters.type" :options="incidentTypes" optionLabel="label" optionValue="value" placeholder="All" class="w-full" showClear />
                    </div>
                    <div class="w-32">
                        <label class="block text-sm font-medium mb-2">Severity</label>
                        <Select v-model="filters.severity" :options="severityLevels" optionLabel="label" optionValue="value" placeholder="All" class="w-full" showClear />
                    </div>
                    <div class="w-36">
                        <label class="block text-sm font-medium mb-2">Status</label>
                        <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="All" class="w-full" showClear />
                    </div>
                    <div class="w-36">
                        <label class="block text-sm font-medium mb-2">From Date</label>
                        <DatePicker v-model="filters.startDate" placeholder="Start" class="w-full" showIcon />
                    </div>
                    <div class="w-36">
                        <label class="block text-sm font-medium mb-2">To Date</label>
                        <DatePicker v-model="filters.endDate" placeholder="End" class="w-full" showIcon />
                    </div>
                    <Button label="Clear" icon="pi pi-filter-slash" severity="secondary" @click="clearFilters" />
                </div>
            </div>
        </div>

        <!-- Incidents Table -->
        <div class="col-span-12">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">All Pest & Disease Incidents</h5>
                    <span class="text-muted-color text-sm">{{ filteredIncidents.length }} records</span>
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!filteredIncidents.length" class="text-center py-8">
                    <i class="pi pi-check-circle text-4xl text-green-400 mb-4"></i>
                    <p class="text-surface-500">No pest or disease incidents found</p>
                    <p class="text-surface-400 text-sm">Your crops are healthy!</p>
                </div>

                <DataTable v-else :value="filteredIncidents" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 25, 50]" responsiveLayout="scroll" class="p-datatable-sm" sortField="detected_date" :sortOrder="-1">
                    <Column field="detected_date" header="Detected" sortable>
                        <template #body="{ data }">
                            {{ formatDate(data.detected_date) }}
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
                    <Column field="type" header="Type" sortable>
                        <template #body="{ data }">
                            <Tag :severity="getTypeSeverity(data.type)" :value="data.type" />
                        </template>
                    </Column>
                    <Column field="name" header="Name" sortable />
                    <Column field="severity" header="Severity" sortable>
                        <template #body="{ data }">
                            <Tag :severity="getSeveritySeverity(data.severity)" :value="data.severity" />
                        </template>
                    </Column>
                    <Column field="status" header="Status" sortable>
                        <template #body="{ data }">
                            <Tag :severity="getStatusSeverity(data.status)" :value="data.status" />
                        </template>
                    </Column>
                    <Column header="Actions" style="width: 140px">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button icon="pi pi-eye" severity="info" text rounded @click="viewIncident(data)" v-tooltip.top="'View details'" />
                                <Button icon="pi pi-pencil" severity="warn" text rounded @click="openUpdateDialog(data)" v-tooltip.top="'Update status'" />
                                <Button icon="pi pi-external-link" severity="secondary" text rounded @click="goToBatch(data.batch_id)" v-tooltip.top="'Go to batch'" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- View Incident Dialog -->
        <Dialog v-model:visible="showViewDialog" modal header="Incident Details" :style="{ width: '600px' }">
            <div v-if="selectedIncident" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Batch</label>
                        <router-link :to="{ name: 'crop-batch-detail', params: { id: selectedIncident.batch_id } }" class="text-primary font-medium hover:underline">
                            {{ selectedIncident.batch_code }}
                        </router-link>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Detected Date</label>
                        <p class="font-medium">{{ formatDate(selectedIncident.detected_date) }}</p>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Crop</label>
                        <p class="font-medium">{{ selectedIncident.crop_type_name }}</p>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Type</label>
                        <Tag :severity="getTypeSeverity(selectedIncident.type)" :value="selectedIncident.type" />
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Name</label>
                        <p class="font-medium">{{ selectedIncident.name }}</p>
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Severity</label>
                        <Tag :severity="getSeveritySeverity(selectedIncident.severity)" :value="selectedIncident.severity" />
                    </div>
                    <div>
                        <label class="block text-sm text-muted-color mb-1">Status</label>
                        <Tag :severity="getStatusSeverity(selectedIncident.status)" :value="selectedIncident.status" />
                    </div>
                    <div v-if="selectedIncident.affected_area">
                        <label class="block text-sm text-muted-color mb-1">Affected Area</label>
                        <p class="font-medium">{{ selectedIncident.affected_area }}</p>
                    </div>
                </div>
                <div v-if="selectedIncident.symptoms">
                    <label class="block text-sm text-muted-color mb-1">Symptoms</label>
                    <p class="font-medium whitespace-pre-wrap">{{ selectedIncident.symptoms }}</p>
                </div>
                <div v-if="selectedIncident.control_measures">
                    <label class="block text-sm text-muted-color mb-1">Control Measures</label>
                    <p class="font-medium whitespace-pre-wrap">{{ selectedIncident.control_measures }}</p>
                </div>
                <div v-if="selectedIncident.notes">
                    <label class="block text-sm text-muted-color mb-1">Notes</label>
                    <p class="font-medium whitespace-pre-wrap">{{ selectedIncident.notes }}</p>
                </div>
                <div v-if="selectedIncident.resolution_date">
                    <label class="block text-sm text-muted-color mb-1">Resolution Date</label>
                    <p class="font-medium">{{ formatDate(selectedIncident.resolution_date) }}</p>
                </div>
            </div>
            <template #footer>
                <Button
                    label="Update Status"
                    icon="pi pi-pencil"
                    severity="warn"
                    @click="
                        openUpdateDialog(selectedIncident);
                        showViewDialog = false;
                    "
                />
                <Button
                    label="Go to Batch"
                    icon="pi pi-external-link"
                    @click="
                        goToBatch(selectedIncident?.batch_id);
                        showViewDialog = false;
                    "
                />
                <Button label="Close" severity="secondary" @click="showViewDialog = false" />
            </template>
        </Dialog>

        <!-- Report Incident Dialog -->
        <Dialog v-model:visible="showReportDialog" modal header="Report Pest/Disease Incident" :style="{ width: '650px' }">
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-2">Batch *</label>
                        <Select v-model="reportForm.batch_id" :options="activeBatches" optionLabel="batch_code" optionValue="id" placeholder="Select Batch" class="w-full" filter>
                            <template #option="{ option }">
                                <div>
                                    <span class="font-medium">{{ option.batch_code }}</span>
                                    <span class="text-muted-color ml-2">{{ option.crop_type_name }}</span>
                                </div>
                            </template>
                        </Select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Detection Date *</label>
                        <DatePicker v-model="reportForm.detected_date" class="w-full" showIcon />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Type *</label>
                        <Select v-model="reportForm.type" :options="incidentTypes" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Name/Identification *</label>
                        <InputText v-model="reportForm.name" class="w-full" placeholder="e.g., Aphids, Powdery Mildew" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Severity *</label>
                        <Select v-model="reportForm.severity" :options="severityLevels" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-2">Affected Area</label>
                        <InputText v-model="reportForm.affected_area" class="w-full" placeholder="e.g., Row 1-3, 20% of plants" />
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-2">Symptoms Observed</label>
                        <Textarea v-model="reportForm.symptoms" class="w-full" rows="2" placeholder="Describe the symptoms observed..." />
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-2">Control Measures</label>
                        <Textarea v-model="reportForm.control_measures" class="w-full" rows="2" placeholder="Describe actions taken or planned..." />
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-2">Additional Notes</label>
                        <Textarea v-model="reportForm.notes" class="w-full" rows="2" />
                    </div>
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="showReportDialog = false" :disabled="saving" />
                <Button label="Report" icon="pi pi-check" severity="danger" @click="saveReport" :loading="saving" :disabled="!reportForm.batch_id || !reportForm.name" />
            </template>
        </Dialog>

        <!-- Update Status Dialog -->
        <Dialog v-model:visible="showUpdateDialog" modal header="Update Incident Status" :style="{ width: '500px' }">
            <div v-if="selectedIncident" class="space-y-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg mb-4">
                    <div class="flex items-center gap-2 mb-2">
                        <Tag :severity="getTypeSeverity(selectedIncident.type)" :value="selectedIncident.type" />
                        <span class="font-medium">{{ selectedIncident.name }}</span>
                    </div>
                    <p class="text-sm text-muted-color">Batch: {{ selectedIncident.batch_code }} | {{ selectedIncident.crop_type_name }}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2">Status *</label>
                    <Select v-model="updateForm.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2">Control Measures / Update Notes</label>
                    <Textarea v-model="updateForm.control_measures" class="w-full" rows="4" placeholder="Describe actions taken or updated measures..." />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="showUpdateDialog = false" :disabled="saving" />
                <Button label="Update" icon="pi pi-check" @click="updateStatus" :loading="saving" />
            </template>
        </Dialog>
    </div>
</template>
