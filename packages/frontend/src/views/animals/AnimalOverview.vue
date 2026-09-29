<script setup>
import { ref, computed, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';

const confirm = useConfirm();
const toast = useToast();

// State
const loading = ref(true);
const saving = ref(false);
const submitted = ref(false);
const animalTypes = ref([]);
const breeds = ref([]);
const housing = ref([]);
const statistics = ref({});

// Dialogs
const typeDialog = ref(false);
const breedDialog = ref(false);
const housingDialog = ref(false);
const editingType = ref(null);
const editingBreed = ref(null);
const editingHousing = ref(null);

// Forms
const typeForm = ref({ name: '', category: '', tracking_mode: 'both', reproduction_type: 'mammal', exclude_from_reproduction: false, description: '' });
const breedForm = ref({ animal_type_id: null, name: '', average_lifespan_years: null, average_weight_kg: null, description: '' });
const housingForm = ref({ name: '', housing_type: '', capacity: null, area_sqm: null, location: '', description: '', is_active: true });
const inlineBreeds = ref([]);
const newInlineBreed = ref({ name: '', average_lifespan_years: null, average_weight_kg: null, description: '' });

// Options
const categoryOptions = ['poultry', 'cattle', 'swine', 'sheep', 'goat', 'equine', 'fish', 'other'];
const trackingModeOptions = [
    { label: 'Individual (e.g., Cattle)', value: 'individual' },
    { label: 'Flock/Group (e.g., Chickens)', value: 'flock' },
    { label: 'Both', value: 'both' }
];
const reproductionTypeOptions = [
    { label: 'Mammal (Live Birth/Breeding)', value: 'mammal' },
    { label: 'Bird (Egg Laying/Incubation)', value: 'bird' },
    { label: 'Other', value: 'other' }
];
const housingTypeOptions = [
    { label: 'Barn', value: 'barn' },
    { label: 'Coop', value: 'coop' },
    { label: 'Pen', value: 'pen' },
    { label: 'Paddock', value: 'paddock' },
    { label: 'Stable', value: 'stable' },
    { label: 'Pond', value: 'pond' },
    { label: 'Cage', value: 'cage' },
    { label: 'Free Range', value: 'free_range' },
    { label: 'Other', value: 'other' }
];

// Computed
const activeHousing = computed(() => housing.value.filter((h) => h.is_active).length);
const totalAnimalCount = computed(() => {
    return (statistics.value.total_individual_animals || 0) + (statistics.value.total_group_animals || 0);
});

// Load data
const loadData = async () => {
    loading.value = true;
    try {
        const [typesRes, breedsRes, housingRes, statsRes] = await Promise.all([animalService.getAnimalTypes(), animalService.getBreeds(), animalService.getHousing(), animalService.getAnimalStatistics()]);
        animalTypes.value = typesRes.data.data || typesRes.data || [];
        breeds.value = breedsRes.data.data || breedsRes.data || [];
        housing.value = housingRes.data.data || housingRes.data || [];
        statistics.value = statsRes.data.data || statsRes.data || {};
    } catch (error) {
        console.error('Error loading data:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load data', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// Animal Type CRUD
const openTypeDialog = () => {
    editingType.value = null;
    typeForm.value = { name: '', category: '', tracking_mode: 'both', reproduction_type: 'mammal', exclude_from_reproduction: false, description: '' };
    inlineBreeds.value = [];
    newInlineBreed.value = { name: '', average_lifespan_years: null, average_weight_kg: null, description: '' };
    submitted.value = false;
    typeDialog.value = true;
};

const editType = (type) => {
    editingType.value = type;
    typeForm.value = { ...type };
    submitted.value = false;
    typeDialog.value = true;
};

const saveType = async () => {
    submitted.value = true;
    if (!typeForm.value.name || !typeForm.value.category || !typeForm.value.tracking_mode) return;

    saving.value = true;
    try {
        let animalTypeId;

        if (editingType.value) {
            await animalService.updateAnimalType(editingType.value.id, typeForm.value);
            animalTypeId = editingType.value.id;
            toast.add({ severity: 'success', summary: 'Success', detail: 'Animal type updated', life: 3000 });
        } else {
            const response = await animalService.createAnimalType(typeForm.value);
            animalTypeId = response.data.data.id;
            toast.add({ severity: 'success', summary: 'Success', detail: 'Animal type created', life: 3000 });
        }

        // Create inline breeds if any
        if (inlineBreeds.value.length > 0 && animalTypeId) {
            for (const breed of inlineBreeds.value) {
                try {
                    await animalService.createBreed({
                        ...breed,
                        animal_type_id: animalTypeId
                    });
                } catch (breedError) {
                    console.error('Failed to create breed:', breedError);
                    toast.add({
                        severity: 'warn',
                        summary: 'Warning',
                        detail: `Failed to create breed "${breed.name}"`,
                        life: 3000
                    });
                }
            }
        }

        typeDialog.value = false;
        loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const addInlineBreed = () => {
    if (!newInlineBreed.value.name) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Breed name is required', life: 3000 });
        return;
    }

    inlineBreeds.value.push({ ...newInlineBreed.value });
    newInlineBreed.value = { name: '', average_lifespan_years: null, average_weight_kg: null, description: '' };
};

const removeInlineBreed = (index) => {
    inlineBreeds.value.splice(index, 1);
};

const confirmDeleteType = (type) => {
    confirm.require({
        message: `Delete animal type "${type.name}"? This may affect related breeds.`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await animalService.deleteAnimalType(type.id);
                toast.add({ severity: 'success', summary: 'Success', detail: 'Animal type deleted', life: 3000 });
                loadData();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to delete', life: 3000 });
            }
        }
    });
};

// Breed CRUD
const openBreedDialog = () => {
    editingBreed.value = null;
    breedForm.value = { animal_type_id: null, name: '', average_lifespan_years: null, average_weight_kg: null, description: '' };
    submitted.value = false;
    breedDialog.value = true;
};

const editBreed = (breed) => {
    editingBreed.value = breed;
    breedForm.value = { ...breed };
    submitted.value = false;
    breedDialog.value = true;
};

const saveBreed = async () => {
    submitted.value = true;
    if (!breedForm.value.name || !breedForm.value.animal_type_id) return;

    saving.value = true;
    try {
        if (editingBreed.value) {
            await animalService.updateBreed(editingBreed.value.id, breedForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Breed updated', life: 3000 });
        } else {
            await animalService.createBreed(breedForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Breed created', life: 3000 });
        }
        breedDialog.value = false;
        loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const confirmDeleteBreed = (breed) => {
    confirm.require({
        message: `Delete breed "${breed.name}"?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await animalService.deleteBreed(breed.id);
                toast.add({ severity: 'success', summary: 'Success', detail: 'Breed deleted', life: 3000 });
                loadData();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to delete', life: 3000 });
            }
        }
    });
};

// Housing CRUD
const openHousingDialog = () => {
    editingHousing.value = null;
    housingForm.value = { name: '', housing_type: '', capacity: null, area_sqm: null, location: '', description: '', is_active: true };
    submitted.value = false;
    housingDialog.value = true;
};

const editHousing = (h) => {
    editingHousing.value = h;
    housingForm.value = { ...h };
    submitted.value = false;
    housingDialog.value = true;
};

const saveHousing = async () => {
    submitted.value = true;
    if (!housingForm.value.name || !housingForm.value.housing_type) return;

    saving.value = true;
    try {
        if (editingHousing.value) {
            await animalService.updateHousing(editingHousing.value.id, housingForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Housing updated', life: 3000 });
        } else {
            await animalService.createHousing(housingForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Housing created', life: 3000 });
        }
        housingDialog.value = false;
        loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const confirmDeleteHousing = (h) => {
    confirm.require({
        message: `Delete housing "${h.name}"?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await animalService.deleteHousing(h.id);
                toast.add({ severity: 'success', summary: 'Success', detail: 'Housing deleted', life: 3000 });
                loadData();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to delete', life: 3000 });
            }
        }
    });
};

// Utilities
const formatTrackingMode = (mode) => {
    const modes = { individual: 'Individual', flock: 'Flock', both: 'Both' };
    return modes[mode] || mode;
};

const getTrackingModeSeverity = (mode) => {
    switch (mode) {
        case 'individual':
            return 'info';
        case 'flock':
            return 'warn';
        case 'both':
            return 'success';
        default:
            return 'secondary';
    }
};

const formatHousingType = (type) => {
    return type ? type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') : '';
};

const getHousingTypeSeverity = (type) => {
    switch (type) {
        case 'barn':
            return 'info';
        case 'coop':
            return 'warn';
        case 'paddock':
            return 'success';
        case 'stable':
            return 'contrast';
        default:
            return 'secondary';
    }
};

const getOccupancyClass = (data) => {
    if (!data.capacity) return '';
    const percent = ((data.current_occupancy || 0) / data.capacity) * 100;
    if (percent > 90) return 'occupancy-high';
    if (percent > 70) return 'occupancy-medium';
    return '';
};

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="grid grid-cols-12 gap-6">
        <!-- Page Header -->
        <div class="col-span-12">
            <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">Animal Management</h1>
            <p class="text-surface-600 dark:text-surface-400">Overview of all animal operations, types, breeds, and housing</p>
        </div>

        <!-- Stats Cards -->
        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Animal Types</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : animalTypes.length }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-green-100 dark:bg-green-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-th-large text-green-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">Registered animal types</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Breeds</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : breeds.length }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-list text-blue-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-muted-color">Available breeds</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Housing</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : housing.length }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-home text-orange-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-primary font-medium">{{ activeHousing }}</span>
                <span class="text-muted-color"> active</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Total Animals</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : totalAnimalCount }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-purple-100 dark:bg-purple-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-heart text-purple-500 text-xl!"></i>
                    </div>
                </div>
                <router-link to="/animals/list" class="text-primary hover:underline text-sm"> View all animals <i class="pi pi-arrow-right text-xs"></i> </router-link>
            </div>
        </div>

        <!-- Animal Types Section -->
        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Animal Types</h5>
                    <Button label="Add Type" icon="pi pi-plus" size="small" @click="openTypeDialog" />
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!animalTypes.length" class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">No animal types defined yet</p>
                    <Button label="Add First Animal Type" icon="pi pi-plus" @click="openTypeDialog" class="mt-2" />
                </div>

                <DataTable v-else :value="animalTypes" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column field="name" header="Name" sortable />
                    <Column field="category" header="Category" sortable>
                        <template #body="{ data }">
                            <Tag :value="data.category" severity="info" />
                        </template>
                    </Column>
                    <Column field="tracking_mode" header="Tracking" sortable>
                        <template #body="{ data }">
                            <Tag :value="formatTrackingMode(data.tracking_mode)" :severity="getTrackingModeSeverity(data.tracking_mode)" />
                        </template>
                    </Column>
                    <Column field="reproduction_type" header="Reproduction" sortable>
                        <template #body="{ data }">
                            <Tag :value="data.reproduction_type || 'mammal'" :severity="data.reproduction_type === 'bird' ? 'warning' : 'success'" :icon="data.reproduction_type === 'bird' ? 'pi pi-sun' : 'pi pi-heart'" />
                        </template>
                    </Column>
                    <Column header="Actions" style="width: 100px">
                        <template #body="{ data }">
                            <div class="flex gap-1">
                                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="editType(data)" />
                                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDeleteType(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Breeds Section -->
        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Breeds</h5>
                    <Button label="Add Breed" icon="pi pi-plus" size="small" @click="openBreedDialog" :disabled="!animalTypes.length" />
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!breeds.length" class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">No breeds defined yet</p>
                    <p class="text-surface-400 text-sm" v-if="animalTypes.length">Add breeds for your animal types</p>
                    <p class="text-surface-400 text-sm" v-else>Add animal types first</p>
                </div>

                <DataTable v-else :value="breeds" responsiveLayout="scroll" class="p-datatable-sm" :paginator="breeds.length > 5" :rows="5">
                    <Column field="name" header="Breed" sortable />
                    <Column field="animal_type_name" header="Animal Type" sortable />
                    <Column field="average_lifespan_years" header="Lifespan (yrs)">
                        <template #body="{ data }">
                            {{ data.average_lifespan_years || '-' }}
                        </template>
                    </Column>
                    <Column header="Actions" style="width: 100px">
                        <template #body="{ data }">
                            <div class="flex gap-1">
                                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="editBreed(data)" />
                                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDeleteBreed(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Housing Section -->
        <div class="col-span-12">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Animal Housing</h5>
                    <Button label="Add Housing" icon="pi pi-plus" size="small" @click="openHousingDialog" />
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!housing.length" class="text-center py-8">
                    <i class="pi pi-home text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">No housing defined yet</p>
                    <Button label="Add First Housing" icon="pi pi-plus" @click="openHousingDialog" class="mt-2" />
                </div>

                <DataTable v-else :value="housing" responsiveLayout="scroll" class="p-datatable-sm" :paginator="housing.length > 10" :rows="10">
                    <Column field="name" header="Name" sortable />
                    <Column field="housing_type" header="Type" sortable>
                        <template #body="{ data }">
                            <Tag :value="formatHousingType(data.housing_type)" :severity="getHousingTypeSeverity(data.housing_type)" />
                        </template>
                    </Column>
                    <Column field="capacity" header="Capacity">
                        <template #body="{ data }">
                            {{ data.capacity || '-' }}
                        </template>
                    </Column>
                    <Column field="current_occupancy" header="Occupancy">
                        <template #body="{ data }">
                            <span v-if="data.capacity">
                                {{ data.current_occupancy || 0 }} / {{ data.capacity }}
                                <ProgressBar :value="((data.current_occupancy || 0) / data.capacity) * 100" :showValue="false" style="height: 6px; margin-top: 4px" :class="getOccupancyClass(data)" />
                            </span>
                            <span v-else>{{ data.current_occupancy || 0 }}</span>
                        </template>
                    </Column>
                    <Column field="is_active" header="Status" sortable>
                        <template #body="{ data }">
                            <Tag :value="data.is_active ? 'Active' : 'Inactive'" :severity="data.is_active ? 'success' : 'secondary'" />
                        </template>
                    </Column>
                    <Column header="Actions" style="width: 100px">
                        <template #body="{ data }">
                            <div class="flex gap-1">
                                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="editHousing(data)" />
                                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="confirmDeleteHousing(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Animal Type Dialog -->
        <Dialog v-model:visible="typeDialog" :header="editingType ? 'Edit Animal Type' : 'Add Animal Type'" :modal="true" :style="{ width: '700px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="type_name" class="font-medium">Name *</label>
                    <InputText id="type_name" v-model="typeForm.name" class="w-full" :class="{ 'p-invalid': submitted && !typeForm.name }" />
                    <small v-if="submitted && !typeForm.name" class="text-red-500">Name is required</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="type_category" class="font-medium">Category *</label>
                    <Select id="type_category" v-model="typeForm.category" :options="categoryOptions" placeholder="Select category" class="w-full" :class="{ 'p-invalid': submitted && !typeForm.category }" />
                    <small v-if="submitted && !typeForm.category" class="text-red-500">Category is required</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="type_tracking" class="font-medium">Tracking Mode *</label>
                    <Select
                        id="type_tracking"
                        v-model="typeForm.tracking_mode"
                        :options="trackingModeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select tracking mode"
                        class="w-full"
                        :class="{ 'p-invalid': submitted && !typeForm.tracking_mode }"
                    />
                    <small class="text-surface-500">Individual: Track each animal separately (cattle). Flock: Track by numbers (chickens). Both: Supports either method.</small>
                    <small v-if="submitted && !typeForm.tracking_mode" class="text-red-500">Tracking mode is required</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="type_reproduction" class="font-medium">Reproduction Type *</label>
                    <Select
                        id="type_reproduction"
                        v-model="typeForm.reproduction_type"
                        :options="reproductionTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select reproduction type"
                        class="w-full"
                        :disabled="typeForm.exclude_from_reproduction"
                    />
                    <small class="text-surface-500">Determines whether this animal type uses breeding (mammals) or incubation (birds).</small>
                </div>
                <div class="flex items-center gap-2 mt-2">
                    <Checkbox id="type_exclude_reproduction" v-model="typeForm.exclude_from_reproduction" :binary="true" />
                    <label for="type_exclude_reproduction" class="font-medium">Exclude from Reproduction Tracking</label>
                </div>
                <small class="text-surface-500 -mt-2">Check this for animals like bees that don't require breeding or incubation tracking.</small>
                <div class="flex flex-col gap-2">
                    <label for="type_description" class="font-medium">Description</label>
                    <Textarea id="type_description" v-model="typeForm.description" rows="3" class="w-full" />
                </div>

                <!-- Inline Breeds Section -->
                <div v-if="!editingType" class="flex flex-col gap-2 mt-4 border-t pt-4">
                    <label class="font-semibold text-lg">Breeds (Optional)</label>
                    <small class="text-surface-500 -mt-2">Add breeds for this animal type. You can also add breeds later.</small>

                    <!-- Breed Input Form -->
                    <div class="flex gap-2 items-end">
                        <div class="flex-1">
                            <label for="inline_breed_name" class="text-sm font-medium">Breed Name</label>
                            <InputText id="inline_breed_name" v-model="newInlineBreed.name" placeholder="e.g., Holstein" class="w-full mt-1" />
                        </div>
                        <div class="w-32">
                            <label for="inline_breed_lifespan" class="text-sm font-medium">Lifespan (yrs)</label>
                            <InputNumber id="inline_breed_lifespan" v-model="newInlineBreed.average_lifespan_years" :min="0" :max="100" class="w-full mt-1" />
                        </div>
                        <div class="w-32">
                            <label for="inline_breed_weight" class="text-sm font-medium">Weight (kg)</label>
                            <InputNumber id="inline_breed_weight" v-model="newInlineBreed.average_weight_kg" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full mt-1" />
                        </div>
                        <Button icon="pi pi-plus" label="Add" @click="addInlineBreed" size="small" />
                    </div>

                    <!-- Added Breeds List -->
                    <div v-if="inlineBreeds.length > 0" class="mt-2">
                        <DataTable :value="inlineBreeds" size="small" class="text-sm">
                            <Column field="name" header="Breed Name" />
                            <Column field="average_lifespan_years" header="Lifespan (yrs)">
                                <template #body="{ data }">
                                    {{ data.average_lifespan_years || '-' }}
                                </template>
                            </Column>
                            <Column field="average_weight_kg" header="Weight (kg)">
                                <template #body="{ data }">
                                    {{ data.average_weight_kg || '-' }}
                                </template>
                            </Column>
                            <Column header="Actions" style="width: 80px">
                                <template #body="{ index }">
                                    <Button icon="pi pi-trash" severity="danger" text size="small" @click="removeInlineBreed(index)" />
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="typeDialog = false" :disabled="saving" />
                <Button :label="editingType ? 'Update' : 'Create'" @click="saveType" :loading="saving" />
            </template>
        </Dialog>

        <!-- Breed Dialog -->
        <Dialog v-model:visible="breedDialog" :header="editingBreed ? 'Edit Breed' : 'Add Breed'" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="breed_type" class="font-medium">Animal Type *</label>
                    <Select
                        id="breed_type"
                        v-model="breedForm.animal_type_id"
                        :options="animalTypes"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Select animal type"
                        class="w-full"
                        :class="{ 'p-invalid': submitted && !breedForm.animal_type_id }"
                    />
                    <small v-if="submitted && !breedForm.animal_type_id" class="text-red-500">Animal type is required</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="breed_name" class="font-medium">Breed Name *</label>
                    <InputText id="breed_name" v-model="breedForm.name" class="w-full" :class="{ 'p-invalid': submitted && !breedForm.name }" />
                    <small v-if="submitted && !breedForm.name" class="text-red-500">Name is required</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="breed_lifespan" class="font-medium">Average Lifespan (years)</label>
                    <InputNumber id="breed_lifespan" v-model="breedForm.average_lifespan_years" :min="0" :max="100" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="breed_weight" class="font-medium">Average Weight (kg)</label>
                    <InputNumber id="breed_weight" v-model="breedForm.average_weight_kg" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="breed_description" class="font-medium">Description</label>
                    <Textarea id="breed_description" v-model="breedForm.description" rows="3" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="breedDialog = false" :disabled="saving" />
                <Button :label="editingBreed ? 'Update' : 'Create'" @click="saveBreed" :loading="saving" />
            </template>
        </Dialog>

        <!-- Housing Dialog -->
        <Dialog v-model:visible="housingDialog" :header="editingHousing ? 'Edit Housing' : 'Add Housing'" :modal="true" :style="{ width: '500px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="h_name" class="font-medium">Name *</label>
                    <InputText id="h_name" v-model="housingForm.name" class="w-full" :class="{ 'p-invalid': submitted && !housingForm.name }" />
                    <small v-if="submitted && !housingForm.name" class="text-red-500">Name is required</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="h_type" class="font-medium">Housing Type *</label>
                    <Select
                        id="h_type"
                        v-model="housingForm.housing_type"
                        :options="housingTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select type"
                        class="w-full"
                        :class="{ 'p-invalid': submitted && !housingForm.housing_type }"
                    />
                    <small v-if="submitted && !housingForm.housing_type" class="text-red-500">Type is required</small>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="h_capacity" class="font-medium">Capacity</label>
                        <InputNumber id="h_capacity" v-model="housingForm.capacity" :min="1" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="h_area" class="font-medium">Area (sq m)</label>
                        <InputNumber id="h_area" v-model="housingForm.area_sqm" :min="0" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="h_location" class="font-medium">Location</label>
                    <InputText id="h_location" v-model="housingForm.location" class="w-full" placeholder="e.g., North Paddock, Barn A" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="h_description" class="font-medium">Description</label>
                    <Textarea id="h_description" v-model="housingForm.description" rows="2" class="w-full" />
                </div>
                <div class="flex items-center gap-2">
                    <Checkbox id="h_active" v-model="housingForm.is_active" :binary="true" />
                    <label for="h_active">Active</label>
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="housingDialog = false" :disabled="saving" />
                <Button :label="editingHousing ? 'Update' : 'Create'" @click="saveHousing" :loading="saving" />
            </template>
        </Dialog>

        <!-- Confirm Dialog -->
        <ConfirmDialog />
    </div>
</template>

<style scoped>
:deep(.occupancy-high .p-progressbar-value) {
    background: var(--red-500);
}
:deep(.occupancy-medium .p-progressbar-value) {
    background: var(--yellow-500);
}
</style>
