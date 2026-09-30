<script setup>
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';

/**
 * Item form fields for reordering and safety intervals: the default supplier,
 * reorder quantity, active ingredient, pre-harvest interval and withdrawal days.
 * Binds to the fields of ITEM_SUPPLY_FIELDS on the form object.
 */
defineProps({
    /** Active suppliers, from useSupplierOptions */
    suppliers: { type: Array, default: () => [] },
    /** The item's unit, shown on the reorder quantity */
    unit: { type: String, default: '' },
    /** Prefix for input ids, so two forms on a page do not clash */
    idPrefix: { type: String, default: 'item' }
});
const form = defineModel({ type: Object, required: true });

const WITHDRAWAL_FIELDS = [
    { field: 'milk_withdrawal_days', label: 'Milk' },
    { field: 'meat_withdrawal_days', label: 'Meat' },
    { field: 'egg_withdrawal_days', label: 'Eggs' }
];
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
                <label :for="`${idPrefix}_supplier`" class="font-medium">Usual Supplier</label>
                <Select :inputId="`${idPrefix}_supplier`" v-model="form.default_supplier_id" :options="suppliers" optionLabel="name" optionValue="id" placeholder="Select supplier" class="w-full" filter showClear />
            </div>
            <div class="flex flex-col gap-2">
                <label :for="`${idPrefix}_reorder`" class="font-medium">Reorder Quantity</label>
                <InputNumber :inputId="`${idPrefix}_reorder`" v-model="form.reorder_quantity" :min="0" :maxFractionDigits="2" :suffix="unit ? ` ${unit}` : ''" class="w-full" />
                <small class="text-surface-500">How much to order when stock is low</small>
            </div>
        </div>

        <fieldset class="border border-surface-200 dark:border-surface-700 rounded-lg p-4 flex flex-col gap-4">
            <legend class="px-2 font-medium">Safety intervals</legend>
            <p class="text-sm text-surface-500 -mt-2">For pesticides and veterinary medicines, from the product label. Harvests and sales inside these periods are refused.</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label :for="`${idPrefix}_ingredient`" class="font-medium">Active Ingredient</label>
                    <InputText :id="`${idPrefix}_ingredient`" v-model="form.active_ingredient" class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label :for="`${idPrefix}_phi`" class="font-medium">Pre-harvest Interval</label>
                    <InputNumber :inputId="`${idPrefix}_phi`" v-model="form.pre_harvest_interval_days" :min="0" :max="3650" suffix=" days" class="w-full" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div v-for="{ field, label } in WITHDRAWAL_FIELDS" :key="field" class="flex flex-col gap-2">
                    <label :for="`${idPrefix}_${field}`" class="font-medium">{{ label }} withdrawal</label>
                    <InputNumber :inputId="`${idPrefix}_${field}`" v-model="form[field]" :min="0" :max="3650" suffix=" days" class="w-full" />
                </div>
            </div>
        </fieldset>
    </div>
</template>
