<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import Tag from 'primevue/tag';
import { toApiDate } from '@/utils/dates';
import { useFormat } from '@/composables/useFormat';

const toast = useToast();
const { currency, locale } = useFormat();

// State
const records = ref([]);
const breeds = ref([]);
const groups = ref([]);
const animalTypes = ref([]);
const statistics = ref({});
const loading = ref(false);
const loadingBreeds = ref(false);
const loadingGroups = ref(false);
const loadingAnimalTypes = ref(false);
const saving = ref(false);
const deleting = ref(false);
const recordDialog = ref(false);
const deleteDialog = ref(false);
const submitted = ref(false);
const recordToDelete = ref(null);
const selectedAnimalTypeId = ref(null);

const filters = ref({
    status: null,
    start_date: null,
    end_date: null,
    animal_type_id: null
});

const recordForm = ref({
    id: null,
    batch_code: null,
    animal_group_id: null,
    animal_breed_id: null,
    eggs_count: null,
    incubation_start_date: new Date(),
    expected_hatch_date: null,
    actual_hatch_date: null,
    hatched_count: null,
    unhatched_count: null,
    target_group_id: null,
    incubator_id: '',
    temperature: null,
    humidity: null,
    notes: '',
    egg_source: 'internal',
    supplier_name: '',
    supplier_contact: '',
    purchase_cost: null
});

const eggSourceOptions = [
    { label: 'Internal (Own Flock)', value: 'internal' },
    { label: 'External (Purchased)', value: 'external' }
];

const statusFilterOptions = [
    { label: 'All', value: null },
    { label: 'Incubating', value: 'incubating' },
    { label: 'Hatched', value: 'hatched' },
    { label: 'Partial', value: 'partial' },
    { label: 'Failed', value: 'failed' }
];

// Methods
const loadRecords = async () => {
    loading.value = true;
    try {
        const params = {
            status: filters.value.status,
            start_date: filters.value.start_date ? toApiDate(filters.value.start_date) : null,
            end_date: filters.value.end_date ? toApiDate(filters.value.end_date) : null
        };

        const response = await animalService.getIncubationRecords(params);
        records.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load incubation records', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const loadStatistics = async () => {
    try {
        const response = await animalService.getIncubationStatistics();
        statistics.value = response.data.data;
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
};

const loadAnimalTypes = async () => {
    loadingAnimalTypes.value = true;
    try {
        const response = await animalService.getAnimalTypes();
        // Filter to only show bird types that are not excluded from reproduction
        const allTypes = response.data.data || response.data || [];
        animalTypes.value = allTypes.filter((type) => type.reproduction_type === 'bird' && !type.exclude_from_reproduction);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load animal types', life: 3000 });
    } finally {
        loadingAnimalTypes.value = false;
    }
};

const loadBreeds = async () => {
    loadingBreeds.value = true;
    try {
        // Filter to only show bird breeds for incubation
        const response = await animalService.getBreeds({ reproduction_type: 'bird' });
        breeds.value = response.data.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load breeds', life: 3000 });
    } finally {
        loadingBreeds.value = false;
    }
};

// Computed property to filter breeds by selected animal type
const filteredBreeds = computed(() => {
    if (!selectedAnimalTypeId.value) return breeds.value;
    return breeds.value.filter((breed) => breed.animal_type_id === selectedAnimalTypeId.value);
});

// Filter groups by selected animal type (for source groups)
const filteredGroups = computed(() => {
    if (!selectedAnimalTypeId.value) return groups.value;
    return groups.value.filter((group) => group.animal_type_id === selectedAnimalTypeId.value);
});

const onAnimalTypeChange = () => {
    // Clear breed selection when type changes
    recordForm.value.animal_breed_id = null;
    recordForm.value.animal_group_id = null;
};

const loadGroups = async () => {
    loadingGroups.value = true;
    try {
        const response = await animalService.getGroups({ status: 'active' });
        groups.value = response.data.data.map((g) => ({
            ...g,
            display_name: `${g.group_code} - ${g.name} (${g.breed_name})`
        }));
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load groups', life: 3000 });
    } finally {
        loadingGroups.value = false;
    }
};

const openNewRecordDialog = () => {
    selectedAnimalTypeId.value = null;
    recordForm.value = {
        id: null,
        batch_code: null,
        animal_group_id: null,
        animal_breed_id: null,
        eggs_count: null,
        incubation_start_date: new Date(),
        expected_hatch_date: null,
        actual_hatch_date: null,
        hatched_count: null,
        unhatched_count: null,
        target_group_id: null,
        incubator_id: '',
        temperature: null,
        humidity: null,
        notes: '',
        egg_source: 'internal',
        supplier_name: '',
        supplier_contact: '',
        purchase_cost: null
    };
    submitted.value = false;
    recordDialog.value = true;
};

const editRecord = (record) => {
    // Set selected animal type from breed
    const breed = breeds.value.find((b) => b.id === record.animal_breed_id);
    selectedAnimalTypeId.value = breed ? breed.animal_type_id : null;

    recordForm.value = {
        id: record.id,
        batch_code: record.batch_code,
        animal_group_id: record.animal_group_id,
        animal_breed_id: record.animal_breed_id,
        eggs_count: record.eggs_count,
        incubation_start_date: new Date(record.incubation_start_date),
        expected_hatch_date: new Date(record.expected_hatch_date),
        actual_hatch_date: record.actual_hatch_date ? new Date(record.actual_hatch_date) : null,
        hatched_count: record.hatched_count,
        unhatched_count: record.unhatched_count,
        target_group_id: record.target_group_id,
        incubator_id: record.incubator_id || '',
        temperature: record.temperature,
        humidity: record.humidity,
        notes: record.notes || '',
        egg_source: record.egg_source || 'internal',
        supplier_name: record.supplier_name || '',
        supplier_contact: record.supplier_contact || '',
        purchase_cost: record.purchase_cost
    };
    submitted.value = false;
    recordDialog.value = true;
};

const saveRecord = async () => {
    submitted.value = true;

    if (!recordForm.value.animal_breed_id || !recordForm.value.eggs_count || !recordForm.value.incubation_start_date || !recordForm.value.expected_hatch_date) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            ...recordForm.value,
            incubation_start_date: toApiDate(recordForm.value.incubation_start_date),
            expected_hatch_date: toApiDate(recordForm.value.expected_hatch_date),
            actual_hatch_date: recordForm.value.actual_hatch_date ? toApiDate(recordForm.value.actual_hatch_date) : null
        };

        if (recordForm.value.id) {
            await animalService.updateIncubationRecord(recordForm.value.id, data);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Incubation record updated successfully', life: 3000 });
        } else {
            await animalService.createIncubationRecord(data);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Incubation batch created successfully', life: 3000 });
        }

        recordDialog.value = false;
        loadRecords();
        loadStatistics();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error || 'Failed to save incubation record', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const confirmDelete = (record) => {
    recordToDelete.value = record;
    deleteDialog.value = true;
};

const deleteRecord = async () => {
    deleting.value = true;
    try {
        await animalService.deleteIncubationRecord(recordToDelete.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Incubation record deleted successfully', life: 3000 });
        deleteDialog.value = false;
        loadRecords();
        loadStatistics();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete incubation record', life: 3000 });
    } finally {
        deleting.value = false;
    }
};

const clearFilters = () => {
    filters.value = {
        status: null,
        start_date: null,
        end_date: null
    };
    loadRecords();
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const isOverdue = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
};

const formatStatus = (status) => {
    const statusMap = {
        incubating: 'Incubating',
        hatched: 'Hatched',
        partial: 'Partial Hatch',
        failed: 'Failed'
    };
    return statusMap[status] || status;
};

const getStatusSeverity = (status) => {
    const severityMap = {
        incubating: 'info',
        hatched: 'success',
        partial: 'warn',
        failed: 'danger'
    };
    return severityMap[status] || 'secondary';
};

// Lifecycle
onMounted(() => {
    loadRecords();
    loadStatistics();
    loadAnimalTypes();
    loadBreeds();
    loadGroups();
});
</script>

<template>
    <div class="flex flex-col gap-6">
        <!-- Header -->
        <div class="flex justify-between items-center">
            <h1 class="text-3xl font-bold text-surface-900">Egg Incubation & Hatching</h1>
            <Button label="New Incubation Batch" icon="pi pi-plus" @click="openNewRecordDialog" severity="primary" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                <div class="text-surface-500 text-sm mb-1">Active Batches</div>
                <div class="text-2xl font-bold text-surface-900">{{ statistics.active_batches || 0 }}</div>
            </div>
            <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                <div class="text-surface-500 text-sm mb-1">Total Eggs</div>
                <div class="text-2xl font-bold text-surface-900">{{ statistics.total_eggs_incubated || 0 }}</div>
            </div>
            <div class="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
                <div class="text-surface-500 text-sm mb-1">Hatched</div>
                <div class="text-2xl font-bold text-surface-900">{{ statistics.total_hatched || 0 }}</div>
            </div>
            <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
                <div class="text-surface-500 text-sm mb-1">Hatch Rate</div>
                <div class="text-2xl font-bold text-surface-900">{{ statistics.hatch_rate_percentage || 0 }}%</div>
            </div>
            <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                <div class="text-surface-500 text-sm mb-1">Completed Batches</div>
                <div class="text-2xl font-bold text-surface-900">{{ statistics.completed_batches || 0 }}</div>
            </div>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-lg shadow p-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="flex flex-col gap-2">
                    <label>Status</label>
                    <Select v-model="filters.status" :options="statusFilterOptions" optionLabel="label" optionValue="value" placeholder="All Status" @change="loadRecords" />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Start Date</label>
                    <DatePicker v-model="filters.start_date" placeholder="From Date" dateFormat="yy-mm-dd" @date-select="loadRecords" showButtonBar />
                </div>
                <div class="flex flex-col gap-2">
                    <label>End Date</label>
                    <DatePicker v-model="filters.end_date" placeholder="To Date" dateFormat="yy-mm-dd" @date-select="loadRecords" showButtonBar />
                </div>
                <div class="flex items-end">
                    <Button label="Clear Filters" icon="pi pi-filter-slash" outlined @click="clearFilters" class="w-full" />
                </div>
            </div>
        </div>

        <!-- Incubation Records Table -->
        <div class="bg-white rounded-lg shadow">
            <DataTable
                :value="records"
                :loading="loading"
                stripedRows
                paginator
                :rows="10"
                :rowsPerPageOptions="[10, 20, 50]"
                responsiveLayout="scroll"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Showing {first} to {last} of {totalRecords} records"
            >
                <template #empty>
                    <div class="text-center py-8 text-surface-500">No incubation records found</div>
                </template>

                <Column field="batch_code" header="Batch Code" :sortable="true" style="min-width: 140px">
                    <template #body="{ data }">
                        <span class="font-semibold text-blue-600">{{ data.batch_code }}</span>
                    </template>
                </Column>

                <Column field="breed_name" header="Breed" :sortable="true" style="min-width: 150px" />

                <Column field="eggs_count" header="Eggs" :sortable="true" style="min-width: 100px">
                    <template #body="{ data }">
                        <span class="font-semibold">{{ data.eggs_count }}</span>
                    </template>
                </Column>

                <Column field="incubation_start_date" header="Start Date" :sortable="true" style="min-width: 130px">
                    <template #body="{ data }">
                        {{ formatDate(data.incubation_start_date) }}
                    </template>
                </Column>

                <Column field="expected_hatch_date" header="Expected Hatch" :sortable="true" style="min-width: 150px">
                    <template #body="{ data }">
                        {{ formatDate(data.expected_hatch_date) }}
                        <Tag v-if="data.status === 'incubating' && isOverdue(data.expected_hatch_date)" value="Overdue" severity="danger" class="ml-2" />
                    </template>
                </Column>

                <Column field="hatched_count" header="Hatched" :sortable="true" style="min-width: 100px">
                    <template #body="{ data }">
                        <span v-if="data.hatched_count !== null" class="font-semibold text-green-600">
                            {{ data.hatched_count }}
                        </span>
                        <span v-else class="text-surface-400">-</span>
                    </template>
                </Column>

                <Column field="status" header="Status" :sortable="true" style="min-width: 120px">
                    <template #body="{ data }">
                        <Tag :value="formatStatus(data.status)" :severity="getStatusSeverity(data.status)" />
                    </template>
                </Column>

                <Column field="target_group_name" header="Target Group" style="min-width: 150px">
                    <template #body="{ data }">
                        <span v-if="data.target_group_name">{{ data.target_group_code }} - {{ data.target_group_name }}</span>
                        <span v-else class="text-surface-400">Not set</span>
                    </template>
                </Column>

                <Column header="Actions" style="min-width: 150px">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-pencil" text rounded @click="editRecord(data)" v-tooltip.top="'Edit'" />
                            <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Create/Edit Dialog -->
        <Dialog v-model:visible="recordDialog" :header="recordForm.id ? 'Edit Incubation Record' : 'New Incubation Batch'" :modal="true" :closable="true" :style="{ width: '700px' }">
            <div class="flex flex-col gap-4">
                <!-- Egg Source Selection -->
                <div class="flex flex-col gap-2">
                    <label for="egg_source">Egg Source <span class="text-red-500">*</span></label>
                    <Select id="egg_source" v-model="recordForm.egg_source" :options="eggSourceOptions" optionLabel="label" optionValue="value" placeholder="Select egg source" />
                </div>

                <!-- External Supplier Info (shown only when external) -->
                <div v-if="recordForm.egg_source === 'external'" class="grid grid-cols-3 gap-4 p-3 bg-surface-100 rounded-lg">
                    <div class="flex flex-col gap-2">
                        <label for="supplier_name">Supplier Name</label>
                        <InputText id="supplier_name" v-model="recordForm.supplier_name" placeholder="Supplier name" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="supplier_contact">Supplier Contact</label>
                        <InputText id="supplier_contact" v-model="recordForm.supplier_contact" placeholder="Phone or email" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="purchase_cost">Purchase Cost</label>
                        <InputNumber id="purchase_cost" v-model="recordForm.purchase_cost" mode="currency" :currency="currency" :locale="locale" placeholder="Cost" />
                    </div>
                </div>

                <!-- Bird Type and Breed Selection -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="animal_type_id">Bird Type <span class="text-red-500">*</span></label>
                        <Select
                            id="animal_type_id"
                            v-model="selectedAnimalTypeId"
                            :options="animalTypes"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Select bird type first"
                            filter
                            @change="onAnimalTypeChange"
                            :class="{ 'p-invalid': submitted && !selectedAnimalTypeId }"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="animal_breed_id">Breed <span class="text-red-500">*</span></label>
                        <Select
                            id="animal_breed_id"
                            v-model="recordForm.animal_breed_id"
                            :options="filteredBreeds"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Select breed"
                            filter
                            :disabled="!selectedAnimalTypeId"
                            :class="{ 'p-invalid': submitted && !recordForm.animal_breed_id }"
                        />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2" v-if="recordForm.egg_source === 'internal'">
                        <label for="animal_group_id">Source Group (Optional)</label>
                        <Select id="animal_group_id" v-model="recordForm.animal_group_id" :options="filteredGroups" optionLabel="display_name" optionValue="id" placeholder="Select source group" filter showClear :disabled="!selectedAnimalTypeId" />
                    </div>
                    <div v-else></div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="eggs_count">Number of Eggs <span class="text-red-500">*</span></label>
                        <InputNumber id="eggs_count" v-model="recordForm.eggs_count" placeholder="Number of eggs" :min="1" :class="{ 'p-invalid': submitted && !recordForm.eggs_count }" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="incubator_id">Incubator ID</label>
                        <InputText id="incubator_id" v-model="recordForm.incubator_id" placeholder="Incubator identifier" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="incubation_start_date">Start Date <span class="text-red-500">*</span></label>
                        <DatePicker
                            id="incubation_start_date"
                            v-model="recordForm.incubation_start_date"
                            placeholder="Incubation start date"
                            dateFormat="yy-mm-dd"
                            showButtonBar
                            :class="{ 'p-invalid': submitted && !recordForm.incubation_start_date }"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="expected_hatch_date">Expected Hatch Date <span class="text-red-500">*</span></label>
                        <DatePicker id="expected_hatch_date" v-model="recordForm.expected_hatch_date" placeholder="Expected hatch date" dateFormat="yy-mm-dd" showButtonBar :class="{ 'p-invalid': submitted && !recordForm.expected_hatch_date }" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="temperature">Temperature (°C)</label>
                        <InputNumber id="temperature" v-model="recordForm.temperature" placeholder="Temperature" :min="0" :max="100" :minFractionDigits="1" :maxFractionDigits="2" suffix=" °C" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="humidity">Humidity (%)</label>
                        <InputNumber id="humidity" v-model="recordForm.humidity" placeholder="Humidity" :min="0" :max="100" :minFractionDigits="1" :maxFractionDigits="2" suffix=" %" />
                    </div>
                </div>

                <div v-if="recordForm.id" class="grid grid-cols-3 gap-4 border-t pt-4">
                    <div class="flex flex-col gap-2">
                        <label for="actual_hatch_date">Actual Hatch Date</label>
                        <DatePicker id="actual_hatch_date" v-model="recordForm.actual_hatch_date" placeholder="Actual hatch date" dateFormat="yy-mm-dd" showButtonBar />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="hatched_count">Hatched Count</label>
                        <InputNumber id="hatched_count" v-model="recordForm.hatched_count" placeholder="Number hatched" :min="0" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="unhatched_count">Unhatched Count</label>
                        <InputNumber id="unhatched_count" v-model="recordForm.unhatched_count" placeholder="Number unhatched" :min="0" />
                    </div>
                </div>

                <div v-if="recordForm.id && recordForm.hatched_count && recordForm.hatched_count > 0" class="flex flex-col gap-2">
                    <label for="target_group_id">Add Hatched Chicks to Group</label>
                    <Select id="target_group_id" v-model="recordForm.target_group_id" :options="groups" optionLabel="display_name" optionValue="id" placeholder="Select group to add hatched chicks" filter showClear />
                    <small class="text-surface-500 text-xs">Select to automatically add hatched chicks to existing flock</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="notes">Notes</label>
                    <Textarea id="notes" v-model="recordForm.notes" rows="3" placeholder="Additional notes about incubation, conditions, or results" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" icon="pi pi-times" text @click="recordDialog = false" />
                <Button label="Save" icon="pi pi-check" :loading="saving" @click="saveRecord" />
            </template>
        </Dialog>

        <!-- Delete Confirmation Dialog -->
        <Dialog v-model:visible="deleteDialog" header="Confirm Delete" :modal="true" :closable="true" :style="{ width: '450px' }">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
                <span>Are you sure you want to delete this incubation record?</span>
            </div>
            <template #footer>
                <Button label="Cancel" icon="pi pi-times" text @click="deleteDialog = false" />
                <Button label="Delete" icon="pi pi-trash" severity="danger" :loading="deleting" @click="deleteRecord" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
