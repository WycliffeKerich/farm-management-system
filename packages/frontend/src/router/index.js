import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { createAuthGuard } from './guard';

/**
 * Route meta:
 * - requiresAuth: signed-in users only (inherited by children)
 * - roles: only these roles may open the route; others land on /auth/access
 * - guestOnly: signed-in users are sent to the dashboard
 * - menu: { section, label, icon } lists the route in the sidebar (see ./menu.js)
 */
export const routes = [
    {
        path: '/',
        component: AppLayout,
        meta: { requiresAuth: true },
        children: [
            {
                path: '/',
                name: 'dashboard',
                component: () => import('@/views/Dashboard.vue'),
                meta: { menu: { section: 'home', label: 'Dashboard', icon: 'pi pi-fw pi-home' } }
            },
            {
                path: '/timeline',
                name: 'farm-timeline',
                component: () => import('@/views/activities/FarmTimeline.vue'),
                meta: { breadcrumb: ['Farm', 'Timeline'], menu: { section: 'home', label: 'Farm Timeline', icon: 'pi pi-fw pi-history' } }
            },
            // Crop Management
            {
                path: '/crops',
                name: 'crops',
                component: () => import('@/views/crops/CropOverview.vue'),
                meta: { breadcrumb: ['Crops', 'Overview'], menu: { section: 'crops', label: 'Overview', icon: 'pi pi-fw pi-chart-pie' } }
            },
            {
                path: '/crops/batches',
                name: 'crop-batches',
                component: () => import('@/views/crops/CropBatchList.vue'),
                meta: { breadcrumb: ['Crops', 'Batches'], menu: { section: 'crops', label: 'Crop Batches', icon: 'pi pi-fw pi-th-large' } }
            },
            {
                path: '/crops/batches/:id',
                name: 'crop-batch-detail',
                component: () => import('@/views/crops/CropBatchDetail.vue'),
                meta: { breadcrumb: ['Crops', 'Batch Detail'] }
            },
            {
                path: '/crops/harvests',
                name: 'harvests',
                component: () => import('@/views/crops/HarvestList.vue'),
                meta: { breadcrumb: ['Crops', 'Harvests'], menu: { section: 'crops', label: 'Harvests', icon: 'pi pi-fw pi-box' } }
            },
            {
                path: '/crops/observations',
                name: 'observations',
                component: () => import('@/views/crops/ObservationsList.vue'),
                meta: { breadcrumb: ['Crops', 'Observations'], menu: { section: 'crops', label: 'Observations', icon: 'pi pi-fw pi-eye' } }
            },
            {
                path: '/crops/inputs',
                name: 'input-applications',
                component: () => import('@/views/crops/InputApplicationsList.vue'),
                meta: { breadcrumb: ['Crops', 'Input Applications'], menu: { section: 'crops', label: 'Input Applications', icon: 'pi pi-fw pi-sparkles' } }
            },
            {
                path: '/crops/pest-disease',
                name: 'pest-disease',
                component: () => import('@/views/crops/PestDiseaseList.vue'),
                meta: { breadcrumb: ['Crops', 'Pest & Disease'], menu: { section: 'crops', label: 'Pest & Disease', icon: 'pi pi-fw pi-exclamation-triangle' } }
            },
            {
                path: '/crops/care-plans',
                name: 'care-plans',
                component: () => import('@/views/crops/CarePlanList.vue'),
                meta: { breadcrumb: ['Crops', 'Care Plans'], menu: { section: 'crops', label: 'Care Plans', icon: 'pi pi-fw pi-file-edit' } }
            },
            {
                path: '/crops/care-plans/:id',
                name: 'care-plan-detail',
                component: () => import('@/views/crops/CarePlanDetail.vue'),
                meta: { breadcrumb: ['Crops', 'Care Plan Detail'] }
            },
            {
                path: '/crops/care-schedules',
                name: 'care-schedules',
                component: () => import('@/views/crops/CareScheduleList.vue'),
                meta: { breadcrumb: ['Crops', 'Care Schedules'], menu: { section: 'crops', label: 'Care Schedules', icon: 'pi pi-fw pi-calendar-clock' } }
            },
            // Animal Management
            {
                path: '/animals',
                name: 'animals',
                component: () => import('@/views/animals/AnimalOverview.vue'),
                meta: { breadcrumb: ['Animals', 'Overview'], menu: { section: 'animals', label: 'Overview', icon: 'pi pi-fw pi-chart-pie' } }
            },
            {
                path: '/animals/list',
                name: 'animal-list',
                component: () => import('@/views/animals/AnimalList.vue'),
                meta: { breadcrumb: ['Animals', 'Individual Animals'], menu: { section: 'animals', label: 'Individual Animals', icon: 'pi pi-fw pi-id-card' } }
            },
            {
                path: '/animals/:id',
                name: 'animal-detail',
                component: () => import('@/views/animals/AnimalDetail.vue'),
                meta: { breadcrumb: ['Animals', 'Animal Detail'] }
            },
            {
                path: '/animals/groups',
                name: 'animal-groups',
                component: () => import('@/views/animals/AnimalGroupList.vue'),
                meta: { breadcrumb: ['Animals', 'Groups'], menu: { section: 'animals', label: 'Groups & Flocks', icon: 'pi pi-fw pi-users' } }
            },
            {
                path: '/animals/groups/:id',
                name: 'animal-group-detail',
                component: () => import('@/views/animals/AnimalGroupDetail.vue'),
                meta: { breadcrumb: ['Animals', 'Group Detail'] }
            },
            {
                path: '/animals/care-plans',
                name: 'animal-care-plans',
                component: () => import('@/views/animals/AnimalCarePlanList.vue'),
                meta: { breadcrumb: ['Animals', 'Care Plans'], menu: { section: 'animals', label: 'Care Plans', icon: 'pi pi-fw pi-file-edit' } }
            },
            {
                path: '/animals/care-plans/:id',
                name: 'animal-care-plan-detail',
                component: () => import('@/views/animals/AnimalCarePlanDetail.vue'),
                meta: { breadcrumb: ['Animals', 'Care Plan Detail'] }
            },
            {
                path: '/animals/scheduled-tasks',
                name: 'animal-scheduled-tasks',
                component: () => import('@/views/animals/AnimalScheduledTasks.vue'),
                meta: { breadcrumb: ['Animals', 'Scheduled Tasks'], menu: { section: 'animals', label: 'Scheduled Tasks', icon: 'pi pi-fw pi-calendar-clock' } }
            },
            {
                path: '/animals/care-schedules',
                name: 'animal-care-schedules',
                component: () => import('@/views/animals/AnimalCareScheduleList.vue'),
                meta: { breadcrumb: ['Animals', 'Care Schedules'], menu: { section: 'animals', label: 'Care Schedules', icon: 'pi pi-fw pi-calendar' } }
            },
            {
                path: '/animals/production',
                name: 'animal-production',
                component: () => import('@/views/animals/AnimalProduction.vue'),
                meta: { breadcrumb: ['Animals', 'Production'], menu: { section: 'animals', label: 'Production', icon: 'pi pi-fw pi-chart-line' } }
            },
            {
                path: '/animals/health-records',
                name: 'animal-health-records',
                component: () => import('@/views/animals/AnimalHealthRecords.vue'),
                meta: { breadcrumb: ['Animals', 'Health Records'], menu: { section: 'animals', label: 'Health Records', icon: 'pi pi-fw pi-heart' } }
            },
            {
                path: '/animals/diseases-treatments',
                name: 'animal-diseases-treatments',
                component: () => import('@/views/animals/AnimalDiseasesList.vue'),
                meta: { breadcrumb: ['Animals', 'Diseases & Treatments'], menu: { section: 'animals', label: 'Diseases & Treatments', icon: 'pi pi-fw pi-exclamation-circle' } }
            },
            {
                path: '/animals/feed-records',
                name: 'animal-feed-records',
                component: () => import('@/views/animals/AnimalFeedRecords.vue'),
                meta: { breadcrumb: ['Animals', 'Feed Records'], menu: { section: 'animals', label: 'Feed Records', icon: 'pi pi-fw pi-box' } }
            },
            {
                path: '/animals/breeding-records',
                name: 'animal-breeding-records',
                component: () => import('@/views/animals/AnimalBreedingRecords.vue'),
                meta: { breadcrumb: ['Animals', 'Breeding Records'], menu: { section: 'animals', label: 'Breeding Records', icon: 'pi pi-fw pi-users' } }
            },
            {
                path: '/animals/incubation',
                name: 'incubation-records',
                component: () => import('@/views/animals/IncubationRecords.vue'),
                meta: { breadcrumb: ['Animals', 'Incubation'], menu: { section: 'animals', label: 'Incubation', icon: 'pi pi-fw pi-sun' } }
            },
            {
                path: '/animals/sales',
                name: 'animal-sales',
                component: () => import('@/views/animals/AnimalSales.vue'),
                meta: { breadcrumb: ['Animals', 'Sales'], menu: { section: 'animals', label: 'Sales', icon: 'pi pi-fw pi-shopping-cart' } }
            },
            // Inventory
            {
                path: '/inventory',
                name: 'inventory',
                component: () => import('@/views/inventory/InventoryDashboard.vue'),
                meta: { breadcrumb: ['Inventory', 'Dashboard'], menu: { section: 'inventory', label: 'Dashboard', icon: 'pi pi-fw pi-chart-pie' } }
            },
            {
                path: '/inventory/items',
                name: 'inventory-items',
                component: () => import('@/views/inventory/ItemList.vue'),
                meta: { breadcrumb: ['Inventory', 'Items'], menu: { section: 'inventory', label: 'Items', icon: 'pi pi-fw pi-box' } }
            },
            {
                path: '/inventory/items/:id',
                name: 'inventory-item-detail',
                component: () => import('@/views/inventory/ItemDetail.vue'),
                meta: { breadcrumb: ['Inventory', 'Item Detail'] }
            },
            {
                path: '/inventory/suppliers',
                name: 'inventory-suppliers',
                component: () => import('@/views/inventory/SupplierList.vue'),
                meta: { breadcrumb: ['Inventory', 'Suppliers'], menu: { section: 'inventory', label: 'Suppliers', icon: 'pi pi-fw pi-truck' } }
            },
            {
                path: '/inventory/reports',
                name: 'inventory-reports',
                component: () => import('@/views/inventory/InventoryReports.vue'),
                meta: { breadcrumb: ['Inventory', 'Reports'], menu: { section: 'inventory', label: 'Reports', icon: 'pi pi-fw pi-chart-bar' }, roles: ['owner', 'manager'] }
            },
            // Administration
            {
                path: '/users',
                name: 'users',
                component: () => import('@/views/users/UserList.vue'),
                meta: { breadcrumb: ['Administration', 'Users'], menu: { section: 'admin', label: 'Users', icon: 'pi pi-fw pi-user-edit' }, roles: ['owner'] }
            },
            {
                path: '/enterprises',
                name: 'enterprises',
                component: () => import('@/views/settings/EnterpriseList.vue'),
                meta: { breadcrumb: ['Administration', 'Enterprises'], menu: { section: 'admin', label: 'Enterprises', icon: 'pi pi-fw pi-briefcase' } }
            },
            {
                path: '/audit-log',
                name: 'audit-log',
                component: () => import('@/views/settings/AuditLog.vue'),
                meta: { breadcrumb: ['Administration', 'Audit Log'], menu: { section: 'admin', label: 'Audit Log', icon: 'pi pi-fw pi-history' }, roles: ['owner'] }
            },
            {
                path: '/settings',
                name: 'farm-settings',
                component: () => import('@/views/settings/FarmSettings.vue'),
                meta: { breadcrumb: ['Administration', 'Farm Settings'], menu: { section: 'admin', label: 'Farm Settings', icon: 'pi pi-fw pi-sliders-h' } }
            },
            {
                path: '/profile',
                name: 'profile',
                component: () => import('@/views/Profile.vue'),
                meta: { breadcrumb: ['Account', 'Profile'] }
            }
        ]
    },
    {
        path: '/auth/login',
        name: 'login',
        component: () => import('@/views/pages/auth/Login.vue'),
        meta: { guestOnly: true }
    },
    {
        path: '/auth/setup',
        name: 'setup',
        component: () => import('@/views/pages/auth/Setup.vue'),
        meta: { guestOnly: true }
    },
    {
        path: '/auth/forgot-password',
        name: 'forgot-password',
        component: () => import('@/views/pages/auth/ForgotPassword.vue')
    },
    {
        path: '/auth/reset-password',
        name: 'reset-password',
        component: () => import('@/views/pages/auth/ResetPassword.vue')
    },
    {
        path: '/auth/access',
        name: 'accessDenied',
        component: () => import('@/views/pages/auth/Access.vue')
    },
    {
        path: '/auth/error',
        name: 'error',
        component: () => import('@/views/pages/auth/Error.vue')
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'notfound',
        component: () => import('@/views/pages/NotFound.vue')
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach(createAuthGuard(() => useAuthStore()));

export default router;
