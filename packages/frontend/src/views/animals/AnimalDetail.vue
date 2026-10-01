<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import animalService from '@/services/animal.service';
import enterpriseService from '@/services/enterprise.service';
import { formatAge, formatApiDate } from '@/utils/dates';
import { formatMoney, formatNumber } from '@/utils/format';
import { validationMessage } from '@/utils/forms';
import ActivityTimeline from '@/components/activities/ActivityTimeline.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const loading = ref(true);
const animal = ref(null);
const enterprise = ref(null);
const offspring = ref([]);

const statusSeverity = (status) => ({ active: 'success', sold: 'info', deceased: 'danger', culled: 'warn' })[status] || 'secondary';
const capitalise = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ') : '-');

const title = computed(() => (animal.value ? (animal.value.name ? `${animal.value.tag_number} · ${animal.value.name}` : animal.value.tag_number) : ''));

const load = async (id) => {
    loading.value = true;
    animal.value = null;
    enterprise.value = null;
    offspring.value = [];
    try {
        const response = await animalService.getAnimalById(id);
        animal.value = response.data.data;
        animalService
            .getOffspring(id)
            .then((res) => (offspring.value = res.data.data || []))
            .catch(() => (offspring.value = []));
        if (animal.value.enterprise_id) {
            enterpriseService
                .get(animal.value.enterprise_id)
                .then((res) => (enterprise.value = res.data.data))
                .catch(() => (enterprise.value = null));
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load the animal'), life: 4000 });
    } finally {
        loading.value = false;
    }
};

// The same view serves a parent or offspring link, so follow the id
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

        <div v-else-if="!animal" class="card text-center py-8">
            <p class="text-surface-600 mb-4">This animal could not be found.</p>
            <Button label="Back to animals" icon="pi pi-arrow-left" @click="router.push({ name: 'animal-list' })" />
        </div>

        <template v-else>
            <div class="card">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div class="flex items-center gap-3">
                        <Button icon="pi pi-arrow-left" text rounded @click="router.push({ name: 'animal-list' })" v-tooltip.top="'Back'" />
                        <div>
                            <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ title }}</h2>
                            <p class="text-surface-600 dark:text-surface-400">{{ [animal.animal_type_name, animal.breed_name].filter(Boolean).join(' · ') || 'Animal' }}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Tag v-if="animal.is_breeding_stock" value="Breeding stock" severity="info" />
                        <Tag :value="capitalise(animal.status)" :severity="statusSeverity(animal.status)" class="text-lg px-3 py-1" />
                    </div>
                </div>

                <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                    <div>
                        <dt class="text-surface-500 text-sm">Sex</dt>
                        <dd class="font-medium">{{ capitalise(animal.gender) }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Born</dt>
                        <dd class="font-medium">
                            {{ animal.date_of_birth ? formatApiDate(animal.date_of_birth) : '-' }}
                            <span v-if="animal.date_of_birth && animal.status === 'active'" class="text-surface-500 font-normal">({{ formatAge(animal.date_of_birth) }})</span>
                        </dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Acquired</dt>
                        <dd class="font-medium">
                            {{ formatApiDate(animal.date_acquired) }}
                            <span v-if="animal.acquisition_type" class="text-surface-500 font-normal">({{ animal.acquisition_type }})</span>
                        </dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Purchase price</dt>
                        <dd class="font-medium">{{ animal.purchase_price != null ? formatMoney(animal.purchase_price) : '-' }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Housing</dt>
                        <dd class="font-medium">{{ animal.housing_name || '-' }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Weight</dt>
                        <dd class="font-medium">
                            {{ animal.weight != null ? `${formatNumber(animal.weight)} ${animal.weight_unit || ''}` : '-' }}
                            <span v-if="animal.weight_date" class="text-surface-500 font-normal">({{ formatApiDate(animal.weight_date) }})</span>
                        </dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Enterprise</dt>
                        <dd class="font-medium">{{ enterprise?.name || '-' }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Status since</dt>
                        <dd class="font-medium">{{ animal.status_date ? formatApiDate(animal.status_date) : '-' }}</dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Sire</dt>
                        <dd class="font-medium">
                            <router-link v-if="animal.parent_male_id" :to="{ name: 'animal-detail', params: { id: animal.parent_male_id } }" class="text-primary hover:underline">{{ animal.parent_male_tag }}</router-link>
                            <span v-else>-</span>
                        </dd>
                    </div>
                    <div>
                        <dt class="text-surface-500 text-sm">Dam</dt>
                        <dd class="font-medium">
                            <router-link v-if="animal.parent_female_id" :to="{ name: 'animal-detail', params: { id: animal.parent_female_id } }" class="text-primary hover:underline">{{ animal.parent_female_tag }}</router-link>
                            <span v-else>-</span>
                        </dd>
                    </div>
                </dl>
                <p v-if="animal.notes" class="mt-4 text-surface-700 dark:text-surface-300 whitespace-pre-line">{{ animal.notes }}</p>
            </div>

            <div class="card">
                <TabView>
                    <TabPanel header="Timeline">
                        <ActivityTimeline :subject="{ animal_id: animal.id }" :farmWide="false" :rows="10" />
                    </TabPanel>
                    <TabPanel :header="`Offspring (${offspring.length})`">
                        <DataTable :value="offspring" :paginator="offspring.length > 10" :rows="10" stripedRows class="p-datatable-sm">
                            <template #empty>
                                <div class="text-center py-4 text-surface-500">No offspring recorded</div>
                            </template>
                            <Column field="tag_number" header="Tag">
                                <template #body="{ data }">
                                    <router-link :to="{ name: 'animal-detail', params: { id: data.id } }" class="text-primary hover:underline">{{ data.tag_number }}</router-link>
                                </template>
                            </Column>
                            <Column field="name" header="Name">
                                <template #body="{ data }">{{ data.name || '-' }}</template>
                            </Column>
                            <Column field="gender" header="Sex">
                                <template #body="{ data }">{{ capitalise(data.gender) }}</template>
                            </Column>
                            <Column field="date_of_birth" header="Born">
                                <template #body="{ data }">{{ data.date_of_birth ? formatApiDate(data.date_of_birth) : '-' }}</template>
                            </Column>
                            <Column field="status" header="Status">
                                <template #body="{ data }">
                                    <Tag :value="capitalise(data.status)" :severity="statusSeverity(data.status)" />
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                </TabView>
            </div>
        </template>
    </div>
</template>
