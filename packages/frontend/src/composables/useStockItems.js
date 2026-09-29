import { ref } from 'vue';
import inventoryService from '@/services/inventory.service';

/**
 * Inventory items for the product pickers. Call load() when a form opens so
 * the stock on hand is current.
 */
export function useStockItems() {
    const items = ref([]);
    const loading = ref(false);
    const error = ref(null);

    const load = async () => {
        loading.value = true;
        error.value = null;
        try {
            const response = await inventoryService.getItems();
            items.value = response.data.data.filter((item) => item.is_active !== false);
        } catch (err) {
            // The forms still work with a typed product name
            error.value = err;
        } finally {
            loading.value = false;
        }
    };

    const findItem = (id) => items.value.find((item) => item.id === id) || null;

    return { items, loading, error, load, findItem };
}
