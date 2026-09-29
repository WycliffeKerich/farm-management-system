<script setup>
import { ref, computed, onMounted } from 'vue';
import cropService from '@/services/crop.service';

// State
const loading = ref(true);
const batchStats = ref({});
const recentHarvests = ref([]);
const pestAlerts = ref([]);
const activeBatches = ref([]);

// Load data
const loadDashboardData = async () => {
    loading.value = true;
    try {
        const [statsRes, harvestsRes, alertsRes, batchesRes] = await Promise.all([
            cropService.getBatchStatistics(),
            cropService.getHarvests({ limit: 5 }),
            cropService.getActiveAlerts(5),
            cropService.getBatches({ status: 'growing,harvesting', limit: 5 })
        ]);

        batchStats.value = statsRes.data.data || {};
        recentHarvests.value = harvestsRes.data.data || [];
        pestAlerts.value = alertsRes.data.data || [];
        activeBatches.value = batchesRes.data.data || [];
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    } finally {
        loading.value = false;
    }
};

// Computed
const totalActiveCrops = computed(() => {
    return (batchStats.value.planted_count || 0) + (batchStats.value.growing_count || 0) + (batchStats.value.harvesting_count || 0);
});

// Utilities
const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
};

const getStatusSeverity = (status) => {
    switch (status) {
        case 'planted':
            return 'info';
        case 'growing':
            return 'success';
        case 'harvesting':
            return 'warn';
        case 'completed':
            return 'secondary';
        default:
            return 'info';
    }
};

const formatStatus = (status) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
};

const getSeverityColor = (severity) => {
    switch (severity) {
        case 'critical':
            return 'danger';
        case 'high':
            return 'warn';
        case 'medium':
            return 'info';
        default:
            return 'secondary';
    }
};

const getQualityColor = (grade) => {
    switch (grade) {
        case 'A':
            return 'success';
        case 'B':
            return 'info';
        case 'C':
            return 'warn';
        default:
            return 'secondary';
    }
};

// Lifecycle
onMounted(() => {
    loadDashboardData();
});
</script>

<template>
    <div class="grid grid-cols-12 gap-6">
        <!-- Page Header -->
        <div class="col-span-12">
            <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">Farm Dashboard</h1>
            <p class="text-surface-600 dark:text-surface-400">Overview of your farm operations</p>
        </div>

        <!-- Stats Cards -->
        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Active Crops</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : totalActiveCrops }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-green-100 dark:bg-green-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-seedling text-green-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-primary font-medium">{{ batchStats.growing_count || 0 }} growing</span>
                <span class="text-muted-color"> | {{ batchStats.harvesting_count || 0 }} harvesting</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Planted Batches</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : batchStats.planted_count || 0 }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-box text-blue-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-primary font-medium">Recently planted</span>
                <span class="text-muted-color"> awaiting growth</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Completed Batches</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : batchStats.completed_count || 0 }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-gray-100 dark:bg-gray-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-check-circle text-gray-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-primary font-medium">Harvesting done</span>
                <span class="text-muted-color"> cycle complete</span>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0 h-full">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Pest/Disease Alerts</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ loading ? '...' : pestAlerts.length }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center bg-red-100 dark:bg-red-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-exclamation-triangle text-red-500 text-xl!"></i>
                    </div>
                </div>
                <span class="text-red-500 font-medium" v-if="pestAlerts.length">Action needed</span>
                <span class="text-green-500 font-medium" v-else>No active alerts</span>
            </div>
        </div>

        <!-- Active Batches -->
        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Active Crop Batches</h5>
                    <router-link to="/crops/batches" class="text-primary text-sm hover:underline"> View all <i class="pi pi-arrow-right text-xs ml-1"></i> </router-link>
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!activeBatches.length" class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">No active batches</p>
                    <router-link to="/crops/batches" class="text-primary hover:underline"> Create your first batch </router-link>
                </div>

                <DataTable v-else :value="activeBatches" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column field="batch_code" header="Batch">
                        <template #body="{ data }">
                            <router-link :to="{ name: 'crop-batch-detail', params: { id: data.id } }" class="text-primary font-medium hover:underline">
                                {{ data.batch_code }}
                            </router-link>
                        </template>
                    </Column>
                    <Column field="crop_type_name" header="Crop" />
                    <Column field="variety_name" header="Variety" />
                    <Column field="status" header="Status">
                        <template #body="{ data }">
                            <Tag :severity="getStatusSeverity(data.status)" :value="formatStatus(data.status)" />
                        </template>
                    </Column>
                    <Column field="planting_date" header="Planted">
                        <template #body="{ data }">
                            {{ formatDate(data.planting_date) }}
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Recent Harvests -->
        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Recent Harvests</h5>
                    <router-link to="/crops/harvests" class="text-primary text-sm hover:underline"> View all <i class="pi pi-arrow-right text-xs ml-1"></i> </router-link>
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!recentHarvests.length" class="text-center py-8">
                    <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
                    <p class="text-surface-500">No harvests recorded yet</p>
                </div>

                <DataTable v-else :value="recentHarvests" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column field="batch_code" header="Batch">
                        <template #body="{ data }">
                            <router-link :to="{ name: 'crop-batch-detail', params: { id: data.batch_id } }" class="text-primary font-medium hover:underline">
                                {{ data.batch_code }}
                            </router-link>
                        </template>
                    </Column>
                    <Column field="crop_type_name" header="Crop" />
                    <Column field="quantity" header="Quantity">
                        <template #body="{ data }"> {{ data.quantity }} {{ data.unit }} </template>
                    </Column>
                    <Column field="quality_grade" header="Grade">
                        <template #body="{ data }">
                            <Tag v-if="data.quality_grade" :severity="getQualityColor(data.quality_grade)" :value="'Grade ' + data.quality_grade" />
                            <span v-else class="text-surface-400">-</span>
                        </template>
                    </Column>
                    <Column field="harvest_date" header="Date">
                        <template #body="{ data }">
                            {{ formatDate(data.harvest_date) }}
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- Pest & Disease Alerts -->
        <div class="col-span-12">
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-lg font-semibold m-0">Pest & Disease Alerts</h5>
                </div>

                <div v-if="loading" class="text-center py-8">
                    <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
                </div>

                <div v-else-if="!pestAlerts.length" class="text-center py-8">
                    <i class="pi pi-check-circle text-4xl text-green-400 mb-4"></i>
                    <p class="text-surface-500">No active pest or disease alerts. Your crops are healthy!</p>
                </div>

                <DataTable v-else :value="pestAlerts" responsiveLayout="scroll" class="p-datatable-sm">
                    <Column field="batch_code" header="Batch">
                        <template #body="{ data }">
                            <router-link :to="{ name: 'crop-batch-detail', params: { id: data.batch_id } }" class="text-primary font-medium hover:underline">
                                {{ data.batch_code }}
                            </router-link>
                        </template>
                    </Column>
                    <Column field="crop_type_name" header="Crop" />
                    <Column field="type" header="Type">
                        <template #body="{ data }">
                            <Tag :severity="data.type === 'disease' ? 'warn' : 'danger'" :value="data.type" />
                        </template>
                    </Column>
                    <Column field="name" header="Issue" />
                    <Column field="severity" header="Severity">
                        <template #body="{ data }">
                            <Tag :severity="getSeverityColor(data.severity)" :value="data.severity" />
                        </template>
                    </Column>
                    <Column field="detected_date" header="Detected">
                        <template #body="{ data }">
                            {{ formatDate(data.detected_date) }}
                        </template>
                    </Column>
                    <Column field="status" header="Status">
                        <template #body="{ data }">
                            <Tag :severity="data.status === 'resolved' ? 'success' : 'info'" :value="data.status" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>
</template>
