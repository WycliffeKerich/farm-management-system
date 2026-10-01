<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import auditLogService from '@/services/auditLog.service';
import userService from '@/services/user.service';
import { useLazyTable } from '@/composables/useLazyTable';
import { AUDIT_ACTION_OPTIONS, AUDITED_TABLES, auditActionLabel, auditActionSeverity, auditChanges, auditRecordRoute, auditValue, tableLabel } from '@/utils/audit';
import { toApiDate } from '@/utils/dates';
import { formatDateTime } from '@/utils/format';
import { validationMessage } from '@/utils/forms';

const toast = useToast();

const tableOptions = AUDITED_TABLES.map((value) => ({ label: tableLabel(value), value }));
const users = ref([]);
const range = ref(null);
const expandedRows = ref({});

const emptyFilters = () => ({ table: null, record_id: null, changed_by: null, action: [], date_from: null, date_to: null });

const { data, totalRecords, loading, first, rows, sortField, sortOrder, filters, load, onPage, onSort } = useLazyTable((params) => auditLogService.list(params), {
    rows: 25,
    sortField: 'changed_at',
    sortOrder: -1,
    filters: emptyFilters(),
    onError: (error) => toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load the audit log'), life: 4000 })
});

const hasFilters = computed(() => Object.values(filters.value).some((value) => (Array.isArray(value) ? value.length : value != null)));

watch(range, (value) => {
    filters.value.date_from = toApiDate(value?.[0]);
    filters.value.date_to = toApiDate(value?.[1] || value?.[0]);
});

// A new page of rows starts collapsed
watch(data, () => (expandedRows.value = {}));

const clearFilters = () => {
    range.value = null;
    filters.value = emptyFilters();
};

/** Who changed it; no user means a migration, a script or the database itself */
const actor = (entry) => entry.changed_by_name || (entry.changed_by ? `User #${entry.changed_by}` : 'System');

const changedSummary = (entry) => {
    if (entry.action !== 'update') return '';
    const fields = auditChanges(entry).map((change) => change.field);
    return fields.length > 4 ? `${fields.slice(0, 4).join(', ')} and ${fields.length - 4} more` : fields.join(', ');
};

onMounted(async () => {
    load();
    try {
        const list = await userService.list();
        users.value = list.map((user) => ({ label: `${user.first_name} ${user.last_name}`.trim() || user.email, value: user.id }));
    } catch {
        users.value = [];
    }
});
</script>

<template>
    <div class="card">
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Audit Log</h2>
            <p class="text-surface-600 dark:text-surface-400">Who created, changed or removed which record, and when. Expand a row to see the values before and after.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <Select v-model="filters.table" :options="tableOptions" optionLabel="label" optionValue="value" placeholder="All records" filter showClear />
            <InputNumber v-model="filters.record_id" placeholder="Record ID" :useGrouping="false" :min="1" />
            <Select v-model="filters.changed_by" :options="users" optionLabel="label" optionValue="value" placeholder="Anyone" filter showClear />
            <MultiSelect v-model="filters.action" :options="AUDIT_ACTION_OPTIONS" optionLabel="label" optionValue="value" placeholder="Any change" display="chip" />
            <DatePicker v-model="range" selectionMode="range" :manualInput="false" placeholder="Any date" dateFormat="dd/mm/yy" showIcon showButtonBar />
            <Button v-if="hasFilters" label="Clear" icon="pi pi-filter-slash" severity="secondary" outlined @click="clearFilters" />
        </div>

        <DataTable
            v-model:expandedRows="expandedRows"
            :value="data"
            lazy
            paginator
            :first="first"
            :rows="rows"
            :rowsPerPageOptions="[25, 50, 100]"
            :totalRecords="totalRecords"
            :loading="loading"
            :sortField="sortField"
            :sortOrder="sortOrder"
            dataKey="id"
            stripedRows
            responsiveLayout="scroll"
            class="p-datatable-sm"
            @page="onPage"
            @sort="onSort"
        >
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-history text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">{{ hasFilters ? 'No changes match these filters' : 'No changes recorded yet' }}</p>
                </div>
            </template>

            <Column expander style="width: 3rem" />
            <Column field="changed_at" header="When" sortable>
                <template #body="{ data: entry }">
                    <span class="whitespace-nowrap">{{ formatDateTime(entry.changed_at) }}</span>
                </template>
            </Column>
            <Column header="Who">
                <template #body="{ data: entry }">
                    <span :class="{ 'text-surface-500 italic': !entry.changed_by }">{{ actor(entry) }}</span>
                </template>
            </Column>
            <Column header="Change">
                <template #body="{ data: entry }">
                    <Tag :value="auditActionLabel(entry.action)" :severity="auditActionSeverity(entry.action)" />
                </template>
            </Column>
            <Column header="Record">
                <template #body="{ data: entry }">
                    {{ tableLabel(entry.table_name) }}
                    <router-link v-if="auditRecordRoute(entry.table_name, entry.record_id)" :to="auditRecordRoute(entry.table_name, entry.record_id)" class="text-primary hover:underline">#{{ entry.record_id }}</router-link>
                    <span v-else class="text-surface-500">#{{ entry.record_id }}</span>
                </template>
            </Column>
            <Column header="Fields changed">
                <template #body="{ data: entry }">
                    <span class="text-surface-600 dark:text-surface-400 text-sm">{{ changedSummary(entry) }}</span>
                </template>
            </Column>

            <template #expansion="{ data: entry }">
                <div class="p-2">
                    <DataTable :value="auditChanges(entry)" class="p-datatable-sm" size="small">
                        <template #empty>
                            <div class="text-surface-500 py-2">No field values were recorded</div>
                        </template>
                        <Column field="field" header="Field" style="width: 25%">
                            <template #body="{ data: change }">
                                <code class="text-sm">{{ change.field }}</code>
                            </template>
                        </Column>
                        <Column v-if="entry.action !== 'insert'" header="Before">
                            <template #body="{ data: change }">
                                <span class="break-all" :class="{ 'line-through text-surface-500': entry.action === 'update' }">{{ auditValue(change.before) }}</span>
                            </template>
                        </Column>
                        <Column v-if="entry.action !== 'delete'" :header="entry.action === 'insert' ? 'Value' : 'After'">
                            <template #body="{ data: change }">
                                <span class="break-all">{{ auditValue(change.after) }}</span>
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </template>
        </DataTable>
    </div>
</template>
