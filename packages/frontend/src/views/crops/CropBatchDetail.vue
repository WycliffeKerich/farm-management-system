<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import cropService from '@/services/crop.service';
import { formatApiDate, toApiDate } from '@/utils/dates';
import { validationMessage } from '@/utils/forms';
import { holdProducts } from '@/utils/withdrawals';
import { useActiveHolds } from '@/composables/useActiveHolds';
import { useStockItems } from '@/composables/useStockItems';
import { useWithdrawalGuard } from '@/composables/useWithdrawalGuard';
import ProductPicker from '@/components/inventory/ProductPicker.vue';
import WithdrawalDialog from '@/components/withdrawals/WithdrawalDialog.vue';
import ActivityTimeline from '@/components/activities/ActivityTimeline.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const stock = useStockItems();
const holds = useActiveHolds();
const withdrawalGuard = useWithdrawalGuard();

// State
const loading = ref(true);
const saving = ref(false);
const batch = ref(null);
const timeline = ref(null);

// Dialogs
const statusDialog = ref(false);
const observationDialog = ref(false);
const harvestDialog = ref(false);
const inputDialog = ref(false);
const pestDiseaseDialog = ref(false);
const pestStatusDialog = ref(false);
const applyPlanDialog = ref(false);
const changePlanDialog = ref(false);
const cancelCareDialog = ref(false);
const completeTaskDialog = ref(false);
const skipTaskDialog = ref(false);

// Care Plan State
const loadingCareSchedule = ref(false);
const loadingPlans = ref(false);
const careSchedule = ref(null);
const availableCarePlans = ref([]);
const selectedPlanId = ref(null);
const upcomingCareTasks = ref([]);
const completingTask = ref(null);
const skippingTask = ref(null);
const taskCompleteNotes = ref('');
const taskSkipReason = ref('');
const taskSkipSubmitted = ref(false);

// Forms
const newStatus = ref('');
const observationForm = ref({ observation_date: new Date(), growth_stage: '', health_status: '', notes: '' });
const harvestForm = ref({ harvest_date: new Date(), quantity: null, unit: 'kg', grade: '', notes: '' });
const inputForm = ref({ application_date: new Date(), input_type: '', inventory_item_id: null, product_name: '', quantity: null, unit: 'ml', application_method: '', target_pest_disease: '', notes: '' });
const pestForm = ref({ incident_date: new Date(), type: 'pest', name: '', severity: 'medium', affected_area: '', symptoms: '', control_measures: '' });
const pestStatusForm = ref({ id: null, status: '', control_measures: '' });

// Options
const statusOptions = [
    { label: 'Planted', value: 'planted' },
    { label: 'Growing', value: 'growing' },
    { label: 'Harvesting', value: 'harvesting' },
    { label: 'Completed', value: 'completed' }
];

const inputTypeOptions = [
    { label: 'Fertilizer', value: 'fertilizer' },
    { label: 'Pesticide', value: 'pesticide' },
    { label: 'Herbicide', value: 'herbicide' },
    { label: 'Fungicide', value: 'fungicide' }
];

// Methods
const loadBatch = async () => {
    loading.value = true;
    try {
        const response = await cropService.getBatchById(route.params.id);
        batch.value = response.data.data;
        holds.load();
        timeline.value?.reload();
        // Load care schedule after batch data
        await loadCareSchedule();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to load batch',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const goBack = () => {
    router.push({ name: 'crop-batches' });
};

const openStatusDialog = () => {
    newStatus.value = batch.value.status;
    statusDialog.value = true;
};

const updateStatus = async () => {
    saving.value = true;
    try {
        await cropService.updateBatchStatus(batch.value.id, newStatus.value);
        batch.value.status = newStatus.value;
        statusDialog.value = false;
        toast.add({ severity: 'success', summary: 'Success', detail: 'Status updated', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to update status', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const openObservationDialog = () => {
    observationForm.value = { observation_date: new Date(), growth_stage: '', health_status: '', notes: '' };
    observationDialog.value = true;
};

const saveObservation = async () => {
    saving.value = true;
    try {
        const data = { ...observationForm.value, observation_date: toApiDate(observationForm.value.observation_date) };
        await cropService.addObservation(batch.value.id, data);
        observationDialog.value = false;
        loadBatch();
        toast.add({ severity: 'success', summary: 'Success', detail: 'Observation recorded', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save observation', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const openHarvestDialog = () => {
    harvestForm.value = { harvest_date: new Date(), quantity: null, unit: 'kg', grade: '', notes: '' };
    harvestDialog.value = true;
};

// Today's pre-harvest interval on this batch, if any
const harvestHold = computed(() => (batch.value ? holds.forBatch(batch.value.id) : null));
const harvestDateHeld = computed(() => {
    const date = toApiDate(harvestForm.value.harvest_date);
    return Boolean(harvestHold.value && date && date < harvestHold.value.safe_from);
});

const onHarvestSaved = () => {
    harvestDialog.value = false;
    loadBatch();
    toast.add({ severity: 'success', summary: 'Success', detail: 'Harvest recorded', life: 3000 });
};

const saveHarvest = async () => {
    if (!harvestForm.value.quantity || !harvestForm.value.unit) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill required fields', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const data = { ...harvestForm.value, harvest_date: toApiDate(harvestForm.value.harvest_date) };
        await withdrawalGuard.attempt((override) => cropService.recordHarvest(batch.value.id, { ...data, ...override }), onHarvestSaved);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to save harvest'), life: 3000 });
    } finally {
        saving.value = false;
    }
};

const openInputDialog = () => {
    inputForm.value = { application_date: new Date(), input_type: '', inventory_item_id: null, product_name: '', quantity: null, unit: 'ml', application_method: '', target_pest_disease: '', notes: '' };
    inputDialog.value = true;
    stock.load();
};

// A stock item names the product and sets the unit; clearing it keeps the typed name
const onInputProductPicked = (item) => {
    if (!item) return;
    inputForm.value.product_name = item.name;
    inputForm.value.unit = item.unit;
};

const inputUnits = ['ml', 'l', 'g', 'kg', 'tablets'];
const inputUnitOptions = computed(() => {
    const unit = inputForm.value.unit;
    return unit && !inputUnits.includes(unit) ? [...inputUnits, unit] : inputUnits;
});

const saveInputApplication = async () => {
    if (!inputForm.value.input_type || !inputForm.value.product_name || !inputForm.value.quantity || !inputForm.value.unit) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill required fields', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const data = { ...inputForm.value, application_date: toApiDate(inputForm.value.application_date) };
        await cropService.recordInputApplication(batch.value.id, data);
        inputDialog.value = false;
        loadBatch();
        toast.add({ severity: 'success', summary: 'Success', detail: data.inventory_item_id ? 'Input application recorded and stock drawn' : 'Input application recorded', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to save'), life: 5000 });
    } finally {
        saving.value = false;
    }
};

const openPestDiseaseDialog = () => {
    pestForm.value = { incident_date: new Date(), type: 'pest', name: '', severity: 'medium', affected_area: '', symptoms: '', control_measures: '' };
    pestDiseaseDialog.value = true;
};

const savePestDisease = async () => {
    if (!pestForm.value.type || !pestForm.value.name) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill required fields', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const data = { ...pestForm.value, incident_date: toApiDate(pestForm.value.incident_date) };
        await cropService.reportPestDisease(batch.value.id, data);
        pestDiseaseDialog.value = false;
        loadBatch();
        toast.add({ severity: 'success', summary: 'Success', detail: 'Issue reported', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const updatePestStatus = (pest) => {
    pestStatusForm.value = { id: pest.id, status: pest.status, control_measures: pest.control_measures || '' };
    pestStatusDialog.value = true;
};

const savePestStatus = async () => {
    saving.value = true;
    try {
        await cropService.updatePestDiseaseStatus(pestStatusForm.value.id, pestStatusForm.value.status, pestStatusForm.value.control_measures);
        pestStatusDialog.value = false;
        loadBatch();
        toast.add({ severity: 'success', summary: 'Success', detail: 'Status updated', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to update', life: 3000 });
    } finally {
        saving.value = false;
    }
};

// Utility functions
const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : '');
const formatStatus = (status) => status.charAt(0).toUpperCase() + status.slice(1);
const formatInputType = (type) => type.charAt(0).toUpperCase() + type.slice(1);

const getStatusSeverity = (status) => {
    switch (status) {
        case 'planted':
            return 'info';
        case 'growing':
            return 'success';
        case 'harvesting':
            return 'warn';
        case 'completed':
            return 'secondary';
        default:
            return 'info';
    }
};

const getInputTypeSeverity = (type) => {
    switch (type) {
        case 'fertilizer':
            return 'success';
        case 'pesticide':
            return 'warn';
        case 'herbicide':
            return 'info';
        case 'fungicide':
            return 'secondary';
        default:
            return 'info';
    }
};

const getSeverityColor = (severity) => {
    switch (severity) {
        case 'low':
            return 'success';
        case 'medium':
            return 'warn';
        case 'high':
            return 'danger';
        case 'critical':
            return 'danger';
        default:
            return 'info';
    }
};

const getPestStatusSeverity = (status) => {
    switch (status) {
        case 'active':
            return 'danger';
        case 'controlled':
            return 'warn';
        case 'resolved':
            return 'success';
        default:
            return 'info';
    }
};

const getCareScheduleStatusSeverity = (status) => {
    switch (status) {
        case 'active':
            return 'success';
        case 'paused':
            return 'warn';
        case 'completed':
            return 'info';
        case 'cancelled':
            return 'secondary';
        default:
            return 'info';
    }
};

const getTaskStatusSeverity = (status) => {
    switch (status) {
        case 'pending':
            return 'secondary';
        case 'upcoming':
            return 'info';
        case 'due':
            return 'warn';
        case 'overdue':
            return 'danger';
        case 'completed':
            return 'success';
        case 'skipped':
            return 'secondary';
        default:
            return 'info';
    }
};

const getCareProgressPercent = (schedule) => {
    if (!schedule || !schedule.total_tasks) return 0;
    return Math.round((schedule.completed_tasks / schedule.total_tasks) * 100);
};

const selectedPlanDetails = computed(() => {
    if (!selectedPlanId.value) return null;
    return availableCarePlans.value.find((p) => p.id === selectedPlanId.value);
});

// Care Plan Methods
const loadCareSchedule = async () => {
    if (!batch.value?.id) return;
    loadingCareSchedule.value = true;
    try {
        const response = await cropService.getBatchCareSchedule(batch.value.id);
        careSchedule.value = response.data.data;
        if (careSchedule.value) {
            await loadUpcomingTasks();
        }
    } catch (error) {
        // No schedule found is not an error
        careSchedule.value = null;
    } finally {
        loadingCareSchedule.value = false;
    }
};

const loadUpcomingTasks = async () => {
    if (!batch.value?.id) return;
    try {
        const response = await cropService.getUpcomingScheduledTasks(14, { batch_id: batch.value.id });
        upcomingCareTasks.value = (response.data.data || []).slice(0, 5);
    } catch (error) {
        upcomingCareTasks.value = [];
    }
};

const loadAvailableCarePlans = async () => {
    loadingPlans.value = true;
    try {
        const response = await cropService.getCarePlans({ status: 'active' });
        availableCarePlans.value = (response.data.data || []).map((p) => ({
            ...p,
            display_name: `${p.name} (${p.task_count} tasks)`
        }));
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load care plans', life: 3000 });
    } finally {
        loadingPlans.value = false;
    }
};

const openApplyPlanDialog = async () => {
    selectedPlanId.value = null;
    await loadAvailableCarePlans();
    applyPlanDialog.value = true;
};

const openChangePlanDialog = async () => {
    selectedPlanId.value = null;
    await loadAvailableCarePlans();
    changePlanDialog.value = true;
};

const applyCarePlan = async () => {
    if (!selectedPlanId.value) return;
    saving.value = true;
    try {
        await cropService.applyCarePlanToBatch(batch.value.id, selectedPlanId.value);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Care plan applied successfully', life: 3000 });
        applyPlanDialog.value = false;
        await loadCareSchedule();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to apply care plan', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const changeCarePlan = async () => {
    if (!selectedPlanId.value) return;
    saving.value = true;
    try {
        // First cancel existing, then apply new
        await cropService.cancelBatchCareSchedule(batch.value.id);
        await cropService.applyCarePlanToBatch(batch.value.id, selectedPlanId.value);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Care plan changed successfully', life: 3000 });
        changePlanDialog.value = false;
        await loadCareSchedule();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to change care plan', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const confirmCancelCareSchedule = () => {
    cancelCareDialog.value = true;
};

const cancelCareSchedule = async () => {
    saving.value = true;
    try {
        await cropService.cancelBatchCareSchedule(batch.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Care plan cancelled', life: 3000 });
        cancelCareDialog.value = false;
        careSchedule.value = null;
        upcomingCareTasks.value = [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to cancel care plan', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const openCompleteTaskDialog = (task) => {
    completingTask.value = task;
    taskCompleteNotes.value = '';
    completeTaskDialog.value = true;
};

const openSkipTaskDialog = (task) => {
    skippingTask.value = task;
    taskSkipReason.value = '';
    taskSkipSubmitted.value = false;
    skipTaskDialog.value = true;
};

const completeTask = async () => {
    saving.value = true;
    try {
        await cropService.completeScheduledTask(completingTask.value.id, taskCompleteNotes.value);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Task completed', life: 3000 });
        completeTaskDialog.value = false;
        await loadCareSchedule();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to complete task', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const skipTask = async () => {
    taskSkipSubmitted.value = true;
    if (!taskSkipReason.value) return;
    saving.value = true;
    try {
        await cropService.skipScheduledTask(skippingTask.value.id, taskSkipReason.value);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Task skipped', life: 3000 });
        skipTaskDialog.value = false;
        await loadCareSchedule();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to skip task', life: 3000 });
    } finally {
        saving.value = false;
    }
};

// Lifecycle
onMounted(() => {
    loadBatch();
});
</script>

<template>
    <div v-if="loading" class="flex justify-center items-center min-h-96">
        <ProgressSpinner />
    </div>

    <div v-else-if="batch" class="flex flex-col gap-6">
        <!-- Header -->
        <div class="card">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex items-center gap-4">
                    <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="goBack" />
                    <div>
                        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">
                            {{ batch.batch_code }}
                        </h2>
                        <p class="text-surface-600 dark:text-surface-400">{{ batch.crop_type_name }} - {{ batch.variety_name }}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <Tag :severity="getStatusSeverity(batch.status)" :value="formatStatus(batch.status)" class="text-lg px-3 py-1" />
                    <Button label="Change Status" icon="pi pi-sync" severity="secondary" outlined @click="openStatusDialog" />
                </div>
            </div>
            <Message v-if="harvestHold" severity="warn" :closable="false" class="mt-4">
                Pre-harvest interval: do not harvest before <strong>{{ formatApiDate(harvestHold.safe_from) }}</strong> ({{ holdProducts(harvestHold) }}).
            </Message>
        </div>

        <!-- Batch Details & Quick Actions -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Batch Info -->
            <div class="card lg:col-span-2">
                <h3 class="text-lg font-semibold mb-4">Batch Information</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p class="text-surface-500 text-sm">Location</p>
                        <p class="font-medium">{{ batch.location_name || 'Not assigned' }}</p>
                    </div>
                    <div>
                        <p class="text-surface-500 text-sm">Planting Date</p>
                        <p class="font-medium">{{ formatDate(batch.planting_date) }}</p>
                    </div>
                    <div>
                        <p class="text-surface-500 text-sm">Expected Harvest</p>
                        <p class="font-medium">{{ formatDate(batch.expected_harvest_date) || 'Not calculated' }}</p>
                    </div>
                    <div>
                        <p class="text-surface-500 text-sm">Actual Harvest</p>
                        <p class="font-medium">{{ formatDate(batch.actual_harvest_date) || 'Not yet' }}</p>
                    </div>
                    <div>
                        <p class="text-surface-500 text-sm">Quantity Planted</p>
                        <p class="font-medium">{{ batch.quantity_planted }} {{ batch.unit }}</p>
                    </div>
                    <div>
                        <p class="text-surface-500 text-sm">Total Harvested</p>
                        <p class="font-medium">{{ batch.total_harvested || 0 }} {{ batch.unit }}</p>
                    </div>
                    <div class="md:col-span-2">
                        <p class="text-surface-500 text-sm">Notes</p>
                        <p class="font-medium">{{ batch.notes || 'No notes' }}</p>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card">
                <h3 class="text-lg font-semibold mb-4">Quick Actions</h3>
                <div class="flex flex-col gap-3">
                    <Button label="Add Observation" icon="pi pi-eye" severity="info" outlined class="w-full" @click="openObservationDialog" />
                    <Button label="Record Harvest" icon="pi pi-box" severity="success" outlined class="w-full" @click="openHarvestDialog" />
                    <Button label="Apply Input" icon="pi pi-plus-circle" severity="warn" outlined class="w-full" @click="openInputDialog" />
                    <Button label="Report Issue" icon="pi pi-exclamation-triangle" severity="danger" outlined class="w-full" @click="openPestDiseaseDialog" />
                </div>
            </div>
        </div>

        <!-- Care Plan Section -->
        <div class="card">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold">Care Plan</h3>
                <Button v-if="!careSchedule" label="Apply Care Plan" icon="pi pi-calendar-plus" severity="info" @click="openApplyPlanDialog" />
                <Button v-else label="Change Plan" icon="pi pi-sync" severity="secondary" outlined @click="openChangePlanDialog" />
            </div>

            <!-- No Care Plan Applied -->
            <div v-if="!careSchedule && !loadingCareSchedule" class="text-center py-6 surface-100 border-round">
                <i class="pi pi-calendar text-4xl text-surface-400 mb-3"></i>
                <p class="text-surface-600 mb-2">No care plan applied to this batch</p>
                <p class="text-surface-500 text-sm">Apply a care plan to automatically schedule tasks based on the planting date</p>
            </div>

            <!-- Loading State -->
            <div v-else-if="loadingCareSchedule" class="text-center py-6">
                <ProgressSpinner style="width: 40px; height: 40px" />
            </div>

            <!-- Care Plan Active -->
            <div v-else>
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 surface-100 border-round mb-4">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <router-link :to="`/crops/care-plans/${careSchedule.plan_id}`" class="font-semibold text-primary text-lg">
                                {{ careSchedule.plan_name }}
                            </router-link>
                            <Tag :value="careSchedule.status" :severity="getCareScheduleStatusSeverity(careSchedule.status)" />
                        </div>
                        <p class="text-surface-500 text-sm">Applied on {{ formatDate(careSchedule.applied_date) }}</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-primary">{{ careSchedule.completed_tasks || 0 }}</div>
                            <div class="text-surface-500 text-sm">Completed</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold" :class="{ 'text-red-500': careSchedule.overdue_tasks > 0 }">{{ careSchedule.overdue_tasks || 0 }}</div>
                            <div class="text-surface-500 text-sm">Overdue</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold">{{ careSchedule.total_tasks || 0 }}</div>
                            <div class="text-surface-500 text-sm">Total</div>
                        </div>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="mb-4">
                    <div class="flex justify-between mb-2">
                        <span class="text-surface-600 text-sm">Progress</span>
                        <span class="text-surface-600 text-sm">{{ getCareProgressPercent(careSchedule) }}%</span>
                    </div>
                    <ProgressBar :value="getCareProgressPercent(careSchedule)" :showValue="false" style="height: 0.75rem" />
                </div>

                <!-- Upcoming Tasks Preview -->
                <div v-if="upcomingCareTasks.length > 0">
                    <h4 class="font-medium mb-3">Upcoming Tasks</h4>
                    <DataTable :value="upcomingCareTasks" :rows="5" class="p-datatable-sm">
                        <Column header="Task" style="min-width: 10rem">
                            <template #body="{ data }">
                                <div class="font-medium">{{ data.task_name }}</div>
                            </template>
                        </Column>
                        <Column header="Due Date" style="min-width: 8rem">
                            <template #body="{ data }">
                                <div>{{ formatDate(data.planned_date) }}</div>
                            </template>
                        </Column>
                        <Column header="Status" style="width: 6rem">
                            <template #body="{ data }">
                                <Tag :value="data.status" :severity="getTaskStatusSeverity(data.status)" />
                            </template>
                        </Column>
                        <Column header="Actions" style="width: 8rem">
                            <template #body="{ data }">
                                <Button icon="pi pi-check" class="p-button-success p-button-sm p-button-text" @click="openCompleteTaskDialog(data)" v-tooltip.top="'Complete'" />
                                <Button icon="pi pi-times" class="p-button-secondary p-button-sm p-button-text" @click="openSkipTaskDialog(data)" v-tooltip.top="'Skip'" />
                            </template>
                        </Column>
                    </DataTable>
                    <div class="mt-3 text-right">
                        <router-link to="/crops/care-schedules" class="text-primary text-sm">View all tasks →</router-link>
                    </div>
                </div>

                <!-- Cancel Schedule Button -->
                <div class="mt-4 pt-4 border-top-1 surface-border">
                    <Button label="Cancel Care Plan" icon="pi pi-trash" severity="danger" text @click="confirmCancelCareSchedule" />
                </div>
            </div>
        </div>

        <!-- Tabs for History -->
        <div class="card">
            <TabView>
                <!-- Observations Tab -->
                <TabPanel header="Growth Observations">
                    <DataTable :value="batch.observations" :paginator="batch.observations?.length > 5" :rows="5" stripedRows>
                        <template #empty>
                            <div class="text-center py-4 text-surface-500">No observations recorded</div>
                        </template>
                        <Column field="observation_date" header="Date">
                            <template #body="{ data }">{{ formatDate(data.observation_date) }}</template>
                        </Column>
                        <Column field="growth_stage" header="Growth Stage" />
                        <Column field="health_status" header="Health Status" />
                        <Column field="notes" header="Notes" />
                        <Column field="recorded_by_name" header="Recorded By" />
                    </DataTable>
                </TabPanel>

                <!-- Harvests Tab -->
                <TabPanel header="Harvests">
                    <DataTable :value="batch.harvests" :paginator="batch.harvests?.length > 5" :rows="5" stripedRows>
                        <template #empty>
                            <div class="text-center py-4 text-surface-500">No harvests recorded</div>
                        </template>
                        <Column field="harvest_date" header="Date">
                            <template #body="{ data }">{{ formatDate(data.harvest_date) }}</template>
                        </Column>
                        <Column field="quantity" header="Quantity">
                            <template #body="{ data }">{{ data.quantity }} {{ data.unit }}</template>
                        </Column>
                        <Column field="grade" header="Grade" />
                        <Column field="notes" header="Notes" />
                        <Column field="recorded_by_name" header="Recorded By" />
                    </DataTable>
                </TabPanel>

                <!-- Input Applications Tab -->
                <TabPanel header="Input Applications">
                    <DataTable :value="batch.input_applications" :paginator="batch.input_applications?.length > 5" :rows="5" stripedRows>
                        <template #empty>
                            <div class="text-center py-4 text-surface-500">No input applications recorded</div>
                        </template>
                        <Column field="application_date" header="Date">
                            <template #body="{ data }">{{ formatDate(data.application_date) }}</template>
                        </Column>
                        <Column field="input_type" header="Type">
                            <template #body="{ data }">
                                <Tag :severity="getInputTypeSeverity(data.input_type)" :value="formatInputType(data.input_type)" />
                            </template>
                        </Column>
                        <Column field="product_name" header="Product" />
                        <Column field="quantity" header="Quantity">
                            <template #body="{ data }">{{ data.quantity }} {{ data.unit }}</template>
                        </Column>
                        <Column field="application_method" header="Method" />
                        <Column field="recorded_by_name" header="Recorded By" />
                    </DataTable>
                </TabPanel>

                <!-- Pests & Diseases Tab -->
                <TabPanel header="Pests & Diseases">
                    <DataTable :value="batch.pests_diseases" :paginator="batch.pests_diseases?.length > 5" :rows="5" stripedRows>
                        <template #empty>
                            <div class="text-center py-4 text-surface-500">No pest or disease incidents recorded</div>
                        </template>
                        <Column field="incident_date" header="Date">
                            <template #body="{ data }">{{ formatDate(data.incident_date) }}</template>
                        </Column>
                        <Column field="type" header="Type">
                            <template #body="{ data }">
                                <Tag :severity="data.type === 'pest' ? 'warn' : 'danger'" :value="data.type" />
                            </template>
                        </Column>
                        <Column field="name" header="Name" />
                        <Column field="severity" header="Severity">
                            <template #body="{ data }">
                                <Tag :severity="getSeverityColor(data.severity)" :value="data.severity" />
                            </template>
                        </Column>
                        <Column field="status" header="Status">
                            <template #body="{ data }">
                                <Tag :severity="getPestStatusSeverity(data.status)" :value="data.status" />
                            </template>
                        </Column>
                        <Column header="Actions" style="width: 100px">
                            <template #body="{ data }">
                                <Button v-if="data.status !== 'resolved'" icon="pi pi-check" severity="success" text rounded @click="updatePestStatus(data)" v-tooltip.top="'Update Status'" />
                            </template>
                        </Column>
                    </DataTable>
                </TabPanel>

                <!-- Everything done on this batch, with labour, cost and attachments -->
                <TabPanel header="Timeline">
                    <ActivityTimeline ref="timeline" :subject="{ crop_batch_id: batch.id }" :farmWide="false" :rows="10" />
                </TabPanel>
            </TabView>
        </div>

        <!-- Status Change Dialog -->
        <Dialog v-model:visible="statusDialog" header="Change Status" :modal="true" :style="{ width: '400px' }">
            <div class="flex flex-col gap-4">
                <p class="text-surface-600">Select new status for batch {{ batch.batch_code }}</p>
                <Select v-model="newStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Select status" class="w-full" />
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="statusDialog = false" />
                <Button label="Update" @click="updateStatus" :loading="saving" />
            </template>
        </Dialog>

        <!-- Observation Dialog -->
        <Dialog v-model:visible="observationDialog" header="Add Observation" :modal="true" :style="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Observation Date *</label>
                    <DatePicker v-model="observationForm.observation_date" dateFormat="yy-mm-dd" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Growth Stage</label>
                    <InputText v-model="observationForm.growth_stage" class="w-full" placeholder="e.g., Flowering, Fruiting" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Health Status</label>
                    <Select v-model="observationForm.health_status" :options="['Excellent', 'Good', 'Fair', 'Poor', 'Critical']" placeholder="Select health status" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Notes</label>
                    <Textarea v-model="observationForm.notes" rows="3" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="observationDialog = false" />
                <Button label="Save" @click="saveObservation" :loading="saving" />
            </template>
        </Dialog>

        <!-- Harvest Dialog -->
        <Dialog v-model:visible="harvestDialog" header="Record Harvest" :modal="true" :style="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Harvest Date *</label>
                    <DatePicker v-model="harvestForm.harvest_date" dateFormat="yy-mm-dd" class="w-full" />
                    <small v-if="harvestDateHeld" class="text-orange-600 dark:text-orange-400">Inside the pre-harvest interval: safe from {{ formatApiDate(harvestHold.safe_from) }}.</small>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">Quantity *</label>
                        <InputNumber v-model="harvestForm.quantity" :min="0.01" :minFractionDigits="2" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">Unit *</label>
                        <Select v-model="harvestForm.unit" :options="['kg', 'g', 'crates', 'boxes', 'pieces']" class="w-full" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Grade</label>
                    <Select v-model="harvestForm.grade" :options="['A', 'B', 'C', 'Reject']" placeholder="Select grade" class="w-full" showClear />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Notes</label>
                    <Textarea v-model="harvestForm.notes" rows="3" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="harvestDialog = false" />
                <Button label="Save" @click="saveHarvest" :loading="saving" />
            </template>
        </Dialog>

        <!-- Input Application Dialog -->
        <Dialog v-model:visible="inputDialog" header="Record Input Application" :modal="true" :style="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Application Date *</label>
                    <DatePicker v-model="inputForm.application_date" dateFormat="yy-mm-dd" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Input Type *</label>
                    <Select v-model="inputForm.input_type" :options="inputTypeOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium" for="input_item">From Stock</label>
                    <ProductPicker v-model="inputForm.inventory_item_id" inputId="input_item" use="crop" :items="stock.items.value" :loading="stock.loading.value" @select="onInputProductPicked" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Product Name *</label>
                    <InputText v-model="inputForm.product_name" class="w-full" placeholder="Enter product name" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">Quantity *</label>
                        <InputNumber v-model="inputForm.quantity" :min="0.01" :minFractionDigits="2" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">Unit *</label>
                        <Select v-model="inputForm.unit" :options="inputUnitOptions" class="w-full" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Application Method</label>
                    <InputText v-model="inputForm.application_method" class="w-full" placeholder="e.g., Foliar spray, Drench" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Target (if pesticide)</label>
                    <InputText v-model="inputForm.target_pest_disease" class="w-full" placeholder="Target pest or disease" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Notes</label>
                    <Textarea v-model="inputForm.notes" rows="2" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="inputDialog = false" />
                <Button label="Save" @click="saveInputApplication" :loading="saving" />
            </template>
        </Dialog>

        <!-- Pest/Disease Dialog -->
        <Dialog v-model:visible="pestDiseaseDialog" header="Report Pest/Disease Issue" :modal="true" :style="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Incident Date *</label>
                    <DatePicker v-model="pestForm.incident_date" dateFormat="yy-mm-dd" class="w-full" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">Type *</label>
                        <Select
                            v-model="pestForm.type"
                            :options="[
                                { label: 'Pest', value: 'pest' },
                                { label: 'Disease', value: 'disease' }
                            ]"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                        />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">Severity *</label>
                        <Select v-model="pestForm.severity" :options="['low', 'medium', 'high', 'critical']" class="w-full" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Name *</label>
                    <InputText v-model="pestForm.name" class="w-full" placeholder="Name of pest or disease" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Affected Area</label>
                    <InputText v-model="pestForm.affected_area" class="w-full" placeholder="e.g., 20% of plants" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Symptoms</label>
                    <Textarea v-model="pestForm.symptoms" rows="2" class="w-full" placeholder="Describe symptoms observed" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Control Measures</label>
                    <Textarea v-model="pestForm.control_measures" rows="2" class="w-full" placeholder="Actions taken or planned" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="pestDiseaseDialog = false" />
                <Button label="Save" @click="savePestDisease" :loading="saving" />
            </template>
        </Dialog>

        <!-- Update Pest Status Dialog -->
        <Dialog v-model:visible="pestStatusDialog" header="Update Issue Status" :modal="true" :style="{ width: '400px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label class="font-medium">New Status</label>
                    <Select
                        v-model="pestStatusForm.status"
                        :options="[
                            { label: 'Active', value: 'active' },
                            { label: 'Controlled', value: 'controlled' },
                            { label: 'Resolved', value: 'resolved' }
                        ]"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Control Measures</label>
                    <Textarea v-model="pestStatusForm.control_measures" rows="3" class="w-full" placeholder="Describe control measures taken" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="pestStatusDialog = false" />
                <Button label="Update" @click="savePestStatus" :loading="saving" />
            </template>
        </Dialog>

        <!-- Apply Care Plan Dialog -->
        <Dialog v-model:visible="applyPlanDialog" header="Apply Care Plan" :modal="true" :style="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <p class="text-surface-600">
                    Select a care plan to apply to batch <strong>{{ batch?.batch_code }}</strong
                    >. Tasks will be scheduled based on the planting date.
                </p>

                <div class="flex flex-col gap-2">
                    <label class="font-medium">Care Plan *</label>
                    <Select v-model="selectedPlanId" :options="availableCarePlans" optionLabel="display_name" optionValue="id" placeholder="Select a care plan" class="w-full" filter :loading="loadingPlans">
                        <template #option="{ option }">
                            <div>
                                <div class="font-medium">{{ option.name }}</div>
                                <div class="text-surface-500 text-sm">{{ option.task_count }} tasks · {{ option.total_duration_days || 'N/A' }} days</div>
                            </div>
                        </template>
                    </Select>
                </div>

                <div v-if="selectedPlanId" class="surface-100 border-round p-3">
                    <div class="font-medium mb-2">Plan Preview</div>
                    <div class="text-sm text-surface-600">
                        <p v-if="selectedPlanDetails">{{ selectedPlanDetails.description || 'No description available' }}</p>
                        <p class="mt-2"><strong>Tasks:</strong> {{ selectedPlanDetails?.task_count || 0 }}</p>
                        <p><strong>Duration:</strong> {{ selectedPlanDetails?.total_duration_days || 'N/A' }} days</p>
                    </div>
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="applyPlanDialog = false" />
                <Button label="Apply Plan" icon="pi pi-check" @click="applyCarePlan" :loading="saving" :disabled="!selectedPlanId" />
            </template>
        </Dialog>

        <!-- Change Care Plan Dialog -->
        <Dialog v-model:visible="changePlanDialog" header="Change Care Plan" :modal="true" :style="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="surface-100 border-round p-3 border-left-3 border-orange-500">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="pi pi-exclamation-triangle text-orange-500"></i>
                        <span class="font-medium">Warning</span>
                    </div>
                    <p class="text-surface-600 text-sm">Changing the care plan will cancel the current schedule and all pending tasks. Completed tasks will be preserved in history.</p>
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-medium">New Care Plan *</label>
                    <Select v-model="selectedPlanId" :options="availableCarePlans" optionLabel="display_name" optionValue="id" placeholder="Select a care plan" class="w-full" filter :loading="loadingPlans" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="changePlanDialog = false" />
                <Button label="Change Plan" icon="pi pi-sync" severity="warn" @click="changeCarePlan" :loading="saving" :disabled="!selectedPlanId" />
            </template>
        </Dialog>

        <!-- Cancel Care Schedule Confirmation -->
        <Dialog v-model:visible="cancelCareDialog" header="Cancel Care Plan" :modal="true" :style="{ width: '400px' }">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
                <div>
                    <p>Are you sure you want to cancel the care plan for this batch?</p>
                    <p class="text-surface-500 text-sm mt-2">All pending tasks will be removed. Completed tasks will be preserved in history.</p>
                </div>
            </div>
            <template #footer>
                <Button label="Keep Plan" severity="secondary" @click="cancelCareDialog = false" />
                <Button label="Cancel Plan" icon="pi pi-trash" severity="danger" @click="cancelCareSchedule" :loading="saving" />
            </template>
        </Dialog>

        <!-- Complete Task Dialog -->
        <Dialog v-model:visible="completeTaskDialog" header="Complete Task" :modal="true" :style="{ width: '450px' }">
            <div class="mb-3">
                <div class="font-medium text-lg">{{ completingTask?.task_name }}</div>
                <div class="text-surface-500">Due: {{ formatDate(completingTask?.planned_date) }}</div>
            </div>
            <div class="flex flex-col gap-2">
                <label class="font-medium">Notes (optional)</label>
                <Textarea v-model="taskCompleteNotes" rows="3" placeholder="Add any notes about the completed task..." class="w-full" />
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="completeTaskDialog = false" />
                <Button label="Mark Complete" icon="pi pi-check" severity="success" @click="completeTask" :loading="saving" />
            </template>
        </Dialog>

        <!-- Skip Task Dialog -->
        <Dialog v-model:visible="skipTaskDialog" header="Skip Task" :modal="true" :style="{ width: '450px' }">
            <div class="mb-3">
                <div class="font-medium text-lg">{{ skippingTask?.task_name }}</div>
                <div class="text-surface-500">Due: {{ formatDate(skippingTask?.planned_date) }}</div>
            </div>
            <div class="flex flex-col gap-2">
                <label class="font-medium">Reason for skipping *</label>
                <Textarea v-model="taskSkipReason" rows="3" placeholder="Why is this task being skipped?" class="w-full" :class="{ 'p-invalid': taskSkipSubmitted && !taskSkipReason }" />
                <small class="text-red-500" v-if="taskSkipSubmitted && !taskSkipReason">Reason is required.</small>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="skipTaskDialog = false" />
                <Button label="Skip Task" icon="pi pi-times" severity="warn" @click="skipTask" :loading="saving" />
            </template>
        </Dialog>

        <WithdrawalDialog :guard="withdrawalGuard" />
    </div>

    <div v-else class="card text-center py-8">
        <i class="pi pi-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
        <p class="text-surface-600">Batch not found</p>
        <Button label="Go Back" icon="pi pi-arrow-left" class="mt-4" @click="goBack" />
    </div>
</template>
