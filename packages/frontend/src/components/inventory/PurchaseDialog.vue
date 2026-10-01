<script setup>
import { computed, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import inventoryService from '@/services/inventory.service';
import { useSupplierOptions } from '@/composables/useSupplierOptions';
import { validationMessage } from '@/utils/forms';
import { emptyPurchase, formatCurrency, toPurchasePayload } from '@/utils/inventory';
import { useFormat } from '@/composables/useFormat';

/**
 * Receive a purchase of an item as a batch: the batch carries the supplier,
 * cost and expiry, and its quantity is added to stock as a purchase.
 */
const props = defineProps({
    /** The item bought: id, name, unit, and optionally default_supplier_id, cost_per_unit, location */
    item: { type: Object, default: null }
});
const visible = defineModel('visible', { type: Boolean, default: false });
const emit = defineEmits(['saved']);

const toast = useToast();
const { currency, locale } = useFormat();
const { suppliers, load: loadSuppliers } = useSupplierOptions();

const form = ref(emptyPurchase(props.item));
const submitted = ref(false);
const saving = ref(false);
let suppliersLoaded = false;

const total = computed(() => (form.value.quantity && form.value.unit_cost ? form.value.quantity * form.value.unit_cost : null));

watch(visible, (open) => {
    if (!open) return;
    form.value = emptyPurchase(props.item);
    submitted.value = false;
    if (!suppliersLoaded) {
        suppliersLoaded = true;
        loadSuppliers();
    }
});

const save = async () => {
    submitted.value = true;
    if (!props.item || !(form.value.quantity > 0)) return;

    saving.value = true;
    try {
        const response = await inventoryService.createBatch(toPurchasePayload(props.item.id, form.value));
        const batch = response.data.data;
        toast.add({ severity: 'success', summary: 'Stock received', detail: `${form.value.quantity} ${props.item.unit || ''} added as batch ${batch?.batch_number || ''}`.trim(), life: 4000 });
        visible.value = false;
        emit('saved', batch);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to receive stock'), life: 4000 });
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <Dialog v-model:visible="visible" header="Receive Stock" :modal="true" :style="{ width: '600px' }" :closable="!saving">
        <div class="flex flex-col gap-4">
            <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
                <p class="font-medium">{{ item?.name }}</p>
                <p class="text-surface-500 text-sm">
                    <span v-if="item?.current_stock != null">{{ item.current_stock }} {{ item.unit || '' }} in stock. </span>
                    The quantity is added to stock as a purchase, in its own batch.
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="purchase_qty" class="font-medium">Quantity *</label>
                    <InputNumber inputId="purchase_qty" v-model="form.quantity" :min="0.01" :maxFractionDigits="2" :suffix="item?.unit ? ` ${item.unit}` : ''" class="w-full" :class="{ 'p-invalid': submitted && !(form.quantity > 0) }" autofocus />
                    <small v-if="submitted && !(form.quantity > 0)" class="text-red-500">Quantity is required</small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="purchase_cost" class="font-medium">Unit Cost</label>
                    <InputNumber inputId="purchase_cost" v-model="form.unit_cost" :min="0" :minFractionDigits="2" mode="currency" :currency="currency" :locale="locale" class="w-full" />
                    <small v-if="total" class="text-surface-500">Total {{ formatCurrency(total) }}</small>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="purchase_supplier" class="font-medium">Supplier</label>
                    <Select inputId="purchase_supplier" v-model="form.supplier_id" :options="suppliers" optionLabel="name" optionValue="id" placeholder="Select supplier" class="w-full" filter showClear />
                    <small class="text-surface-500"> Not listed? Add it under <router-link :to="{ name: 'inventory-suppliers' }" class="text-primary hover:underline" @click="visible = false">Suppliers</router-link> </small>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="purchase_received" class="font-medium">Received Date</label>
                    <DatePicker inputId="purchase_received" v-model="form.received_date" dateFormat="yy-mm-dd" :maxDate="new Date()" class="w-full" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="purchase_mfg" class="font-medium">Manufacture Date</label>
                    <DatePicker inputId="purchase_mfg" v-model="form.manufacture_date" dateFormat="yy-mm-dd" :maxDate="new Date()" class="w-full" showButtonBar />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="purchase_expiry" class="font-medium">Expiry Date</label>
                    <DatePicker inputId="purchase_expiry" v-model="form.expiry_date" dateFormat="yy-mm-dd" :minDate="form.manufacture_date || undefined" class="w-full" showButtonBar />
                    <small class="text-surface-500">Stock is used earliest expiry first</small>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label for="purchase_batch" class="font-medium">Batch Number</label>
                    <InputText id="purchase_batch" v-model="form.batch_number" class="w-full" placeholder="Assigned if left empty" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="purchase_supplier_batch" class="font-medium">Supplier's Batch / Lot #</label>
                    <InputText id="purchase_supplier_batch" v-model="form.supplier_batch_number" class="w-full" />
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <label for="purchase_location" class="font-medium">Storage Location</label>
                <InputText id="purchase_location" v-model="form.storage_location" class="w-full" />
            </div>

            <div class="flex flex-col gap-2">
                <label for="purchase_notes" class="font-medium">Notes</label>
                <Textarea id="purchase_notes" v-model="form.notes" rows="2" class="w-full" placeholder="e.g. invoice number" />
            </div>
        </div>

        <template #footer>
            <Button label="Cancel" severity="secondary" @click="visible = false" :disabled="saving" />
            <Button label="Receive" icon="pi pi-check" @click="save" :loading="saving" />
        </template>
    </Dialog>
</template>
