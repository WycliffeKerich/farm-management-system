<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { format, differenceInDays, parseISO } from 'date-fns';
import animalService from '@/services/animal.service';

const toast = useToast();

// State
const loading = ref(false);
const loadingTasks = ref(false);
const saving = ref(false);
const daysAhead = ref(14);
const searchQuery = ref('');
const filters = ref({
    animal_type_id: null,
    status: null
});

const alerts = ref({
    overdue_count: 0,
    due_count: 0,
    upcoming_count: 0,
    completed_count: 0,
    total_count: 0
});
const overdueTasks = ref([]);
const allTasks = ref([]);
const schedules = ref([]);
const animalTypes = ref([]);

// Options
const daysOptions = [
    { label: '7 days', value: 7 },
    { label: '14 days', value: 14 },
    { label: '30 days', value: 30 },
    { label: '60 days', value: 60 }
];

const statusFilterOptions = [
    { label: 'Pending', value: 'pending' },
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Due', value: 'due' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Completed', value: 'completed' },
    { label: 'Skipped', value: 'skipped' }
];

// Dialogs
const completeDialog = ref(false);
const skipDialog = ref(false);
const detailsDialog = ref(false);
const cancelScheduleDialog = ref(false);
const completingTask = ref(null);
const skippingTask = ref(null);
const selectedTask = ref(null);
const cancellingSchedule = ref(null);
const skipSubmitted = ref(false);

const completeForm = ref({
    quantity_treated: null,
    notes: ''
});

const skipForm = ref({
    reason: ''
});

// Computed
const filteredTasks = computed(() => {
    let result = allTasks.value.filter((t) => t.status !== 'overdue'); // Overdue shown separately

    if (filters.value.status) {
        result = result.filter((t) => t.status === filters.value.status);
    }

    if (filters.value.animal_type_id) {
        result = result.filter((t) => t.animal_type_id === filters.value.animal_type_id);
    }

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(
            (t) =>
                t.task_name.toLowerCase().includes(query) ||
                (t.animal_tag && t.animal_tag.toLowerCase().includes(query)) ||
                (t.animal_name && t.animal_name.toLowerCase().includes(query)) ||
                (t.group_name && t.group_name.toLowerCase().includes(query)) ||
                (t.plan_name && t.plan_name.toLowerCase().includes(query))
        );
    }

    return result;
});

// Methods
const loadData = async () => {
    loading.value = true;
    try {
        const [alertsRes, schedulesRes, typesRes] = await Promise.all([animalService.getCareAlertsSummary({ days_ahead: daysAhead.value }), animalService.getCareSchedules({ status: 'active' }), animalService.getAnimalTypes()]);

        alerts.value = alertsRes.data.data || {
            overdue_count: 0,
            due_count: 0,
            upcoming_count: 0,
            completed_count: 0,
            total_count: 0
        };
        schedules.value = schedulesRes.data.data || [];
        animalTypes.value = typesRes.data.data || [];

        await loadTasks();
    } catch (error) {
        console.error('Failed to load data:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load data', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const loadTasks = async () => {
    loadingTasks.value = true;
    try {
        const params = {
            days_ahead: daysAhead.value,
            animal_type_id: filters.value.animal_type_id,
            status: filters.value.status
        };

        // Clean undefined params
        Object.keys(params).forEach((key) => {
            if (params[key] === null || params[key] === undefined) {
                delete params[key];
            }
        });

        const response = await animalService.getScheduledTasks(params);
        const tasks = response.data.data || [];

        overdueTasks.value = tasks.filter((t) => t.status === 'overdue');
        allTasks.value = tasks;
    } catch (error) {
        console.error('Failed to load tasks:', error);
    } finally {
        loadingTasks.value = false;
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return format(parseISO(dateStr), 'MMM d, yyyy');
};

const getDaysOverdue = (dueDateEnd) => {
    if (!dueDateEnd) return 0;
    const diff = differenceInDays(new Date(), parseISO(dueDateEnd));
    return diff > 0 ? diff : 0;
};

const getDaysUntil = (dateStr) => {
    if (!dateStr) return 0;
    return differenceInDays(parseISO(dateStr), new Date());
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

const getStatusSeverity = (status) => {
    const severities = {
        pending: 'secondary',
        upcoming: 'info',
        due: 'warn',
        overdue: 'danger',
        completed: 'success',
        skipped: 'secondary'
    };
    return severities[status] || 'info';
};

const getPrioritySeverity = (priority) => {
    const severities = {
        low: 'secondary',
        medium: 'info',
        high: 'warn',
        urgent: 'danger'
    };
    return severities[priority] || 'info';
};

const getProgressPercent = (schedule) => {
    if (!schedule.total_tasks) return 0;
    return Math.round((schedule.completed_tasks / schedule.total_tasks) * 100);
};

const getRowClass = (data) => {
    if (data.status === 'overdue') return 'bg-red-50 dark:bg-red-900/20';
    if (data.status === 'due') return 'bg-orange-50 dark:bg-orange-900/20';
    return '';
};

const filterByStatus = (status) => {
    filters.value.status = status;
    loadTasks();
};

const clearStatusFilter = () => {
    filters.value.status = null;
    loadTasks();
};

const openCompleteDialog = (task) => {
    completingTask.value = task;
    completeForm.value = {
        quantity_treated: task.group_count || null,
        notes: ''
    };
    completeDialog.value = true;
};

const openSkipDialog = (task) => {
    skippingTask.value = task;
    skipForm.value = { reason: '' };
    skipSubmitted.value = false;
    skipDialog.value = true;
};

const openDetailsDialog = (task) => {
    selectedTask.value = task;
    detailsDialog.value = true;
};

const completeTask = async () => {
    saving.value = true;
    try {
        const data = {
            notes: completeForm.value.notes
        };

        if (completingTask.value.group_id && completeForm.value.quantity_treated) {
            await animalService.partiallyCompleteScheduledTask(completingTask.value.id, {
                ...data,
                quantity_treated: completeForm.value.quantity_treated
            });
        } else {
            await animalService.completeScheduledTask(completingTask.value.id, data);
        }

        toast.add({ severity: 'success', summary: 'Success', detail: 'Task completed', life: 3000 });
        completeDialog.value = false;
        await loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to complete task', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const skipTask = async () => {
    skipSubmitted.value = true;
    if (!skipForm.value.reason) return;

    saving.value = true;
    try {
        await animalService.skipScheduledTask(skippingTask.value.id, { reason: skipForm.value.reason });
        toast.add({ severity: 'success', summary: 'Success', detail: 'Task skipped', life: 3000 });
        skipDialog.value = false;
        await loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to skip task', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const confirmCancelSchedule = (schedule) => {
    cancellingSchedule.value = schedule;
    cancelScheduleDialog.value = true;
};

const cancelSchedule = async () => {
    saving.value = true;
    try {
        await animalService.cancelCareSchedule(cancellingSchedule.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Schedule cancelled', life: 3000 });
        cancelScheduleDialog.value = false;
        await loadData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Failed to cancel schedule', life: 3000 });
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
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Animal Care Schedules</h2>
                <p class="text-surface-600 dark:text-surface-400">Track scheduled tasks and manage care activities for animals and groups</p>
            </div>
            <router-link to="/animals/care-plans">
                <Button label="Manage Plans" icon="pi pi-cog" severity="secondary" outlined class="mt-4 md:mt-0" />
            </router-link>
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="flex-1">
                <InputText v-model="searchQuery" placeholder="Search tasks..." class="w-full" />
            </div>
            <Select v-model="daysAhead" :options="daysOptions" optionLabel="label" optionValue="value" placeholder="Time Range" class="w-full md:w-40" @change="loadTasks" />
            <Select v-model="filters.animal_type_id" :options="animalTypes" optionLabel="name" optionValue="id" placeholder="All Animal Types" class="w-full md:w-48" showClear @change="loadTasks" />
            <Select v-model="filters.status" :options="statusFilterOptions" optionLabel="label" optionValue="value" placeholder="All Statuses" class="w-full md:w-40" showClear @change="loadTasks" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div
                class="p-4 rounded-lg cursor-pointer transition-all hover:ring-2"
                :class="alerts.overdue_count > 0 ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-red-500' : 'bg-red-50 dark:bg-red-900/20 hover:ring-red-300'"
                @click="filterByStatus('overdue')"
            >
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-red-600 dark:text-red-400 text-sm font-medium">Overdue</p>
                        <p class="text-2xl font-bold" :class="alerts.overdue_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-red-900 dark:text-red-100'">{{ alerts.overdue_count }}</p>
                    </div>
                    <i class="pi pi-exclamation-circle text-3xl text-red-400"></i>
                </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg cursor-pointer transition-all hover:ring-2 hover:ring-orange-300" @click="filterByStatus('due')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-orange-600 dark:text-orange-400 text-sm font-medium">Due Now</p>
                        <p class="text-2xl font-bold text-orange-900 dark:text-orange-100">{{ alerts.due_count }}</p>
                    </div>
                    <i class="pi pi-clock text-3xl text-orange-400"></i>
                </div>
            </div>
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg cursor-pointer transition-all hover:ring-2 hover:ring-blue-300" @click="filterByStatus('upcoming')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">Upcoming</p>
                        <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ alerts.upcoming_count }}</p>
                    </div>
                    <i class="pi pi-calendar text-3xl text-blue-400"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg cursor-pointer transition-all hover:ring-2 hover:ring-green-300" @click="filterByStatus('completed')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-600 dark:text-green-400 text-sm font-medium">Completed</p>
                        <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ alerts.completed_count }}</p>
                    </div>
                    <i class="pi pi-check-circle text-3xl text-green-400"></i>
                </div>
            </div>
            <div class="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg cursor-pointer transition-all hover:ring-2 hover:ring-cyan-300" @click="clearStatusFilter">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-cyan-600 dark:text-cyan-400 text-sm font-medium">Total Tasks</p>
                        <p class="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{{ alerts.total_count }}</p>
                    </div>
                    <i class="pi pi-list text-3xl text-cyan-400"></i>
                </div>
            </div>
        </div>

        <!-- Overdue Tasks Alert -->
        <div v-if="overdueTasks.length > 0" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg">
            <div class="flex items-center gap-2 mb-4">
                <i class="pi pi-exclamation-triangle text-red-500 text-xl"></i>
                <h3 class="font-semibold text-red-700 dark:text-red-300">Overdue Tasks</h3>
            </div>
            <DataTable :value="overdueTasks" responsiveLayout="scroll" class="p-datatable-sm">
                <Column header="Task" style="min-width: 12rem">
                    <template #body="{ data }">
                        <div>
                            <div class="font-medium text-surface-900 dark:text-surface-0">{{ data.task_name }}</div>
                            <div class="text-surface-500 text-sm">
                                <span v-if="data.animal_id">
                                    <router-link :to="`/animals/${data.animal_id}`" class="text-primary hover:underline">{{ data.animal_tag || data.animal_name }}</router-link>
                                </span>
                                <span v-else-if="data.group_id">
                                    <router-link :to="`/animals/groups/${data.group_id}`" class="text-primary hover:underline">{{ data.group_name }}</router-link>
                                </span>
                                <span v-if="data.animal_type_name"> - {{ data.animal_type_name }}</span>
                            </div>
                        </div>
                    </template>
                </Column>
                <Column header="Due Date" style="min-width: 8rem">
                    <template #body="{ data }">
                        <div>
                            <div class="text-red-500 font-medium">{{ formatDate(data.planned_date) }}</div>
                            <div class="text-surface-500 text-sm">{{ getDaysOverdue(data.due_date_end) }} days overdue</div>
                        </div>
                    </template>
                </Column>
                <Column header="Type" style="min-width: 8rem">
                    <template #body="{ data }">
                        <Tag :value="formatTaskType(data.task_type)" :severity="getTaskTypeSeverity(data.task_type)" />
                    </template>
                </Column>
                <Column header="Actions" style="width: 180px">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button label="Complete" icon="pi pi-check" severity="success" size="small" @click="openCompleteDialog(data)" />
                            <Button label="Skip" icon="pi pi-times" severity="secondary" outlined size="small" @click="openSkipDialog(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Main Data Table -->
        <DataTable :value="filteredTasks" :loading="loadingTasks" :paginator="true" :rows="10" :rowsPerPageOptions="[10, 25, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm" :rowClass="getRowClass">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-check-circle text-4xl text-green-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No upcoming tasks</p>
                </div>
            </template>

            <Column field="planned_date" header="Planned Date" sortable style="min-width: 10rem">
                <template #body="{ data }">
                    <div>
                        <div class="font-medium text-surface-900 dark:text-surface-0">{{ formatDate(data.planned_date) }}</div>
                        <div class="text-surface-500 text-sm">
                            <span v-if="getDaysUntil(data.planned_date) < 0" class="text-red-500">{{ Math.abs(getDaysUntil(data.planned_date)) }} days overdue</span>
                            <span v-else-if="getDaysUntil(data.planned_date) === 0" class="text-orange-500">Due today</span>
                            <span v-else>In {{ getDaysUntil(data.planned_date) }} days</span>
                        </div>
                    </div>
                </template>
            </Column>

            <Column field="task_name" header="Task" sortable style="min-width: 12rem">
                <template #body="{ data }">
                    <div>
                        <div class="font-medium text-surface-900 dark:text-surface-0">{{ data.task_name }}</div>
                        <div class="text-surface-500 text-sm">{{ data.plan_name || '-' }}</div>
                    </div>
                </template>
            </Column>

            <Column field="task_type" header="Type" sortable style="min-width: 8rem">
                <template #body="{ data }">
                    <Tag :value="formatTaskType(data.task_type)" :severity="getTaskTypeSeverity(data.task_type)" />
                </template>
            </Column>

            <Column header="Animal/Group" style="min-width: 12rem">
                <template #body="{ data }">
                    <div v-if="data.animal_id">
                        <router-link :to="`/animals/${data.animal_id}`" class="text-primary font-medium hover:underline">
                            {{ data.animal_tag || data.animal_name }}
                        </router-link>
                        <div class="text-surface-500 text-sm">{{ data.animal_type_name }} {{ data.breed_name ? `- ${data.breed_name}` : '' }}</div>
                    </div>
                    <div v-else-if="data.group_id">
                        <router-link :to="`/animals/groups/${data.group_id}`" class="text-primary font-medium hover:underline">
                            {{ data.group_name }}
                        </router-link>
                        <div class="text-surface-500 text-sm">{{ data.animal_type_name }} ({{ data.group_count || 0 }} animals)</div>
                    </div>
                    <span v-else class="text-surface-400">-</span>
                </template>
            </Column>

            <Column field="priority" header="Priority" sortable style="min-width: 6rem">
                <template #body="{ data }">
                    <Tag :value="data.priority" :severity="getPrioritySeverity(data.priority)" />
                </template>
            </Column>

            <Column field="status" header="Status" sortable style="min-width: 6rem">
                <template #body="{ data }">
                    <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
                </template>
            </Column>

            <Column header="Actions" style="width: 120px">
                <template #body="{ data }">
                    <div class="flex gap-1" v-if="data.status !== 'completed' && data.status !== 'skipped'">
                        <Button icon="pi pi-check" severity="success" text rounded @click="openCompleteDialog(data)" v-tooltip.top="'Complete'" />
                        <Button icon="pi pi-times" severity="secondary" text rounded @click="openSkipDialog(data)" v-tooltip.top="'Skip'" />
                        <Button icon="pi pi-eye" severity="info" text rounded @click="openDetailsDialog(data)" v-tooltip.top="'Details'" />
                    </div>
                    <div v-else>
                        <Button icon="pi pi-eye" severity="info" text rounded @click="openDetailsDialog(data)" v-tooltip.top="'Details'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Active Care Schedules Section -->
        <div class="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0">Active Care Schedules</h3>
                <span class="text-surface-500">{{ schedules.length }} animals/groups with active care plans</span>
            </div>

            <div v-if="schedules.length === 0" class="text-center py-8">
                <i class="pi pi-calendar-plus text-4xl text-surface-400 mb-4"></i>
                <p class="text-surface-600 dark:text-surface-400">No active schedules</p>
                <p class="text-surface-500 text-sm">Apply care plans to animals or groups from their detail pages</p>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div v-for="schedule in schedules" :key="schedule.id" class="bg-surface-100 dark:bg-surface-800 p-4 rounded-lg">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <router-link :to="schedule.animal_id ? `/animals/${schedule.animal_id}` : `/animals/groups/${schedule.group_id}`" class="font-medium text-primary hover:underline">
                                {{ schedule.animal_tag || schedule.animal_name || schedule.group_name }}
                            </router-link>
                            <div class="text-surface-500 text-sm">{{ schedule.animal_type_name }}</div>
                            <div class="text-surface-500 text-sm">{{ schedule.plan_name }}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-semibold text-surface-900 dark:text-surface-0">{{ schedule.completed_tasks }}/{{ schedule.total_tasks }}</div>
                            <div class="text-surface-500 text-sm">tasks</div>
                        </div>
                    </div>
                    <ProgressBar :value="getProgressPercent(schedule)" :showValue="false" style="height: 0.5rem" class="mb-3" />
                    <div class="flex justify-between items-center">
                        <Tag v-if="schedule.overdue_tasks > 0" :value="`${schedule.overdue_tasks} overdue`" severity="danger" />
                        <span v-else class="text-green-500 text-sm">On track</span>
                        <Button icon="pi pi-times" severity="danger" text size="small" @click="confirmCancelSchedule(schedule)" v-tooltip.top="'Cancel Schedule'" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Complete Task Dialog -->
        <Dialog v-model:visible="completeDialog" header="Complete Task" :modal="true" :style="{ width: '450px' }">
            <div class="mb-4">
                <div class="font-medium text-lg text-surface-900 dark:text-surface-0">{{ completingTask?.task_name }}</div>
                <div class="text-surface-500">
                    {{ completingTask?.animal_tag || completingTask?.animal_name || completingTask?.group_name }}
                    <span v-if="completingTask?.animal_type_name"> - {{ completingTask.animal_type_name }}</span>
                </div>
            </div>

            <div v-if="completingTask?.group_id" class="flex flex-col gap-2 mb-4">
                <label for="quantity_treated" class="font-medium">Quantity Treated</label>
                <InputNumber id="quantity_treated" v-model="completeForm.quantity_treated" :min="1" class="w-full" />
                <small class="text-surface-500">Number of animals in the group that were treated</small>
            </div>

            <div class="flex flex-col gap-2">
                <label for="complete_notes" class="font-medium">Notes (optional)</label>
                <Textarea id="complete_notes" v-model="completeForm.notes" rows="3" placeholder="Add any notes about the completed task..." class="w-full" />
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="completeDialog = false" />
                <Button label="Mark Complete" icon="pi pi-check" severity="success" @click="completeTask" :loading="saving" />
            </template>
        </Dialog>

        <!-- Skip Task Dialog -->
        <Dialog v-model:visible="skipDialog" header="Skip Task" :modal="true" :style="{ width: '450px' }">
            <div class="mb-4">
                <div class="font-medium text-lg text-surface-900 dark:text-surface-0">{{ skippingTask?.task_name }}</div>
                <div class="text-surface-500">
                    {{ skippingTask?.animal_tag || skippingTask?.animal_name || skippingTask?.group_name }}
                    <span v-if="skippingTask?.animal_type_name"> - {{ skippingTask.animal_type_name }}</span>
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <label for="skip_reason" class="font-medium">Reason for skipping *</label>
                <Textarea id="skip_reason" v-model="skipForm.reason" rows="3" placeholder="Why is this task being skipped?" class="w-full" :class="{ 'p-invalid': skipSubmitted && !skipForm.reason }" />
                <small class="text-red-500" v-if="skipSubmitted && !skipForm.reason">Reason is required.</small>
            </div>

            <template #footer>
                <Button label="Cancel" severity="secondary" @click="skipDialog = false" />
                <Button label="Skip Task" icon="pi pi-times" severity="warn" @click="skipTask" :loading="saving" />
            </template>
        </Dialog>

        <!-- Task Details Dialog -->
        <Dialog v-model:visible="detailsDialog" header="Task Details" :modal="true" :style="{ width: '500px' }">
            <div v-if="selectedTask" class="flex flex-col gap-4">
                <div>
                    <div class="text-surface-500 text-sm mb-1">Task Name</div>
                    <div class="font-medium text-surface-900 dark:text-surface-0">{{ selectedTask.task_name }}</div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="text-surface-500 text-sm mb-1">Care Plan</div>
                        <div class="text-surface-900 dark:text-surface-0">{{ selectedTask.plan_name || '-' }}</div>
                    </div>
                    <div>
                        <div class="text-surface-500 text-sm mb-1">Task Type</div>
                        <Tag :value="formatTaskType(selectedTask.task_type)" :severity="getTaskTypeSeverity(selectedTask.task_type)" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="text-surface-500 text-sm mb-1">Planned Date</div>
                        <div class="text-surface-900 dark:text-surface-0">{{ formatDate(selectedTask.planned_date) }}</div>
                    </div>
                    <div>
                        <div class="text-surface-500 text-sm mb-1">Due Window</div>
                        <div class="text-surface-900 dark:text-surface-0">{{ formatDate(selectedTask.due_date_start) }} - {{ formatDate(selectedTask.due_date_end) }}</div>
                    </div>
                </div>

                <div v-if="selectedTask.description">
                    <div class="text-surface-500 text-sm mb-1">Description</div>
                    <div class="text-surface-900 dark:text-surface-0">{{ selectedTask.description }}</div>
                </div>

                <div v-if="selectedTask.input_type" class="bg-surface-100 dark:bg-surface-800 rounded-lg p-4">
                    <div class="font-medium mb-2">Input Requirements</div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><span class="text-surface-500">Type:</span> {{ selectedTask.input_type }}</div>
                        <div v-if="selectedTask.input_product_name"><span class="text-surface-500">Product:</span> {{ selectedTask.input_product_name }}</div>
                        <div v-if="selectedTask.input_quantity"><span class="text-surface-500">Quantity:</span> {{ selectedTask.input_quantity }} {{ selectedTask.input_unit }}</div>
                        <div v-if="selectedTask.input_application_method"><span class="text-surface-500">Method:</span> {{ selectedTask.input_application_method }}</div>
                    </div>
                </div>

                <div v-if="selectedTask.status === 'completed' || selectedTask.status === 'skipped'" class="bg-surface-100 dark:bg-surface-800 rounded-lg p-4">
                    <div class="font-medium mb-2">Completion Info</div>
                    <div class="text-sm">
                        <div><span class="text-surface-500">Status:</span> <Tag :value="selectedTask.status" :severity="getStatusSeverity(selectedTask.status)" /></div>
                        <div v-if="selectedTask.completed_at"><span class="text-surface-500">Completed:</span> {{ formatDate(selectedTask.completed_at) }}</div>
                        <div v-if="selectedTask.completed_by_name"><span class="text-surface-500">By:</span> {{ selectedTask.completed_by_name }}</div>
                        <div v-if="selectedTask.notes"><span class="text-surface-500">Notes:</span> {{ selectedTask.notes }}</div>
                        <div v-if="selectedTask.skip_reason"><span class="text-surface-500">Skip Reason:</span> {{ selectedTask.skip_reason }}</div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="Close" severity="secondary" @click="detailsDialog = false" />
            </template>
        </Dialog>

        <!-- Cancel Schedule Confirmation Dialog -->
        <Dialog v-model:visible="cancelScheduleDialog" header="Cancel Care Schedule" :modal="true" :style="{ width: '400px' }">
            <div class="flex items-start gap-3">
                <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
                <div>
                    <p>
                        Are you sure you want to cancel the care schedule for <strong>{{ cancellingSchedule?.animal_tag || cancellingSchedule?.animal_name || cancellingSchedule?.group_name }}</strong
                        >?
                    </p>
                    <p class="text-surface-500 text-sm mt-2">This will remove all pending tasks. Completed tasks will be preserved.</p>
                </div>
            </div>
            <template #footer>
                <Button label="Keep Schedule" severity="secondary" @click="cancelScheduleDialog = false" />
                <Button label="Cancel Schedule" icon="pi pi-trash" severity="danger" @click="cancelSchedule" :loading="saving" />
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

:deep(.dark .p-datatable .p-datatable-tbody > tr.dark\:bg-red-900\/20) {
    background-color: rgb(127 29 29 / 0.2) !important;
}

:deep(.dark .p-datatable .p-datatable-tbody > tr.dark\:bg-orange-900\/20) {
    background-color: rgb(124 45 18 / 0.2) !important;
}
</style>
