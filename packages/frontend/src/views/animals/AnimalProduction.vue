<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';

const confirm = useConfirm();
const toast = useToast();

// State
const loading = ref(false);
const saving = ref(false);
const records = ref([]);
const productionTypes = ref([]);
const allProductionTypes = ref([]);
const animals = ref([]);
const groups = ref([]);
const statistics = ref([]);
const recordDialog = ref(false);
const editingRecord = ref(null);
const submitted = ref(false);
const sourceType = ref('group');
const pagination = ref({ page: 1, limit: 15, total: 0 });

// Filters
const filters = ref({
    category: null,
    production_type_id: null,
    date_from: null,
    date_to: null
});

// Form
const recordForm = ref({
    production_type_id: null,
    animal_id: null,
    animal_group_id: null,
    production_date: new Date(),
    quantity: null,
    quality_grade: null,
    unit_price: null,
    notes: ''
});

// Options
const categoryOptions = [
    { label: 'Eggs', value: 'eggs' },
    { label: 'Milk', value: 'milk' },
    { label: 'Honey', value: 'honey' },
    { label: 'Wool', value: 'wool' },
    { label: 'Other', value: 'other' }
];

const gradeOptions = ['A', 'B', 'C', 'Premium', 'Standard', 'Grade 1', 'Grade 2'];

// Computed
const filteredProductionTypes = computed(() => {
    if (!filters.value.category) return allProductionTypes.value;
    return allProductionTypes.value.filter((t) => t.category === filters.value.category);
});

const topStats = computed(() => {
    return statistics.value.slice(0, 4);
});

// Methods
const loadRecords = async () => {
    loading.value = true;
    try {
        const params = {
            ...filters.value,
            page: pagination.value.page,
            limit: pagination.value.limit
        };

        // Format dates
        if (params.date_from) {
            params.date_from = formatDateForApi(params.date_from);
        }
        if (params.date_to) {
            params.date_to = formatDateForApi(params.date_to);
        }

        Object.keys(params).forEach((key) => {
            if (params[key] === null || params[key] === '') {
                delete params[key];
            }
        });

        const response = await animalService.getProductionRecords(params);
        const result = response.data || {};
        records.value = result.data || [];
        if (result.pagination) {
            pagination.value = result.pagination;
        }
    } catch (error) {
        console.error('Failed to load records:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to load production records',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const loadStatistics = async () => {
    try {
        const params = {};
        if (filters.value.date_from) {
            params.date_from = formatDateForApi(filters.value.date_from);
        }
        if (filters.value.date_to) {
            params.date_to = formatDateForApi(filters.value.date_to);
        }

        const response = await animalService.getProductionStatistics(params);
        statistics.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
};

const loadProductionTypes = async () => {
    try {
        const response = await animalService.getProductionTypes({ is_active: true });
        allProductionTypes.value = response.data.data || response.data || [];

        // Group by category for the dropdown
        const grouped = {};
        allProductionTypes.value.forEach((type) => {
            if (!grouped[type.category]) {
                grouped[type.category] = {
                    label: type.category.charAt(0).toUpperCase() + type.category.slice(1),
                    value: type.category,
                    items: []
                };
            }
            grouped[type.category].items.push(type);
        });
        productionTypes.value = Object.values(grouped);
    } catch (error) {
        console.error('Failed to load production types:', error);
    }
};

const loadAnimals = async () => {
    try {
        const response = await animalService.getAnimals({ status: 'active' });
        const data = response.data.data || response.data || [];
        animals.value = data.map((a) => ({
            ...a,
            display_name: `${a.tag_number}${a.name ? ' - ' + a.name : ''}`
        }));
    } catch (error) {
        console.error('Failed to load animals:', error);
    }
};

const loadGroups = async () => {
    try {
        const response = await animalService.getGroups({ status: 'active' });
        const data = response.data.data || response.data || [];
        groups.value = data.map((g) => ({
            ...g,
            display_name: `${g.name} (${g.group_code})`
        }));
    } catch (error) {
        console.error('Failed to load groups:', error);
    }
};

const onPage = (event) => {
    pagination.value.page = event.page + 1;
    pagination.value.limit = event.rows;
    loadRecords();
};

const openNewRecordDialog = () => {
    editingRecord.value = null;
    recordForm.value = {
        production_type_id: null,
        animal_id: null,
        animal_group_id: null,
        production_date: new Date(),
        quantity: null,
        quality_grade: null,
        unit_price: null,
        notes: ''
    };
    sourceType.value = 'group';
    submitted.value = false;
    recordDialog.value = true;
};

const editRecord = (record) => {
    editingRecord.value = record;
    recordForm.value = {
        production_type_id: record.production_type_id,
        animal_id: record.animal_id,
        animal_group_id: record.animal_group_id,
        production_date: record.production_date ? new Date(record.production_date) : null,
        quantity: parseFloat(record.quantity),
        quality_grade: record.quality_grade,
        unit_price: record.unit_price ? parseFloat(record.unit_price) : null,
        notes: record.notes || ''
    };
    sourceType.value = record.animal_id ? 'individual' : 'group';
    submitted.value = false;
    recordDialog.value = true;
};

const closeRecordDialog = () => {
    recordDialog.value = false;
    editingRecord.value = null;
};

const saveRecord = async () => {
    submitted.value = true;

    const hasSource = (sourceType.value === 'individual' && recordForm.value.animal_id) || (sourceType.value === 'group' && recordForm.value.animal_group_id);

    if (!recordForm.value.production_type_id || !hasSource || !recordForm.value.production_date || !recordForm.value.quantity) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            production_type_id: recordForm.value.production_type_id,
            production_date: formatDateForApi(recordForm.value.production_date),
            quantity: recordForm.value.quantity,
            quality_grade: recordForm.value.quality_grade,
            unit_price: recordForm.value.unit_price,
            notes: recordForm.value.notes
        };

        if (sourceType.value === 'individual') {
            data.animal_id = recordForm.value.animal_id;
        } else {
            data.animal_group_id = recordForm.value.animal_group_id;
        }

        if (editingRecord.value) {
            await animalService.updateProductionRecord(editingRecord.value.id, data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Production record updated successfully',
                life: 3000
            });
        } else {
            await animalService.createProductionRecord(data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Production record saved successfully',
                life: 3000
            });
        }

        closeRecordDialog();
        loadRecords();
        loadStatistics();
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
    confirm.require({
        message: 'Are you sure you want to delete this production record?',
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deleteRecord(record)
    });
};

const deleteRecord = async (record) => {
    try {
        await animalService.deleteProductionRecord(record.id);
        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Production record deleted successfully',
            life: 3000
        });
        loadRecords();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to delete record',
            life: 3000
        });
    }
};

// Utility functions
const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
};

const formatDateForApi = (date) => {
    if (!date) return null;
    return new Date(date).toISOString().split('T')[0];
};

const formatNumber = (value) => {
    if (value === null || value === undefined) return '0';
    return new Intl.NumberFormat().format(value);
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
};

const getCategoryIcon = (category) => {
    switch (category) {
        case 'eggs':
            return 'pi pi-circle-fill';
        case 'milk':
            return 'pi pi-box';
        case 'honey':
            return 'pi pi-star-fill';
        case 'wool':
            return 'pi pi-cloud';
        default:
            return 'pi pi-tag';
    }
};

const getCategorySeverity = (category) => {
    switch (category) {
        case 'eggs':
            return 'warn';
        case 'milk':
            return 'info';
        case 'honey':
            return 'success';
        case 'wool':
            return 'secondary';
        default:
            return 'secondary';
    }
};

const getGradeSeverity = (grade) => {
    if (!grade) return 'secondary';
    const g = grade.toLowerCase();
    if (g === 'a' || g === 'premium' || g === 'grade 1') return 'success';
    if (g === 'b' || g === 'standard' || g === 'grade 2') return 'info';
    return 'warn';
};

// Watch source type changes to clear the other source
watch(sourceType, (newValue) => {
    if (newValue === 'individual') {
        recordForm.value.animal_group_id = null;
    } else {
        recordForm.value.animal_id = null;
    }
});

// Lifecycle
onMounted(() => {
    loadRecords();
    loadStatistics();
    loadProductionTypes();
    loadAnimals();
    loadGroups();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Animal Production</h2>
                <p class="text-surface-600 dark:text-surface-400">Track and record production (eggs, milk, honey, etc.)</p>
            </div>
            <Button label="Record Production" icon="pi pi-plus" @click="openNewRecordDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <Select v-model="filters.category" :options="categoryOptions" optionLabel="label" optionValue="value" placeholder="All Categories" class="w-full md:w-48" showClear @change="loadRecords" />
            <Select v-model="filters.production_type_id" :options="filteredProductionTypes" optionLabel="name" optionValue="id" placeholder="All Types" class="w-full md:w-48" showClear @change="loadRecords" />
            <DatePicker v-model="filters.date_from" placeholder="From Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <DatePicker v-model="filters.date_to" placeholder="To Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div v-for="stat in topStats" :key="stat.production_type" class="bg-surface-50 dark:bg-surface-800 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">{{ stat.production_type }}</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">
                            {{ formatNumber(stat.total_quantity) }} <span class="text-sm font-normal">{{ stat.unit }}</span>
                        </p>
                        <p v-if="stat.total_value" class="text-green-600 text-sm">{{ formatCurrency(stat.total_value) }}</p>
                    </div>
                    <i :class="getCategoryIcon(stat.category)" class="text-3xl text-primary-400"></i>
                </div>
            </div>
            <div v-if="topStats.length === 0" class="col-span-4 text-center py-4 text-surface-500">No production data yet</div>
        </div>

        <!-- Data Table -->
        <DataTable :value="records" :loading="loading" :paginator="true" :rows="15" :rowsPerPageOptions="[10, 15, 25, 50]" :totalRecords="pagination.total" :lazy="true" @page="onPage" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No production records found</p>
                </div>
            </template>

            <Column field="production_date" header="Date" sortable style="width: 120px">
                <template #body="{ data }">
                    {{ formatDate(data.production_date) }}
                </template>
            </Column>

            <Column field="production_type_name" header="Type" sortable>
                <template #body="{ data }">
                    <div>
                        <span class="font-medium">{{ data.production_type_name }}</span>
                        <Tag :value="data.production_category" :severity="getCategorySeverity(data.production_category)" class="ml-2" />
                    </div>
                </template>
            </Column>

            <Column header="Source" style="width: 180px">
                <template #body="{ data }">
                    <div v-if="data.animal_tag">
                        <router-link :to="{ name: 'animal-detail', params: { id: data.animal_id } }" class="text-primary hover:underline">
                            {{ data.animal_tag }}
                        </router-link>
                        <span v-if="data.animal_name" class="text-surface-500"> - {{ data.animal_name }}</span>
                    </div>
                    <div v-else-if="data.group_name">
                        <router-link :to="{ name: 'animal-group-detail', params: { id: data.animal_group_id } }" class="text-primary hover:underline">
                            {{ data.group_name }}
                        </router-link>
                        <span class="text-surface-500 text-sm"> ({{ data.group_code }})</span>
                    </div>
                </template>
            </Column>

            <Column field="quantity" header="Quantity" sortable style="width: 130px">
                <template #body="{ data }">
                    <span class="font-semibold">{{ formatNumber(data.quantity) }}</span>
                    <span class="text-surface-500 text-sm ml-1">{{ data.production_unit }}</span>
                </template>
            </Column>

            <Column field="quality_grade" header="Grade" style="width: 100px">
                <template #body="{ data }">
                    <Tag v-if="data.quality_grade" :value="data.quality_grade" :severity="getGradeSeverity(data.quality_grade)" />
                    <span v-else class="text-surface-400">-</span>
                </template>
            </Column>

            <Column field="total_value" header="Value" sortable style="width: 120px">
                <template #body="{ data }">
                    <span v-if="data.total_value" class="text-green-600 font-medium">{{ formatCurrency(data.total_value) }}</span>
                    <span v-else class="text-surface-400">-</span>
                </template>
            </Column>

            <Column header="Actions" style="width: 120px">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-pencil" severity="secondary" text rounded @click="editRecord(data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- New/Edit Record Dialog -->
        <Dialog v-model:visible="recordDialog" :header="editingRecord ? 'Edit Production Record' : 'Record Production'" :modal="true" :style="{ width: '550px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="production_type" class="font-medium">Production Type *</label>
                    <Select
                        id="production_type"
                        v-model="recordForm.production_type_id"
                        :options="productionTypes"
                        optionLabel="name"
                        optionValue="id"
                        optionGroupLabel="label"
                        optionGroupChildren="items"
                        placeholder="Select type"
                        class="w-full"
                        :class="{ 'p-invalid': submitted && !recordForm.production_type_id }"
                    >
                        <template #optiongroup="slotProps">
                            <div class="flex items-center">
                                <i :class="getCategoryIcon(slotProps.option.value)" class="mr-2"></i>
                                <span>{{ slotProps.option.label }}</span>
                            </div>
                        </template>
                    </Select>
                    <small v-if="submitted && !recordForm.production_type_id" class="text-red-500"> Production type is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-medium">Source *</label>
                    <div class="flex gap-4 mb-2">
                        <div class="flex items-center">
                            <RadioButton v-model="sourceType" inputId="individual" value="individual" />
                            <label for="individual" class="ml-2">Individual Animal</label>
                        </div>
                        <div class="flex items-center">
                            <RadioButton v-model="sourceType" inputId="group" value="group" />
                            <label for="group" class="ml-2">Group/Flock</label>
                        </div>
                    </div>
                    <Select
                        v-if="sourceType === 'individual'"
                        v-model="recordForm.animal_id"
                        :options="animals"
                        optionLabel="display_name"
                        optionValue="id"
                        placeholder="Select animal"
                        class="w-full"
                        filter
                        :class="{ 'p-invalid': submitted && sourceType === 'individual' && !recordForm.animal_id }"
                    />
                    <Select
                        v-else
                        v-model="recordForm.animal_group_id"
                        :options="groups"
                        optionLabel="display_name"
                        optionValue="id"
                        placeholder="Select group"
                        class="w-full"
                        filter
                        :class="{ 'p-invalid': submitted && sourceType === 'group' && !recordForm.animal_group_id }"
                    />
                    <small v-if="submitted && !recordForm.animal_id && !recordForm.animal_group_id" class="text-red-500"> Please select a source </small>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="production_date" class="font-medium">Date *</label>
                        <DatePicker id="production_date" v-model="recordForm.production_date" dateFormat="yy-mm-dd" class="w-full" :maxDate="new Date()" :class="{ 'p-invalid': submitted && !recordForm.production_date }" />
                        <small v-if="submitted && !recordForm.production_date" class="text-red-500"> Date is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="quantity" class="font-medium">Quantity *</label>
                        <InputNumber id="quantity" v-model="recordForm.quantity" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" :class="{ 'p-invalid': submitted && !recordForm.quantity }" />
                        <small v-if="submitted && !recordForm.quantity" class="text-red-500"> Quantity is required </small>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="quality_grade" class="font-medium">Quality Grade</label>
                        <Select id="quality_grade" v-model="recordForm.quality_grade" :options="gradeOptions" placeholder="Select grade" class="w-full" showClear />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="unit_price" class="font-medium">Unit Price</label>
                        <InputNumber id="unit_price" v-model="recordForm.unit_price" :min="0" :minFractionDigits="2" :maxFractionDigits="2" mode="currency" currency="USD" class="w-full" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="notes" class="font-medium">Notes</label>
                    <Textarea id="notes" v-model="recordForm.notes" rows="2" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="closeRecordDialog" :disabled="saving" />
                <Button :label="editingRecord ? 'Update' : 'Save'" @click="saveRecord" :loading="saving" />
            </template>
        </Dialog>

        <!-- Delete Confirmation -->
        <ConfirmDialog />
    </div>
</template>
