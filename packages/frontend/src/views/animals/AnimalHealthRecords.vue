<template>
  <div class="card">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Health Records</h2>
        <p class="text-surface-600 dark:text-surface-400">Track vaccinations, treatments, checkups, and deworming</p>
      </div>
      <Button
        label="Add Health Record"
        icon="pi pi-plus"
        @click="openNewRecordDialog"
        class="mt-4 md:mt-0"
      />
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Records</p>
            <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.total_records || 0 }}</p>
          </div>
          <i class="pi pi-file text-3xl text-blue-500"></i>
        </div>
      </div>
      <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Vaccinations</p>
            <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.vaccination_count || 0 }}</p>
          </div>
          <i class="pi pi-shield text-3xl text-green-500"></i>
        </div>
      </div>
      <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Treatments</p>
            <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.treatment_count || 0 }}</p>
          </div>
          <i class="pi pi-heart text-3xl text-orange-500"></i>
        </div>
      </div>
      <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-l-4 border-purple-500">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Cost</p>
            <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(statistics.total_cost || 0) }}</p>
          </div>
          <i class="pi pi-dollar text-3xl text-purple-500"></i>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <Select
        v-model="filters.record_type"
        :options="recordTypeOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="All Types"
        class="w-full md:w-48"
        showClear
        @change="loadRecords"
      />
      <DatePicker
        v-model="filters.start_date"
        placeholder="From Date"
        dateFormat="yy-mm-dd"
        class="w-full md:w-40"
        showClear
        @date-select="loadRecords"
        @clear-click="loadRecords"
      />
      <DatePicker
        v-model="filters.end_date"
        placeholder="To Date"
        dateFormat="yy-mm-dd"
        class="w-full md:w-40"
        showClear
        @date-select="loadRecords"
        @clear-click="loadRecords"
      />
      <InputText
        v-model="searchQuery"
        placeholder="Search animals..."
        class="w-full md:w-64"
        @input="onSearch"
      >
        <template #prefix>
          <i class="pi pi-search" />
        </template>
      </InputText>
    </div>

    <!-- Data Table -->
    <DataTable
      :value="records"
      :loading="loading"
      :paginator="true"
      :rows="15"
      :rowsPerPageOptions="[10, 15, 25, 50]"
      stripedRows
      responsiveLayout="scroll"
      class="p-datatable-sm"
    >
      <template #empty>
        <div class="text-center py-8">
          <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
          <p class="text-surface-600 dark:text-surface-400">No health records found</p>
        </div>
      </template>

      <Column field="record_date" header="Date" sortable style="width: 120px">
        <template #body="{ data }">
          {{ formatDate(data.record_date) }}
        </template>
      </Column>

      <Column field="record_type" header="Type" sortable style="width: 140px">
        <template #body="{ data }">
          <Tag :value="data.record_type" :severity="getRecordTypeSeverity(data.record_type)" />
        </template>
      </Column>

      <Column field="animal_name" header="Animal/Group" style="width: 200px">
        <template #body="{ data }">
          <div>
            <div class="font-medium">{{ data.animal_name || data.group_name }}</div>
            <div class="text-sm text-surface-500">{{ data.animal_tag || data.group_code }}</div>
            <div class="text-xs text-surface-400">{{ data.animal_type_name }}</div>
          </div>
        </template>
      </Column>

      <Column field="diagnosis" header="Diagnosis/Purpose" style="min-width: 200px">
        <template #body="{ data }">
          <div class="line-clamp-2">{{ data.diagnosis || data.treatment || '-' }}</div>
        </template>
      </Column>

      <Column field="medication" header="Medication" style="width: 180px">
        <template #body="{ data }">
          {{ data.medication || '-' }}
        </template>
      </Column>

      <Column field="veterinarian" header="Veterinarian" style="width: 160px">
        <template #body="{ data }">
          {{ data.veterinarian || '-' }}
        </template>
      </Column>

      <Column field="cost" header="Cost" sortable style="width: 120px">
        <template #body="{ data }">
          {{ data.cost ? formatCurrency(data.cost) : '-' }}
        </template>
      </Column>

      <Column field="next_followup_date" header="Next Followup" sortable style="width: 140px">
        <template #body="{ data }">
          <span v-if="data.next_followup_date">
            <Tag v-if="isOverdue(data.next_followup_date)" value="Overdue" severity="danger" />
            <span v-else>{{ formatDate(data.next_followup_date) }}</span>
          </span>
          <span v-else>-</span>
        </template>
      </Column>

      <Column header="Actions" style="width: 100px" frozen alignFrozen="right">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="pi pi-pencil"
              severity="info"
              text
              rounded
              @click="editRecord(data)"
              v-tooltip.top="'Edit'"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="confirmDelete(data)"
              v-tooltip.top="'Delete'"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Create/Edit Dialog -->
    <Dialog
      v-model:visible="recordDialog"
      :header="recordForm.id ? 'Edit Health Record' : 'Add Health Record'"
      :modal="true"
      :closable="true"
      :style="{ width: '50rem' }"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    >
      <div class="flex flex-col gap-4 mt-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="record_date">Date *</label>
            <DatePicker
              id="record_date"
              v-model="recordForm.record_date"
              dateFormat="yy-mm-dd"
              showIcon
              :class="{ 'p-invalid': submitted && !recordForm.record_date }"
            />
            <small class="p-error" v-if="submitted && !recordForm.record_date">Date is required</small>
          </div>

          <div class="flex flex-col gap-2">
            <label for="record_type">Type *</label>
            <Select
              id="record_type"
              v-model="recordForm.record_type"
              :options="recordTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select type"
              :class="{ 'p-invalid': submitted && !recordForm.record_type }"
            />
            <small class="p-error" v-if="submitted && !recordForm.record_type">Type is required</small>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label for="source_type">Source Type *</label>
          <div class="flex gap-4">
            <div class="flex items-center">
              <RadioButton
                v-model="sourceType"
                inputId="individual"
                value="individual"
                @change="clearSource"
              />
              <label for="individual" class="ml-2">Individual Animal</label>
            </div>
            <div class="flex items-center">
              <RadioButton
                v-model="sourceType"
                inputId="group"
                value="group"
                @change="clearSource"
              />
              <label for="group" class="ml-2">Animal Group</label>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2" v-if="sourceType === 'individual'">
          <label for="animal_id">Animal *</label>
          <Select
            id="animal_id"
            v-model="recordForm.animal_id"
            :options="animals"
            optionLabel="display_name"
            optionValue="id"
            placeholder="Select animal"
            filter
            :loading="loadingAnimals"
            :class="{ 'p-invalid': submitted && !recordForm.animal_id }"
          />
          <small class="p-error" v-if="submitted && !recordForm.animal_id && sourceType === 'individual'">
            Animal is required
          </small>
        </div>

        <div class="flex flex-col gap-2" v-if="sourceType === 'group'">
          <label for="animal_group_id">Animal Group *</label>
          <Select
            id="animal_group_id"
            v-model="recordForm.animal_group_id"
            :options="groups"
            optionLabel="display_name"
            optionValue="id"
            placeholder="Select group"
            filter
            :loading="loadingGroups"
            :class="{ 'p-invalid': submitted && !recordForm.animal_group_id }"
          />
          <small class="p-error" v-if="submitted && !recordForm.animal_group_id && sourceType === 'group'">
            Group is required
          </small>
        </div>

        <div class="flex flex-col gap-2">
          <label for="diagnosis">Diagnosis/Purpose</label>
          <Textarea
            id="diagnosis"
            v-model="recordForm.diagnosis"
            rows="3"
            placeholder="Enter diagnosis or purpose"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="treatment">Treatment</label>
          <Textarea
            id="treatment"
            v-model="recordForm.treatment"
            rows="3"
            placeholder="Enter treatment details"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="medication">Medication</label>
            <InputText
              id="medication"
              v-model="recordForm.medication"
              placeholder="Medication name"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="veterinarian">Veterinarian</label>
            <InputText
              id="veterinarian"
              v-model="recordForm.veterinarian"
              placeholder="Veterinarian name"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="cost">Cost</label>
            <InputNumber
              id="cost"
              v-model="recordForm.cost"
              mode="currency"
              currency="KES"
              locale="en-KE"
              placeholder="0.00"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="next_followup_date">Next Followup Date</label>
            <DatePicker
              id="next_followup_date"
              v-model="recordForm.next_followup_date"
              dateFormat="yy-mm-dd"
              showIcon
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label for="notes">Notes</label>
          <Textarea
            id="notes"
            v-model="recordForm.notes"
            rows="3"
            placeholder="Additional notes"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" icon="pi pi-times" text @click="recordDialog = false" />
        <Button
          label="Save"
          icon="pi pi-check"
          :loading="saving"
          @click="saveRecord"
        />
      </template>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog
      v-model:visible="deleteDialog"
      header="Confirm Delete"
      :modal="true"
      :closable="true"
      :style="{ width: '450px' }"
    >
      <div class="flex items-center gap-4">
        <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
        <span>Are you sure you want to delete this health record?</span>
      </div>
      <template #footer>
        <Button label="Cancel" icon="pi pi-times" text @click="deleteDialog = false" />
        <Button
          label="Delete"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="deleteRecord"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import Tag from 'primevue/tag';
import RadioButton from 'primevue/radiobutton';

const toast = useToast();

// State
const records = ref([]);
const animals = ref([]);
const groups = ref([]);
const statistics = ref({});
const loading = ref(false);
const loadingAnimals = ref(false);
const loadingGroups = ref(false);
const saving = ref(false);
const deleting = ref(false);
const recordDialog = ref(false);
const deleteDialog = ref(false);
const submitted = ref(false);
const searchQuery = ref('');
const sourceType = ref('individual');
const recordToDelete = ref(null);

const filters = ref({
  record_type: null,
  start_date: null,
  end_date: null
});

const recordForm = ref({
  id: null,
  record_date: new Date(),
  record_type: null,
  animal_id: null,
  animal_group_id: null,
  diagnosis: '',
  treatment: '',
  medication: '',
  veterinarian: '',
  cost: null,
  next_followup_date: null,
  notes: ''
});

const recordTypeOptions = [
  { label: 'Vaccination', value: 'vaccination' },
  { label: 'Treatment', value: 'treatment' },
  { label: 'Checkup', value: 'checkup' },
  { label: 'Deworming', value: 'deworming' }
];

// Methods
const loadRecords = async () => {
  loading.value = true;
  try {
    const params = {
      ...filters.value,
      start_date: filters.value.start_date ? formatDateForAPI(filters.value.start_date) : null,
      end_date: filters.value.end_date ? formatDateForAPI(filters.value.end_date) : null
    };

    const response = await animalService.getHealthRecords(params);
    records.value = response.data.data;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load health records', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const loadStatistics = async () => {
  try {
    const params = {
      start_date: filters.value.start_date ? formatDateForAPI(filters.value.start_date) : null,
      end_date: filters.value.end_date ? formatDateForAPI(filters.value.end_date) : null
    };
    const response = await animalService.getHealthStatistics(params);
    statistics.value = response.data.data;
  } catch (error) {
    console.error('Failed to load statistics:', error);
  }
};

const loadAnimals = async () => {
  loadingAnimals.value = true;
  try {
    const response = await animalService.getAnimals({ status: 'active' });
    animals.value = response.data.data.map(a => ({
      ...a,
      display_name: `${a.tag_number} - ${a.name} (${a.breed_name})`
    }));
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load animals', life: 3000 });
  } finally {
    loadingAnimals.value = false;
  }
};

const loadGroups = async () => {
  loadingGroups.value = true;
  try {
    const response = await animalService.getGroups({ status: 'active' });
    groups.value = response.data.data.map(g => ({
      ...g,
      display_name: `${g.group_code} - ${g.name} (${g.breed_name})`
    }));
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load groups', life: 3000 });
  } finally {
    loadingGroups.value = false;
  }
};

const openNewRecordDialog = () => {
  recordForm.value = {
    id: null,
    record_date: new Date(),
    record_type: null,
    animal_id: null,
    animal_group_id: null,
    diagnosis: '',
    treatment: '',
    medication: '',
    veterinarian: '',
    cost: null,
    next_followup_date: null,
    notes: ''
  };
  sourceType.value = 'individual';
  submitted.value = false;
  recordDialog.value = true;
};

const editRecord = (record) => {
  recordForm.value = {
    id: record.id,
    record_date: new Date(record.record_date),
    record_type: record.record_type,
    animal_id: record.animal_id,
    animal_group_id: record.animal_group_id,
    diagnosis: record.diagnosis || '',
    treatment: record.treatment || '',
    medication: record.medication || '',
    veterinarian: record.veterinarian || '',
    cost: record.cost,
    next_followup_date: record.next_followup_date ? new Date(record.next_followup_date) : null,
    notes: record.notes || ''
  };
  sourceType.value = record.animal_id ? 'individual' : 'group';
  submitted.value = false;
  recordDialog.value = true;
};

const saveRecord = async () => {
  submitted.value = true;

  if (!recordForm.value.record_date || !recordForm.value.record_type) {
    return;
  }

  if (sourceType.value === 'individual' && !recordForm.value.animal_id) {
    return;
  }

  if (sourceType.value === 'group' && !recordForm.value.animal_group_id) {
    return;
  }

  saving.value = true;
  try {
    const data = {
      ...recordForm.value,
      record_date: formatDateForAPI(recordForm.value.record_date),
      next_followup_date: recordForm.value.next_followup_date
        ? formatDateForAPI(recordForm.value.next_followup_date)
        : null
    };

    if (recordForm.value.id) {
      await animalService.updateHealthRecord(recordForm.value.id, data);
      toast.add({ severity: 'success', summary: 'Success', detail: 'Health record updated', life: 3000 });
    } else {
      await animalService.createHealthRecord(data);
      toast.add({ severity: 'success', summary: 'Success', detail: 'Health record created', life: 3000 });
    }

    recordDialog.value = false;
    await loadRecords();
    await loadStatistics();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to save health record',
      life: 3000
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (record) => {
  recordToDelete.value = record;
  deleteDialog.value = true;
};

const deleteRecord = async () => {
  deleting.value = true;
  try {
    await animalService.deleteHealthRecord(recordToDelete.value.id);
    toast.add({ severity: 'success', summary: 'Success', detail: 'Health record deleted', life: 3000 });
    deleteDialog.value = false;
    await loadRecords();
    await loadStatistics();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete health record', life: 3000 });
  } finally {
    deleting.value = false;
  }
};

const clearSource = () => {
  recordForm.value.animal_id = null;
  recordForm.value.animal_group_id = null;
};

const onSearch = () => {
  // Implement search if needed
};

// Formatting helpers
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateForAPI = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
};

const getRecordTypeSeverity = (type) => {
  const severities = {
    vaccination: 'success',
    treatment: 'warn',
    checkup: 'info',
    deworming: 'secondary'
  };
  return severities[type] || 'info';
};

const isOverdue = (date) => {
  return new Date(date) < new Date();
};

// Lifecycle
onMounted(() => {
  loadRecords();
  loadStatistics();
  loadAnimals();
  loadGroups();
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
