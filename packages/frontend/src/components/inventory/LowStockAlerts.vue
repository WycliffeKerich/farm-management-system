<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <h5 class="text-lg font-semibold m-0">Low Stock Alerts</h5>
        <Tag v-if="items.length > 0" :value="items.length" severity="danger" rounded />
      </div>
      <Button
        v-if="showViewAll && items.length > 0"
        label="View All"
        icon="pi pi-arrow-right"
        size="small"
        text
        @click="$emit('view-all')"
      />
    </div>

    <div v-if="loading" class="text-center py-6">
      <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
    </div>

    <div v-else-if="!items.length" class="text-center py-6">
      <i class="pi pi-check-circle text-4xl text-green-500 mb-3"></i>
      <p class="text-surface-500 m-0">All items are well stocked</p>
    </div>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="item in displayItems"
        :key="item.id"
        class="p-3 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <router-link
              :to="{ name: 'inventory-item-detail', params: { id: item.id } }"
              class="font-medium text-surface-900 dark:text-surface-0 hover:text-primary"
            >
              {{ item.name }}
            </router-link>
            <p class="text-sm text-surface-500 mt-1">{{ item.category_name || 'Uncategorized' }}</p>
          </div>

          <div class="text-right">
            <Tag
              :value="`${item.current_stock} / ${item.minimum_stock} ${item.unit_of_measure || ''}`"
              :severity="item.current_stock <= 0 ? 'danger' : 'warn'"
            />
          </div>
        </div>

        <!-- Stock Level Bar -->
        <div class="mt-3">
          <div class="h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="item.current_stock <= 0 ? 'bg-red-500' : 'bg-yellow-500'"
              :style="{ width: `${Math.min((item.current_stock / item.minimum_stock) * 100, 100)}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-xs text-surface-500 mt-1">
            <span>{{ item.current_stock <= 0 ? 'Out of stock' : 'Low stock' }}</span>
            <span>Need {{ Math.max(item.minimum_stock - item.current_stock, 0) }} more</span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="flex gap-2 mt-3">
          <Button
            label="Add Stock"
            icon="pi pi-plus"
            size="small"
            severity="success"
            outlined
            class="flex-1"
            @click="$emit('add-stock', item)"
          />
          <Button
            v-if="item.reorder_quantity"
            :label="`Reorder (${item.reorder_quantity})`"
            icon="pi pi-shopping-cart"
            size="small"
            outlined
            class="flex-1"
            @click="$emit('reorder', item)"
          />
        </div>
      </div>

      <!-- Show more indicator -->
      <div v-if="items.length > maxDisplay" class="text-center pt-2">
        <Button
          :label="`View ${items.length - maxDisplay} more items`"
          size="small"
          text
          @click="$emit('view-all')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import inventoryService from '@/services/inventory.service';

const props = defineProps({
  items: {
    type: Array,
    default: null
  },
  maxDisplay: {
    type: Number,
    default: 5
  },
  showViewAll: {
    type: Boolean,
    default: true
  },
  autoLoad: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['view-all', 'add-stock', 'reorder', 'loaded']);

const loading = ref(false);
const internalItems = ref([]);

const items = computed(() => {
  return props.items !== null ? props.items : internalItems.value;
});

const displayItems = computed(() => {
  return items.value.slice(0, props.maxDisplay);
});

const loadLowStockItems = async () => {
  loading.value = true;
  try {
    const response = await inventoryService.getLowStockItems();
    internalItems.value = response.data.data || [];
    emit('loaded', internalItems.value);
  } catch (error) {
    console.error('Failed to load low stock items:', error);
  } finally {
    loading.value = false;
  }
};

watch(() => props.autoLoad, (newVal) => {
  if (newVal && props.items === null) {
    loadLowStockItems();
  }
}, { immediate: true });

onMounted(() => {
  if (props.autoLoad && props.items === null) {
    loadLowStockItems();
  }
});

defineExpose({
  refresh: loadLowStockItems
});
</script>
