<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import activityService from '@/services/activity.service';
import enterpriseService from '@/services/enterprise.service';
import { useLazyTable } from '@/composables/useLazyTable';
import { ACTIVITY_STATUS_OPTIONS, ACTIVITY_TYPE_OPTIONS, activityCost, activityDate, activityStatusSeverity, activitySubject, activityTotals, activityTypeIcon, activityTypeLabel } from '@/utils/activities';
import { formatApiDate, toApiDate } from '@/utils/dates';
import { formatDateTime, formatMoney, formatNumber } from '@/utils/format';
import { validationMessage } from '@/utils/forms';
import AttachmentPanel from '@/components/attachments/AttachmentPanel.vue';

/**
 * Activities as a filterable, paged timeline: the whole farm, or one batch,
 * animal or group when `subject` fixes its filter
 */
const props = defineProps({
    /** Fixed filters, e.g. { crop_batch_id: 3 } */
    subject: { type: Object, default: () => ({}) },
    /** The subject column and the enterprise filter; off on a subject's own page */
    farmWide: { type: Boolean, default: true },
    rows: { type: Number, default: 20 }
});

const toast = useToast();

const enterprises = ref([]);
const range = ref(null);
const selected = ref(null);

const table = useLazyTable((params) => activityService.list({ ...params, ...props.subject }), {
    rows: props.rows,
    sortField: 'date',
    sortOrder: -1,
    filters: { search: '', activity_type: [], status: null, enterprise_id: null, date_from: null, date_to: null },
    onError: (error) => toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load the timeline'), life: 4000 })
});
const { data, totalRecords, loading, first, rows: pageRows, sortField, sortOrder, filters, load, onPage, onSort } = table;

const totals = computed(() => activityTotals(data.value));
const hasFilters = computed(() => !!(filters.value.search || filters.value.activity_type.length || filters.value.status || filters.value.enterprise_id || range.value));

// A range picker gives [start, end]; end stays null until the second click
watch(range, (value) => {
    filters.value.date_from = toApiDate(value?.[0]);
    filters.value.date_to = toApiDate(value?.[1] || value?.[0]);
});

// By content: a parent passing an inline object makes a new one on every render
watch(
    () => JSON.stringify(props.subject),
    () => {
        first.value = 0;
        load();
    }
);

const clearFilters = () => {
    range.value = null;
    filters.value = { search: '', activity_type: [], status: null, enterprise_id: null, date_from: null, date_to: null };
};

const loadEnterprises = async () => {
    try {
        const response = await enterpriseService.list({ limit: 100, sort: 'name', order: 'asc' });
        enterprises.value = response.data.data || [];
    } catch {
        enterprises.value = [];
    }
};

const peopleOf = (activity) => {
    if (activity.performed_by_name && activity.recorded_by_name && activity.performed_by_name !== activity.recorded_by_name) {
        return `${activity.performed_by_name} (recorded by ${activity.recorded_by_name})`;
    }
    return activity.performed_by_name || activity.recorded_by_name || '-';
};

onMounted(() => {
    if (props.farmWide) loadEnterprises();
    load();
});

defineExpose({ reload: load });
</script>

<template>
    <div>
        <div class="flex flex-col lg:flex-row lg:items-center gap-3 mb-4 flex-wrap">
            <IconField class="w-full lg:w-64">
                <InputIcon class="pi pi-search" />
                <InputText v-model="filters.search" placeholder="Search titles..." class="w-full" />
            </IconField>
            <MultiSelect v-model="filters.activity_type" :options="ACTIVITY_TYPE_OPTIONS" optionLabel="label" optionValue="value" placeholder="All types" :maxSelectedLabels="2" class="w-full lg:w-56" />
            <Select v-model="filters.status" :options="ACTIVITY_STATUS_OPTIONS" optionLabel="label" optionValue="value" placeholder="Any status" showClear class="w-full lg:w-40" />
            <Select v-if="farmWide" v-model="filters.enterprise_id" :options="enterprises" optionLabel="name" optionValue="id" placeholder="All enterprises" showClear filter class="w-full lg:w-48" />
            <DatePicker v-model="range" selectionMode="range" :manualInput="false" placeholder="Any date" showIcon showButtonBar class="w-full lg:w-64" />
            <Button v-if="hasFilters" label="Clear" icon="pi pi-filter-slash" severity="secondary" text @click="clearFilters" />
        </div>

        <DataTable
            :value="data"
            lazy
            paginator
            :first="first"
            :rows="pageRows"
            :totalRecords="totalRecords"
            :loading="loading"
            :sortField="sortField"
            :sortOrder="sortOrder"
            :rowsPerPageOptions="[10, 20, 50]"
            dataKey="id"
            stripedRows
            responsiveLayout="scroll"
            class="p-datatable-sm"
            @page="onPage"
            @sort="onSort"
            @row-click="selected = $event.data"
            rowHover
        >
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-history text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">{{ hasFilters ? 'No activities match these filters' : 'No activities recorded yet' }}</p>
                </div>
            </template>

            <Column field="date" header="Date" sortable style="width: 8rem">
                <template #body="{ data: row }">{{ formatApiDate(activityDate(row)) }}</template>
            </Column>
            <Column field="activity_type" header="Type" sortable style="min-width: 10rem">
                <template #body="{ data: row }">
                    <span class="whitespace-nowrap"><i :class="activityTypeIcon(row.activity_type)" class="mr-2 text-primary"></i>{{ activityTypeLabel(row.activity_type) }}</span>
                </template>
            </Column>
            <Column field="title" header="What" sortable style="min-width: 14rem">
                <template #body="{ data: row }">
                    <div class="font-medium">{{ row.title }}</div>
                    <div v-if="row.notes" class="text-surface-500 text-sm truncate max-w-md">{{ row.notes }}</div>
                </template>
            </Column>
            <Column v-if="farmWide" header="Subject" style="min-width: 10rem">
                <template #body="{ data: row }">
                    <router-link v-if="activitySubject(row)" :to="activitySubject(row).to" class="text-primary hover:underline whitespace-nowrap" @click.stop>
                        <i :class="activitySubject(row).icon" class="mr-1 text-xs"></i>{{ activitySubject(row).label }}
                    </router-link>
                    <span v-else class="text-surface-500">{{ row.location_name || '-' }}</span>
                </template>
            </Column>
            <Column v-if="farmWide" header="Enterprise" style="min-width: 8rem">
                <template #body="{ data: row }">{{ row.enterprise_name || '-' }}</template>
            </Column>
            <Column header="By" style="min-width: 9rem">
                <template #body="{ data: row }">{{ peopleOf(row) }}</template>
            </Column>
            <Column header="Labour (h)" class="text-right" style="width: 7rem">
                <template #body="{ data: row }">{{ row.labour_hours != null ? formatNumber(row.labour_hours) : '-' }}</template>
            </Column>
            <Column header="Cost" class="text-right" style="width: 9rem">
                <template #body="{ data: row }">{{ activityCost(row) != null ? formatMoney(activityCost(row)) : '-' }}</template>
            </Column>
            <Column field="status" header="Status" sortable style="width: 7rem">
                <template #body="{ data: row }">
                    <Tag :value="row.status" :severity="activityStatusSeverity(row.status)" />
                </template>
            </Column>

            <template #footer>
                <div v-if="data.length" class="flex justify-end gap-6 text-sm">
                    <span
                        >This page: <strong>{{ formatNumber(totals.hours) }} h</strong> labour</span
                    >
                    <span
                        ><strong>{{ formatMoney(totals.cost) }}</strong> cost</span
                    >
                </div>
            </template>
        </DataTable>

        <Dialog :visible="!!selected" @update:visible="selected = null" :header="selected?.title" modal :style="{ width: '640px' }" :breakpoints="{ '768px': '95vw' }">
            <div v-if="selected" class="flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span class="text-surface-500">Type</span>
                    <span><i :class="activityTypeIcon(selected.activity_type)" class="mr-2"></i>{{ activityTypeLabel(selected.activity_type) }}</span>
                    <span class="text-surface-500">Status</span>
                    <span><Tag :value="selected.status" :severity="activityStatusSeverity(selected.status)" /></span>
                    <span class="text-surface-500">{{ selected.occurred_on ? 'Done on' : 'Planned for' }}</span>
                    <span>{{ formatApiDate(activityDate(selected)) }}</span>
                    <template v-if="activitySubject(selected)">
                        <span class="text-surface-500">Subject</span>
                        <router-link :to="activitySubject(selected).to" class="text-primary hover:underline" @click="selected = null">{{ activitySubject(selected).label }}</router-link>
                    </template>
                    <template v-if="selected.location_name">
                        <span class="text-surface-500">Location</span>
                        <span>{{ selected.location_name }}</span>
                    </template>
                    <span class="text-surface-500">Enterprise</span>
                    <span>{{ selected.enterprise_name || '-' }}</span>
                    <span class="text-surface-500">Performed by</span>
                    <span>{{ selected.performed_by_name || '-' }}</span>
                    <span class="text-surface-500">Recorded by</span>
                    <span>{{ selected.recorded_by_name || '-' }} · {{ formatDateTime(selected.created_at) }}</span>
                    <span class="text-surface-500">Labour</span>
                    <span>{{ selected.labour_hours != null ? `${formatNumber(selected.labour_hours)} h` : '-' }}</span>
                    <span class="text-surface-500">Input cost</span>
                    <span>{{ selected.input_cost != null ? formatMoney(selected.input_cost) : '-' }}</span>
                    <span class="text-surface-500">Other cost</span>
                    <span>{{ selected.other_cost != null ? formatMoney(selected.other_cost) : '-' }}</span>
                </div>
                <p v-if="selected.notes" class="whitespace-pre-line">{{ selected.notes }}</p>

                <div>
                    <h4 class="font-semibold mb-2">Photos and documents</h4>
                    <AttachmentPanel entityType="activities" :entityId="selected.id" />
                </div>
            </div>
        </Dialog>
    </div>
</template>
