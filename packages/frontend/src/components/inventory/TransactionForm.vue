<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Record Transaction"
    :modal="true"
    :style="{ width: '500px' }"
    :closable="!saving"
  >
    <div class="flex flex-col gap-4">
      <!-- Item Selection (if not pre-selected) -->
      <div v-if="!item" class="flex flex-col gap-2">
        <label for="trans_item" class="font-medium">Item *</label>
        <Select
          id="trans_item"
          v-model="form.inventory_item_id"
          :options="items"
          optionLabel="name"
          optionValue="id"
          placeholder="Select item"
          class="w-full"
          filter
          :class="{ 'p-invalid': submitted && !form.inventory_item_id }"
          @change="onItemSelect"
        >
          <template #option="{ option }">
            <div class="flex justify-between w-full">
              <span>{{ option.name }}</span>
              <span class="text-surface-500">Stock: {{ option.current_stock }}</span>
            </div>
          </template>
        </Select>
        <small v-if="submitted && !form.inventory_item_id" class="text-red-500">Item is required</small>
      </div>

      <!-- Selected Item Info -->
      <div v-if="selectedItem" class="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
        <div class="font-medium">{{ selectedItem.name }}</div>
        <div class="flex justify-between text-sm mt-2">
          <span class="text-surface-600 dark:text-surface-400">Current Stock:</span>
          <span class="font-medium" :class="{ 'text-red-500': selectedItem.current_stock <= selectedItem.minimum_stock }">
            {{ selectedItem.current_stock }} {{ selectedItem.unit_of_measure || '' }}
          </span>
        </div>
        <div class="flex justify-between text-sm mt-1">
          <span class="text-surface-600 dark:text-surface-400">Minimum Stock:</span>
          <span>{{ selectedItem.minimum_stock }} {{ selectedItem.unit_of_measure || '' }}</span>
        </div>
      </div>

      <!-- Transaction Type -->
      <div class="flex flex-col gap-2">
        <label for="trans_type" class="font-medium">Transaction Type *</label>
        <Select
          id="trans_type"
          v-model="form.transaction_type"
          :options="transactionTypeOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select type"
          class="w-full"
          :class="{ 'p-invalid': submitted && !form.transaction_type }"
        />
        <small v-if="submitted && !form.transaction_type" class="text-red-500">Type is required</small>
      </div>

      <!-- Quantity -->
      <div class="flex flex-col gap-2">
        <label for="trans_qty" class="font-medium">Quantity *</label>
        <InputNumber
          id="trans_qty"
          v-model="form.quantity"
          :min="1"
          :max="maxQuantity"
          class="w-full"
          :class="{ 'p-invalid': submitted && !form.quantity }"
          :suffix="selectedItem ? ` ${selectedItem.unit_of_measure || ''}` : ''"
        />
        <small v-if="submitted && !form.quantity" class="text-red-500">Quantity is required</small>
        <small v-if="isReducingStock && form.quantity > (selectedItem?.current_stock || 0)" class="text-red-500">
          Cannot exceed current stock ({{ selectedItem?.current_stock }})
        </small>
      </div>

      <!-- Transaction Date -->
      <div class="flex flex-col gap-2">
        <label for="trans_date" class="font-medium">Date</label>
        <DatePicker
          id="trans_date"
          v-model="form.transaction_date"
          dateFormat="yy-mm-dd"
          class="w-full"
          :maxDate="new Date()"
        />
      </div>

      <!-- Reference Fields -->
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <label for="trans_ref_type" class="font-medium">Reference Type</label>
          <Select
            id="trans_ref_type"
            v-model="form.reference_type"
            :options="referenceTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select"
            class="w-full"
            showClear
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="trans_ref_id" class="font-medium">Reference ID</label>
          <InputNumber
            id="trans_ref_id"
            v-model="form.reference_id"
            class="w-full"
            :disabled="!form.reference_type"
          />
        </div>
      </div>

      <!-- Notes -->
      <div class="flex flex-col gap-2">
        <label for="trans_notes" class="font-medium">Notes</label>
        <Textarea id="trans_notes" v-model="form.notes" rows="2" class="w-full" />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="close" :disabled="saving" />
      <Button label="Record Transaction" @click="submit" :loading="saving" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import inventoryService from '@/services/inventory.service';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  item: {
    type: Object,
    default: null
  },
  items: {
    type: Array,
    default: () => []
  },
  defaultType: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['update:visible', 'saved']);

const toast = useToast();

// State
const saving = ref(false);
const submitted = ref(false);
const form = ref({
  inventory_item_id: null,
  transaction_type: null,
  quantity: null,
  transaction_date: new Date(),
  reference_type: null,
  reference_id: null,
  notes: ''
});

// Options
const transactionTypeOptions = [
  { label: 'Purchase', value: 'purchase' },
  { label: 'Usage', value: 'usage' },
  { label: 'Adjustment (Add)', value: 'adjustment_add' },
  { label: 'Adjustment (Remove)', value: 'adjustment_remove' },
  { label: 'Transfer In', value: 'transfer_in' },
  { label: 'Transfer Out', value: 'transfer_out' },
  { label: 'Return', value: 'return' },
  { label: 'Waste/Expired', value: 'waste' }
];

const referenceTypeOptions = [
  { label: 'Crop Batch', value: 'crop_batch' },
  { label: 'Animal', value: 'animal' },
  { label: 'Animal Group', value: 'animal_group' },
  { label: 'Task', value: 'task' },
  { label: 'Purchase Order', value: 'purchase_order' }
];

// Computed
const selectedItem = computed(() => {
  if (props.item) return props.item;
  if (!form.value.inventory_item_id) return null;
  return props.items.find(i => i.id === form.value.inventory_item_id);
});

const isReducingStock = computed(() => {
  const type = form.value.transaction_type;
  return ['usage', 'adjustment_remove', 'transfer_out', 'waste'].includes(type);
});

const maxQuantity = computed(() => {
  if (!selectedItem.value || !isReducingStock.value) return 999999;
  return selectedItem.value.current_stock;
});

// Watch for dialog open to reset form
watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetForm();
  }
});

// Methods
const resetForm = () => {
  form.value = {
    inventory_item_id: props.item?.id || null,
    transaction_type: props.defaultType || null,
    quantity: null,
    transaction_date: new Date(),
    reference_type: null,
    reference_id: null,
    notes: ''
  };
  submitted.value = false;
};

const onItemSelect = () => {
  form.value.quantity = null;
};

const close = () => {
  emit('update:visible', false);
};

const submit = async () => {
  submitted.value = true;

  const itemId = props.item?.id || form.value.inventory_item_id;
  if (!itemId || !form.value.transaction_type || !form.value.quantity) {
    return;
  }

  // Validate quantity for stock reduction
  if (isReducingStock.value && form.value.quantity > (selectedItem.value?.current_stock || 0)) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Quantity cannot exceed current stock',
      life: 3000
    });
    return;
  }

  saving.value = true;
  try {
    const data = {
      inventory_item_id: itemId,
      transaction_type: form.value.transaction_type,
      quantity: form.value.quantity,
      transaction_date: form.value.transaction_date ? new Date(form.value.transaction_date).toISOString().split('T')[0] : null,
      reference_type: form.value.reference_type,
      reference_id: form.value.reference_id,
      notes: form.value.notes
    };

    await inventoryService.createTransaction(data);

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Transaction recorded successfully',
      life: 3000
    });

    emit('saved');
    close();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.message || 'Failed to record transaction',
      life: 3000
    });
  } finally {
    saving.value = false;
  }
};
</script>
