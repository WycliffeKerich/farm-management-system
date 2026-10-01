import { ref } from 'vue';
import inventoryService from '@/services/inventory.service';

/**
 * Active suppliers for a supplier Select
 * @returns {{suppliers: import('vue').Ref<Array>, load: () => Promise<void>}}
 */
export function useSupplierOptions() {
    const suppliers = ref([]);

    const load = async () => {
        try {
            const response = await inventoryService.getSuppliers();
            suppliers.value = response.data.data || [];
        } catch (error) {
            console.error('Failed to load suppliers:', error);
        }
    };

    return { suppliers, load };
}
