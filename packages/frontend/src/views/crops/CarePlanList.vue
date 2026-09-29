<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import cropService from '@/services/crop.service';

const toast = useToast();

// State
const loading = ref(false);
const saving = ref(false);
const plans = ref([]);
const varieties = ref([]);
const searchQuery = ref('');
const filters = ref({
    status: null,
    variety_id: null
});

const stats = ref({
    total: 0,
    active: 0,
    activeSchedules: 0
});

const alerts = ref({
    overdue_count: 0,
    upcoming_count: 0
});

// Dialog state
const planDialog = ref(false);
const cloneDialog = ref(false);
const deleteDialog = ref(false);
const editingPlan = ref(null);
const deletingPlan = ref(null);
const cloningPlan = ref(null);
const cloneName = ref('');
const submitted = ref(false);
const cloneSubmitted = ref(false);

const planForm = ref({
    name: '',
    crop_variety_id: null,
    description: '',
    is_template: true,
    total_duration_days: null,
    status: 'active'
});

const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' }
];

// Computed
const filteredPlans = computed(() => {
    let result = plans.value;

    if (filters.value.status) {
        result = result.filter((p) => p.status === filters.value.status);
    }

    if (filters.value.variety_id) {
        result = result.filter((p) => p.crop_variety_id === filters.value.variety_id);
    }

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter((p) => p.name.toLowerCase().includes(query) || p.plan_code.toLowerCase().includes(query) || (p.variety_name && p.variety_name.toLowerCase().includes(query)));
    }

    return result;
});

// Methods
const loadData = async () => {
    loading.value = true;
    try {
        const [plansRes, varietiesRes, schedulesRes, alertsRes] = await Promise.all([cropService.getCarePlans(), cropService.getVarieties(), cropService.getAllBatchSchedules({ status: 'active' }), cropService.getCareAlertsSummary()]);

        plans.value = plansRes.data.data || [];
        varieties.value = varietiesRes.data.data || [];

        const schedules = schedulesRes.data.data || [];
        alerts.value = alertsRes.data.data || { overdue_count: 0, upcoming_count: 0 };

        // Calculate stats
        stats.value = {
            total: plans.value.length,
            active: plans.value.filter((p) => p.status === 'active').length,
            activeSchedules: schedules.length
        };
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load data', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const getStatusSeverity = (status) => {
    const severities = {
        draft: 'warn',
        active: 'success',
        archived: 'secondary'
    };
    return severities[status] || 'info';
};

const openCreateDialog = () => {
    editingPlan.value = null;
    planForm.value = {
        name: '',
        crop_variety_id: null,
        description: '',
        is_template: true,
        total_duration_days: null,
        status: 'active'
    };
    submitted.value = false;
    planDialog.value = true;
};

const openEditDialog = (plan) => {
    editingPlan.value = plan;
    planForm.value = {
        name: plan.name,
        crop_variety_id: plan.crop_variety_id,
        description: plan.description || '',
        is_template: plan.is_template,
        total_duration_days: plan.total_duration_days,
        status: plan.status
    };
    submitted.value = false;
    planDialog.value = true;
};

const openCloneDialog = (plan) => {
    cloningPlan.value = plan;
    cloneName.value = `${plan.name} (Copy)`;
    cloneSubmitted.value = false;
    cloneDialog.value = true;
};

const confirmDelete = (plan) => {
    deletingPlan.value = plan;
    deleteDialog.value = true;
};

const savePlan = async () => {
    submitted.value = true;

    if (!planForm.value.name) {
        return;
    }

    saving.value = true;
    try {
        if (editingPlan.value) {
            await cropService.updateCarePlan(editingPlan.value.id, planForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Care plan updated', life: 3000 });
        } else {
            await cropService.createCarePlan(planForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Care plan created', life: 3000 });
        }
        planDialog.value = false;
        await loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to save', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const clonePlan = async () => {
    cloneSubmitted.value = true;

    if (!cloneName.value) {
        return;
    }

    saving.value = true;
    try {
        await cropService.cloneCarePlan(cloningPlan.value.id, cloneName.value);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Care plan cloned', life: 3000 });
        cloneDialog.value = false;
        await loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to clone', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const deletePlan = async () => {
    saving.value = true;
    try {
        await cropService.deleteCarePlan(deletingPlan.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Care plan deleted', life: 3000 });
        deleteDialog.value = false;
        await loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to delete', life: 3000 });
    } finally {
        saving.value = false;
    }
};

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Care Plans</h2>
                <p class="text-surface-600 dark:text-surface-400">Create and manage care plan templates for your crops</p>
            </div>
            <Button label="New Plan" icon="pi pi-plus" @click="openCreateDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="flex-1">
                <InputText v-model="searchQuery" placeholder="Search plans..." class="w-full" />
            </div>
            <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="All Statuses" class="w-full md:w-48" showClear />
            <Select v-model="filters.variety_id" :options="varieties" optionLabel="name" optionValue="id" placeholder="All Varieties" class="w-full md:w-48" showClear filter />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Plans</p>
                        <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ stats.total }}</p>
                    </div>
                    <i class="pi pi-file text-3xl text-blue-400"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-600 dark:text-green-400 text-sm font-medium">Active Templates</p>
                        <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ stats.active }}</p>
                    </div>
                    <i class="pi pi-check-circle text-3xl text-green-400"></i>
                </div>
            </div>
            <div class="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-cyan-600 dark:text-cyan-400 text-sm font-medium">Active Schedules</p>
                        <p class="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{{ stats.activeSchedules }}</p>
                    </div>
                    <i class="pi pi-calendar text-3xl text-cyan-400"></i>
                </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-orange-600 dark:text-orange-400 text-sm font-medium">Overdue Tasks</p>
                        <p class="text-2xl font-bold" :class="alerts.overdue_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-900 dark:text-orange-100'">{{ alerts.overdue_count }}</p>
                    </div>
                    <i class="pi pi-exclamation-triangle text-3xl text-orange-400"></i>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <DataTable :value="filteredPlans" :loading="loading" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 25, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No care plans found</p>
                </div>
            </template>

            <Column field="plan_code" header="Code" sortable style="min-width: 8rem">
                <template #body="{ data }">
                    <router-link :to="`/crops/care-plans/${data.id}`" class="text-primary font-medium hover:underline">
                        {{ data.plan_code }}
                    </router-link>
                </template>
            </Column>

            <Column field="name" header="Name" sortable style="min-width: 12rem">
                <template #body="{ data }">
                    <div>
                        <div class="font-medium">{{ data.name }}</div>
                        <div class="text-surface-500 text-sm" v-if="data.variety_name">{{ data.crop_type_name }} - {{ data.variety_name }}</div>
                    </div>
                </template>
            </Column>

            <Column field="task_count" header="Tasks" sortable style="min-width: 6rem">
                <template #body="{ data }">
                    <Tag :value="`${data.task_count} tasks`" severity="info" />
                </template>
            </Column>

            <Column field="total_duration_days" header="Duration" sortable style="min-width: 8rem">
                <template #body="{ data }">
                    {{ data.total_duration_days ? `${data.total_duration_days} days` : '-' }}
                </template>
            </Column>

            <Column field="usage_count" header="Usage" sortable style="min-width: 6rem">
                <template #body="{ data }">
                    <span class="text-surface-500">{{ data.usage_count || 0 }} batches</span>
                </template>
            </Column>

            <Column field="status" header="Status" sortable style="min-width: 8rem">
                <template #body="{ data }">
                    <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
                </template>
            </Column>

            <Column header="Actions" style="width: 120px">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-eye" severity="info" text rounded @click="$router.push(`/crops/care-plans/${data.id}`)" v-tooltip.top="'View'" />
                        <Button icon="pi pi-pencil" severity="secondary" text rounded @click="openEditDialog(data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-copy" severity="secondary" text rounded @click="openCloneDialog(data)" v-tooltip.top="'Clone'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Create/Edit Dialog -->
        <Dialog v-model:visible="planDialog" :header="editingPlan ? 'Edit Care Plan' : 'New Care Plan'" :modal="true" :style="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="name" class="font-medium">Plan Name *</label>
                    <InputText id="name" v-model="planForm.name" :class="{ 'p-invalid': submitted && !planForm.name }" />
                    <small class="text-red-500" v-if="submitted && !planForm.name">Name is required.</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="variety" class="font-medium">Crop Variety</label>
                    <Select id="variety" v-model="planForm.crop_variety_id" :options="varieties" optionLabel="name" optionValue="id" placeholder="Select variety (optional)" filter showClear class="w-full" />
                    <small class="text-surface-500">Associate with a specific variety or leave blank for general use</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="duration" class="font-medium">Total Duration (days)</label>
                    <InputNumber id="duration" v-model="planForm.total_duration_days" :min="1" placeholder="Auto-calculate from tasks" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="status" class="font-medium">Status</label>
                    <Select id="status" v-model="planForm.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="description" class="font-medium">Description</label>
                    <Textarea id="description" v-model="planForm.description" rows="3" class="w-full" />
                </div>

                <div class="flex items-center gap-2">
                    <Checkbox id="is_template" v-model="planForm.is_template" :binary="true" />
                    <label for="is_template">Save as reusable template</label>
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="planDialog = false" />
                <Button label="Save" icon="pi pi-check" @click="savePlan" :loading="saving" />
            </template>
        </Dialog>

        <!-- Clone Dialog -->
        <Dialog v-model:visible="cloneDialog" header="Clone Care Plan" :modal="true" :style="{ width: '400px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="clone_name" class="font-medium">New Plan Name *</label>
                    <InputText id="clone_name" v-model="cloneName" :class="{ 'p-invalid': cloneSubmitted && !cloneName }" />
                    <small class="text-red-500" v-if="cloneSubmitted && !cloneName">Name is required.</small>
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="cloneDialog = false" />
                <Button label="Clone" icon="pi pi-copy" @click="clonePlan" :loading="saving" />
            </template>
        </Dialog>

        <!-- Delete Confirmation -->
        <Dialog v-model:visible="deleteDialog" header="Confirm Delete" :modal="true" :style="{ width: '400px' }">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
                <span
                    >Are you sure you want to delete <strong>{{ deletingPlan?.name }}</strong
                    >?</span
                >
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="deleteDialog = false" />
                <Button label="Delete" icon="pi pi-trash" severity="danger" @click="deletePlan" :loading="saving" />
            </template>
        </Dialog>
    </div>
</template>
