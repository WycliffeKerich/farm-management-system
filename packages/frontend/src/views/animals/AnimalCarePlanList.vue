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
const plans = ref([]);
const animalTypes = ref([]);
const breeds = ref([]);
const planDialog = ref(false);
const editingPlan = ref(null);
const submitted = ref(false);

// Filters
const filters = ref({
    search: '',
    status: null,
    plan_type: null,
    animal_type_id: null
});

// Form
const planForm = ref({
    plan_code: '',
    name: '',
    plan_type: null,
    applies_to: 'both',
    animal_type_id: null,
    animal_breed_id: null,
    total_duration_days: null,
    description: '',
    status: 'active'
});

// Options
const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' }
];

const planTypeOptions = [
    { label: 'Vaccination', value: 'vaccination' },
    { label: 'Feeding', value: 'feeding' },
    { label: 'Health Checkup', value: 'health_checkup' },
    { label: 'Breeding', value: 'breeding' },
    { label: 'Growth Monitoring', value: 'growth_monitoring' },
    { label: 'General', value: 'general' },
    { label: 'Custom', value: 'custom' }
];

const appliesToOptions = [
    { label: 'Individual Animals', value: 'individual' },
    { label: 'Flocks/Groups', value: 'flock' },
    { label: 'Both', value: 'both' }
];

// Computed
const filteredBreeds = computed(() => {
    if (!planForm.value.animal_type_id) return [];
    return breeds.value.filter((b) => b.animal_type_id === planForm.value.animal_type_id);
});

// Methods
const loadPlans = async () => {
    loading.value = true;
    try {
        const params = { ...filters.value };
        Object.keys(params).forEach((key) => {
            if (params[key] === null || params[key] === '') {
                delete params[key];
            }
        });

        const response = await animalService.getCarePlans(params);
        plans.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load care plans:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to load care plans',
            life: 3000
        });
    } finally {
        loading.value = false;
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

const onTypeChange = () => {
    planForm.value.animal_breed_id = null;
};

const openNewPlanDialog = () => {
    editingPlan.value = null;
    planForm.value = {
        plan_code: '',
        name: '',
        plan_type: null,
        applies_to: 'both',
        animal_type_id: null,
        animal_breed_id: null,
        total_duration_days: null,
        description: '',
        status: 'active'
    };
    submitted.value = false;
    planDialog.value = true;
};

const editPlan = (plan) => {
    editingPlan.value = plan;
    planForm.value = {
        plan_code: plan.plan_code,
        name: plan.name,
        plan_type: plan.plan_type,
        applies_to: plan.applies_to,
        animal_type_id: plan.animal_type_id,
        animal_breed_id: plan.animal_breed_id,
        total_duration_days: plan.total_duration_days,
        description: plan.description || '',
        status: plan.status
    };
    submitted.value = false;
    planDialog.value = true;
};

const closePlanDialog = () => {
    planDialog.value = false;
    editingPlan.value = null;
};

const savePlan = async () => {
    submitted.value = true;

    if (!planForm.value.name || !planForm.value.plan_type) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            plan_code: planForm.value.plan_code || undefined,
            name: planForm.value.name,
            plan_type: planForm.value.plan_type,
            applies_to: planForm.value.applies_to,
            animal_type_id: planForm.value.animal_type_id,
            animal_breed_id: planForm.value.animal_breed_id,
            total_duration_days: planForm.value.total_duration_days,
            description: planForm.value.description
        };

        if (editingPlan.value) {
            data.status = planForm.value.status;
            await animalService.updateCarePlan(editingPlan.value.id, data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Care plan updated successfully',
                life: 3000
            });
        } else {
            await animalService.createCarePlan(data);
            toast.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Care plan created successfully',
                life: 3000
            });
        }

        closePlanDialog();
        loadPlans();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to save care plan',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const viewPlan = (plan) => {
    router.push(`/animals/care-plans/${plan.id}`);
};

const clonePlan = async (plan) => {
    try {
        await animalService.cloneCarePlan(plan.id);
        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Care plan cloned successfully',
            life: 3000
        });
        loadPlans();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to clone care plan',
            life: 3000
        });
    }
};

const confirmDelete = (plan) => {
    confirm.require({
        message: `Are you sure you want to delete care plan "${plan.name}"?`,
        header: 'Confirm Delete',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => deletePlan(plan)
    });
};

const deletePlan = async (plan) => {
    try {
        await animalService.deleteCarePlan(plan.id);
        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Care plan deleted successfully',
            life: 3000
        });
        loadPlans();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to delete care plan',
            life: 3000
        });
    }
};

// Utility functions
const formatPlanType = (type) => {
    const types = {
        vaccination: 'Vaccination',
        feeding: 'Feeding',
        health_checkup: 'Health Checkup',
        breeding: 'Breeding',
        growth_monitoring: 'Growth Monitoring',
        general: 'General',
        custom: 'Custom'
    };
    return types[type] || type;
};

const getPlanTypeSeverity = (type) => {
    switch (type) {
        case 'vaccination':
            return 'info';
        case 'feeding':
            return 'success';
        case 'health_checkup':
            return 'warn';
        case 'breeding':
            return 'contrast';
        default:
            return 'secondary';
    }
};

const formatAppliesTo = (value) => {
    const map = {
        individual: 'Individual',
        flock: 'Flock/Group',
        both: 'Both'
    };
    return map[value] || value;
};

const formatStatus = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
};

const getStatusSeverity = (status) => {
    switch (status) {
        case 'active':
            return 'success';
        case 'draft':
            return 'warn';
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
        loadPlans();
    }, 300);
};

// Lifecycle
onMounted(() => {
    loadPlans();
    loadAnimalTypes();
    loadBreeds();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Animal Care Plans</h2>
                <p class="text-surface-600 dark:text-surface-400">Manage care plan templates for vaccinations, feeding, and health checkups</p>
            </div>
            <div class="flex gap-2 mt-4 md:mt-0">
                <router-link to="/animals/care-schedules">
                    <Button label="View Schedules" icon="pi pi-calendar" severity="secondary" outlined />
                </router-link>
                <Button label="New Care Plan" icon="pi pi-plus" @click="openNewPlanDialog" />
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="flex-1">
                <InputText v-model="filters.search" placeholder="Search care plans..." class="w-full" @input="debouncedSearch" />
            </div>
            <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="All Statuses" class="w-full md:w-48" showClear @change="loadPlans" />
            <Select v-model="filters.plan_type" :options="planTypeOptions" optionLabel="label" optionValue="value" placeholder="All Types" class="w-full md:w-48" showClear @change="loadPlans" />
            <Select v-model="filters.animal_type_id" :options="animalTypes" optionLabel="name" optionValue="id" placeholder="All Animal Types" class="w-full md:w-48" showClear @change="loadPlans" />
        </div>

        <!-- Data Table -->
        <DataTable :value="plans" :loading="loading" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No care plans found</p>
                </div>
            </template>

            <Column field="plan_code" header="Code" sortable>
                <template #body="{ data }">
                    <router-link :to="`/animals/care-plans/${data.id}`" class="text-primary font-medium hover:underline">
                        {{ data.plan_code }}
                    </router-link>
                </template>
            </Column>

            <Column field="name" header="Name" sortable />

            <Column field="plan_type" header="Type" sortable>
                <template #body="{ data }">
                    <Tag :value="formatPlanType(data.plan_type)" :severity="getPlanTypeSeverity(data.plan_type)" />
                </template>
            </Column>

            <Column field="animal_type_name" header="Animal Type" sortable>
                <template #body="{ data }">
                    {{ data.animal_type_name || 'Any' }}
                </template>
            </Column>

            <Column field="applies_to" header="Applies To" sortable>
                <template #body="{ data }">
                    <Tag :value="formatAppliesTo(data.applies_to)" severity="secondary" />
                </template>
            </Column>

            <Column field="task_count" header="Tasks" sortable>
                <template #body="{ data }">
                    {{ data.task_count || 0 }}
                </template>
            </Column>

            <Column field="total_duration_days" header="Duration" sortable>
                <template #body="{ data }">
                    {{ data.total_duration_days ? `${data.total_duration_days} days` : '-' }}
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
                        <Button icon="pi pi-eye" severity="info" text rounded @click="viewPlan(data)" v-tooltip.top="'View'" />
                        <Button icon="pi pi-pencil" severity="secondary" text rounded @click="editPlan(data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-copy" severity="warn" text rounded @click="clonePlan(data)" v-tooltip.top="'Clone'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- New/Edit Care Plan Dialog -->
        <Dialog v-model:visible="planDialog" :header="editingPlan ? 'Edit Care Plan' : 'New Care Plan'" :modal="true" :style="{ width: '600px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="plan_code" class="font-medium">Plan Code</label>
                        <InputText id="plan_code" v-model="planForm.plan_code" class="w-full" placeholder="Auto-generated if empty" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="name" class="font-medium">Name *</label>
                        <InputText id="name" v-model="planForm.name" class="w-full" :class="{ 'p-invalid': submitted && !planForm.name }" />
                        <small v-if="submitted && !planForm.name" class="text-red-500"> Name is required </small>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="plan_type" class="font-medium">Plan Type *</label>
                        <Select id="plan_type" v-model="planForm.plan_type" :options="planTypeOptions" optionLabel="label" optionValue="value" placeholder="Select type" class="w-full" :class="{ 'p-invalid': submitted && !planForm.plan_type }" />
                        <small v-if="submitted && !planForm.plan_type" class="text-red-500"> Plan type is required </small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="applies_to" class="font-medium">Applies To</label>
                        <Select id="applies_to" v-model="planForm.applies_to" :options="appliesToOptions" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="animal_type" class="font-medium">Animal Type</label>
                        <Select id="animal_type" v-model="planForm.animal_type_id" :options="animalTypes" optionLabel="name" optionValue="id" placeholder="Any (Generic)" class="w-full" showClear @change="onTypeChange" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="breed" class="font-medium">Breed</label>
                        <Select id="breed" v-model="planForm.animal_breed_id" :options="filteredBreeds" optionLabel="name" optionValue="id" placeholder="Any Breed" class="w-full" showClear :disabled="!planForm.animal_type_id" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="duration" class="font-medium">Total Duration (days)</label>
                    <InputNumber id="duration" v-model="planForm.total_duration_days" :min="1" class="w-full" />
                    <small class="text-surface-500">Total duration of the care plan cycle</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="description" class="font-medium">Description</label>
                    <Textarea id="description" v-model="planForm.description" rows="3" class="w-full" />
                </div>

                <div v-if="editingPlan" class="flex flex-col gap-2">
                    <label for="status" class="font-medium">Status</label>
                    <Select id="status" v-model="planForm.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="closePlanDialog" :disabled="saving" />
                <Button :label="editingPlan ? 'Update' : 'Create'" @click="savePlan" :loading="saving" />
            </template>
        </Dialog>

        <!-- Delete Confirmation -->
        <ConfirmDialog />
    </div>
</template>
