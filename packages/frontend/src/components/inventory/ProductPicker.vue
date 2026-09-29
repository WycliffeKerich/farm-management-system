<script setup>
import { computed } from 'vue';
import Select from 'primevue/select';
import { formatStock, withdrawalSummary } from '@/utils/inventory';

/**
 * Pick a product from stock. v-model is the inventory item id; `select`
 * passes the whole item (or null when cleared) so the form can fill in the
 * product name and unit. Leaving it empty lets the form take a typed name.
 */
const props = defineProps({
    modelValue: { type: Number, default: null },
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    /** 'crop' shows the pre-harvest interval, 'animal' the withdrawal periods */
    use: { type: String, default: 'animal' },
    inputId: { type: String, default: undefined },
    placeholder: { type: String, default: 'Pick from stock (optional)' }
});

const emit = defineEmits(['update:modelValue', 'select']);

const selected = computed(() => props.items.find((item) => item.id === props.modelValue) || null);

const onChange = (id) => {
    emit('update:modelValue', id ?? null);
    emit('select', props.items.find((item) => item.id === id) || null);
};
</script>

<template>
    <div class="flex flex-col gap-1">
        <Select
            :inputId="inputId"
            :modelValue="modelValue"
            :options="items"
            optionLabel="name"
            optionValue="id"
            :filterFields="['name', 'item_code']"
            filter
            showClear
            :loading="loading"
            :disabled="disabled"
            :placeholder="placeholder"
            class="w-full"
            @update:modelValue="onChange"
        >
            <template #option="{ option }">
                <div class="flex flex-col">
                    <div class="flex items-baseline gap-2">
                        <span class="font-medium">{{ option.name }}</span>
                        <span v-if="option.item_code" class="text-surface-500 text-sm">{{ option.item_code }}</span>
                    </div>
                    <span class="text-sm" :class="Number(option.current_stock) > 0 ? 'text-surface-500' : 'text-red-500'">
                        {{ formatStock(option) }}<template v-if="withdrawalSummary(option, use)"> · {{ withdrawalSummary(option, use) }}</template>
                    </span>
                </div>
            </template>
        </Select>
        <small v-if="selected" class="text-surface-500">
            {{ formatStock(selected) }}<template v-if="withdrawalSummary(selected, use)"> · {{ withdrawalSummary(selected, use) }}</template>
        </small>
    </div>
</template>
