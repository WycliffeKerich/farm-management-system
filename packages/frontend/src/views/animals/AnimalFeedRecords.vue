<script setup>
import { ref, computed, onMounted, watch } from 'vue';
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
import RadioButton from 'primevue/radiobutton';
import { toApiDate } from '@/utils/dates';
import { validationMessage } from '@/utils/forms';
import { useStockItems } from '@/composables/useStockItems';
import ProductPicker from '@/components/inventory/ProductPicker.vue';

const toast = useToast();
const stock = useStockItems();

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
    feed_type: '',
    start_date: null,
    end_date: null
});

const recordForm = ref({
    id: null,
    feed_date: new Date(),
    feeding_time: '',
    animal_id: null,
    animal_group_id: null,
    feed_type: '',
    inventory_item_id: null,
    feed_name: '',
    quantity: null,
    unit: 'kg',
    cost_per_unit: null,
    total_cost: null,
    notes: ''
});

const units = ['kg', 'g', 'lbs', 'bags', 'sacks', 'bales', 'liters'];

// The picked item's unit may not be one of the usual ones
const unitOptions = computed(() => {
    const unit = recordForm.value.unit;
    return unit && !units.includes(unit) ? [...units, unit] : units;
});

// Methods
const loadRecords = async () => {
    loading.value = true;
    try {
        const params = {
            ...filters.value,
            start_date: filters.value.start_date ? toApiDate(filters.value.start_date) : null,
            end_date: filters.value.end_date ? toApiDate(filters.value.end_date) : null
        };

        const response = await animalService.getFeedRecords(params);
        records.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load feed records', life: 3000 });
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
        const response = await animalService.getFeedStatistics(params);
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
        feed_date: new Date(),
        feeding_time: '',
        animal_id: null,
        animal_group_id: null,
        feed_type: '',
        inventory_item_id: null,
        feed_name: '',
        quantity: null,
        unit: 'kg',
        cost_per_unit: null,
        total_cost: null,
        notes: ''
    };
    sourceType.value = 'individual';
    submitted.value = false;
    recordDialog.value = true;
    stock.load();
};

// A stock item names the feed and sets the unit and cost; clearing it keeps the typed name
const onFeedPicked = (item) => {
    if (!item) return;
    recordForm.value.feed_name = item.name;
    recordForm.value.unit = item.unit;
    const cost = Number(item.cost_per_unit ?? item.unit_cost);
    if (cost > 0 && !recordForm.value.cost_per_unit) recordForm.value.cost_per_unit = cost;
};

const editRecord = (record) => {
    recordForm.value = {
        id: record.id,
        feed_date: new Date(record.feed_date),
        feeding_time: record.feeding_time || '',
        animal_id: record.animal_id,
        animal_group_id: record.animal_group_id,
        feed_type: record.feed_type || '',
        inventory_item_id: record.inventory_item_id || null,
        feed_name: record.feed_name || '',
        quantity: record.quantity,
        unit: record.unit,
        cost_per_unit: record.cost_per_unit,
        total_cost: record.total_cost,
        notes: record.notes || ''
    };
    sourceType.value = record.animal_id ? 'individual' : 'group';
    submitted.value = false;
    recordDialog.value = true;
    if (record.inventory_item_id) stock.load();
};

const calculateTotalCost = () => {
    if (recordForm.value.quantity && recordForm.value.cost_per_unit) {
        recordForm.value.total_cost = recordForm.value.quantity * recordForm.value.cost_per_unit;
    }
};

const saveRecord = async () => {
    submitted.value = true;

    if (!recordForm.value.feed_date || !recordForm.value.quantity || !recordForm.value.unit) {
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
            feed_date: toApiDate(recordForm.value.feed_date)
        };

        if (recordForm.value.id) {
            await animalService.updateFeedRecord(recordForm.value.id, data);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Feed record updated', life: 3000 });
        } else {
            await animalService.createFeedRecord(data);
            toast.add({ severity: 'success', summary: 'Success', detail: data.inventory_item_id ? 'Feed record created and stock drawn' : 'Feed record created', life: 3000 });
        }

        recordDialog.value = false;
        await loadRecords();
        await loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: validationMessage(error, 'Failed to save feed record'),
            life: 5000
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
        await animalService.deleteFeedRecord(recordToDelete.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Feed record deleted', life: 3000 });
        deleteDialog.value = false;
        await loadRecords();
        await loadStatistics();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete feed record', life: 3000 });
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

const formatNumber = (value) => {
    return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value);
};

// Watch for quantity and cost changes to auto-calculate total
watch(
    () => [recordForm.value.quantity, recordForm.value.cost_per_unit],
    () => {
        calculateTotalCost();
    }
);

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
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Feed Management</h2>
                <p class="text-surface-600 dark:text-surface-400">Track feed consumption and costs</p>
            </div>
            <Button label="Record Feeding" icon="pi pi-plus" @click="openNewRecordDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Records</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.total_records || 0 }}</p>
                    </div>
                    <i class="pi pi-file text-3xl text-blue-500"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Quantity</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ formatNumber(statistics.total_quantity || 0) }}</p>
                    </div>
                    <i class="pi pi-box text-3xl text-green-500"></i>
                </div>
            </div>
            <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-l-4 border-purple-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Cost</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(statistics.total_cost || 0) }}</p>
                    </div>
                    <i class="pi pi-dollar text-3xl text-purple-500"></i>
                </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Feed Types</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.unique_feed_types || 0 }}</p>
                    </div>
                    <i class="pi pi-list text-3xl text-orange-500"></i>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <InputText v-model="filters.feed_type" placeholder="Feed type..." class="w-full md:w-48">
                <template #prefix>
                    <i class="pi pi-filter" />
                </template>
            </InputText>
            <DatePicker v-model="filters.start_date" placeholder="From Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <DatePicker v-model="filters.end_date" placeholder="To Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <InputText v-model="searchQuery" placeholder="Search..." class="w-full md:w-64" @input="onSearch">
                <template #prefix>
                    <i class="pi pi-search" />
                </template>
            </InputText>
            <Button label="Filter" icon="pi pi-check" @click="loadRecords" class="w-full md:w-auto" />
        </div>

        <!-- Data Table -->
        <DataTable :value="records" :loading="loading" :paginator="true" :rows="15" :rowsPerPageOptions="[10, 15, 25, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No feed records found</p>
                </div>
            </template>

            <Column field="feed_date" header="Date" sortable style="width: 120px">
                <template #body="{ data }">
                    {{ formatDate(data.feed_date) }}
                </template>
            </Column>

            <Column field="feeding_time" header="Time" style="width: 100px">
                <template #body="{ data }">
                    {{ data.feeding_time || '-' }}
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

            <Column field="feed_type" header="Feed Type" sortable style="width: 150px">
                <template #body="{ data }">
                    {{ data.feed_type || '-' }}
                </template>
            </Column>

            <Column field="feed_name" header="Feed Name" sortable style="width: 180px">
                <template #body="{ data }">
                    {{ data.feed_name }}
                </template>
            </Column>

            <Column field="quantity" header="Quantity" sortable style="width: 120px">
                <template #body="{ data }"> {{ formatNumber(data.quantity) }} {{ data.unit }} </template>
            </Column>

            <Column field="cost_per_unit" header="Cost/Unit" sortable style="width: 120px">
                <template #body="{ data }">
                    {{ data.cost_per_unit ? formatCurrency(data.cost_per_unit) : '-' }}
                </template>
            </Column>

            <Column field="total_cost" header="Total Cost" sortable style="width: 120px">
                <template #body="{ data }">
                    {{ data.total_cost ? formatCurrency(data.total_cost) : '-' }}
                </template>
            </Column>

            <Column field="recorded_by_name" header="Recorded By" style="width: 150px">
                <template #body="{ data }">
                    {{ data.recorded_by_name }}
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
        <Dialog v-model:visible="recordDialog" :header="recordForm.id ? 'Edit Feed Record' : 'Record Feeding'" :modal="true" :closable="true" :style="{ width: '50rem' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }">
            <div class="flex flex-col gap-4 mt-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="feed_date">Date *</label>
                        <DatePicker id="feed_date" v-model="recordForm.feed_date" dateFormat="yy-mm-dd" showIcon :class="{ 'p-invalid': submitted && !recordForm.feed_date }" />
                        <small class="p-error" v-if="submitted && !recordForm.feed_date">Date is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="feeding_time">Time</label>
                        <InputText id="feeding_time" v-model="recordForm.feeding_time" placeholder="HH:MM" type="time" />
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
                    <label for="feed_item">From Stock</label>
                    <ProductPicker v-model="recordForm.inventory_item_id" inputId="feed_item" :items="stock.items.value" :loading="stock.loading.value" :disabled="!!recordForm.id" @select="onFeedPicked" />
                    <small v-if="recordForm.id && recordForm.inventory_item_id" class="text-surface-500">Changing the quantity, unit or date puts the old amount back in stock and draws the new one.</small>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="feed_type">Feed Type</label>
                        <InputText id="feed_type" v-model="recordForm.feed_type" placeholder="e.g., Concentrate, Hay, Pellets" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="feed_name">Feed Name</label>
                        <InputText id="feed_name" v-model="recordForm.feed_name" placeholder="Feed brand or name" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="quantity">Quantity *</label>
                        <InputNumber id="quantity" v-model="recordForm.quantity" placeholder="0.00" :minFractionDigits="2" :maxFractionDigits="2" :class="{ 'p-invalid': submitted && !recordForm.quantity }" />
                        <small class="p-error" v-if="submitted && !recordForm.quantity">Quantity is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="unit">Unit *</label>
                        <Select id="unit" v-model="recordForm.unit" :options="unitOptions" placeholder="Select unit" :class="{ 'p-invalid': submitted && !recordForm.unit }" />
                        <small class="p-error" v-if="submitted && !recordForm.unit">Unit is required</small>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="cost_per_unit">Cost per Unit</label>
                        <InputNumber id="cost_per_unit" v-model="recordForm.cost_per_unit" mode="currency" currency="KES" locale="en-KE" placeholder="0.00" @input="calculateTotalCost" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="total_cost">Total Cost</label>
                        <InputNumber id="total_cost" v-model="recordForm.total_cost" mode="currency" currency="KES" locale="en-KE" placeholder="0.00" :disabled="recordForm.cost_per_unit && recordForm.quantity" />
                    </div>
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
                <span>Are you sure you want to delete this feed record?</span>
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
