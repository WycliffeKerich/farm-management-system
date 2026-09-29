<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';

const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

// State
const loading = ref(false);
const saving = ref(false);
const groups = ref([]);
const animalTypes = ref([]);
const breeds = ref([]);
const housing = ref([]);
const statistics = ref({});
const groupDialog = ref(false);
const additionDialog = ref(false);
const saleDialog = ref(false);
const deathDialog = ref(false);
const editingGroup = ref(null);
const selectedGroup = ref(null);
const submitted = ref(false);
const additionSubmitted = ref(false);
const saleSubmitted = ref(false);
const deathSubmitted = ref(false);

// Filters
const filters = ref({
    search: '',
    status: null,
    animal_type_id: null
});

// Forms
const groupForm = ref({
    animal_type_id: null,
    animal_breed_id: null,
    group_code: '',
    name: '',
    quantity: null,
    housing_id: null,
    acquisition_date: new Date(),
    acquisition_type: 'purchased',
    cost_per_unit: null,
    status: 'active',
    notes: ''
});

const additionForm = ref({
    quantity: null,
    adjustment_type: 'acquisition',
    date: new Date(),
    cost_per_unit: null,
    notes: ''
});

const saleForm = ref({
    quantity: null,
    sale_date: new Date(),
    price_per_unit: null,
    buyer_name: '',
    notes: ''
});

const deathForm = ref({
    quantity: null,
    death_date: new Date(),
    cause_category: null,
    cause_of_death: '',
    notes: ''
});

// Options
const statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Depleted', value: 'depleted' },
    { label: 'Sold', value: 'sold' },
    { label: 'Archived', value: 'archived' }
];

const acquisitionOptions = [
    { label: 'Purchased', value: 'purchased' },
    { label: 'Hatched', value: 'hatched' },
    { label: 'Born', value: 'born' },
    { label: 'Transferred', value: 'transferred' }
];

const additionTypeOptions = [
    { label: 'Acquisition/Purchase', value: 'acquisition' },
    { label: 'Hatched', value: 'hatched' },
    { label: 'Born', value: 'born' },
    { label: 'Transfer In', value: 'transfer_in' }
];

const deathCauseOptions = [
    { label: 'Disease', value: 'disease' },
    { label: 'Predator', value: 'predator' },
    { label: 'Accident', value: 'accident' },
    { label: 'Natural', value: 'natural' },
    { label: 'Culled', value: 'culled' },
    { label: 'Slaughtered', value: 'slaughtered' },
    { label: 'Unknown', value: 'unknown' },
    { label: 'Other', value: 'other' }
];

// Computed
const flockAnimalTypes = computed(() => {
    return animalTypes.value.filter((t) => t.tracking_mode === 'flock' || t.tracking_mode === 'both');
});

const formFilteredBreeds = computed(() => {
    if (!groupForm.value.animal_type_id) return [];
    return breeds.value.filter((b) => b.animal_type_id === groupForm.value.animal_type_id);
});

const activeHousing = computed(() => {
    return housing.value.filter((h) => h.is_active);
});

const saleTotal = computed(() => {
    return (saleForm.value.quantity || 0) * (saleForm.value.price_per_unit || 0);
});

// Methods
const loadGroups = async () => {
    loading.value = true;
    try {
        const params = { ...filters.value };
        Object.keys(params).forEach((key) => {
            if (params[key] === null || params[key] === '') {
                delete params[key];
            }
        });

        const response = await animalService.getGroups(params);
        groups.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load groups:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to load groups',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const loadStatistics = async () => {
    try {
        const response = await animalService.getGroupStatistics();
        statistics.value = response.data.data || response.data || {};
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
};

const loadAnimalTypes = async () => {
    try {
        const response = await animalService.getAnimalTypes();
        animalTypes.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load animal types:', error);
    }
};

const loadBreeds = async () => {
    try {
        const response = await animalService.getBreeds();
        breeds.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load breeds:', error);
    }
};

const loadHousing = async () => {
    try {
        const response = await animalService.getHousing({ is_active: true });
        housing.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load housing:', error);
    }
};

const onTypeChange = () => {
    loadGroups();
};

const onFormTypeChange = () => {
    groupForm.value.animal_breed_id = null;
};

const openNewGroupDialog = () => {
    editingGroup.value = null;
    groupForm.value = {
        animal_type_id: null,
        animal_breed_id: null,
        group_code: '',
        name: '',
        quantity: null,
        housing_id: null,
        acquisition_date: new Date(),
        acquisition_type: 'purchased',
        cost_per_unit: null,
        status: 'active',
        notes: ''
    };
    submitted.value = false;
    groupDialog.value = true;
};

const editGroup = (group) => {
    editingGroup.value = group;
    const breed = breeds.value.find((b) => b.id === group.animal_breed_id);

    groupForm.value = {
        animal_type_id: breed?.animal_type_id || null,
        animal_breed_id: group.animal_breed_id,
        group_code: group.group_code,
        name: group.name,
        quantity: group.current_quantity,
        housing_id: group.housing_id,
        acquisition_date: group.acquisition_date ? new Date(group.acquisition_date) : null,
        acquisition_type: group.acquisition_type || 'purchased',
        cost_per_unit: group.cost_per_unit,
        status: group.status,
        notes: group.notes || ''
    };
    submitted.value = false;
    groupDialog.value = true;
};

const closeGroupDialog = () => {
    groupDialog.value = false;
    editingGroup.value = null;
};

const saveGroup = async () => {
    submitted.value = true;

    if (!groupForm.value.animal_breed_id || !groupForm.value.name || !groupForm.value.quantity) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            animal_breed_id: groupForm.value.animal_breed_id,
            group_code: groupForm.value.group_code || undefined,
            name: groupForm.value.name,
            housing_id: groupForm.value.housing_id,
            acquisition_date: formatDateForApi(groupForm.value.acquisition_date),
            acquisition_type: groupForm.value.acquisition_type,
            cost_per_unit: groupForm.value.cost_per_unit,
            notes: groupForm.value.notes
        };

        if (editingGroup.value) {
            data.current_quantity = groupForm.value.quantity;
            data.status = groupForm.value.status;
            await animalService.updateGroup(editingGroup.value.id, data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Group updated successfully',
                life: 3000
            });
        } else {
            data.quantity = groupForm.value.quantity;
            await animalService.createGroup(data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Group created successfully',
                life: 3000
            });
        }

        closeGroupDialog();
        loadGroups();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to save group',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const viewGroup = (group) => {
    router.push({ name: 'animal-group-detail', params: { id: group.id } });
};

const openAdditionDialog = (group) => {
    selectedGroup.value = group;
    additionForm.value = {
        quantity: null,
        adjustment_type: 'acquisition',
        date: new Date(),
        cost_per_unit: group.cost_per_unit,
        notes: ''
    };
    additionSubmitted.value = false;
    additionDialog.value = true;
};

const recordAddition = async () => {
    additionSubmitted.value = true;

    if (!additionForm.value.quantity || !additionForm.value.adjustment_type) {
        return;
    }

    saving.value = true;
    try {
        await animalService.recordGroupAddition(selectedGroup.value.id, {
            quantity: additionForm.value.quantity,
            adjustment_type: additionForm.value.adjustment_type,
            adjustment_date: formatDateForApi(additionForm.value.date),
            cost_per_unit: additionForm.value.cost_per_unit,
            notes: additionForm.value.notes
        });

        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: `Added ${additionForm.value.quantity} animals to group`,
            life: 3000
        });

        additionDialog.value = false;
        loadGroups();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to record addition',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const openSaleDialog = (group) => {
    selectedGroup.value = group;
    saleForm.value = {
        quantity: null,
        sale_date: new Date(),
        price_per_unit: null,
        buyer_name: '',
        notes: ''
    };
    saleSubmitted.value = false;
    saleDialog.value = true;
};

const recordSale = async () => {
    saleSubmitted.value = true;

    if (!saleForm.value.quantity || !saleForm.value.sale_date || !saleForm.value.price_per_unit) {
        return;
    }

    saving.value = true;
    try {
        await animalService.recordGroupRemoval(selectedGroup.value.id, {
            quantity: saleForm.value.quantity,
            adjustment_type: 'sale',
            adjustment_date: formatDateForApi(saleForm.value.sale_date),
            unit_value: saleForm.value.price_per_unit,
            reason: saleForm.value.buyer_name ? `Sold to ${saleForm.value.buyer_name}` : 'Sold',
            notes: saleForm.value.notes
        });

        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: `Recorded sale of ${saleForm.value.quantity} animals`,
            life: 3000
        });

        saleDialog.value = false;
        loadGroups();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to record sale',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const openDeathDialog = (group) => {
    selectedGroup.value = group;
    deathForm.value = {
        quantity: null,
        death_date: new Date(),
        cause_category: null,
        cause_of_death: '',
        notes: ''
    };
    deathSubmitted.value = false;
    deathDialog.value = true;
};

const recordDeath = async () => {
    deathSubmitted.value = true;

    if (!deathForm.value.quantity || !deathForm.value.death_date || !deathForm.value.cause_category) {
        return;
    }

    saving.value = true;
    try {
        await animalService.recordGroupDeaths(selectedGroup.value.id, {
            quantity: deathForm.value.quantity,
            death_date: formatDateForApi(deathForm.value.death_date),
            cause_category: deathForm.value.cause_category,
            cause_of_death: deathForm.value.cause_of_death,
            notes: deathForm.value.notes
        });

        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: `Recorded ${deathForm.value.quantity} deaths`,
            life: 3000
        });

        deathDialog.value = false;
        loadGroups();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to record deaths',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const confirmDelete = (group) => {
    confirm.require({
        message: `Are you sure you want to delete group "${group.name}"?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deleteGroup(group)
    });
};

const deleteGroup = async (group) => {
    try {
        await animalService.deleteGroup(group.id);
        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Group deleted successfully',
            life: 3000
        });
        loadGroups();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to delete group',
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

const formatStatus = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
};

const getStatusSeverity = (status) => {
    switch (status) {
        case 'active':
            return 'success';
        case 'depleted':
            return 'warn';
        case 'sold':
            return 'info';
        case 'archived':
            return 'secondary';
        default:
            return 'secondary';
    }
};

let searchTimeout = null;
const debouncedSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadGroups();
    }, 300);
};

// Lifecycle
onMounted(() => {
    loadGroups();
    loadStatistics();
    loadAnimalTypes();
    loadBreeds();
    loadHousing();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Animal Groups</h2>
                <p class="text-surface-600 dark:text-surface-400">Manage flocks, herds, and groups tracked by quantity</p>
            </div>
            <Button label="New Group" icon="pi pi-plus" @click="openNewGroupDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="flex-1">
                <InputText v-model="filters.search" placeholder="Search by name or code..." class="w-full" @input="debouncedSearch" />
            </div>
            <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="All Statuses" class="w-full md:w-48" showClear @change="loadGroups" />
            <Select v-model="filters.animal_type_id" :options="animalTypes" optionLabel="name" optionValue="id" placeholder="All Types" class="w-full md:w-48" showClear @change="onTypeChange" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Active Groups</p>
                        <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ statistics.active_groups || 0 }}</p>
                    </div>
                    <i class="pi pi-users text-3xl text-blue-400"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-600 dark:text-green-400 text-sm font-medium">Total Animals</p>
                        <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ statistics.total_animals || 0 }}</p>
                    </div>
                    <i class="pi pi-heart text-3xl text-green-400"></i>
                </div>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-red-600 dark:text-red-400 text-sm font-medium">Total Deaths</p>
                        <p class="text-2xl font-bold text-red-900 dark:text-red-100">{{ statistics.total_deaths || 0 }}</p>
                    </div>
                    <i class="pi pi-times-circle text-3xl text-red-400"></i>
                </div>
            </div>
            <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-purple-600 dark:text-purple-400 text-sm font-medium">Total Sold</p>
                        <p class="text-2xl font-bold text-purple-900 dark:text-purple-100">{{ statistics.total_sold || 0 }}</p>
                    </div>
                    <i class="pi pi-dollar text-3xl text-purple-400"></i>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <DataTable :value="groups" :loading="loading" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No groups found</p>
                </div>
            </template>

            <Column field="group_code" header="Code" sortable>
                <template #body="{ data }">
                    <router-link :to="{ name: 'animal-group-detail', params: { id: data.id } }" class="text-primary font-medium hover:underline">
                        {{ data.group_code }}
                    </router-link>
                </template>
            </Column>

            <Column field="name" header="Name" sortable />

            <Column field="breed_name" header="Breed" sortable />

            <Column field="current_quantity" header="Quantity" sortable>
                <template #body="{ data }">
                    <span class="font-semibold">{{ data.current_quantity }}</span>
                    <span class="text-surface-500 text-sm"> / {{ data.initial_quantity }} initial</span>
                </template>
            </Column>

            <Column field="housing_name" header="Housing" sortable>
                <template #body="{ data }">
                    {{ data.housing_name || 'Not assigned' }}
                </template>
            </Column>

            <Column field="acquisition_date" header="Acquired" sortable>
                <template #body="{ data }">
                    {{ formatDate(data.acquisition_date) }}
                </template>
            </Column>

            <Column field="status" header="Status" sortable>
                <template #body="{ data }">
                    <Tag :severity="getStatusSeverity(data.status)" :value="formatStatus(data.status)" />
                </template>
            </Column>

            <Column header="Actions" style="width: 200px">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-eye" severity="info" text rounded @click="viewGroup(data)" v-tooltip.top="'View'" />
                        <Button icon="pi pi-pencil" severity="secondary" text rounded @click="editGroup(data)" v-tooltip.top="'Edit'" />
                        <Button v-if="data.status === 'active'" icon="pi pi-plus" severity="success" text rounded @click="openAdditionDialog(data)" v-tooltip.top="'Add Animals'" />
                        <Button v-if="data.status === 'active'" icon="pi pi-dollar" severity="warn" text rounded @click="openSaleDialog(data)" v-tooltip.top="'Record Sale'" />
                        <Button v-if="data.status === 'active'" icon="pi pi-times" severity="danger" text rounded @click="openDeathDialog(data)" v-tooltip.top="'Record Deaths'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- New/Edit Group Dialog -->
        <Dialog v-model:visible="groupDialog" :header="editingGroup ? 'Edit Group' : 'New Animal Group'" :modal="true" :style="{ width: '600px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="animal_type" class="font-medium">Animal Type *</label>
                        <Select
                            id="animal_type"
                            v-model="groupForm.animal_type_id"
                            :options="flockAnimalTypes"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Select type"
                            class="w-full"
                            @change="onFormTypeChange"
                            :class="{ 'p-invalid': submitted && !groupForm.animal_type_id }"
                        />
                        <small v-if="submitted && !groupForm.animal_type_id" class="text-red-500"> Type is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="breed" class="font-medium">Breed *</label>
                        <Select
                            id="breed"
                            v-model="groupForm.animal_breed_id"
                            :options="formFilteredBreeds"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Select breed"
                            class="w-full"
                            :disabled="!groupForm.animal_type_id"
                            :class="{ 'p-invalid': submitted && !groupForm.animal_breed_id }"
                        />
                        <small v-if="submitted && !groupForm.animal_breed_id" class="text-red-500"> Breed is required </small>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="group_code" class="font-medium">Group Code</label>
                        <InputText id="group_code" v-model="groupForm.group_code" class="w-full" placeholder="Auto-generated if empty" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="name" class="font-medium">Group Name *</label>
                        <InputText id="name" v-model="groupForm.name" class="w-full" :class="{ 'p-invalid': submitted && !groupForm.name }" />
                        <small v-if="submitted && !groupForm.name" class="text-red-500"> Name is required </small>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="quantity" class="font-medium">{{ editingGroup ? 'Current' : 'Initial' }} Quantity *</label>
                        <InputNumber id="quantity" v-model="groupForm.quantity" :min="1" class="w-full" :class="{ 'p-invalid': submitted && !groupForm.quantity }" />
                        <small v-if="submitted && !groupForm.quantity" class="text-red-500"> Quantity is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="housing" class="font-medium">Housing</label>
                        <Select id="housing" v-model="groupForm.housing_id" :options="activeHousing" optionLabel="name" optionValue="id" placeholder="Select housing" class="w-full" showClear />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="acquisition_date" class="font-medium">Acquisition Date</label>
                        <DatePicker id="acquisition_date" v-model="groupForm.acquisition_date" dateFormat="yy-mm-dd" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="acquisition_type" class="font-medium">Acquisition Type</label>
                        <Select id="acquisition_type" v-model="groupForm.acquisition_type" :options="acquisitionOptions" optionLabel="label" optionValue="value" placeholder="Select type" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="cost_per_unit" class="font-medium">Cost Per Animal</label>
                        <InputNumber id="cost_per_unit" v-model="groupForm.cost_per_unit" :min="0" :minFractionDigits="2" :maxFractionDigits="2" mode="currency" currency="USD" class="w-full" />
                    </div>

                    <div v-if="editingGroup" class="flex flex-col gap-2">
                        <label for="status" class="font-medium">Status</label>
                        <Select id="status" v-model="groupForm.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="notes" class="font-medium">Notes</label>
                    <Textarea id="notes" v-model="groupForm.notes" rows="3" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="closeGroupDialog" :disabled="saving" />
                <Button :label="editingGroup ? 'Update' : 'Create'" @click="saveGroup" :loading="saving" />
            </template>
        </Dialog>

        <!-- Addition Dialog (Acquisitions) -->
        <Dialog v-model:visible="additionDialog" header="Add Animals to Group" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg mb-2">
                    <p class="font-medium">{{ selectedGroup?.name }}</p>
                    <p class="text-surface-500 text-sm">Current Quantity: {{ selectedGroup?.current_quantity }}</p>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="add_quantity" class="font-medium">Quantity to Add *</label>
                    <InputNumber id="add_quantity" v-model="additionForm.quantity" :min="1" class="w-full" :class="{ 'p-invalid': additionSubmitted && !additionForm.quantity }" />
                    <small v-if="additionSubmitted && !additionForm.quantity" class="text-red-500"> Quantity is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="add_type" class="font-medium">Reason *</label>
                    <Select
                        id="add_type"
                        v-model="additionForm.adjustment_type"
                        :options="additionTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select reason"
                        class="w-full"
                        :class="{ 'p-invalid': additionSubmitted && !additionForm.adjustment_type }"
                    />
                    <small v-if="additionSubmitted && !additionForm.adjustment_type" class="text-red-500"> Reason is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="add_date" class="font-medium">Date</label>
                    <DatePicker id="add_date" v-model="additionForm.date" dateFormat="yy-mm-dd" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="add_cost" class="font-medium">Cost Per Animal</label>
                    <InputNumber id="add_cost" v-model="additionForm.cost_per_unit" :min="0" :minFractionDigits="2" :maxFractionDigits="2" mode="currency" currency="USD" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="add_notes" class="font-medium">Notes</label>
                    <Textarea id="add_notes" v-model="additionForm.notes" rows="2" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="additionDialog = false" :disabled="saving" />
                <Button label="Add Animals" @click="recordAddition" :loading="saving" />
            </template>
        </Dialog>

        <!-- Sale Dialog -->
        <Dialog v-model:visible="saleDialog" header="Record Sale" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg mb-2">
                    <p class="font-medium">{{ selectedGroup?.name }}</p>
                    <p class="text-surface-500 text-sm">Current Quantity: {{ selectedGroup?.current_quantity }}</p>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="sale_quantity" class="font-medium">Quantity Sold *</label>
                    <InputNumber id="sale_quantity" v-model="saleForm.quantity" :min="1" :max="selectedGroup?.current_quantity" class="w-full" :class="{ 'p-invalid': saleSubmitted && !saleForm.quantity }" />
                    <small v-if="saleSubmitted && !saleForm.quantity" class="text-red-500"> Quantity is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="sale_date" class="font-medium">Sale Date *</label>
                    <DatePicker id="sale_date" v-model="saleForm.sale_date" dateFormat="yy-mm-dd" class="w-full" :class="{ 'p-invalid': saleSubmitted && !saleForm.sale_date }" />
                    <small v-if="saleSubmitted && !saleForm.sale_date" class="text-red-500"> Sale date is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="sale_price_per_unit" class="font-medium">Price Per Animal *</label>
                    <InputNumber
                        id="sale_price_per_unit"
                        v-model="saleForm.price_per_unit"
                        :min="0"
                        :minFractionDigits="2"
                        :maxFractionDigits="2"
                        mode="currency"
                        currency="USD"
                        class="w-full"
                        :class="{ 'p-invalid': saleSubmitted && !saleForm.price_per_unit }"
                    />
                    <small v-if="saleSubmitted && !saleForm.price_per_unit" class="text-red-500"> Price is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-medium">Total Sale Value</label>
                    <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-300 font-semibold">
                        {{ formatCurrency(saleTotal) }}
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="buyer" class="font-medium">Buyer</label>
                    <InputText id="buyer" v-model="saleForm.buyer_name" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="sale_notes" class="font-medium">Notes</label>
                    <Textarea id="sale_notes" v-model="saleForm.notes" rows="2" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="saleDialog = false" :disabled="saving" />
                <Button label="Record Sale" @click="recordSale" :loading="saving" />
            </template>
        </Dialog>

        <!-- Death Dialog -->
        <Dialog v-model:visible="deathDialog" header="Record Deaths" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg mb-2">
                    <p class="font-medium">{{ selectedGroup?.name }}</p>
                    <p class="text-surface-500 text-sm">Current Quantity: {{ selectedGroup?.current_quantity }}</p>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="death_quantity" class="font-medium">Number of Deaths *</label>
                    <InputNumber id="death_quantity" v-model="deathForm.quantity" :min="1" :max="selectedGroup?.current_quantity" class="w-full" :class="{ 'p-invalid': deathSubmitted && !deathForm.quantity }" />
                    <small v-if="deathSubmitted && !deathForm.quantity" class="text-red-500"> Quantity is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="death_date" class="font-medium">Death Date *</label>
                    <DatePicker id="death_date" v-model="deathForm.death_date" dateFormat="yy-mm-dd" class="w-full" :class="{ 'p-invalid': deathSubmitted && !deathForm.death_date }" />
                    <small v-if="deathSubmitted && !deathForm.death_date" class="text-red-500"> Death date is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="cause_category" class="font-medium">Cause Category *</label>
                    <Select
                        id="cause_category"
                        v-model="deathForm.cause_category"
                        :options="deathCauseOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select cause"
                        class="w-full"
                        :class="{ 'p-invalid': deathSubmitted && !deathForm.cause_category }"
                    />
                    <small v-if="deathSubmitted && !deathForm.cause_category" class="text-red-500"> Cause category is required </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="cause_of_death" class="font-medium">Cause Details</label>
                    <InputText id="cause_of_death" v-model="deathForm.cause_of_death" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="death_notes" class="font-medium">Notes</label>
                    <Textarea id="death_notes" v-model="deathForm.notes" rows="2" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="deathDialog = false" :disabled="saving" />
                <Button label="Record Deaths" severity="danger" @click="recordDeath" :loading="saving" />
            </template>
        </Dialog>

        <!-- Delete Confirmation -->
        <ConfirmDialog />
    </div>
</template>
