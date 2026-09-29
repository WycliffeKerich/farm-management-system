<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';

const route = useRoute();
const toast = useToast();

// State
const loading = ref(false);
const saving = ref(false);
const plan = ref(null);
const tasks = ref([]);
const viewMode = ref('timeline');

const viewModes = [
    { label: 'Timeline', value: 'timeline' },
    { label: 'Table', value: 'table' }
];

// Dialogs
const taskDialog = ref(false);
const deleteTaskDialog = ref(false);
const editPlanDialog = ref(false);
const editingTask = ref(null);
const deletingTask = ref(null);
const taskSubmitted = ref(false);

const taskForm = ref({
    task_name: '',
    days_from_start: 0,
    task_type: null,
    description: '',
    priority: 'medium',
    tolerance_days_before: 0,
    tolerance_days_after: 2,
    is_recurring: false,
    recurrence_interval_days: null,
    recurrence_end_days: null,
    input_product_name: '',
    input_quantity: null,
    input_unit: '',
    input_application_method: ''
});

const planForm = ref({
    name: '',
    plan_type: null,
    applies_to: 'both',
    total_duration_days: null,
    status: 'active',
    description: ''
});

const priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' }
];

const taskTypeOptions = [
    { label: 'Vaccination', value: 'vaccination' },
    { label: 'Deworming', value: 'deworming' },
    { label: 'Health Check', value: 'health_check' },
    { label: 'Weighing', value: 'weighing' },
    { label: 'Feeding Change', value: 'feeding_change' },
    { label: 'Medication', value: 'medication' },
    { label: 'Supplement', value: 'supplement' },
    { label: 'Observation', value: 'observation' },
    { label: 'Other', value: 'other' }
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

const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' }
];

// Computed
const sortedTasks = computed(() => {
    return [...tasks.value].sort((a, b) => a.days_from_start - b.days_from_start);
});

// Methods
const loadPlan = async () => {
    loading.value = true;
    try {
        const response = await animalService.getCarePlanById(route.params.id);
        plan.value = response.data.data;
        tasks.value = plan.value.tasks || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load care plan', life: 3000 });
        plan.value = null;
    } finally {
        loading.value = false;
    }
};

const getStatusSeverity = (status) => {
    const severities = { draft: 'warn', active: 'success', archived: 'secondary' };
    return severities[status] || 'info';
};

const getPrioritySeverity = (priority) => {
    const severities = { low: 'secondary', medium: 'info', high: 'warn', urgent: 'danger' };
    return severities[priority] || 'info';
};

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
    return types[type] || type || '-';
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

const formatTaskType = (type) => {
    const types = {
        vaccination: 'Vaccination',
        deworming: 'Deworming',
        health_check: 'Health Check',
        weighing: 'Weighing',
        feeding_change: 'Feeding Change',
        medication: 'Medication',
        supplement: 'Supplement',
        observation: 'Observation',
        other: 'Other'
    };
    return types[type] || type || '-';
};

const getTaskTypeSeverity = (type) => {
    const severities = {
        vaccination: 'info',
        deworming: 'warn',
        health_check: 'success',
        medication: 'danger',
        feeding_change: 'secondary'
    };
    return severities[type] || 'secondary';
};

const formatAppliesTo = (value) => {
    const map = {
        individual: 'Individual Animals',
        flock: 'Flocks/Groups',
        both: 'Both'
    };
    return map[value] || value || '-';
};

const getTaskClass = (task) => {
    if (task.task_type === 'vaccination' || task.task_type === 'medication') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (task.is_recurring) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
};

const openTaskDialog = (task = null) => {
    editingTask.value = task;
    if (task) {
        taskForm.value = { ...task };
    } else {
        taskForm.value = {
            task_name: '',
            days_from_start: 0,
            task_type: null,
            description: '',
            priority: 'medium',
            tolerance_days_before: 0,
            tolerance_days_after: 2,
            is_recurring: false,
            recurrence_interval_days: null,
            recurrence_end_days: null,
            input_product_name: '',
            input_quantity: null,
            input_unit: '',
            input_application_method: ''
        };
    }
    taskSubmitted.value = false;
    taskDialog.value = true;
};

const saveTask = async () => {
    taskSubmitted.value = true;

    if (!taskForm.value.task_name || taskForm.value.days_from_start === null) {
        return;
    }

    saving.value = true;
    try {
        if (editingTask.value) {
            await animalService.updateCarePlanTask(editingTask.value.id, taskForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Task updated', life: 3000 });
        } else {
            await animalService.addCarePlanTask(plan.value.id, taskForm.value);
            toast.add({ severity: 'success', summary: 'Success', detail: 'Task added', life: 3000 });
        }
        taskDialog.value = false;
        await loadPlan();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to save task', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const confirmDeleteTask = (task) => {
    deletingTask.value = task;
    deleteTaskDialog.value = true;
};

const deleteTask = async () => {
    saving.value = true;
    try {
        await animalService.deleteCarePlanTask(deletingTask.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Task deleted', life: 3000 });
        deleteTaskDialog.value = false;
        await loadPlan();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete task', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const openEditDialog = () => {
    planForm.value = {
        name: plan.value.name,
        plan_type: plan.value.plan_type,
        applies_to: plan.value.applies_to,
        total_duration_days: plan.value.total_duration_days,
        status: plan.value.status,
        description: plan.value.description || ''
    };
    editPlanDialog.value = true;
};

const updatePlan = async () => {
    saving.value = true;
    try {
        await animalService.updateCarePlan(plan.value.id, planForm.value);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Plan updated', life: 3000 });
        editPlanDialog.value = false;
        await loadPlan();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to update plan', life: 3000 });
    } finally {
        saving.value = false;
    }
};

onMounted(() => {
    loadPlan();
});
</script>

<template>
    <div v-if="plan">
        <!-- Plan Header -->
        <div class="card mb-4">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div class="flex-1">
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                        <Button icon="pi pi-arrow-left" text rounded @click="$router.push('/animals/care-plans')" />
                        <span class="text-surface-500 dark:text-surface-400">{{ plan.plan_code }}</span>
                        <Tag :value="plan.status" :severity="getStatusSeverity(plan.status)" />
                        <Tag :value="formatPlanType(plan.plan_type)" :severity="getPlanTypeSeverity(plan.plan_type)" />
                    </div>
                    <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0 m-0">{{ plan.name }}</h2>
                    <p class="text-surface-600 dark:text-surface-400 mt-2" v-if="plan.description">{{ plan.description }}</p>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <Button label="Add Task" icon="pi pi-plus" @click="openTaskDialog()" />
                    <Button label="Edit Plan" icon="pi pi-pencil" outlined @click="openEditDialog" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                    <div class="text-surface-500 dark:text-surface-400 text-sm mb-1">Animal Type</div>
                    <div class="font-medium text-surface-900 dark:text-surface-0">{{ plan.animal_type_name || 'Any' }}</div>
                    <div class="text-surface-500 dark:text-surface-400 text-sm" v-if="plan.breed_name">{{ plan.breed_name }}</div>
                </div>
                <div>
                    <div class="text-surface-500 dark:text-surface-400 text-sm mb-1">Applies To</div>
                    <div class="font-medium text-surface-900 dark:text-surface-0">{{ formatAppliesTo(plan.applies_to) }}</div>
                </div>
                <div>
                    <div class="text-surface-500 dark:text-surface-400 text-sm mb-1">Duration</div>
                    <div class="font-medium text-surface-900 dark:text-surface-0">{{ plan.total_duration_days ? `${plan.total_duration_days} days` : 'Not set' }}</div>
                </div>
                <div>
                    <div class="text-surface-500 dark:text-surface-400 text-sm mb-1">Tasks</div>
                    <div class="font-medium text-surface-900 dark:text-surface-0">{{ tasks.length }} activities</div>
                </div>
                <div>
                    <div class="text-surface-500 dark:text-surface-400 text-sm mb-1">Created By</div>
                    <div class="font-medium text-surface-900 dark:text-surface-0">{{ plan.created_by_name || 'System' }}</div>
                </div>
            </div>
        </div>

        <!-- Tasks Timeline -->
        <div class="card">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0 m-0">Care Activities Timeline</h3>
                <div class="flex gap-2">
                    <SelectButton v-model="viewMode" :options="viewModes" optionLabel="label" optionValue="value" />
                </div>
            </div>

            <!-- Timeline View -->
            <div v-if="viewMode === 'timeline'" class="care-timeline">
                <div v-for="task in sortedTasks" :key="task.id" class="timeline-item mb-3">
                    <div class="flex items-start gap-3">
                        <div class="timeline-marker" :class="getTaskClass(task)">
                            <span class="font-bold">Day {{ task.days_from_start }}</span>
                        </div>
                        <div class="grow bg-surface-50 dark:bg-surface-800 rounded-lg p-3">
                            <div class="flex justify-between items-start">
                                <div>
                                    <div class="font-medium text-lg text-surface-900 dark:text-surface-0">{{ task.task_name }}</div>
                                    <div class="text-surface-500 dark:text-surface-400 text-sm mt-1" v-if="task.description">{{ task.description }}</div>
                                    <div class="flex flex-wrap gap-2 mt-2">
                                        <Tag v-if="task.task_type" :value="formatTaskType(task.task_type)" :severity="getTaskTypeSeverity(task.task_type)" />
                                        <Tag v-if="task.is_recurring" severity="warn">
                                            <template #default>
                                                <i class="pi pi-sync mr-1"></i>
                                                Every {{ task.recurrence_interval_days }} days
                                                <span v-if="task.recurrence_end_days"> until day {{ task.recurrence_end_days }}</span>
                                            </template>
                                        </Tag>
                                        <Tag :value="task.priority" :severity="getPrioritySeverity(task.priority)" />
                                        <span class="text-surface-500 dark:text-surface-400 text-sm" v-if="task.tolerance_days_before || task.tolerance_days_after">
                                            Window: -{{ task.tolerance_days_before || 0 }} / +{{ task.tolerance_days_after || 2 }} days
                                        </span>
                                    </div>
                                    <div class="mt-2 text-sm text-surface-700 dark:text-surface-300" v-if="task.input_product_name">
                                        <strong>Input:</strong> {{ task.input_product_name }}
                                        <span v-if="task.input_quantity"> - {{ task.input_quantity }} {{ task.input_unit }}</span>
                                        <span v-if="task.input_application_method"> ({{ task.input_application_method }})</span>
                                    </div>
                                </div>
                                <div class="flex gap-1">
                                    <Button icon="pi pi-pencil" text rounded size="small" @click="openTaskDialog(task)" />
                                    <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="confirmDeleteTask(task)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="tasks.length === 0" class="text-center py-8">
                    <i class="pi pi-calendar-plus text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No tasks added yet. Click "Add Task" to get started.</p>
                </div>
            </div>

            <!-- Table View -->
            <DataTable v-else :value="sortedTasks" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="days_from_start" header="Day" sortable style="width: 5rem">
                    <template #body="{ data }">
                        <span class="font-bold">{{ data.days_from_start }}</span>
                    </template>
                </Column>
                <Column field="task_name" header="Task" sortable>
                    <template #body="{ data }">
                        <div>
                            <div class="font-medium text-surface-900 dark:text-surface-0">{{ data.task_name }}</div>
                            <div class="text-surface-500 dark:text-surface-400 text-sm" v-if="data.description">{{ data.description }}</div>
                        </div>
                    </template>
                </Column>
                <Column header="Type" style="width: 8rem">
                    <template #body="{ data }">
                        <Tag v-if="data.task_type" :value="formatTaskType(data.task_type)" :severity="getTaskTypeSeverity(data.task_type)" />
                        <span v-else class="text-surface-400">-</span>
                    </template>
                </Column>
                <Column header="Recurring" style="width: 10rem">
                    <template #body="{ data }">
                        <span v-if="data.is_recurring" class="text-surface-700 dark:text-surface-300">Every {{ data.recurrence_interval_days }} days</span>
                        <span v-else class="text-surface-500 dark:text-surface-400">One-time</span>
                    </template>
                </Column>
                <Column field="priority" header="Priority" sortable style="width: 6rem">
                    <template #body="{ data }">
                        <Tag :value="data.priority" :severity="getPrioritySeverity(data.priority)" />
                    </template>
                </Column>
                <Column header="Actions" style="width: 8rem">
                    <template #body="{ data }">
                        <div class="flex gap-1">
                            <Button icon="pi pi-pencil" text rounded size="small" @click="openTaskDialog(data)" />
                            <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="confirmDeleteTask(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Task Dialog -->
        <Dialog v-model:visible="taskDialog" :header="editingTask ? 'Edit Task' : 'Add Task'" :modal="true" :style="{ width: '600px' }">
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="md:col-span-2 flex flex-col gap-2">
                        <label for="task_name" class="font-medium">Task Name *</label>
                        <InputText id="task_name" v-model="taskForm.task_name" class="w-full" :class="{ 'p-invalid': taskSubmitted && !taskForm.task_name }" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="days_from_start" class="font-medium">Day from Start *</label>
                        <InputNumber id="days_from_start" v-model="taskForm.days_from_start" :min="0" class="w-full" :class="{ 'p-invalid': taskSubmitted && taskForm.days_from_start === null }" />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="task_type" class="font-medium">Task Type</label>
                        <Select id="task_type" v-model="taskForm.task_type" :options="taskTypeOptions" optionLabel="label" optionValue="value" placeholder="Select type" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="priority" class="font-medium">Priority</label>
                        <Select id="priority" v-model="taskForm.priority" :options="priorityOptions" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="description" class="font-medium">Description</label>
                    <Textarea id="description" v-model="taskForm.description" rows="2" class="w-full" />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="tolerance_before" class="font-medium">Days Early</label>
                        <InputNumber id="tolerance_before" v-model="taskForm.tolerance_days_before" :min="0" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="tolerance_after" class="font-medium">Days Late</label>
                        <InputNumber id="tolerance_after" v-model="taskForm.tolerance_days_after" :min="0" class="w-full" />
                    </div>
                </div>

                <!-- Recurring Options -->
                <div class="flex items-center gap-2">
                    <Checkbox id="is_recurring" v-model="taskForm.is_recurring" :binary="true" />
                    <label for="is_recurring">This is a recurring task</label>
                </div>

                <div v-if="taskForm.is_recurring" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="recurrence_interval" class="font-medium">Repeat Every (days) *</label>
                        <InputNumber id="recurrence_interval" v-model="taskForm.recurrence_interval_days" :min="1" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="recurrence_end" class="font-medium">End at Day</label>
                        <InputNumber id="recurrence_end" v-model="taskForm.recurrence_end_days" :min="1" placeholder="Until plan ends" class="w-full" />
                        <small class="text-surface-500">Leave blank to continue until plan ends</small>
                    </div>
                </div>

                <!-- Input Application Fields -->
                <Divider align="left"><span class="text-surface-500">Input/Treatment (Optional)</span></Divider>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="input_product" class="font-medium">Product/Medicine Name</label>
                        <InputText id="input_product" v-model="taskForm.input_product_name" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="input_method" class="font-medium">Application Method</label>
                        <InputText id="input_method" v-model="taskForm.input_application_method" placeholder="e.g., Injection, Oral, Topical" class="w-full" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="input_quantity" class="font-medium">Dosage/Quantity</label>
                        <InputNumber id="input_quantity" v-model="taskForm.input_quantity" :minFractionDigits="0" :maxFractionDigits="2" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="input_unit" class="font-medium">Unit</label>
                        <InputText id="input_unit" v-model="taskForm.input_unit" placeholder="e.g., ml, mg, g" class="w-full" />
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="taskDialog = false" />
                <Button label="Save" @click="saveTask" :loading="saving" />
            </template>
        </Dialog>

        <!-- Delete Task Confirmation -->
        <Dialog v-model:visible="deleteTaskDialog" header="Confirm Delete" :modal="true" :style="{ width: '400px' }">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
                <span
                    >Are you sure you want to delete <strong>{{ deletingTask?.task_name }}</strong
                    >?</span
                >
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="deleteTaskDialog = false" />
                <Button label="Delete" severity="danger" @click="deleteTask" :loading="saving" />
            </template>
        </Dialog>

        <!-- Edit Plan Dialog -->
        <Dialog v-model:visible="editPlanDialog" header="Edit Care Plan" :modal="true" :style="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="edit_name" class="font-medium">Plan Name *</label>
                    <InputText id="edit_name" v-model="planForm.name" class="w-full" />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="edit_plan_type" class="font-medium">Plan Type</label>
                        <Select id="edit_plan_type" v-model="planForm.plan_type" :options="planTypeOptions" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="edit_applies_to" class="font-medium">Applies To</label>
                        <Select id="edit_applies_to" v-model="planForm.applies_to" :options="appliesToOptions" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="edit_duration" class="font-medium">Total Duration (days)</label>
                    <InputNumber id="edit_duration" v-model="planForm.total_duration_days" :min="1" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="edit_status" class="font-medium">Status</label>
                    <Select id="edit_status" v-model="planForm.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="edit_description" class="font-medium">Description</label>
                    <Textarea id="edit_description" v-model="planForm.description" rows="3" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" @click="editPlanDialog = false" />
                <Button label="Save" @click="updatePlan" :loading="saving" />
            </template>
        </Dialog>
    </div>

    <div v-else-if="loading" class="card flex justify-center py-8">
        <ProgressSpinner />
    </div>

    <div v-else class="card">
        <div class="text-center py-8">
            <i class="pi pi-exclamation-circle text-4xl text-surface-400 mb-4"></i>
            <p class="text-surface-600 dark:text-surface-400">Care plan not found</p>
            <Button label="Back to Plans" icon="pi pi-arrow-left" class="mt-4" @click="$router.push('/animals/care-plans')" />
        </div>
    </div>
</template>

<style scoped>
.care-timeline .timeline-item {
    position: relative;
}

.care-timeline .timeline-item::before {
    content: '';
    position: absolute;
    left: 2.5rem;
    top: 2.5rem;
    bottom: -1rem;
    width: 2px;
    background: var(--surface-border);
}

.care-timeline .timeline-item:last-child::before {
    display: none;
}

.timeline-marker {
    min-width: 5rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    text-align: center;
    font-size: 0.875rem;
}
</style>
