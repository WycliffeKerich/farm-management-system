import { ref, shallowRef } from 'vue';
import withdrawalService from '@/services/withdrawal.service';
import { indexHolds } from '@/utils/withdrawals';

/**
 * Today's withdrawal periods and pre-harvest intervals, for badges on batch,
 * animal and group pages
 */
export function useActiveHolds() {
    const index = shallowRef(indexHolds(null));
    const loading = ref(false);

    const load = async () => {
        loading.value = true;
        try {
            const response = await withdrawalService.getActive();
            index.value = indexHolds(response.data.data);
        } catch {
            // Badges are a hint; the server still refuses a held harvest, record or sale
            index.value = indexHolds(null);
        } finally {
            loading.value = false;
        }
    };

    /** The batch's pre-harvest interval entry, or null */
    const forBatch = (id) => index.value.batches.get(id) || null;
    /** The animal's held products (milk, meat, egg) */
    const forAnimal = (id) => index.value.animals.get(id) || [];
    /** The group's held products */
    const forGroup = (id) => index.value.groups.get(id) || [];

    return { loading, load, forBatch, forAnimal, forGroup };
}
