<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';
import enterpriseService from '@/services/enterprise.service';
import { formatApiDate } from '@/utils/dates';
import { formatMoney } from '@/utils/format';
import { validationMessage } from '@/utils/forms';
import ActivityTimeline from '@/components/activities/ActivityTimeline.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const loading = ref(true);
const group = ref(null);
const enterprise = ref(null);

const capitalise = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ') : '-');
const adjustmentSeverity = (quantity) => (quantity > 0 ? 'success' : quantity < 0 ? 'danger' : 'secondary');

const quantity = computed(() => group.value?.current_quantity ?? group.value?.quantity ?? 0);

const load = async (id) => {
    loading.value = true;
    group.value = null;
    enterprise.value = null;
    try {
        const response = await animalService.getGroupById(id);
        group.value = response.data.data;
        if (group.value.enterprise_id) {
            enterpriseService
                .get(group.value.enterprise_id)
                .then((res) => (enterprise.value = res.data.data))
                .catch(() => (enterprise.value = null));
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load the group'), life: 4000 });
    } finally {
        loading.value = false;
    }
};

watch(
    () => route.params.id,
    (id) => id && load(id),
    { immediate: true }
);
</script>

<template>
    <div>
        <div v-if="loading" class="card flex justify-center py-8">
            <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <div v-else-if="!group" class="card text-center py-8">
            <p class="text-surface-600 mb-4">This group could not be found.</p>
            <Button label="Back to groups" icon="pi pi-arrow-left" @click="router.push({ name: 'animal-groups' })" />
        </div>

        <template v-else>
            <div class="card">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div class="flex items-center gap-3">
                        <Button icon="pi pi-arrow-left" text rounded @click="router.push({ name: 'animal-groups' })" v-tooltip.top="'Back'" />
                        <div>
                            <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">
                                {{ group.name }}
                                <span v-if="group.group_code" class="text-surface-500 font-normal text-lg ml-2">{{ group.group_code }}</span>
                            </h2>
                            <p class="text-surface-600 dark:text-surface-400">{{ [group.animal_type_name, group.breed_name, group.group_type].filter(Boolean).join(' · ') || 'Group' }}</p>
                        </div>
                    </div>
                    <Tag :value="capitalise(group.status)" :severity="group.status === 'active' ? 'success' : 'secondary'" class="text-lg px-3 py-1" />
                </div>

                <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                    <div>
                        <dt class="text-surface-500 text-sm">Head now</dt>
                        <dd class="text-2xl font-bold text-primary">{{ quantity }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Started with</dt>
                        <dd class="font-medium">{{ group.initial_quantity ?? group.quantity }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Deaths</dt>
                        <dd class="font-medium" :class="{ 'text-red-500': group.total_deaths > 0 }">{{ group.total_deaths || 0 }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Sold</dt>
                        <dd class="font-medium">{{ group.total_sold || 0 }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Acquired</dt>
                        <dd class="font-medium">
                            {{ formatApiDate(group.acquisition_date || group.date_established) }}
                            <span v-if="group.acquisition_type" class="text-surface-500 font-normal">({{ group.acquisition_type }})</span>
                        </dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Acquisition cost</dt>
                        <dd class="font-medium">
                            {{ group.acquisition_cost != null ? formatMoney(group.acquisition_cost) : '-' }}
                            <span v-if="group.cost_per_unit != null" class="text-surface-500 font-normal">({{ formatMoney(group.cost_per_unit) }} each)</span>
                        </dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Housing</dt>
                        <dd class="font-medium">{{ group.housing_name || '-' }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Enterprise</dt>
                        <dd class="font-medium">{{ enterprise?.name || '-' }}</dd>
                    </div>
                </dl>
                <p v-if="group.notes" class="mt-4 text-surface-700 dark:text-surface-300 whitespace-pre-line">{{ group.notes }}</p>
            </div>

            <div class="card">
                <TabView>
                    <TabPanel header="Timeline">
                        <ActivityTimeline :subject="{ animal_group_id: group.id }" :farmWide="false" :rows="10" />
                    </TabPanel>
                    <TabPanel :header="`Head count history (${group.adjustments?.length || 0})`">
                        <DataTable :value="group.adjustments" :paginator="group.adjustments?.length > 10" :rows="10" stripedRows class="p-datatable-sm">
                            <template #empty>
                                <div class="text-center py-4 text-surface-500">No additions or removals recorded</div>
                            </template>
                            <Column field="adjustment_date" header="Date">
                                <template #body="{ data }">{{ formatApiDate(data.adjustment_date) }}</template>
                            </Column>
                            <Column field="adjustment_type" header="Change">
                                <template #body="{ data }">{{ capitalise(data.adjustment_type) }}</template>
                            </Column>
                            <Column field="quantity" header="Head" class="text-right">
                                <template #body="{ data }">
                                    <Tag :value="data.quantity > 0 ? `+${data.quantity}` : String(data.quantity)" :severity="adjustmentSeverity(data.quantity)" />
                                </template>
                            </Column>
                            <Column header="Count" class="text-right">
                                <template #body="{ data }">{{ data.quantity_before }} → {{ data.quantity_after }}</template>
                            </Column>
                            <Column header="Value" class="text-right">
                                <template #body="{ data }">{{ data.total_value != null ? formatMoney(data.total_value) : '-' }}</template>
                            </Column>
                            <Column header="Reason">
                                <template #body="{ data }">{{ data.reason || data.notes || '-' }}</template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                </TabView>
            </div>
        </template>
    </div>
</template>
