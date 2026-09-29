<script setup>
import { ref, onMounted, computed } from 'vue';
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

const toast = useToast();

// State
const records = ref([]);
const animals = ref([]);
const animalTypes = ref([]);
const groups = ref([]);
const statistics = ref({});
const loading = ref(false);
const loadingAnimals = ref(false);
const loadingAnimalTypes = ref(false);
const loadingGroups = ref(false);
const saving = ref(false);
const deleting = ref(false);
const recordDialog = ref(false);
const deleteDialog = ref(false);
const submitted = ref(false);
const searchQuery = ref('');
const recordToDelete = ref(null);

const filters = ref({
    status: null,
    start_date: null,
    end_date: null
});

const recordForm = ref({
    id: null,
    animal_type_filter: null,
    breeding_date: new Date(),
    male_animal_id: null,
    female_animal_id: null,
    expected_delivery_date: null,
    actual_delivery_date: null,
    offspring_count: null,
    target_group_id: null,
    notes: ''
});

const statusFilterOptions = [
    { label: 'All', value: null },
    { label: 'Pending Delivery', value: 'pending' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Overdue', value: 'overdue' }
];

// Computed
const filteredMaleAnimals = computed(() => {
    if (!recordForm.value.animal_type_filter) return [];
    return animals.value.filter((a) => a.gender === 'male' && a.animal_type_id === recordForm.value.animal_type_filter);
});

const filteredFemaleAnimals = computed(() => {
    if (!recordForm.value.animal_type_filter) return [];
    return animals.value.filter((a) => a.gender === 'female' && a.animal_type_id === recordForm.value.animal_type_filter);
});

// Methods
const loadRecords = async () => {
    loading.value = true;
    try {
        const params = {
            start_date: filters.value.start_date ? toApiDate(filters.value.start_date) : null,
            end_date: filters.value.end_date ? toApiDate(filters.value.end_date) : null
        };

        if (filters.value.status === 'pending') {
            params.has_delivered = false;
            params.expected_soon = false;
        } else if (filters.value.status === 'delivered') {
            params.has_delivered = true;
        } else if (filters.value.status === 'overdue') {
            params.has_delivered = false;
        }

        const response = await animalService.getBreedingRecords(params);
        records.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load breeding records', life: 3000 });
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
        const response = await animalService.getBreedingStatistics(params);
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
            display_name: `${a.tag_number} - ${a.name} (${a.breed_name}) - ${a.gender}`
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

const loadAnimalTypes = async () => {
    loadingAnimalTypes.value = true;
    try {
        const response = await animalService.getAnimalTypes();
        // Filter to only show mammals that are not excluded from reproduction
        const allTypes = response.data.data;
        animalTypes.value = allTypes.filter((type) => type.reproduction_type === 'mammal' && !type.exclude_from_reproduction);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load animal types', life: 3000 });
    } finally {
        loadingAnimalTypes.value = false;
    }
};

const onAnimalTypeChange = () => {
    // Clear selections when type changes
    recordForm.value.male_animal_id = null;
    recordForm.value.female_animal_id = null;
};

const openNewRecordDialog = () => {
    recordForm.value = {
        id: null,
        animal_type_filter: null,
        breeding_date: new Date(),
        male_animal_id: null,
        female_animal_id: null,
        expected_delivery_date: null,
        actual_delivery_date: null,
        offspring_count: null,
        target_group_id: null,
        notes: ''
    };
    submitted.value = false;
    recordDialog.value = true;
};

const editRecord = (record) => {
    // Find animal type from the selected male animal
    const maleAnimal = animals.value.find((a) => a.id === record.male_animal_id);

    recordForm.value = {
        id: record.id,
        animal_type_filter: maleAnimal ? maleAnimal.animal_type_id : null,
        breeding_date: new Date(record.breeding_date),
        male_animal_id: record.male_animal_id,
        female_animal_id: record.female_animal_id,
        expected_delivery_date: record.expected_delivery_date ? new Date(record.expected_delivery_date) : null,
        actual_delivery_date: record.actual_delivery_date ? new Date(record.actual_delivery_date) : null,
        offspring_count: record.offspring_count,
        target_group_id: null,
        notes: record.notes || ''
    };
    submitted.value = false;
    recordDialog.value = true;
};

const saveRecord = async () => {
    submitted.value = true;

    if (!recordForm.value.breeding_date || !recordForm.value.male_animal_id || !recordForm.value.female_animal_id) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            ...recordForm.value,
            breeding_date: toApiDate(recordForm.value.breeding_date),
            expected_delivery_date: recordForm.value.expected_delivery_date ? toApiDate(recordForm.value.expected_delivery_date) : null,
            actual_delivery_date: recordForm.value.actual_delivery_date ? toApiDate(recordForm.value.actual_delivery_date) : null
        };

        if (recordForm.value.id) {
            await animalService.updateBreedingRecord(recordForm.value.id, data);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Breeding record updated', life: 3000 });
        } else {
            await animalService.createBreedingRecord(data);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Breeding record created', life: 3000 });
        }

        recordDialog.value = false;
        await loadRecords();
        await loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to save breeding record',
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
        await animalService.deleteBreedingRecord(recordToDelete.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Breeding record deleted', life: 3000 });
        deleteDialog.value = false;
        await loadRecords();
        await loadStatistics();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete breeding record', life: 3000 });
    } finally {
        deleting.value = false;
    }
};

const onSearch = () => {
    // Implement search if needed
};

// Helper functions
const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
};

const isOverdue = (date) => {
    return new Date(date) < new Date();
};

const getStatusLabel = (record) => {
    if (record.actual_delivery_date) {
        return 'Delivered';
    }
    if (record.expected_delivery_date && isOverdue(record.expected_delivery_date)) {
        return 'Overdue';
    }
    return 'Pending';
};

const getStatusSeverity = (record) => {
    if (record.actual_delivery_date) {
        return 'success';
    }
    if (record.expected_delivery_date && isOverdue(record.expected_delivery_date)) {
        return 'danger';
    }
    return 'warn';
};

// Lifecycle
onMounted(() => {
    loadRecords();
    loadStatistics();
    loadAnimals();
    loadAnimalTypes();
    loadGroups();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Breeding Records</h2>
                <p class="text-surface-600 dark:text-surface-400">Track breeding, expected deliveries, and offspring</p>
            </div>
            <Button label="Record Breeding" icon="pi pi-plus" @click="openNewRecordDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Breedings</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.total_breeding_records || 0 }}</p>
                    </div>
                    <i class="pi pi-heart text-3xl text-blue-500"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Delivered</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.delivered_count || 0 }}</p>
                    </div>
                    <i class="pi pi-check-circle text-3xl text-green-500"></i>
                </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Pending</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.pending_count || 0 }}</p>
                    </div>
                    <i class="pi pi-clock text-3xl text-orange-500"></i>
                </div>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Overdue</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.overdue_count || 0 }}</p>
                    </div>
                    <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
                </div>
            </div>
            <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-l-4 border-purple-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Offspring</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.total_offspring || 0 }}</p>
                    </div>
                    <i class="pi pi-users text-3xl text-purple-500"></i>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <Select v-model="filters.status" :options="statusFilterOptions" optionLabel="label" optionValue="value" placeholder="All Status" class="w-full md:w-48" showClear @change="loadRecords" />
            <DatePicker v-model="filters.start_date" placeholder="From Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <DatePicker v-model="filters.end_date" placeholder="To Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <InputText v-model="searchQuery" placeholder="Search..." class="w-full md:w-64" @input="onSearch">
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
                    <p class="text-surface-600 dark:text-surface-400">No breeding records found</p>
                </div>
            </template>

            <Column field="breeding_date" header="Breeding Date" sortable style="width: 130px">
                <template #body="{ data }">
                    {{ formatDate(data.breeding_date) }}
                </template>
            </Column>

            <Column field="male_name" header="Male" style="width: 200px">
                <template #body="{ data }">
                    <div>
                        <div class="font-medium">{{ data.male_name }}</div>
                        <div class="text-sm text-surface-500">{{ data.male_tag }}</div>
                        <div class="text-xs text-surface-400">{{ data.male_breed_name }}</div>
                    </div>
                </template>
            </Column>

            <Column field="female_name" header="Female" style="width: 200px">
                <template #body="{ data }">
                    <div>
                        <div class="font-medium">{{ data.female_name }}</div>
                        <div class="text-sm text-surface-500">{{ data.female_tag }}</div>
                        <div class="text-xs text-surface-400">{{ data.female_breed_name }}</div>
                    </div>
                </template>
            </Column>

            <Column field="expected_delivery_date" header="Expected Delivery" sortable style="width: 140px">
                <template #body="{ data }">
                    <span v-if="data.expected_delivery_date">
                        <Tag v-if="isOverdue(data.expected_delivery_date) && !data.actual_delivery_date" value="Overdue" severity="danger" />
                        <span v-else>{{ formatDate(data.expected_delivery_date) }}</span>
                    </span>
                    <span v-else>-</span>
                </template>
            </Column>

            <Column field="actual_delivery_date" header="Actual Delivery" sortable style="width: 140px">
                <template #body="{ data }">
                    <span v-if="data.actual_delivery_date">
                        {{ formatDate(data.actual_delivery_date) }}
                    </span>
                    <span v-else class="text-surface-400">Pending</span>
                </template>
            </Column>

            <Column field="offspring_count" header="Offspring" sortable style="width: 100px">
                <template #body="{ data }">
                    <span v-if="data.offspring_count">
                        <Tag :value="data.offspring_count" severity="success" />
                    </span>
                    <span v-else>-</span>
                </template>
            </Column>

            <Column field="status" header="Status" style="width: 120px">
                <template #body="{ data }">
                    <Tag :value="getStatusLabel(data)" :severity="getStatusSeverity(data)" />
                </template>
            </Column>

            <Column field="animal_type_name" header="Type" style="width: 130px">
                <template #body="{ data }">
                    {{ data.animal_type_name }}
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
        <Dialog v-model:visible="recordDialog" :header="recordForm.id ? 'Edit Breeding Record' : 'Record Breeding'" :modal="true" :closable="true" :style="{ width: '50rem' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }">
            <div class="flex flex-col gap-4 mt-4">
                <div class="flex flex-col gap-2">
                    <label for="breeding_date">Breeding Date *</label>
                    <DatePicker id="breeding_date" v-model="recordForm.breeding_date" dateFormat="yy-mm-dd" showIcon :class="{ 'p-invalid': submitted && !recordForm.breeding_date }" />
                    <small class="p-error" v-if="submitted && !recordForm.breeding_date">Date is required</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="animal_type_filter">Animal Type *</label>
                    <Select
                        id="animal_type_filter"
                        v-model="recordForm.animal_type_filter"
                        :options="animalTypes"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Select animal type first"
                        :class="{ 'p-invalid': submitted && !recordForm.animal_type_filter }"
                        @change="onAnimalTypeChange"
                    />
                    <small class="text-surface-500 text-xs">Select type to filter available animals</small>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="male_animal_id">Male Animal *</label>
                        <Select
                            id="male_animal_id"
                            v-model="recordForm.male_animal_id"
                            :options="filteredMaleAnimals"
                            optionLabel="display_name"
                            optionValue="id"
                            placeholder="Select male animal"
                            filter
                            :loading="loadingAnimals"
                            :disabled="!recordForm.animal_type_filter"
                            :class="{ 'p-invalid': submitted && !recordForm.male_animal_id }"
                        />
                        <small class="p-error" v-if="submitted && !recordForm.male_animal_id"> Male animal is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="female_animal_id">Female Animal *</label>
                        <Select
                            id="female_animal_id"
                            v-model="recordForm.female_animal_id"
                            :options="filteredFemaleAnimals"
                            optionLabel="display_name"
                            optionValue="id"
                            placeholder="Select female animal"
                            filter
                            :loading="loadingAnimals"
                            :disabled="!recordForm.animal_type_filter"
                            :class="{ 'p-invalid': submitted && !recordForm.female_animal_id }"
                        />
                        <small class="p-error" v-if="submitted && !recordForm.female_animal_id"> Female animal is required </small>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="expected_delivery_date">Expected Delivery Date</label>
                        <DatePicker id="expected_delivery_date" v-model="recordForm.expected_delivery_date" dateFormat="yy-mm-dd" showIcon />
                        <small class="text-surface-500 text-xs">Optional: Calculated from gestation period</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="actual_delivery_date">Actual Delivery Date</label>
                        <DatePicker id="actual_delivery_date" v-model="recordForm.actual_delivery_date" dateFormat="yy-mm-dd" showIcon />
                        <small class="text-surface-500 text-xs">Leave empty until delivery occurs</small>
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="offspring_count">Offspring Count</label>
                    <InputNumber id="offspring_count" v-model="recordForm.offspring_count" placeholder="Number of offspring" :min="0" />
                    <small class="text-surface-500 text-xs">Enter after delivery</small>
                </div>

                <div class="flex flex-col gap-2" v-if="recordForm.offspring_count && recordForm.offspring_count > 0">
                    <label for="target_group_id">Add Offspring to Group (Optional)</label>
                    <Select id="target_group_id" v-model="recordForm.target_group_id" :options="groups" optionLabel="display_name" optionValue="id" placeholder="Select a group/flock to add offspring" filter showClear />
                    <small class="text-surface-500 text-xs">Select to automatically add offspring to existing flock</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="notes">Notes</label>
                    <Textarea id="notes" v-model="recordForm.notes" rows="3" placeholder="Additional notes about breeding, delivery, or offspring" />
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
                <span>Are you sure you want to delete this breeding record?</span>
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
