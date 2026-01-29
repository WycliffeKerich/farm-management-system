<template>
  <div class="card">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Care Schedules</h2>
        <p class="text-surface-600 dark:text-surface-400">Track scheduled tasks and manage batch care activities</p>
      </div>
      <router-link to="/crops/care-plans">
        <Button
          label="Manage Plans"
          icon="pi pi-cog"
          severity="secondary"
          outlined
          class="mt-4 md:mt-0"
        />
      </router-link>
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="flex-1">
        <InputText
          v-model="searchQuery"
          placeholder="Search tasks..."
          class="w-full"
        />
      </div>
      <Select
        v-model="daysAhead"
        :options="daysOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Time Range"
        class="w-full md:w-40"
        @change="loadTasks"
      />
      <Select
        v-model="filters.batch_id"
        :options="batchOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="All Batches"
        class="w-full md:w-56"
        showClear
        filter
      />
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="p-4 rounded-lg" :class="alerts.overdue_count > 0 ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-red-500' : 'bg-red-50 dark:bg-red-900/20'">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-red-600 dark:text-red-400 text-sm font-medium">Overdue Tasks</p>
            <p class="text-2xl font-bold" :class="alerts.overdue_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-red-900 dark:text-red-100'">{{ alerts.overdue_count }}</p>
          </div>
          <i class="pi pi-exclamation-circle text-3xl text-red-400"></i>
        </div>
      </div>
      <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-orange-600 dark:text-orange-400 text-sm font-medium">Due Today</p>
            <p class="text-2xl font-bold text-orange-900 dark:text-orange-100">{{ todayTasks.length }}</p>
          </div>
          <i class="pi pi-calendar text-3xl text-orange-400"></i>
        </div>
      </div>
      <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-blue-600 dark:text-blue-400 text-sm font-medium">This Week</p>
            <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ alerts.upcoming_count }}</p>
          </div>
          <i class="pi pi-clock text-3xl text-blue-400"></i>
        </div>
      </div>
      <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-600 dark:text-green-400 text-sm font-medium">Active Schedules</p>
            <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ schedules.length }}</p>
          </div>
          <i class="pi pi-check-circle text-3xl text-green-400"></i>
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
              <div class="font-medium">{{ data.task_name }}</div>
              <div class="text-surface-500 text-sm">{{ data.batch_code }} - {{ data.variety_name }}</div>
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
        <Column header="Location" style="min-width: 8rem">
          <template #body="{ data }">
            {{ data.location_name || '-' }}
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

    <!-- Data Table -->
    <DataTable
      :value="filteredTasks"
      :loading="loadingTasks"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[10, 25, 50]"
      stripedRows
      responsiveLayout="scroll"
      class="p-datatable-sm"
    >
      <template #empty>
        <div class="text-center py-8">
          <i class="pi pi-check-circle text-4xl text-green-400 mb-4"></i>
          <p class="text-surface-600 dark:text-surface-400">No upcoming tasks</p>
        </div>
      </template>

      <Column field="status" header="Status" sortable style="width: 6rem">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
        </template>
      </Column>

      <Column field="task_name" header="Task" sortable style="min-width: 12rem">
        <template #body="{ data }">
          <div>
            <div class="font-medium">{{ data.task_name }}</div>
            <div class="text-surface-500 text-sm">
              <router-link :to="`/crops/batches/${data.batch_id}`" class="text-primary hover:underline">{{ data.batch_code }}</router-link>
              - {{ data.variety_name }}
            </div>
          </div>
        </template>
      </Column>

      <Column header="Care Plan" style="min-width: 10rem">
        <template #body="{ data }">
          <span class="text-surface-500">{{ data.plan_name || '-' }}</span>
        </template>
      </Column>

      <Column field="planned_date" header="Planned Date" sortable style="min-width: 10rem">
        <template #body="{ data }">
          <div>
            <div class="font-medium">{{ formatDate(data.planned_date) }}</div>
            <div class="text-surface-500 text-sm">Window: {{ formatDate(data.due_date_start) }} - {{ formatDate(data.due_date_end) }}</div>
          </div>
        </template>
      </Column>

      <Column header="Type" style="width: 8rem">
        <template #body="{ data }">
          <Tag v-if="data.input_type" :value="data.input_type" severity="info" />
          <span v-else class="text-surface-400">-</span>
        </template>
      </Column>

      <Column header="Actions" style="width: 100px">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button icon="pi pi-check" severity="success" text rounded @click="openCompleteDialog(data)" v-tooltip.top="'Complete'" />
            <Button icon="pi pi-times" severity="secondary" text rounded @click="openSkipDialog(data)" v-tooltip.top="'Skip'" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Active Batch Schedules Section -->
    <div class="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-0">Active Batch Schedules</h3>
        <span class="text-surface-500">{{ schedules.length }} batches with active care plans</span>
      </div>

      <div v-if="schedules.length === 0" class="text-center py-8">
        <i class="pi pi-calendar-plus text-4xl text-surface-400 mb-4"></i>
        <p class="text-surface-600 dark:text-surface-400">No active schedules</p>
        <p class="text-surface-500 text-sm">Apply care plans to batches from the batch detail page</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div v-for="schedule in schedules" :key="schedule.id" class="bg-surface-100 dark:bg-surface-800 p-4 rounded-lg">
          <div class="flex justify-between items-start mb-3">
            <div>
              <router-link :to="`/crops/batches/${schedule.batch_id}`" class="font-medium text-primary hover:underline">{{ schedule.batch_code }}</router-link>
              <div class="text-surface-500 text-sm">{{ schedule.variety_name }}</div>
              <div class="text-surface-500 text-sm">{{ schedule.plan_name }}</div>
            </div>
            <div class="text-right">
              <div class="font-semibold">{{ schedule.completed_tasks }}/{{ schedule.total_tasks }}</div>
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
        <div class="font-medium text-lg">{{ completingTask?.task_name }}</div>
        <div class="text-surface-500">{{ completingTask?.batch_code }} - {{ completingTask?.variety_name }}</div>
      </div>

      <div v-if="completingTask?.input_type" class="bg-surface-100 dark:bg-surface-800 rounded-lg p-4 mb-4">
        <div class="font-medium mb-2">Input Application Details</div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span class="text-surface-500">Type:</span> {{ completingTask.input_type }}
          </div>
          <div v-if="completingTask.input_product_name">
            <span class="text-surface-500">Product:</span> {{ completingTask.input_product_name }}
          </div>
          <div v-if="completingTask.input_quantity">
            <span class="text-surface-500">Quantity:</span> {{ completingTask.input_quantity }} {{ completingTask.input_unit }}
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="complete_notes" class="font-medium">Notes (optional)</label>
        <Textarea id="complete_notes" v-model="completeNotes" rows="3" placeholder="Add any notes about the completed task..." class="w-full" />
      </div>

      <template #footer>
        <Button label="Cancel" severity="secondary" @click="completeDialog = false" />
        <Button label="Mark Complete" icon="pi pi-check" severity="success" @click="completeTask" :loading="saving" />
      </template>
    </Dialog>

    <!-- Skip Task Dialog -->
    <Dialog v-model:visible="skipDialog" header="Skip Task" :modal="true" :style="{ width: '450px' }">
      <div class="mb-4">
        <div class="font-medium text-lg">{{ skippingTask?.task_name }}</div>
        <div class="text-surface-500">{{ skippingTask?.batch_code }} - {{ skippingTask?.variety_name }}</div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="skip_reason" class="font-medium">Reason for skipping *</label>
        <Textarea id="skip_reason" v-model="skipReason" rows="3" placeholder="Why is this task being skipped?" class="w-full" :class="{ 'p-invalid': skipSubmitted && !skipReason }" />
        <small class="text-red-500" v-if="skipSubmitted && !skipReason">Reason is required.</small>
      </div>

      <template #footer>
        <Button label="Cancel" severity="secondary" @click="skipDialog = false" />
        <Button label="Skip Task" icon="pi pi-times" severity="warn" @click="skipTask" :loading="saving" />
      </template>
    </Dialog>

    <!-- Cancel Schedule Confirmation Dialog -->
    <Dialog v-model:visible="cancelScheduleDialog" header="Cancel Care Schedule" :modal="true" :style="{ width: '400px' }">
      <div class="flex items-start gap-3">
        <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
        <div>
          <p>Are you sure you want to cancel the care schedule for <strong>{{ cancellingSchedule?.batch_code }}</strong>?</p>
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

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { format, differenceInDays, parseISO, isToday } from 'date-fns';
import cropService from '@/services/crop.service';

const toast = useToast();

// State
const loading = ref(false);
const loadingTasks = ref(false);
const saving = ref(false);
const daysAhead = ref(7);
const searchQuery = ref('');
const filters = ref({
  batch_id: null
});

const alerts = ref({ overdue_count: 0, upcoming_count: 0 });
const overdueTasks = ref([]);
const upcomingTasks = ref([]);
const schedules = ref([]);
const batches = ref([]);

// Options
const daysOptions = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 }
];

// Dialogs
const completeDialog = ref(false);
const skipDialog = ref(false);
const cancelScheduleDialog = ref(false);
const completingTask = ref(null);
const skippingTask = ref(null);
const cancellingSchedule = ref(null);
const completeNotes = ref('');
const skipReason = ref('');
const skipSubmitted = ref(false);

// Computed
const batchOptions = computed(() => {
  return batches.value.map(b => ({
    label: `${b.batch_code} - ${b.variety_name}`,
    value: b.id
  }));
});

const filteredTasks = computed(() => {
  let result = upcomingTasks.value;

  if (filters.value.batch_id) {
    result = result.filter(t => t.batch_id === filters.value.batch_id);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t =>
      t.task_name.toLowerCase().includes(query) ||
      t.batch_code.toLowerCase().includes(query) ||
      (t.variety_name && t.variety_name.toLowerCase().includes(query)) ||
      (t.plan_name && t.plan_name.toLowerCase().includes(query))
    );
  }

  return result;
});

const todayTasks = computed(() => {
  return upcomingTasks.value.filter(t => {
    const planned = parseISO(t.planned_date);
    return isToday(planned);
  });
});

// Methods
const loadData = async () => {
  loading.value = true;
  try {
    const [alertsRes, schedulesRes, batchesRes] = await Promise.all([
      cropService.getCareAlertsSummary(daysAhead.value),
      cropService.getAllBatchSchedules({ status: 'active' }),
      cropService.getBatches({ status: 'growing' })
    ]);

    alerts.value = alertsRes.data.data || { overdue_count: 0, upcoming_count: 0 };
    schedules.value = schedulesRes.data.data || [];
    batches.value = batchesRes.data.data || [];

    await loadTasks();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load data', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const loadTasks = async () => {
  loadingTasks.value = true;
  try {
    const [overdueRes, upcomingRes] = await Promise.all([
      cropService.getOverdueScheduledTasks(),
      cropService.getUpcomingScheduledTasks(daysAhead.value)
    ]);

    overdueTasks.value = overdueRes.data.data || [];
    upcomingTasks.value = upcomingRes.data.data || [];
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
  return differenceInDays(new Date(), parseISO(dueDateEnd));
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

const getProgressPercent = (schedule) => {
  if (!schedule.total_tasks) return 0;
  return Math.round((schedule.completed_tasks / schedule.total_tasks) * 100);
};

const openCompleteDialog = (task) => {
  completingTask.value = task;
  completeNotes.value = '';
  completeDialog.value = true;
};

const openSkipDialog = (task) => {
  skippingTask.value = task;
  skipReason.value = '';
  skipSubmitted.value = false;
  skipDialog.value = true;
};

const completeTask = async () => {
  saving.value = true;
  try {
    if (completingTask.value.input_type) {
      await cropService.completeScheduledTaskWithInput(completingTask.value.id, {
        notes: completeNotes.value
      });
    } else {
      await cropService.completeScheduledTask(completingTask.value.id, completeNotes.value);
    }
    toast.add({ severity: 'success', summary: 'Success', detail: 'Task completed', life: 3000 });
    completeDialog.value = false;
    await loadData();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to complete task', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const skipTask = async () => {
  skipSubmitted.value = true;
  if (!skipReason.value) return;

  saving.value = true;
  try {
    await cropService.skipScheduledTask(skippingTask.value.id, skipReason.value);
    toast.add({ severity: 'success', summary: 'Success', detail: 'Task skipped', life: 3000 });
    skipDialog.value = false;
    await loadData();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to skip task', life: 3000 });
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
    await cropService.cancelBatchCareSchedule(cancellingSchedule.value.batch_id);
    toast.add({ severity: 'success', summary: 'Success', detail: 'Schedule cancelled', life: 3000 });
    cancelScheduleDialog.value = false;
    await loadData();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.error?.message || 'Failed to cancel schedule', life: 3000 });
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>
