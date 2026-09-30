<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import inventoryService from '@/services/inventory.service';
import PurchaseDialog from '@/components/inventory/PurchaseDialog.vue';
import { formatApiDate } from '@/utils/dates';
import { validationMessage } from '@/utils/forms';
import { formatCurrency } from '@/utils/inventory';
import { formatDaysOfCover, formatExpiryDistance, orderText, reorderBySupplier } from '@/utils/inventoryReports';

const TABS = ['valuation', 'reorder', 'expiring'];
const USAGE_DAY_OPTIONS = [14, 30, 60, 90].map((days) => ({ label: `Last ${days} days`, value: days }));
const EXPIRY_DAY_OPTIONS = [7, 14, 30, 60, 90].map((days) => ({ label: `Next ${days} days`, value: days }));

const route = useRoute();
const router = useRouter();
const toast = useToast();

const tab = ref(TABS.includes(route.query.tab) ? route.query.tab : 'valuation');
const setTab = (value) => {
    tab.value = value;
    router.replace({ query: { ...route.query, tab: value } });
};

// Valuation
const categories = ref([]);
const valuationCategory = ref(null);
const valuation = ref(null);
const loadingValuation = ref(false);
const valuationTable = ref(null);

const loadValuation = async () => {
    loadingValuation.value = true;
    try {
        const params = valuationCategory.value ? { category_id: valuationCategory.value } : {};
        const response = await inventoryService.getValuationReport(params);
        valuation.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load stock valuation'), life: 4000 });
    } finally {
        loadingValuation.value = false;
    }
};

const categoryShare = (category) => (valuation.value?.total_value > 0 ? Math.round((category.value / valuation.value.total_value) * 100) : 0);

// Reorder
const usageDays = ref(30);
const reorder = ref(null);
const loadingReorder = ref(false);
const orders = computed(() => reorderBySupplier(reorder.value?.items));

const loadReorder = async () => {
    loadingReorder.value = true;
    try {
        const response = await inventoryService.getReorderReport(usageDays.value);
        reorder.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load the reorder list'), life: 4000 });
    } finally {
        loadingReorder.value = false;
    }
};

const copyOrder = async (order) => {
    try {
        await navigator.clipboard.writeText(orderText(order));
        toast.add({ severity: 'success', summary: 'Copied', detail: 'Order copied; paste it into a message or email', life: 3000 });
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Could not copy to the clipboard', life: 3000 });
    }
};

const purchaseDialog = ref(false);
const purchaseItem = ref(null);
const receive = (row) => {
    purchaseItem.value = { id: row.item_id, name: row.name, unit: row.unit, current_stock: row.current_stock, default_supplier_id: row.supplier_id, cost_per_unit: row.unit_cost, reorder_quantity: row.reorder_quantity };
    purchaseDialog.value = true;
};

// Expiring
const expiryDays = ref(30);
const expiring = ref(null);
const loadingExpiring = ref(false);
const expiringRows = computed(() => [...(expiring.value?.expired || []), ...(expiring.value?.expiring || [])]);

const loadExpiring = async () => {
    loadingExpiring.value = true;
    try {
        const response = await inventoryService.getExpiringReport(expiryDays.value);
        expiring.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: validationMessage(error, 'Failed to load expiring stock'), life: 4000 });
    } finally {
        loadingExpiring.value = false;
    }
};

const expirySeverity = (days) => {
    if (days < 0) return 'danger';
    if (days <= 7) return 'warn';
    return 'info';
};

// Each tab loads the first time it is shown
const loaders = { valuation: loadValuation, reorder: loadReorder, expiring: loadExpiring };
const loaded = new Set();
watch(
    tab,
    (value) => {
        if (loaded.has(value)) return;
        loaded.add(value);
        loaders[value]();
    },
    { immediate: true }
);

onMounted(async () => {
    try {
        const response = await inventoryService.getCategories();
        categories.value = response.data.data || [];
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
});
</script>

<template>
    <div class="card">
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Inventory Reports</h2>
            <p class="text-surface-600 dark:text-surface-400">What stock is worth, what to order, and what is about to expire</p>
        </div>

        <Tabs :value="tab" @update:value="setTab">
            <TabList>
                <Tab value="valuation"><i class="pi pi-wallet mr-2"></i>Valuation</Tab>
                <Tab value="reorder"><i class="pi pi-shopping-cart mr-2"></i>Reorder</Tab>
                <Tab value="expiring"><i class="pi pi-clock mr-2"></i>Expiring</Tab>
            </TabList>

            <TabPanels>
                <!-- Valuation -->
                <TabPanel value="valuation">
                    <div class="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                        <Select v-model="valuationCategory" :options="categories" optionLabel="name" optionValue="id" placeholder="All categories" class="w-full md:w-60" showClear @change="loadValuation" />
                        <Button label="Export CSV" icon="pi pi-download" severity="secondary" outlined size="small" class="md:ml-auto" :disabled="!valuation?.items.length" @click="valuationTable.exportCSV()" />
                    </div>

                    <div v-if="loadingValuation && !valuation" class="text-center py-12"><i class="pi pi-spin pi-spinner text-3xl text-primary"></i></div>

                    <template v-else-if="valuation">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <p class="text-green-700 dark:text-green-400 text-sm font-medium">Stock value</p>
                                <p class="text-2xl font-bold text-green-900 dark:text-green-100">{{ formatCurrency(valuation.total_value) }}</p>
                                <p class="text-sm text-surface-500">At each batch's purchase cost</p>
                            </div>
                            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <p class="text-blue-700 dark:text-blue-400 text-sm font-medium">Items in stock</p>
                                <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ valuation.item_count }}</p>
                            </div>
                            <div class="p-4 rounded-lg" :class="valuation.uncosted_item_count ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-surface-100 dark:bg-surface-800'">
                                <p class="text-sm font-medium" :class="valuation.uncosted_item_count ? 'text-yellow-700 dark:text-yellow-400' : 'text-surface-600 dark:text-surface-400'">Items without a cost</p>
                                <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ valuation.uncosted_item_count }}</p>
                                <p class="text-sm text-surface-500">Not counted in the value; set a cost per unit or receive stock with a unit cost</p>
                            </div>
                        </div>

                        <h5 class="text-lg font-semibold mb-3">By category</h5>
                        <DataTable :value="valuation.categories" class="p-datatable-sm mb-6" responsiveLayout="scroll" sortField="value" :sortOrder="-1">
                            <template #empty><p class="text-center text-surface-500 py-4">No stock on hand</p></template>
                            <Column field="category_name" header="Category" sortable />
                            <Column field="item_count" header="Items" sortable />
                            <Column field="value" header="Value" sortable>
                                <template #body="{ data }">{{ formatCurrency(data.value) }}</template>
                            </Column>
                            <Column header="Share" style="width: 30%">
                                <template #body="{ data }">
                                    <div class="flex items-center gap-2">
                                        <ProgressBar :value="categoryShare(data)" :showValue="false" class="flex-1" style="height: 0.5rem" />
                                        <span class="text-sm w-10 text-right">{{ categoryShare(data) }}%</span>
                                    </div>
                                </template>
                            </Column>
                        </DataTable>

                        <h5 class="text-lg font-semibold mb-3">By item</h5>
                        <DataTable
                            ref="valuationTable"
                            :value="valuation.items"
                            :loading="loadingValuation"
                            :paginator="valuation.items.length > 20"
                            :rows="20"
                            class="p-datatable-sm"
                            responsiveLayout="scroll"
                            sortField="value"
                            :sortOrder="-1"
                            exportFilename="stock-valuation"
                        >
                            <template #empty><p class="text-center text-surface-500 py-4">No stock on hand</p></template>
                            <Column field="item_code" header="Code" sortable>
                                <template #body="{ data }"
                                    ><span class="font-mono text-sm">{{ data.item_code }}</span></template
                                >
                            </Column>
                            <Column field="name" header="Item" sortable>
                                <template #body="{ data }">
                                    <router-link :to="{ name: 'inventory-item-detail', params: { id: data.item_id } }" class="text-primary hover:underline">{{ data.name }}</router-link>
                                </template>
                            </Column>
                            <Column field="category_name" header="Category" sortable />
                            <Column field="quantity" header="Quantity" sortable>
                                <template #body="{ data }">{{ data.quantity }} {{ data.unit }}</template>
                            </Column>
                            <Column field="average_unit_cost" header="Avg. Unit Cost" sortable>
                                <template #body="{ data }">{{ data.average_unit_cost != null ? formatCurrency(data.average_unit_cost) : '-' }}</template>
                            </Column>
                            <Column field="value" header="Value" sortable>
                                <template #body="{ data }">
                                    {{ formatCurrency(data.value) }}
                                    <Tag v-if="data.uncosted_quantity > 0" value="Part uncosted" severity="warn" class="ml-2" v-tooltip.top="`${data.uncosted_quantity} ${data.unit} have no cost`" />
                                </template>
                            </Column>
                        </DataTable>
                    </template>
                </TabPanel>

                <!-- Reorder -->
                <TabPanel value="reorder">
                    <div class="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                        <div class="flex items-center gap-2">
                            <label for="usage_days" class="text-sm text-surface-600 dark:text-surface-400">Usage over</label>
                            <Select inputId="usage_days" v-model="usageDays" :options="USAGE_DAY_OPTIONS" optionLabel="label" optionValue="value" class="w-44" @change="loadReorder" />
                        </div>
                        <p v-if="reorder" class="text-surface-600 dark:text-surface-400 md:ml-auto">
                            <strong>{{ reorder.item_count }}</strong> {{ reorder.item_count === 1 ? 'item' : 'items' }} to order, about <strong>{{ formatCurrency(reorder.estimated_cost) }}</strong>
                        </p>
                    </div>

                    <div v-if="loadingReorder && !reorder" class="text-center py-12"><i class="pi pi-spin pi-spinner text-3xl text-primary"></i></div>

                    <div v-else-if="reorder && !orders.length" class="text-center py-12">
                        <i class="pi pi-check-circle text-4xl text-green-500 mb-4"></i>
                        <p class="text-surface-500">Nothing is at or below its minimum stock</p>
                    </div>

                    <div v-else class="flex flex-col gap-6">
                        <div v-for="order in orders" :key="order.supplier_id ?? 'none'" class="border border-surface-200 dark:border-surface-700 rounded-lg">
                            <div class="flex flex-col md:flex-row md:items-center gap-2 p-4 bg-surface-50 dark:bg-surface-800 rounded-t-lg">
                                <div>
                                    <p class="font-semibold">{{ order.supplier_name || 'No usual supplier' }}</p>
                                    <p class="text-sm text-surface-500 flex flex-wrap gap-x-4">
                                        <a v-if="order.supplier_phone" :href="`tel:${order.supplier_phone}`" class="hover:underline"><i class="pi pi-phone text-xs mr-1"></i>{{ order.supplier_phone }}</a>
                                        <a v-if="order.supplier_email" :href="`mailto:${order.supplier_email}`" class="hover:underline"><i class="pi pi-envelope text-xs mr-1"></i>{{ order.supplier_email }}</a>
                                        <span v-if="!order.supplier_id">Set a usual supplier on these items to group them</span>
                                    </p>
                                </div>
                                <div class="md:ml-auto flex items-center gap-3">
                                    <span class="text-sm">
                                        About <strong>{{ formatCurrency(order.estimated_cost) }}</strong>
                                        <span v-if="order.uncosted_count" class="text-surface-500"> ({{ order.uncosted_count }} without a cost)</span>
                                    </span>
                                    <Button label="Copy order" icon="pi pi-copy" size="small" severity="secondary" outlined @click="copyOrder(order)" />
                                </div>
                            </div>

                            <DataTable :value="order.items" class="p-datatable-sm" responsiveLayout="scroll">
                                <Column field="name" header="Item">
                                    <template #body="{ data }">
                                        <router-link :to="{ name: 'inventory-item-detail', params: { id: data.item_id } }" class="text-primary hover:underline">{{ data.name }}</router-link>
                                        <p class="text-xs text-surface-500">{{ data.category_name }}</p>
                                    </template>
                                </Column>
                                <Column header="Stock / Minimum">
                                    <template #body="{ data }">
                                        <Tag :value="`${data.current_stock} ${data.unit || ''}`" :severity="data.current_stock <= 0 ? 'danger' : 'warn'" />
                                        <span class="text-surface-500 ml-1">/ {{ data.minimum_stock }}</span>
                                    </template>
                                </Column>
                                <Column header="Lasts">
                                    <template #body="{ data }">
                                        <span v-tooltip.top="data.average_daily_usage ? `Using ${data.average_daily_usage} ${data.unit || ''} a day` : undefined">{{ formatDaysOfCover(data.days_of_cover) }}</span>
                                    </template>
                                </Column>
                                <Column header="Order">
                                    <template #body="{ data }">
                                        <strong>{{ data.suggested_quantity }} {{ data.unit }}</strong>
                                        <p v-if="!data.reorder_quantity" class="text-xs text-surface-500">To twice the minimum</p>
                                    </template>
                                </Column>
                                <Column header="Est. Cost">
                                    <template #body="{ data }">{{ data.estimated_cost != null ? formatCurrency(data.estimated_cost) : '-' }}</template>
                                </Column>
                                <Column style="width: 110px">
                                    <template #body="{ data }">
                                        <Button label="Receive" icon="pi pi-plus" size="small" text severity="success" @click="receive(data)" />
                                    </template>
                                </Column>
                            </DataTable>
                        </div>
                    </div>
                </TabPanel>

                <!-- Expiring -->
                <TabPanel value="expiring">
                    <div class="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                        <Select v-model="expiryDays" :options="EXPIRY_DAY_OPTIONS" optionLabel="label" optionValue="value" class="w-44" @change="loadExpiring" />
                    </div>

                    <div v-if="loadingExpiring && !expiring" class="text-center py-12"><i class="pi pi-spin pi-spinner text-3xl text-primary"></i></div>

                    <template v-else-if="expiring">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div class="p-4 rounded-lg" :class="expiring.totals.expired_count ? 'bg-red-50 dark:bg-red-900/20' : 'bg-surface-100 dark:bg-surface-800'">
                                <p class="text-sm font-medium" :class="expiring.totals.expired_count ? 'text-red-700 dark:text-red-400' : 'text-surface-600 dark:text-surface-400'">Expired, still in stock</p>
                                <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ expiring.totals.expired_count }}</p>
                                <p class="text-sm text-surface-500">{{ formatCurrency(expiring.totals.expired_value) }} to write off</p>
                            </div>
                            <div class="p-4 rounded-lg" :class="expiring.totals.expiring_count ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-surface-100 dark:bg-surface-800'">
                                <p class="text-sm font-medium" :class="expiring.totals.expiring_count ? 'text-orange-700 dark:text-orange-400' : 'text-surface-600 dark:text-surface-400'">Expiring in the next {{ expiring.days }} days</p>
                                <p class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ expiring.totals.expiring_count }}</p>
                                <p class="text-sm text-surface-500">{{ formatCurrency(expiring.totals.expiring_value) }} at risk; use these first</p>
                            </div>
                        </div>
                        <p v-if="expiring.totals.uncosted_count" class="text-sm text-surface-500 mb-4">
                            <i class="pi pi-info-circle mr-1"></i>{{ expiring.totals.uncosted_count }} {{ expiring.totals.uncosted_count === 1 ? 'entry has' : 'entries have' }} no cost and {{ expiring.totals.uncosted_count === 1 ? 'is' : 'are' }} not
                            counted in these values.
                        </p>

                        <DataTable :value="expiringRows" :loading="loadingExpiring" :paginator="expiringRows.length > 20" :rows="20" class="p-datatable-sm" responsiveLayout="scroll">
                            <template #empty>
                                <div class="text-center py-8">
                                    <i class="pi pi-check-circle text-4xl text-green-500 mb-4"></i>
                                    <p class="text-surface-500">Nothing expires in the next {{ expiring.days }} days</p>
                                </div>
                            </template>
                            <Column field="item_name" header="Item">
                                <template #body="{ data }">
                                    <router-link :to="{ name: 'inventory-item-detail', params: { id: data.item_id } }" class="text-primary hover:underline">{{ data.item_name }}</router-link>
                                    <p class="text-xs text-surface-500">{{ data.category_name }}</p>
                                </template>
                            </Column>
                            <Column header="Batch">
                                <template #body="{ data }">
                                    <span v-if="data.batch_number" class="font-mono text-sm">{{ data.batch_number }}</span>
                                    <span v-else class="text-surface-500 text-sm">Not in a batch</span>
                                </template>
                            </Column>
                            <Column header="Quantity">
                                <template #body="{ data }">{{ data.quantity }} {{ data.unit }}</template>
                            </Column>
                            <Column header="Expiry">
                                <template #body="{ data }">
                                    {{ formatApiDate(data.expiry_date) }}
                                    <Tag :value="formatExpiryDistance(data.days_until_expiry)" :severity="expirySeverity(data.days_until_expiry)" class="ml-2" />
                                </template>
                            </Column>
                            <Column header="Location">
                                <template #body="{ data }">{{ data.storage_location || '-' }}</template>
                            </Column>
                            <Column header="Supplier">
                                <template #body="{ data }">{{ data.supplier || '-' }}</template>
                            </Column>
                            <Column header="Value">
                                <template #body="{ data }">{{ data.value_at_risk != null ? formatCurrency(data.value_at_risk) : '-' }}</template>
                            </Column>
                        </DataTable>
                    </template>
                </TabPanel>
            </TabPanels>
        </Tabs>

        <PurchaseDialog v-model:visible="purchaseDialog" :item="purchaseItem" @saved="loadReorder" />
    </div>
</template>
