<script setup>
import { ref, onMounted } from 'vue';
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
import RadioButton from 'primevue/radiobutton';
import { toApiDate } from '@/utils/dates';

const toast = useToast();

// State
const records = ref([]);
const animals = ref([]);
const groups = ref([]);
const statistics = ref({});
const loading = ref(false);
const loadingAnimals = ref(false);
const loadingGroups = ref(false);
const saving = ref(false);
const deleting = ref(false);
const recordDialog = ref(false);
const deleteDialog = ref(false);
const submitted = ref(false);
const searchQuery = ref('');
const sourceType = ref('individual');
const recordToDelete = ref(null);

const filters = ref({
    status: null,
    severity: null,
    start_date: null,
    end_date: null
});

const recordForm = ref({
    id: null,
    diagnosis_date: new Date(),
    disease_name: '',
    animal_id: null,
    animal_group_id: null,
    symptoms: '',
    severity: 'medium',
    diagnosis: '',
    treatment_plan: '',
    medications: '',
    treatment_start_date: null,
    treatment_end_date: null,
    veterinarian: '',
    cost: null,
    status: 'ongoing',
    outcome: '',
    notes: ''
});

const severityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' }
];

const statusOptions = [
    { label: 'Ongoing', value: 'ongoing' },
    { label: 'Completed', value: 'completed' },
    { label: 'Chronic', value: 'chronic' }
];

// Methods
const loadRecords = async () => {
    loading.value = true;
    try {
        const params = {
            ...filters.value,
            start_date: filters.value.start_date ? toApiDate(filters.value.start_date) : null,
            end_date: filters.value.end_date ? toApiDate(filters.value.end_date) : null
        };

        const response = await animalService.getDiseaseTreatments(params);
        records.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load records', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const loadStatistics = async () => {
    try {
        const params = {
            start_date: filters.value.start_date ? toApiDate(filters.value.start_date) : null,
            end_date: filters.value.end_date ? toApiDate(filters.value.end_date) : null
        };
        const response = await animalService.getDiseaseStatistics(params);
        statistics.value = response.data.data;
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
};

const loadAnimals = async () => {
    loadingAnimals.value = true;
    try {
        const response = await animalService.getAnimals({ status: 'active' });
        animals.value = response.data.data.map((a) => ({
            ...a,
            display_name: `${a.tag_number} - ${a.name} (${a.breed_name})`
        }));
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load animals', life: 3000 });
    } finally {
        loadingAnimals.value = false;
    }
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
    recordForm.value = {
        id: null,
        diagnosis_date: new Date(),
        disease_name: '',
        animal_id: null,
        animal_group_id: null,
        symptoms: '',
        severity: 'medium',
        diagnosis: '',
        treatment_plan: '',
        medications: '',
        treatment_start_date: null,
        treatment_end_date: null,
        veterinarian: '',
        cost: null,
        status: 'ongoing',
        outcome: '',
        notes: ''
    };
    sourceType.value = 'individual';
    submitted.value = false;
    recordDialog.value = true;
};

const editRecord = (record) => {
    recordForm.value = {
        id: record.id,
        diagnosis_date: new Date(record.diagnosis_date),
        disease_name: record.disease_name,
        animal_id: record.animal_id,
        animal_group_id: record.animal_group_id,
        symptoms: record.symptoms || '',
        severity: record.severity || 'medium',
        diagnosis: record.diagnosis || '',
        treatment_plan: record.treatment_plan || '',
        medications: record.medications || '',
        treatment_start_date: record.treatment_start_date ? new Date(record.treatment_start_date) : null,
        treatment_end_date: record.treatment_end_date ? new Date(record.treatment_end_date) : null,
        veterinarian: record.veterinarian || '',
        cost: record.cost,
        status: record.status || 'ongoing',
        outcome: record.outcome || '',
        notes: record.notes || ''
    };
    sourceType.value = record.animal_id ? 'individual' : 'group';
    submitted.value = false;
    recordDialog.value = true;
};

const saveRecord = async () => {
    submitted.value = true;

    if (!recordForm.value.diagnosis_date || !recordForm.value.disease_name) {
        return;
    }

    if (sourceType.value === 'individual' && !recordForm.value.animal_id) {
        return;
    }

    if (sourceType.value === 'group' && !recordForm.value.animal_group_id) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            ...recordForm.value,
            diagnosis_date: toApiDate(recordForm.value.diagnosis_date),
            treatment_start_date: recordForm.value.treatment_start_date ? toApiDate(recordForm.value.treatment_start_date) : null,
            treatment_end_date: recordForm.value.treatment_end_date ? toApiDate(recordForm.value.treatment_end_date) : null
        };

        if (recordForm.value.id) {
            await animalService.updateDiseaseTreatment(recordForm.value.id, data);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Record updated', life: 3000 });
        } else {
            await animalService.createDiseaseTreatment(data);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Record created', life: 3000 });
        }

        recordDialog.value = false;
        await loadRecords();
        await loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to save record',
            life: 3000
        });
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
        await animalService.deleteDiseaseTreatment(recordToDelete.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Record deleted', life: 3000 });
        deleteDialog.value = false;
        await loadRecords();
        await loadStatistics();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete record', life: 3000 });
    } finally {
        deleting.value = false;
    }
};

const clearSource = () => {
    recordForm.value.animal_id = null;
    recordForm.value.animal_group_id = null;
};

const onSearch = () => {
    // Implement search if needed
};

// Formatting helpers
const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
};

const getSeveritySeverity = (severity) => {
    const severities = {
        low: 'success',
        medium: 'warn',
        high: 'danger',
        critical: 'danger'
    };
    return severities[severity] || 'info';
};

const getStatusSeverity = (status) => {
    const severities = {
        ongoing: 'warn',
        completed: 'success',
        chronic: 'info'
    };
    return severities[status] || 'info';
};

// Lifecycle
onMounted(() => {
    loadRecords();
    loadStatistics();
    loadAnimals();
    loadGroups();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Diseases & Treatments</h2>
                <p class="text-surface-600 dark:text-surface-400">Track disease diagnoses and treatment progress</p>
            </div>
            <Button label="Record Disease" icon="pi pi-plus" @click="openNewRecordDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Cases</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.total_records || 0 }}</p>
                    </div>
                    <i class="pi pi-file text-3xl text-blue-500"></i>
                </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Ongoing</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.ongoing_count || 0 }}</p>
                    </div>
                    <i class="pi pi-clock text-3xl text-orange-500"></i>
                </div>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Critical</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.critical_count || 0 }}</p>
                    </div>
                    <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
                </div>
            </div>
            <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-l-4 border-purple-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Chronic</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.chronic_count || 0 }}</p>
                    </div>
                    <i class="pi pi-refresh text-3xl text-purple-500"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Cost</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(statistics.total_cost || 0) }}</p>
                    </div>
                    <i class="pi pi-dollar text-3xl text-green-500"></i>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="All Status" class="w-full md:w-48" showClear @change="loadRecords" />
            <Select v-model="filters.severity" :options="severityOptions" optionLabel="label" optionValue="value" placeholder="All Severities" class="w-full md:w-48" showClear @change="loadRecords" />
            <DatePicker v-model="filters.start_date" placeholder="From Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <DatePicker v-model="filters.end_date" placeholder="To Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <InputText v-model="searchQuery" placeholder="Search disease name..." class="w-full md:w-64" @input="onSearch">
                <template #prefix>
                    <i class="pi pi-search" />
                </template>
            </InputText>
        </div>

        <!-- Data Table -->
        <DataTable :value="records" :loading="loading" :paginator="true" :rows="15" :rowsPerPageOptions="[10, 15, 25, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No disease records found</p>
                </div>
            </template>

            <Column field="diagnosis_date" header="Date" sortable style="width: 120px">
                <template #body="{ data }">
                    {{ formatDate(data.diagnosis_date) }}
                </template>
            </Column>

            <Column field="disease_name" header="Disease" sortable style="width: 180px">
                <template #body="{ data }">
                    <div class="font-medium">{{ data.disease_name }}</div>
                </template>
            </Column>

            <Column field="animal_name" header="Animal/Group" style="width: 200px">
                <template #body="{ data }">
                    <div>
                        <div class="font-medium">{{ data.animal_name || data.group_name }}</div>
                        <div class="text-sm text-surface-500">{{ data.animal_tag || data.group_code }}</div>
                        <div class="text-xs text-surface-400">{{ data.animal_type_name }}</div>
                    </div>
                </template>
            </Column>

            <Column field="severity" header="Severity" sortable style="width: 120px">
                <template #body="{ data }">
                    <Tag :value="data.severity" :severity="getSeveritySeverity(data.severity)" />
                </template>
            </Column>

            <Column field="status" header="Status" sortable style="width: 120px">
                <template #body="{ data }">
                    <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
                </template>
            </Column>

            <Column field="symptoms" header="Symptoms" style="min-width: 200px">
                <template #body="{ data }">
                    <div class="line-clamp-2">{{ data.symptoms || '-' }}</div>
                </template>
            </Column>

            <Column field="medications" header="Medications" style="width: 180px">
                <template #body="{ data }">
                    <div class="line-clamp-2">{{ data.medications || '-' }}</div>
                </template>
            </Column>

            <Column field="veterinarian" header="Veterinarian" style="width: 160px">
                <template #body="{ data }">
                    {{ data.veterinarian || '-' }}
                </template>
            </Column>

            <Column field="cost" header="Cost" sortable style="width: 120px">
                <template #body="{ data }">
                    {{ data.cost ? formatCurrency(data.cost) : '-' }}
                </template>
            </Column>

            <Column header="Actions" style="width: 100px" frozen alignFrozen="right">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-pencil" severity="info" text rounded @click="editRecord(data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Create/Edit Dialog -->
        <Dialog v-model:visible="recordDialog" :header="recordForm.id ? 'Edit Disease/Treatment Record' : 'Record Disease/Treatment'" :modal="true" :closable="true" :style="{ width: '60rem' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }">
            <div class="flex flex-col gap-4 mt-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="diagnosis_date">Diagnosis Date *</label>
                        <DatePicker id="diagnosis_date" v-model="recordForm.diagnosis_date" dateFormat="yy-mm-dd" showIcon :class="{ 'p-invalid': submitted && !recordForm.diagnosis_date }" />
                        <small class="p-error" v-if="submitted && !recordForm.diagnosis_date">Date is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="disease_name">Disease Name *</label>
                        <InputText id="disease_name" v-model="recordForm.disease_name" placeholder="Enter disease name" :class="{ 'p-invalid': submitted && !recordForm.disease_name }" />
                        <small class="p-error" v-if="submitted && !recordForm.disease_name">Disease name is required</small>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="severity">Severity</label>
                        <Select id="severity" v-model="recordForm.severity" :options="severityOptions" optionLabel="label" optionValue="value" placeholder="Select severity" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="status">Status</label>
                        <Select id="status" v-model="recordForm.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Select status" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="source_type">Source Type *</label>
                    <div class="flex gap-4">
                        <div class="flex items-center">
                            <RadioButton v-model="sourceType" inputId="individual" value="individual" @change="clearSource" />
                            <label for="individual" class="ml-2">Individual Animal</label>
                        </div>
                        <div class="flex items-center">
                            <RadioButton v-model="sourceType" inputId="group" value="group" @change="clearSource" />
                            <label for="group" class="ml-2">Animal Group</label>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-2" v-if="sourceType === 'individual'">
                    <label for="animal_id">Animal *</label>
                    <Select
                        id="animal_id"
                        v-model="recordForm.animal_id"
                        :options="animals"
                        optionLabel="display_name"
                        optionValue="id"
                        placeholder="Select animal"
                        filter
                        :loading="loadingAnimals"
                        :class="{ 'p-invalid': submitted && !recordForm.animal_id }"
                    />
                    <small class="p-error" v-if="submitted && !recordForm.animal_id && sourceType === 'individual'"> Animal is required </small>
                </div>

                <div class="flex flex-col gap-2" v-if="sourceType === 'group'">
                    <label for="animal_group_id">Animal Group *</label>
                    <Select
                        id="animal_group_id"
                        v-model="recordForm.animal_group_id"
                        :options="groups"
                        optionLabel="display_name"
                        optionValue="id"
                        placeholder="Select group"
                        filter
                        :loading="loadingGroups"
                        :class="{ 'p-invalid': submitted && !recordForm.animal_group_id }"
                    />
                    <small class="p-error" v-if="submitted && !recordForm.animal_group_id && sourceType === 'group'"> Group is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="symptoms">Symptoms</label>
                    <Textarea id="symptoms" v-model="recordForm.symptoms" rows="3" placeholder="Describe symptoms observed" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="diagnosis">Diagnosis</label>
                    <Textarea id="diagnosis" v-model="recordForm.diagnosis" rows="3" placeholder="Enter diagnosis details" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="treatment_plan">Treatment Plan</label>
                    <Textarea id="treatment_plan" v-model="recordForm.treatment_plan" rows="3" placeholder="Describe treatment plan" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="medications">Medications</label>
                    <Textarea id="medications" v-model="recordForm.medications" rows="2" placeholder="List medications and dosage" />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="treatment_start_date">Treatment Start Date</label>
                        <DatePicker id="treatment_start_date" v-model="recordForm.treatment_start_date" dateFormat="yy-mm-dd" showIcon />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="treatment_end_date">Treatment End Date</label>
                        <DatePicker id="treatment_end_date" v-model="recordForm.treatment_end_date" dateFormat="yy-mm-dd" showIcon />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="veterinarian">Veterinarian</label>
                        <InputText id="veterinarian" v-model="recordForm.veterinarian" placeholder="Veterinarian name" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="cost">Cost</label>
                        <InputNumber id="cost" v-model="recordForm.cost" mode="currency" currency="KES" locale="en-KE" placeholder="0.00" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="outcome">Outcome/Result</label>
                    <Textarea id="outcome" v-model="recordForm.outcome" rows="2" placeholder="Treatment outcome or result" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="notes">Notes</label>
                    <Textarea id="notes" v-model="recordForm.notes" rows="3" placeholder="Additional notes" />
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
                <span>Are you sure you want to delete this disease/treatment record?</span>
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
