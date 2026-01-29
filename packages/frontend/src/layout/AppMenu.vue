<script setup>
import { ref } from 'vue';
import AppMenuItem from './AppMenuItem.vue';

const model = ref([
    {
        label: 'Home',
        items: [
            {
                label: 'Dashboard',
                icon: 'pi pi-fw pi-home',
                to: '/'
            }
        ]
    },
    {
        label: 'Crop Management',
        icon: 'pi pi-fw pi-sun',
        items: [
            {
                label: 'Overview',
                icon: 'pi pi-fw pi-chart-pie',
                to: '/crops'
            },
            {
                label: 'Crop Batches',
                icon: 'pi pi-fw pi-th-large',
                to: '/crops/batches'
            },
            {
                label: 'Harvests',
                icon: 'pi pi-fw pi-box',
                to: '/crops/harvests'
            },
            {
                label: 'Observations',
                icon: 'pi pi-fw pi-eye',
                to: '/crops/observations'
            },
            {
                label: 'Input Applications',
                icon: 'pi pi-fw pi-sparkles',
                to: '/crops/inputs'
            },
            {
                label: 'Pest & Disease',
                icon: 'pi pi-fw pi-exclamation-triangle',
                to: '/crops/pest-disease'
            },
            {
                label: 'Care Plans',
                icon: 'pi pi-fw pi-file-edit',
                to: '/crops/care-plans'
            },
            {
                label: 'Care Schedules',
                icon: 'pi pi-fw pi-calendar-clock',
                to: '/crops/care-schedules'
            }
        ]
    },
    {
        label: 'Animal Management',
        icon: 'pi pi-fw pi-heart',
        items: [
            {
                label: 'Overview',
                icon: 'pi pi-fw pi-chart-pie',
                to: '/animals'
            },
            {
                label: 'Individual Animals',
                icon: 'pi pi-fw pi-id-card',
                to: '/animals/list'
            },
            {
                label: 'Groups & Flocks',
                icon: 'pi pi-fw pi-users',
                to: '/animals/groups'
            },
            {
                label: 'Care Plans',
                icon: 'pi pi-fw pi-file-edit',
                to: '/animals/care-plans'
            },
            {
                label: 'Scheduled Tasks',
                icon: 'pi pi-fw pi-calendar-clock',
                to: '/animals/scheduled-tasks'
            },
            {
                label: 'Production',
                icon: 'pi pi-fw pi-chart-line',
                to: '/animals/production'
            },
            // In your menu configuration
            {
                label: 'Health Records',
                icon: 'pi pi-heart',
                to: '/animals/health-records'
            },
            {
                label: 'Diseases & Treatments',
                icon: 'pi pi-exclamation-circle',
                to: '/animals/diseases-treatments'
            },
            {
                label: 'Feed Records',
                icon: 'pi pi-box',
                to: '/animals/feed-records'
            },
            {
                label: 'Breeding Records',
                icon: 'pi pi-users',
                to: '/animals/breeding-records'
            },
            {
                label: 'Incubation',
                icon: 'pi pi-sun',
                to: '/animals/incubation'
            },
            {
                label: 'Sales',
                icon: 'pi pi-shopping-cart',
                to: '/animals/sales'
            }
        ]
    },
    {
        label: 'Inventory',
        icon: 'pi pi-fw pi-database',
        items: [
            {
                label: 'Items & Stock',
                icon: 'pi pi-fw pi-box',
                to: '/inventory'
            }
        ]
    },
    {
        label: 'Finance',
        icon: 'pi pi-fw pi-wallet',
        items: [
            {
                label: 'Overview',
                icon: 'pi pi-fw pi-chart-bar',
                to: '/finance'
            },
            {
                label: 'Transactions',
                icon: 'pi pi-fw pi-arrow-right-arrow-left',
                to: '/finance/transactions'
            },
            {
                label: 'Sales',
                icon: 'pi pi-fw pi-shopping-cart',
                to: '/finance/sales'
            }
        ]
    },
    {
        label: 'Employees',
        icon: 'pi pi-fw pi-users',
        items: [
            {
                label: 'Employee List',
                icon: 'pi pi-fw pi-id-card',
                to: '/employees'
            },
            {
                label: 'Attendance',
                icon: 'pi pi-fw pi-clock',
                to: '/employees/attendance'
            },
            {
                label: 'Salaries',
                icon: 'pi pi-fw pi-money-bill',
                to: '/employees/salaries'
            }
        ]
    },
    {
        label: 'Tasks',
        icon: 'pi pi-fw pi-check-square',
        items: [
            {
                label: 'Task List',
                icon: 'pi pi-fw pi-list-check',
                to: '/tasks'
            },
            {
                label: 'Calendar',
                icon: 'pi pi-fw pi-calendar',
                to: '/tasks/calendar'
            }
        ]
    },
    {
        separator: true
    },
    {
        label: 'Development',
        icon: 'pi pi-fw pi-code',
        items: [
            {
                label: 'Form Layout',
                icon: 'pi pi-fw pi-id-card',
                to: '/uikit/formlayout'
            },
            {
                label: 'Table',
                icon: 'pi pi-fw pi-table',
                to: '/uikit/table'
            },
            {
                label: 'Charts',
                icon: 'pi pi-fw pi-chart-bar',
                to: '/uikit/charts'
            },
            {
                label: 'CRUD Example',
                icon: 'pi pi-fw pi-pencil',
                to: '/pages/crud'
            }
        ]
    }
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
