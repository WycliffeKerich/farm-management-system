<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';

const toast = useToast();

// State
const loading = ref(false);
const saving = ref(false);
const updatingStatuses = ref(false);
const tasks = ref([]);
const animalTypes = ref([]);
const taskCounts = ref({});
const completeDialog = ref(false);
const skipDialog = ref(false);
const detailsDialog = ref(false);
const selectedTask = ref(null);
const skipSubmitted = ref(false);

// Filters
const filters = ref({
    status: null,
    task_type: null,
    priority: null,
    animal_type_id: null
});

// Forms
const completeForm = ref({
    quantity_treated: null,
    notes: ''
});

const skipForm = ref({
    reason: ''
});

// Options
const statusOptions = [
    { label: 'Pending', value: 'pending' },
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Due', value: 'due' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Completed', value: 'completed' },
    { label: 'Skipped', value: 'skipped' }
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

const priorityOptions = [
    { label: 'Urgent', value: 'urgent' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' }
];

// Methods
const loadTasks = async () => {
    loading.value = true;
    try {
        const params = { ...filters.value };
        Object.keys(params).forEach((key) => {
            if (params[key] === null || params[key] === '') {
                delete params[key];
            }
        });

        const response = await animalService.getScheduledTasks(params);
        const taskData = response.data.data || response.data || [];
        tasks.value = taskData;

        // Calculate counts from tasks data
        calculateTaskCounts(taskData);
    } catch (error) {
        console.error('Failed to load tasks:', error);
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to load tasks',
            life: 3000
        });
    } finally {
        loading.value = false;
    }
};

const calculateTaskCounts = (taskData) => {
    const counts = {
        overdue: 0,
        due: 0,
        upcoming: 0,
        completed: 0,
        pending: 0,
        total: taskData.length
    };

    taskData.forEach((task) => {
        if (task.status === 'overdue') counts.overdue++;
        else if (task.status === 'due') counts.due++;
        else if (task.status === 'upcoming') counts.upcoming++;
        else if (task.status === 'completed') counts.completed++;
        else if (task.status === 'pending') counts.pending++;
    });

    taskCounts.value = counts;
};

const loadAnimalTypes = async () => {
    try {
        const response = await animalService.getAnimalTypes();
        animalTypes.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Failed to load animal types:', error);
    }
};

const updateStatuses = async () => {
    updatingStatuses.value = true;
    try {
        await animalService.updateScheduledTaskStatuses();
        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Task statuses updated',
            life: 3000
        });
        loadTasks();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to update statuses',
            life: 3000
        });
    } finally {
        updatingStatuses.value = false;
    }
};

const filterByStatus = (status) => {
    filters.value.status = status;
    loadTasks();
};

const clearFilters = () => {
    filters.value = {
        status: null,
        task_type: null,
        priority: null,
        animal_type_id: null
    };
    loadTasks();
};

const openCompleteDialog = (task) => {
    selectedTask.value = task;
    completeForm.value = {
        quantity_treated: task.quantity_total,
        notes: ''
    };
    completeDialog.value = true;
};

const completeTask = async () => {
    saving.value = true;
    try {
        await animalService.completeScheduledTask(selectedTask.value.id, {
            notes: completeForm.value.notes,
            quantity_treated: completeForm.value.quantity_treated
        });

        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Task completed',
            life: 3000
        });

        completeDialog.value = false;
        loadTasks();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to complete task',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const openSkipDialog = (task) => {
    selectedTask.value = task;
    skipForm.value = { reason: '' };
    skipSubmitted.value = false;
    skipDialog.value = true;
};

const skipTask = async () => {
    skipSubmitted.value = true;

    if (!skipForm.value.reason) {
        return;
    }

    saving.value = true;
    try {
        await animalService.skipScheduledTask(selectedTask.value.id, {
            reason: skipForm.value.reason
        });

        toast.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Task skipped',
            life: 3000
        });

        skipDialog.value = false;
        loadTasks();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to skip task',
            life: 3000
        });
    } finally {
        saving.value = false;
    }
};

const viewTaskDetails = (task) => {
    selectedTask.value = task;
    detailsDialog.value = true;
};

const isActionable = (status) => {
    return ['pending', 'upcoming', 'due', 'overdue'].includes(status);
};

// Utility functions
const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
};

const getDaysUntil = (date) => {
    if (!date) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    return `In ${diffDays} days`;
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
    return types[type] || type;
};

const getTaskTypeSeverity = (type) => {
    switch (type) {
        case 'vaccination':
            return 'info';
        case 'deworming':
            return 'warn';
        case 'health_check':
            return 'success';
        case 'medication':
            return 'danger';
        default:
            return 'secondary';
    }
};

const formatStatus = (status) => {
    const statuses = {
        pending: 'Pending',
        upcoming: 'Upcoming',
        due: 'Due',
        overdue: 'Overdue',
        completed: 'Completed',
        skipped: 'Skipped',
        partially_completed: 'Partial'
    };
    return statuses[status] || status;
};

const getStatusSeverity = (status) => {
    switch (status) {
        case 'completed':
            return 'success';
        case 'upcoming':
            return 'info';
        case 'due':
            return 'warn';
        case 'overdue':
            return 'danger';
        case 'skipped':
            return 'secondary';
        default:
            return 'secondary';
    }
};

const getPrioritySeverity = (priority) => {
    switch (priority) {
        case 'urgent':
            return 'danger';
        case 'high':
            return 'warn';
        case 'medium':
            return 'info';
        case 'low':
            return 'secondary';
        default:
            return 'secondary';
    }
};

const getRowClass = (data) => {
    if (data.status === 'overdue') return 'bg-red-50 dark:bg-red-900/10';
    if (data.status === 'due') return 'bg-orange-50 dark:bg-orange-900/10';
    return '';
};

// Lifecycle
onMounted(() => {
    loadTasks();
    loadAnimalTypes();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Scheduled Animal Tasks</h2>
                <p class="text-surface-600 dark:text-surface-400">View and manage upcoming care tasks for animals</p>
            </div>
            <div class="flex gap-2 mt-4 md:mt-0">
                <Button label="Update Statuses" icon="pi pi-refresh" severity="secondary" @click="updateStatuses" :loading="updatingStatuses" />
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="All Statuses" class="w-full md:w-48" showClear @change="loadTasks" />
            <Select v-model="filters.task_type" :options="taskTypeOptions" optionLabel="label" optionValue="value" placeholder="All Task Types" class="w-full md:w-48" showClear @change="loadTasks" />
            <Select v-model="filters.priority" :options="priorityOptions" optionLabel="label" optionValue="value" placeholder="All Priorities" class="w-full md:w-48" showClear @change="loadTasks" />
            <Select v-model="filters.animal_type_id" :options="animalTypes" optionLabel="name" optionValue="id" placeholder="All Animal Types" class="w-full md:w-48" showClear @change="loadTasks" />
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30" @click="filterByStatus('overdue')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-red-600 dark:text-red-400 text-sm font-medium">Overdue</p>
                        <p class="text-2xl font-bold text-red-900 dark:text-red-100">{{ taskCounts.overdue || 0 }}</p>
                    </div>
                    <i class="pi pi-exclamation-circle text-3xl text-red-400"></i>
                </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30" @click="filterByStatus('due')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-orange-600 dark:text-orange-400 text-sm font-medium">Due Now</p>
                        <p class="text-2xl font-bold text-orange-900 dark:text-orange-100">{{ taskCounts.due || 0 }}</p>
                    </div>
                    <i class="pi pi-clock text-3xl text-orange-400"></i>
                </div>
            </div>
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30" @click="filterByStatus('upcoming')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Upcoming</p>
                        <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ taskCounts.upcoming || 0 }}</p>
                    </div>
                    <i class="pi pi-calendar text-3xl text-blue-400"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30" @click="filterByStatus('completed')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-600 dark:text-green-400 text-sm font-medium">Completed</p>
                        <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ taskCounts.completed || 0 }}</p>
                    </div>
                    <i class="pi pi-check-circle text-3xl text-green-400"></i>
                </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/30" @click="clearFilters">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 dark:text-gray-400 text-sm font-medium">Total</p>
                        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ taskCounts.total || 0 }}</p>
                    </div>
                    <i class="pi pi-list text-3xl text-gray-400"></i>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <DataTable :value="tasks" :loading="loading" :paginator="true" :rows="15" :rowsPerPageOptions="[10, 15, 25, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm" :rowClass="getRowClass">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-check-circle text-4xl text-green-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No tasks found</p>
                </div>
            </template>

            <Column field="planned_date" header="Date" sortable style="width: 120px">
                <template #body="{ data }">
                    <div>
                        <div class="font-medium">{{ formatDate(data.planned_date) }}</div>
                        <div class="text-surface-500 text-xs">{{ getDaysUntil(data.planned_date) }}</div>
                    </div>
                </template>
            </Column>

            <Column field="task_name" header="Task" sortable>
                <template #body="{ data }">
                    <div>
                        <div class="font-medium">{{ data.task_name }}</div>
                        <div class="text-surface-500 text-sm">{{ data.plan_name }}</div>
                    </div>
                </template>
            </Column>

            <Column field="task_type" header="Type" sortable style="width: 130px">
                <template #body="{ data }">
                    <Tag :value="formatTaskType(data.task_type)" :severity="getTaskTypeSeverity(data.task_type)" />
                </template>
            </Column>

            <Column header="Animal/Group" style="width: 180px">
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

            <Column field="priority" header="Priority" sortable style="width: 100px">
                <template #body="{ data }">
                    <Tag :value="data.priority" :severity="getPrioritySeverity(data.priority)" />
                </template>
            </Column>

            <Column field="status" header="Status" sortable style="width: 130px">
                <template #body="{ data }">
                    <Tag :severity="getStatusSeverity(data.status)" :value="formatStatus(data.status)" />
                </template>
            </Column>

            <Column header="Actions" style="width: 150px">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button v-if="isActionable(data.status)" icon="pi pi-check" severity="success" text rounded @click="openCompleteDialog(data)" v-tooltip.top="'Complete'" />
                        <Button v-if="isActionable(data.status)" icon="pi pi-forward" severity="warn" text rounded @click="openSkipDialog(data)" v-tooltip.top="'Skip'" />
                        <Button icon="pi pi-eye" severity="info" text rounded @click="viewTaskDetails(data)" v-tooltip.top="'Details'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Complete Task Dialog -->
        <Dialog v-model:visible="completeDialog" header="Complete Task" :modal="true" :style="{ width: '500px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
                    <p class="font-medium">{{ selectedTask?.task_name }}</p>
                    <p class="text-surface-500 text-sm">{{ selectedTask?.animal_tag || selectedTask?.group_name }}</p>
                </div>

                <div v-if="selectedTask?.animal_group_id" class="flex flex-col gap-2">
                    <label for="quantity_treated" class="font-medium">Quantity Treated</label>
                    <InputNumber id="quantity_treated" v-model="completeForm.quantity_treated" :min="1" :max="selectedTask?.quantity_total" class="w-full" />
                    <small class="text-surface-500">Total in group: {{ selectedTask?.quantity_total }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="completion_notes" class="font-medium">Notes</label>
                    <Textarea id="completion_notes" v-model="completeForm.notes" rows="3" class="w-full" placeholder="Optional notes about the completed task..." />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="completeDialog = false" :disabled="saving" />
                <Button label="Complete Task" severity="success" @click="completeTask" :loading="saving" />
            </template>
        </Dialog>

        <!-- Skip Task Dialog -->
        <Dialog v-model:visible="skipDialog" header="Skip Task" :modal="true" :style="{ width: '450px' }" :closable="!saving">
            <div class="flex flex-col gap-4">
                <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
                    <p class="font-medium">{{ selectedTask?.task_name }}</p>
                    <p class="text-surface-500 text-sm">{{ selectedTask?.animal_tag || selectedTask?.group_name }}</p>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="skip_reason" class="font-medium">Reason for Skipping *</label>
                    <Textarea id="skip_reason" v-model="skipForm.reason" rows="3" class="w-full" :class="{ 'p-invalid': skipSubmitted && !skipForm.reason }" />
                    <small v-if="skipSubmitted && !skipForm.reason" class="text-red-500"> Reason is required </small>
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="skipDialog = false" :disabled="saving" />
                <Button label="Skip Task" severity="warn" @click="skipTask" :loading="saving" />
            </template>
        </Dialog>

        <!-- Task Details Dialog -->
        <Dialog v-model:visible="detailsDialog" header="Task Details" :modal="true" :style="{ width: '550px' }">
            <div v-if="selectedTask" class="flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-surface-500 text-sm">Task Name</p>
                        <p class="font-medium">{{ selectedTask.task_name }}</p>
                    </div>
                    <div>
                        <p class="text-surface-500 text-sm">Care Plan</p>
                        <p class="font-medium">{{ selectedTask.plan_name }}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-surface-500 text-sm">Planned Date</p>
                        <p class="font-medium">{{ formatDate(selectedTask.planned_date) }}</p>
                    </div>
                    <div>
                        <p class="text-surface-500 text-sm">Due Window</p>
                        <p class="font-medium">{{ formatDate(selectedTask.due_date_start) }} - {{ formatDate(selectedTask.due_date_end) }}</p>
                    </div>
                </div>

                <div v-if="selectedTask.description">
                    <p class="text-surface-500 text-sm">Description</p>
                    <p>{{ selectedTask.description }}</p>
                </div>

                <div v-if="selectedTask.input_product_name" class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p class="font-medium mb-2">Input Required</p>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span class="text-surface-500">Product:</span>
                            <span class="ml-2">{{ selectedTask.input_product_name }}</span>
                        </div>
                        <div>
                            <span class="text-surface-500">Type:</span>
                            <span class="ml-2">{{ selectedTask.input_type }}</span>
                        </div>
                        <div v-if="selectedTask.input_dosage_per_animal">
                            <span class="text-surface-500">Dosage:</span>
                            <span class="ml-2">{{ selectedTask.input_dosage_per_animal }}</span>
                        </div>
                        <div v-if="selectedTask.input_application_method">
                            <span class="text-surface-500">Method:</span>
                            <span class="ml-2">{{ selectedTask.input_application_method }}</span>
                        </div>
                    </div>
                </div>

                <div v-if="selectedTask.status === 'completed'" class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p class="font-medium mb-2">Completion Info</p>
                    <div class="text-sm">
                        <p><span class="text-surface-500">Completed:</span> {{ formatDate(selectedTask.actual_date) }}</p>
                        <p v-if="selectedTask.completed_by_name"><span class="text-surface-500">By:</span> {{ selectedTask.completed_by_name }}</p>
                        <p v-if="selectedTask.completion_notes"><span class="text-surface-500">Notes:</span> {{ selectedTask.completion_notes }}</p>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="Close" @click="detailsDialog = false" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
:deep(.p-datatable .p-datatable-tbody > tr.bg-red-50) {
    background-color: rgb(254 242 242) !important;
}
:deep(.p-datatable .p-datatable-tbody > tr.bg-orange-50) {
    background-color: rgb(255 247 237) !important;
}
</style>
