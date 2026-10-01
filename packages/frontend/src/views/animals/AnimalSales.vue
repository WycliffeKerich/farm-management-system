<script setup>
import { computed, ref, onMounted, watch } from 'vue';
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
import { formatApiDate, fromApiDate, toApiDate } from '@/utils/dates';
import { validationMessage } from '@/utils/forms';
import { holdProducts } from '@/utils/withdrawals';
import { useActiveHolds } from '@/composables/useActiveHolds';
import { useWithdrawalGuard } from '@/composables/useWithdrawalGuard';
import WithdrawalDialog from '@/components/withdrawals/WithdrawalDialog.vue';

const toast = useToast();
const holds = useActiveHolds();
const withdrawalGuard = useWithdrawalGuard();

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
    payment_status: null,
    start_date: null,
    end_date: null
});

const recordForm = ref({
    id: null,
    sale_date: new Date(),
    reference_type: 'animal',
    reference_id: null,
    customer_name: '',
    product_type: '',
    product_description: '',
    quantity: 1,
    unit: 'head',
    unit_price: null,
    total_amount: null,
    payment_method: '',
    payment_status: 'paid',
    notes: ''
});

const paymentStatusOptions = [
    { label: 'Paid', value: 'paid' },
    { label: 'Pending', value: 'pending' },
    { label: 'Partial', value: 'partial' }
];

const paymentMethods = ['Cash', 'M-Pesa', 'Bank Transfer', 'Cheque', 'Credit'];
const unitOptions = ['head', 'kg', 'lbs', 'pieces'];

// Methods
const loadRecords = async () => {
    loading.value = true;
    try {
        const params = {
            ...filters.value,
            start_date: filters.value.start_date ? toApiDate(filters.value.start_date) : null,
            end_date: filters.value.end_date ? toApiDate(filters.value.end_date) : null
        };

        const response = await animalService.getAnimalSales(params);
        records.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to load sales records', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const loadStatistics = async () => {
    try {
        const params = {
            start_date: filters.value.start_date ? toApiDate(filters.value.start_date) : null,
            end_date: filters.value.end_date ? toApiDate(filters.value.end_date) : null
        };
        const response = await animalService.getAnimalSalesStatistics(params);
        statistics.value = response.data.data;
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
};

const loadAnimals = async () => {
    loadingAnimals.value = true;
    try {
        const response = await animalService.getAnimals({ status: 'active' });
        animals.value = response.data.data.map((a) => ({
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
        groups.value = response.data.data.map((g) => ({
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
        sale_date: new Date(),
        reference_type: 'animal',
        reference_id: null,
        customer_name: '',
        product_type: '',
        product_description: '',
        quantity: 1,
        unit: 'head',
        unit_price: null,
        total_amount: null,
        payment_method: '',
        payment_status: 'paid',
        notes: ''
    };
    sourceType.value = 'individual';
    submitted.value = false;
    recordDialog.value = true;
    holds.load();
};

// Today's meat withdrawal on the chosen animal or group: a sold animal may be slaughtered
const sourceHold = computed(() => {
    const id = recordForm.value.reference_id;
    if (!id) return null;
    const entries = sourceType.value === 'individual' ? holds.forAnimal(id) : holds.forGroup(id);
    return entries.find((entry) => entry.product === 'meat') || null;
});

const editRecord = (record) => {
    recordForm.value = {
        id: record.id,
        sale_date: fromApiDate(record.sale_date),
        reference_type: record.reference_type,
        reference_id: record.reference_id,
        customer_name: record.customer_name || '',
        product_type: record.product_type || '',
        product_description: record.product_description || '',
        quantity: record.quantity,
        unit: record.unit,
        unit_price: record.unit_price,
        total_amount: record.total_amount,
        payment_method: record.payment_method || '',
        payment_status: record.payment_status,
        notes: record.notes || ''
    };
    sourceType.value = record.reference_type === 'animal' ? 'individual' : 'group';
    submitted.value = false;
    recordDialog.value = true;
    holds.load();
};

const calculateTotal = () => {
    if (recordForm.value.quantity && recordForm.value.unit_price) {
        recordForm.value.total_amount = recordForm.value.quantity * recordForm.value.unit_price;
    }
};

const saveRecord = async () => {
    submitted.value = true;

    if (!recordForm.value.sale_date || !recordForm.value.reference_id || !recordForm.value.quantity || !recordForm.value.unit || !recordForm.value.unit_price || !recordForm.value.payment_status) {
        return;
    }

    saving.value = true;
    try {
        const data = {
            ...recordForm.value,
            reference_type: sourceType.value === 'individual' ? 'animal' : 'animal_group',
            sale_date: toApiDate(recordForm.value.sale_date)
        };

        const id = recordForm.value.id;
        const submit = (override) => (id ? animalService.updateAnimalSale(id, { ...data, ...override }) : animalService.createAnimalSale({ ...data, ...override }));
        await withdrawalGuard.attempt(submit, async () => {
            toast.add({ severity: 'success', summary: 'Success', detail: id ? 'Sale record updated' : 'Sale recorded successfully', life: 3000 });
            recordDialog.value = false;
            await loadRecords();
            await loadStatistics();
            await loadAnimals(); // Reload to update available animals
        });
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: validationMessage(error, 'Failed to save sale record'),
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
        await animalService.deleteAnimalSale(recordToDelete.value.id);
        toast.add({ severity: 'success', summary: 'Success', detail: 'Sale record deleted', life: 3000 });
        deleteDialog.value = false;
        await loadRecords();
        await loadStatistics();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete sale record', life: 3000 });
    } finally {
        deleting.value = false;
    }
};

const clearSource = () => {
    recordForm.value.reference_id = null;
};

const onSearch = () => {
    // Implement search if needed
};

// Formatting helpers
const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
};

const formatNumber = (value) => {
    return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value);
};

const getPaymentStatusSeverity = (status) => {
    const severities = {
        paid: 'success',
        pending: 'warn',
        partial: 'info'
    };
    return severities[status] || 'info';
};

// Watch for quantity and price changes to auto-calculate total
watch(
    () => [recordForm.value.quantity, recordForm.value.unit_price],
    () => {
        calculateTotal();
    }
);

// Lifecycle
onMounted(() => {
    loadRecords();
    loadStatistics();
    loadAnimals();
    loadGroups();
});
</script>

<template>
    <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Livestock Sales</h2>
                <p class="text-surface-600 dark:text-surface-400">Track animal and livestock sales</p>
            </div>
            <Button label="Record Sale" icon="pi pi-plus" @click="openNewRecordDialog" class="mt-4 md:mt-0" />
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Sales</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.total_sales || 0 }}</p>
                    </div>
                    <i class="pi pi-shopping-cart text-3xl text-blue-500"></i>
                </div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Total Revenue</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(statistics.total_revenue || 0) }}</p>
                    </div>
                    <i class="pi pi-dollar text-3xl text-green-500"></i>
                </div>
            </div>
            <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-l-4 border-purple-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Paid</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(statistics.paid_revenue || 0) }}</p>
                    </div>
                    <i class="pi pi-check-circle text-3xl text-purple-500"></i>
                </div>
            </div>
            <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Pending</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ formatCurrency(statistics.pending_revenue || 0) }}</p>
                    </div>
                    <i class="pi pi-clock text-3xl text-orange-500"></i>
                </div>
            </div>
            <div class="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg border-l-4 border-cyan-500">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-surface-600 dark:text-surface-400 text-sm font-medium">Animals Sold</p>
                        <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ statistics.total_quantity_sold || 0 }}</p>
                    </div>
                    <i class="pi pi-box text-3xl text-cyan-500"></i>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <Select v-model="filters.payment_status" :options="paymentStatusOptions" optionLabel="label" optionValue="value" placeholder="All Payment Status" class="w-full md:w-48" showClear @change="loadRecords" />
            <DatePicker v-model="filters.start_date" placeholder="From Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <DatePicker v-model="filters.end_date" placeholder="To Date" dateFormat="yy-mm-dd" class="w-full md:w-40" showClear @date-select="loadRecords" @clear-click="loadRecords" />
            <InputText v-model="searchQuery" placeholder="Search customer..." class="w-full md:w-64" @input="onSearch">
                <template #prefix>
                    <i class="pi pi-search" />
                </template>
            </InputText>
        </div>

        <!-- Data Table -->
        <DataTable :value="records" :loading="loading" :paginator="true" :rows="15" :rowsPerPageOptions="[10, 15, 25, 50]" stripedRows responsiveLayout="scroll" class="p-datatable-sm">
            <template #empty>
                <div class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-600 dark:text-surface-400">No sales records found</p>
                </div>
            </template>

            <Column field="sale_date" header="Date" sortable style="width: 120px">
                <template #body="{ data }">
                    {{ formatDate(data.sale_date) }}
                </template>
            </Column>

            <Column field="customer_name" header="Customer" sortable style="width: 180px">
                <template #body="{ data }">
                    {{ data.customer_name || '-' }}
                </template>
            </Column>

            <Column field="animal_info" header="Animal/Group" style="width: 200px">
                <template #body="{ data }">
                    <div>
                        <div class="font-medium">{{ data.animal_name || data.group_name }}</div>
                        <div class="text-sm text-surface-500">{{ data.animal_tag || data.group_code }}</div>
                        <div class="text-xs text-surface-400">{{ data.animal_type_name }}</div>
                    </div>
                </template>
            </Column>

            <Column field="product_description" header="Description" style="min-width: 180px">
                <template #body="{ data }">
                    <div class="line-clamp-2">{{ data.product_description || data.product_type || '-' }}</div>
                </template>
            </Column>

            <Column field="quantity" header="Quantity" sortable style="width: 100px">
                <template #body="{ data }"> {{ formatNumber(data.quantity) }} {{ data.unit }} </template>
            </Column>

            <Column field="unit_price" header="Unit Price" sortable style="width: 120px">
                <template #body="{ data }">
                    {{ formatCurrency(data.unit_price) }}
                </template>
            </Column>

            <Column field="total_amount" header="Total" sortable style="width: 130px">
                <template #body="{ data }">
                    <span class="font-semibold">{{ formatCurrency(data.total_amount) }}</span>
                </template>
            </Column>

            <Column field="payment_status" header="Payment" sortable style="width: 120px">
                <template #body="{ data }">
                    <Tag :value="data.payment_status" :severity="getPaymentStatusSeverity(data.payment_status)" />
                </template>
            </Column>

            <Column field="payment_method" header="Method" style="width: 120px">
                <template #body="{ data }">
                    {{ data.payment_method || '-' }}
                </template>
            </Column>

            <Column header="Actions" style="width: 100px" frozen alignFrozen="right">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-pencil" severity="info" text rounded @click="editRecord(data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" v-tooltip.top="'Delete'" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Create/Edit Dialog -->
        <Dialog v-model:visible="recordDialog" :header="recordForm.id ? 'Edit Sale Record' : 'Record Sale'" :modal="true" :closable="true" :style="{ width: '55rem' }" :breakpoints="{ '1199px': '75vw', '575px': '90vw' }">
            <div class="flex flex-col gap-4 mt-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="sale_date">Sale Date *</label>
                        <DatePicker id="sale_date" v-model="recordForm.sale_date" dateFormat="yy-mm-dd" showIcon :class="{ 'p-invalid': submitted && !recordForm.sale_date }" />
                        <small class="p-error" v-if="submitted && !recordForm.sale_date">Date is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="customer_name">Customer Name</label>
                        <InputText id="customer_name" v-model="recordForm.customer_name" placeholder="Customer or buyer name" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="source_type">Source Type *</label>
                    <div class="flex gap-4">
                        <div class="flex items-center">
                            <RadioButton v-model="sourceType" inputId="individual" value="individual" @change="clearSource" />
                            <label for="individual" class="ml-2">Individual Animal</label>
                        </div>
                        <div class="flex items-center">
                            <RadioButton v-model="sourceType" inputId="group" value="group" @change="clearSource" />
                            <label for="group" class="ml-2">Animal Group</label>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-2" v-if="sourceType === 'individual'">
                    <label for="animal_id">Animal *</label>
                    <Select
                        id="animal_id"
                        v-model="recordForm.reference_id"
                        :options="animals"
                        optionLabel="display_name"
                        optionValue="id"
                        placeholder="Select animal to sell"
                        filter
                        :loading="loadingAnimals"
                        :class="{ 'p-invalid': submitted && !recordForm.reference_id }"
                    />
                    <small class="p-error" v-if="submitted && !recordForm.reference_id && sourceType === 'individual'"> Animal is required </small>
                </div>

                <div class="flex flex-col gap-2" v-if="sourceType === 'group'">
                    <label for="animal_group_id">Animal Group *</label>
                    <Select
                        id="animal_group_id"
                        v-model="recordForm.reference_id"
                        :options="groups"
                        optionLabel="display_name"
                        optionValue="id"
                        placeholder="Select group to sell from"
                        filter
                        :loading="loadingGroups"
                        :class="{ 'p-invalid': submitted && !recordForm.reference_id }"
                    />
                    <small class="p-error" v-if="submitted && !recordForm.reference_id && sourceType === 'group'"> Group is required </small>
                </div>
                <small v-if="sourceHold" class="text-orange-600 dark:text-orange-400 -mt-2"> Meat withdrawal ({{ holdProducts(sourceHold) }}): safe to sell for slaughter from {{ formatApiDate(sourceHold.safe_from) }}. </small>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="product_type">Product Type</label>
                        <InputText id="product_type" v-model="recordForm.product_type" placeholder="e.g., Live animal, Meat" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="payment_method">Payment Method</label>
                        <Select id="payment_method" v-model="recordForm.payment_method" :options="paymentMethods" placeholder="Select payment method" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="product_description">Description</label>
                    <Textarea id="product_description" v-model="recordForm.product_description" rows="2" placeholder="Product description or details" />
                </div>

                <div class="grid grid-cols-3 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="quantity">Quantity *</label>
                        <InputNumber id="quantity" v-model="recordForm.quantity" placeholder="0" :min="1" :class="{ 'p-invalid': submitted && !recordForm.quantity }" @input="calculateTotal" />
                        <small class="p-error" v-if="submitted && !recordForm.quantity">Quantity is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="unit">Unit *</label>
                        <Select id="unit" v-model="recordForm.unit" :options="unitOptions" placeholder="Select unit" :class="{ 'p-invalid': submitted && !recordForm.unit }" />
                        <small class="p-error" v-if="submitted && !recordForm.unit">Unit is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="payment_status">Payment Status *</label>
                        <Select
                            id="payment_status"
                            v-model="recordForm.payment_status"
                            :options="paymentStatusOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Select status"
                            :class="{ 'p-invalid': submitted && !recordForm.payment_status }"
                        />
                        <small class="p-error" v-if="submitted && !recordForm.payment_status">Status is required</small>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="unit_price">Unit Price *</label>
                        <InputNumber id="unit_price" v-model="recordForm.unit_price" mode="currency" currency="KES" locale="en-KE" placeholder="0.00" :class="{ 'p-invalid': submitted && !recordForm.unit_price }" @input="calculateTotal" />
                        <small class="p-error" v-if="submitted && !recordForm.unit_price">Unit price is required</small>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="total_amount">Total Amount</label>
                        <InputNumber id="total_amount" v-model="recordForm.total_amount" mode="currency" currency="KES" locale="en-KE" placeholder="0.00" :disabled="recordForm.quantity && recordForm.unit_price" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="notes">Notes</label>
                    <Textarea id="notes" v-model="recordForm.notes" rows="3" placeholder="Additional notes" />
                </div>
            </div>

            <template #footer>
                <Button label="Cancel" icon="pi pi-times" text @click="recordDialog = false" />
                <Button label="Save" icon="pi pi-check" :loading="saving" @click="saveRecord" />
            </template>
        </Dialog>

        <!-- Delete Confirmation Dialog -->
        <Dialog v-model:visible="deleteDialog" header="Confirm Delete" :modal="true" :closable="true" :style="{ width: '450px' }">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle text-4xl text-orange-500"></i>
                <span>Are you sure you want to delete this sale record? This will NOT reverse the animal status.</span>
            </div>
            <template #footer>
                <Button label="Cancel" icon="pi pi-times" text @click="deleteDialog = false" />
                <Button label="Delete" icon="pi pi-trash" severity="danger" :loading="deleting" @click="deleteRecord" />
            </template>
        </Dialog>

        <WithdrawalDialog :guard="withdrawalGuard" />
    </div>
</template>

<style scoped>
.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
