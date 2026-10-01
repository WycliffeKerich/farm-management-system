<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatApiDate, toApiDate } from '@/utils/dates';
import { validationMessage } from '@/utils/forms';
import { holdProducts } from '@/utils/withdrawals';
import { useActiveHolds } from '@/composables/useActiveHolds';
import { useWithdrawalGuard } from '@/composables/useWithdrawalGuard';
import HoldBadges from '@/components/withdrawals/HoldBadges.vue';
import WithdrawalDialog from '@/components/withdrawals/WithdrawalDialog.vue';
import { useFormat } from '@/composables/useFormat';

const router = useRouter();
const { currency, locale } = useFormat();
const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();
const holds = useActiveHolds();
const withdrawalGuard = useWithdrawalGuard();

// Recording a sale needs the owner or a manager (POST /animals/sales)
const canSell = computed(() => authStore.hasRole(['owner', 'manager']));

// State
const loading = ref(false);
const saving = ref(false);
const animals = ref([]);
const animalTypes = ref([]);
const breeds = ref([]);
const housing = ref([]);
const statistics = ref({});
const breedingRecords = ref([]);
const animalDialog = ref(false);
const saleDialog = ref(false);
const deathDialog = ref(false);
const editingAnimal = ref(null);
const selectedAnimal = ref(null);
const submitted = ref(false);
const saleSubmitted = ref(false);
const deathSubmitted = ref(false);

// Filters
const filters = ref({
    search: '',
    status: null,
    animal_type_id: null,
    breed_id: null
});

// Form
const animalForm = ref({
    animal_type_id: null,
    animal_breed_id: null,
    tag_number: '',
    name: '',
    gender: null,
    birth_date: null,
    acquisition_date: new Date(),
    housing_id: null,
    acquisition_type: 'purchased',
    weight_kg: null,
    purchase_price: null,
    parent_male_id: null,
    parent_female_id: null,
    breeding_record_id: null,
    status: 'active',
    notes: ''
});

const saleForm = ref({
    sale_date: new Date(),
    sale_price: null,
    buyer_name: '',
    notes: ''
});

const deathForm = ref({
    death_date: new Date(),
    cause_category: null,
    cause_of_death: '',
    notes: ''
});

// Options
const statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Sick', value: 'sick' },
    { label: 'Quarantine', value: 'quarantine' },
    { label: 'Sold', value: 'sold' },
    { label: 'Deceased', value: 'deceased' }
];

const genderOptions = ['male', 'female'];

const acquisitionOptions = [
    { label: 'Purchased', value: 'purchased' },
    { label: 'Born on Farm', value: 'born' },
    { label: 'Donated', value: 'donated' },
    { label: 'Transferred', value: 'transferred' }
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
const filteredBreeds = computed(() => {
    if (!filters.value.animal_type_id) return breeds.value;
    return breeds.value.filter((b) => b.animal_type_id === filters.value.animal_type_id);
});

const individualAnimalTypes = computed(() => {
    return animalTypes.value.filter((t) => t.tracking_mode === 'individual' || t.tracking_mode === 'both');
});

const formFilteredBreeds = computed(() => {
    if (!animalForm.value.animal_type_id) return [];
    return breeds.value.filter((b) => b.animal_type_id === animalForm.value.animal_type_id);
});

const activeHousing = computed(() => {
    return housing.value.filter((h) => h.is_active);
});

// Potential parent animals (same breed, active, appropriate gender)
const potentialSires = computed(() => {
    if (!animalForm.value.animal_breed_id) return [];
    return animals.value.filter((a) => a.animal_breed_id === animalForm.value.animal_breed_id && a.gender === 'male' && a.status === 'active');
});

const potentialDams = computed(() => {
    if (!animalForm.value.animal_breed_id) return [];
    return animals.value.filter((a) => a.animal_breed_id === animalForm.value.animal_breed_id && a.gender === 'female' && a.status === 'active');
});

// Methods
const loadAnimals = async () => {
    loading.value = true;
    try {
        const params = { ...filters.value };
        Object.keys(params).forEach((key) => {
            if (params[key] === null || params[key] === '') {
                delete params[key];
            }
        });

        const response = await animalService.getAnimals(params);
        animals.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load animals:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to load animals',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const loadStatistics = async () => {
    try {
        const response = await animalService.getAnimalStatistics();
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

const loadBreedingRecords = async () => {
    try {
        const response = await animalService.getBreedingRecords({ status: 'delivered,pregnant' });
        breedingRecords.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load breeding records:', error);
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
    filters.value.breed_id = null;
    loadAnimals();
};

const onFormTypeChange = () => {
    animalForm.value.animal_breed_id = null;
};

const openNewAnimalDialog = () => {
    editingAnimal.value = null;
    animalForm.value = {
        animal_type_id: null,
        animal_breed_id: null,
        tag_number: '',
        name: '',
        gender: null,
        birth_date: null,
        acquisition_date: new Date(),
        housing_id: null,
        acquisition_type: 'purchased',
        weight_kg: null,
        purchase_price: null,
        parent_male_id: null,
        parent_female_id: null,
        breeding_record_id: null,
        status: 'active',
        notes: ''
    };
    submitted.value = false;
    animalDialog.value = true;
};

const editAnimal = (animal) => {
    editingAnimal.value = animal;
    const animalType = breeds.value.find((b) => b.id === animal.animal_breed_id);

    animalForm.value = {
        animal_type_id: animalType?.animal_type_id || animal.animal_type_id || null,
        animal_breed_id: animal.animal_breed_id,
        tag_number: animal.tag_number,
        name: animal.name || '',
        gender: animal.gender,
        birth_date: animal.date_of_birth ? new Date(animal.date_of_birth) : null,
        acquisition_date: animal.date_acquired ? new Date(animal.date_acquired) : null,
        housing_id: animal.housing_id,
        acquisition_type: animal.acquisition_type || 'purchased',
        weight_kg: animal.weight ? parseFloat(animal.weight) : null,
        purchase_price: animal.purchase_price ? parseFloat(animal.purchase_price) : null,
        parent_male_id: animal.parent_male_id || null,
        parent_female_id: animal.parent_female_id || null,
        breeding_record_id: animal.breeding_record_id || null,
        status: animal.status,
        notes: animal.notes || ''
    };
    submitted.value = false;
    animalDialog.value = true;
};

const closeAnimalDialog = () => {
    animalDialog.value = false;
    editingAnimal.value = null;
};

const saveAnimal = async () => {
    submitted.value = true;

    if (!animalForm.value.animal_breed_id || !animalForm.value.gender) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            animal_breed_id: animalForm.value.animal_breed_id,
            tag_number: animalForm.value.tag_number || undefined,
            name: animalForm.value.name || undefined,
            gender: animalForm.value.gender,
            date_of_birth: toApiDate(animalForm.value.birth_date),
            date_acquired: toApiDate(animalForm.value.acquisition_date),
            housing_id: animalForm.value.housing_id,
            acquisition_type: animalForm.value.acquisition_type,
            weight: animalForm.value.weight_kg,
            purchase_price: animalForm.value.purchase_price,
            parent_male_id: animalForm.value.parent_male_id || undefined,
            parent_female_id: animalForm.value.parent_female_id || undefined,
            breeding_record_id: animalForm.value.breeding_record_id || undefined,
            notes: animalForm.value.notes
        };

        if (editingAnimal.value) {
            data.status = animalForm.value.status;
            await animalService.updateAnimal(editingAnimal.value.id, data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Animal updated successfully',
                life: 3000
            });
        } else {
            await animalService.createAnimal(data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Animal created successfully',
                life: 3000
            });
        }

        closeAnimalDialog();
        loadAnimals();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to save animal',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const viewAnimal = (animal) => {
    router.push({ name: 'animal-detail', params: { id: animal.id } });
};

const openSaleDialog = (animal) => {
    selectedAnimal.value = animal;
    saleForm.value = {
        sale_date: new Date(),
        sale_price: null,
        buyer_name: '',
        notes: ''
    };
    saleSubmitted.value = false;
    saleDialog.value = true;
};

// Today's meat withdrawal on the animal being sold, if any
const saleHold = computed(() => (selectedAnimal.value ? holds.forAnimal(selectedAnimal.value.id).find((entry) => entry.product === 'meat') || null : null));

const onSaleSaved = () => {
    toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Sale recorded successfully',
        life: 3000
    });

    saleDialog.value = false;
    loadAnimals();
    loadStatistics();
    holds.load();
};

const recordSale = async () => {
    saleSubmitted.value = true;

    if (!saleForm.value.sale_date || !saleForm.value.sale_price) {
        return;
    }

    saving.value = true;
    try {
        // A sale record keeps the price and buyer, and marks the animal sold
        const data = {
            reference_type: 'animal',
            reference_id: selectedAnimal.value.id,
            sale_date: toApiDate(saleForm.value.sale_date),
            product_type: 'Live animal',
            quantity: 1,
            unit: 'head',
            unit_price: saleForm.value.sale_price,
            customer_name: saleForm.value.buyer_name || undefined,
            notes: saleForm.value.notes || undefined
        };
        await withdrawalGuard.attempt((override) => animalService.createAnimalSale({ ...data, ...override }), onSaleSaved);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: validationMessage(error, 'Failed to record sale'),
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const openDeathDialog = (animal) => {
    selectedAnimal.value = animal;
    deathForm.value = {
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

    if (!deathForm.value.death_date || !deathForm.value.cause_category) {
        return;
    }

    saving.value = true;
    try {
        await animalService.recordAnimalDeath(selectedAnimal.value.id, {
            death_date: toApiDate(deathForm.value.death_date),
            cause_category: deathForm.value.cause_category,
            cause_of_death: deathForm.value.cause_of_death,
            notes: deathForm.value.notes
        });

        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Death recorded',
            life: 3000
        });

        deathDialog.value = false;
        loadAnimals();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to record death',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const confirmDelete = (animal) => {
    confirm.require({
        message: `Are you sure you want to delete animal ${animal.tag_number}?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deleteAnimal(animal)
    });
};

const deleteAnimal = async (animal) => {
    try {
        await animalService.deleteAnimal(animal.id);
        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Animal deleted successfully',
            life: 3000
        });
        loadAnimals();
        loadStatistics();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to delete animal',
            life: 3000
        });
    }
};

// Utility functions
const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
};

const formatStatus = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
};

const getStatusSeverity = (status) => {
    switch (status) {
        case 'active':
            return 'success';
        case 'sick':
            return 'warn';
        case 'quarantine':
            return 'warn';
        case 'sold':
            return 'info';
        case 'deceased':
            return 'danger';
        default:
            return 'secondary';
    }
};

let searchTimeout = null;
const debouncedSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadAnimals();
    }, 300);
};

// Lifecycle
onMounted(() => {
    loadAnimals();
    loadStatistics();
    loadAnimalTypes();
    loadBreeds();
    loadHousing();
    loadBreedingRecords();
    holds.load();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Individual Animals</h2>
                <p class="text-surface-600 dark:text-surface-400">Manage individually tracked animals</p>
            </div>
            <Button label="New Animal" icon="pi pi-plus" @click="openNewAnimalDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="flex-1">
                <InputText v-model="filters.search" placeholder="Search by tag or name..." class="w-full" @input="debouncedSearch" />
            </div>
            <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="All Statuses" class="w-full md:w-48" showClear @change="loadAnimals" />
            <Select v-model="filters.animal_type_id" :options="animalTypes" optionLabel="name" optionValue="id" placeholder="All Types" class="w-full md:w-48" showClear @change="onTypeChange" />
            <Select v-model="filters.breed_id" :options="filteredBreeds" optionLabel="name" optionValue="id" placeholder="All Breeds" class="w-full md:w-48" showClear :disabled="!filters.animal_type_id" @change="loadAnimals" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Active</p>
                        <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ statistics.active_count || 0 }}</p>
                    </div>
                    <i class="pi pi-heart text-3xl text-blue-400"></i>
                </div>
            </div>
            <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-yellow-600 dark:text-yellow-400 text-sm font-medium">Sick</p>
                        <p class="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{{ statistics.sick_count || 0 }}</p>
                    </div>
                    <i class="pi pi-exclamation-triangle text-3xl text-yellow-400"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-600 dark:text-green-400 text-sm font-medium">Sold</p>
                        <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ statistics.sold_count || 0 }}</p>
                    </div>
                    <i class="pi pi-dollar text-3xl text-green-400"></i>
                </div>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-red-600 dark:text-red-400 text-sm font-medium">Deceased</p>
                        <p class="text-2xl font-bold text-red-900 dark:text-red-100">{{ statistics.deceased_count || 0 }}</p>
                    </div>
                    <i class="pi pi-times-circle text-3xl text-red-400"></i>
                </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 dark:text-gray-400 text-sm font-medium">Total</p>
                        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ statistics.total_count || 0 }}</p>
                    </div>
                    <i class="pi pi-chart-bar text-3xl text-gray-400"></i>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <DataTable :value="animals" :loading="loading" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No animals found</p>
                </div>
            </template>

            <Column field="tag_number" header="Tag #" sortable>
                <template #body="{ data }">
                    <div class="flex flex-col items-start gap-1">
                        <router-link :to="{ name: 'animal-detail', params: { id: data.id } }" class="text-primary font-medium hover:underline">
                            {{ data.tag_number }}
                        </router-link>
                        <HoldBadges :entries="holds.forAnimal(data.id)" />
                    </div>
                </template>
            </Column>

            <Column field="name" header="Name" sortable>
                <template #body="{ data }">
                    {{ data.name || '-' }}
                </template>
            </Column>

            <Column field="breed_name" header="Breed" sortable />

            <Column field="gender" header="Gender" sortable>
                <template #body="{ data }">
                    <Tag :value="data.gender" :severity="data.gender === 'male' ? 'info' : 'warn'" />
                </template>
            </Column>

            <Column field="date_of_birth" header="Birth Date" sortable>
                <template #body="{ data }">
                    {{ formatDate(data.date_of_birth) }}
                </template>
            </Column>

            <Column field="housing_name" header="Housing" sortable>
                <template #body="{ data }">
                    {{ data.housing_name || 'Not assigned' }}
                </template>
            </Column>

            <Column field="status" header="Status" sortable>
                <template #body="{ data }">
                    <Tag :severity="getStatusSeverity(data.status)" :value="formatStatus(data.status)" />
                </template>
            </Column>

            <Column header="Actions" style="width: 150px">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-eye" severity="info" text rounded @click="viewAnimal(data)" v-tooltip.top="'View'" />
                        <Button icon="pi pi-pencil" severity="secondary" text rounded @click="editAnimal(data)" v-tooltip.top="'Edit'" />
                        <Button v-if="canSell && data.status === 'active'" icon="pi pi-dollar" severity="success" text rounded @click="openSaleDialog(data)" v-tooltip.top="'Record Sale'" />
                        <Button v-if="data.status === 'active'" icon="pi pi-times" severity="danger" text rounded @click="openDeathDialog(data)" v-tooltip.top="'Record Death'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- New/Edit Animal Dialog -->
        <Dialog v-model:visible="animalDialog" :header="editingAnimal ? 'Edit Animal' : 'New Animal'" :modal="true" :style="{ width: '650px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="animal_type" class="font-medium">Animal Type *</label>
                        <Select
                            id="animal_type"
                            v-model="animalForm.animal_type_id"
                            :options="individualAnimalTypes"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Select type"
                            class="w-full"
                            @change="onFormTypeChange"
                            :class="{ 'p-invalid': submitted && !animalForm.animal_type_id }"
                        />
                        <small v-if="submitted && !animalForm.animal_type_id" class="text-red-500"> Type is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="breed" class="font-medium">Breed *</label>
                        <Select
                            id="breed"
                            v-model="animalForm.animal_breed_id"
                            :options="formFilteredBreeds"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Select breed"
                            class="w-full"
                            :disabled="!animalForm.animal_type_id"
                            :class="{ 'p-invalid': submitted && !animalForm.animal_breed_id }"
                        />
                        <small v-if="submitted && !animalForm.animal_breed_id" class="text-red-500"> Breed is required </small>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="tag_number" class="font-medium">Tag Number</label>
                        <InputText id="tag_number" v-model="animalForm.tag_number" class="w-full" placeholder="Auto-generated if empty" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="name" class="font-medium">Name</label>
                        <InputText id="name" v-model="animalForm.name" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="gender" class="font-medium">Gender *</label>
                        <Select id="gender" v-model="animalForm.gender" :options="genderOptions" placeholder="Select gender" class="w-full" :class="{ 'p-invalid': submitted && !animalForm.gender }" />
                        <small v-if="submitted && !animalForm.gender" class="text-red-500"> Gender is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="birth_date" class="font-medium">Birth Date</label>
                        <DatePicker id="birth_date" v-model="animalForm.birth_date" dateFormat="yy-mm-dd" class="w-full" :maxDate="new Date()" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="acquisition_date" class="font-medium">Acquisition Date</label>
                        <DatePicker id="acquisition_date" v-model="animalForm.acquisition_date" dateFormat="yy-mm-dd" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="housing" class="font-medium">Housing</label>
                        <Select id="housing" v-model="animalForm.housing_id" :options="activeHousing" optionLabel="name" optionValue="id" placeholder="Select housing" class="w-full" showClear />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="acquisition_type" class="font-medium">Acquisition Type</label>
                        <Select id="acquisition_type" v-model="animalForm.acquisition_type" :options="acquisitionOptions" optionLabel="label" optionValue="value" placeholder="Select type" class="w-full" />
                    </div>
                </div>

                <!-- Parent Information (shown when "Born on Farm") -->
                <div v-if="animalForm.acquisition_type === 'born'" class="p-3 bg-surface-100 rounded-lg">
                    <label class="font-semibold text-sm block mb-3">Parent Information</label>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-2">
                            <label for="parent_male" class="font-medium text-sm">Sire (Father)</label>
                            <Select
                                id="parent_male"
                                v-model="animalForm.parent_male_id"
                                :options="potentialSires"
                                optionLabel="tag_number"
                                optionValue="id"
                                placeholder="Select sire"
                                class="w-full"
                                showClear
                                filter
                                :disabled="!animalForm.animal_breed_id"
                            >
                                <template #option="{ option }">
                                    <span
                                        >{{ option.tag_number }} <span v-if="option.name" class="text-surface-500">- {{ option.name }}</span></span
                                    >
                                </template>
                            </Select>
                        </div>

                        <div class="flex flex-col gap-2">
                            <label for="parent_female" class="font-medium text-sm">Dam (Mother)</label>
                            <Select
                                id="parent_female"
                                v-model="animalForm.parent_female_id"
                                :options="potentialDams"
                                optionLabel="tag_number"
                                optionValue="id"
                                placeholder="Select dam"
                                class="w-full"
                                showClear
                                filter
                                :disabled="!animalForm.animal_breed_id"
                            >
                                <template #option="{ option }">
                                    <span
                                        >{{ option.tag_number }} <span v-if="option.name" class="text-surface-500">- {{ option.name }}</span></span
                                    >
                                </template>
                            </Select>
                        </div>
                    </div>
                    <small class="text-surface-500 mt-2 block">Select the breed first to see available parents of that breed.</small>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="weight" class="font-medium">Weight (kg)</label>
                        <InputNumber id="weight" v-model="animalForm.weight_kg" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-2" v-if="animalForm.acquisition_type !== 'born'">
                        <label for="purchase_price" class="font-medium">Purchase Price</label>
                        <InputNumber id="purchase_price" v-model="animalForm.purchase_price" :min="0" :minFractionDigits="2" :maxFractionDigits="2" mode="currency" :currency="currency" :locale="locale" class="w-full" />
                    </div>
                </div>

                <div v-if="editingAnimal" class="flex flex-col gap-2">
                    <label for="status" class="font-medium">Status</label>
                    <Select id="status" v-model="animalForm.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="notes" class="font-medium">Notes</label>
                    <Textarea id="notes" v-model="animalForm.notes" rows="3" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="closeAnimalDialog" :disabled="saving" />
                <Button :label="editingAnimal ? 'Update' : 'Create'" @click="saveAnimal" :loading="saving" />
            </template>
        </Dialog>

        <!-- Sale Dialog -->
        <Dialog v-model:visible="saleDialog" header="Record Sale" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg mb-2">
                    <p class="font-medium">{{ selectedAnimal?.tag_number }} - {{ selectedAnimal?.name || 'Unnamed' }}</p>
                    <p class="text-surface-500 text-sm">{{ selectedAnimal?.breed_name }}</p>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="sale_date" class="font-medium">Sale Date *</label>
                    <DatePicker id="sale_date" v-model="saleForm.sale_date" dateFormat="yy-mm-dd" class="w-full" :class="{ 'p-invalid': saleSubmitted && !saleForm.sale_date }" />
                    <small v-if="saleSubmitted && !saleForm.sale_date" class="text-red-500"> Sale date is required </small>
                    <small v-else-if="saleHold" class="text-orange-600 dark:text-orange-400"> Meat withdrawal ({{ holdProducts(saleHold) }}): safe to sell for slaughter from {{ formatApiDate(saleHold.safe_from) }}. </small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="sale_price" class="font-medium">Sale Price *</label>
                    <InputNumber
                        id="sale_price"
                        v-model="saleForm.sale_price"
                        :min="0"
                        :minFractionDigits="2"
                        :maxFractionDigits="2"
                        mode="currency"
                        :currency="currency"
                        :locale="locale"
                        class="w-full"
                        :class="{ 'p-invalid': saleSubmitted && !saleForm.sale_price }"
                    />
                    <small v-if="saleSubmitted && !saleForm.sale_price" class="text-red-500"> Sale price is required </small>
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
        <Dialog v-model:visible="deathDialog" header="Record Death" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg mb-2">
                    <p class="font-medium">{{ selectedAnimal?.tag_number }} - {{ selectedAnimal?.name || 'Unnamed' }}</p>
                    <p class="text-surface-500 text-sm">{{ selectedAnimal?.breed_name }}</p>
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
                <Button label="Record Death" severity="danger" @click="recordDeath" :loading="saving" />
            </template>
        </Dialog>

        <!-- Delete Confirmation -->
        <WithdrawalDialog :guard="withdrawalGuard" />

        <ConfirmDialog />
    </div>
</template>
