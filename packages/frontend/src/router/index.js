import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            meta: { requiresAuth: true },
            children: [
                {
                    path: '/',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                // Crop Management
                {
                    path: '/crops',
                    name: 'crops',
                    component: () => import('@/views/crops/CropOverview.vue'),
                    meta: { breadcrumb: ['Crops', 'Overview'] }
                },
                {
                    path: '/crops/batches',
                    name: 'crop-batches',
                    component: () => import('@/views/crops/CropBatchList.vue'),
                    meta: { breadcrumb: ['Crops', 'Batches'] }
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
                    meta: { breadcrumb: ['Crops', 'Harvests'] }
                },
                {
                    path: '/crops/observations',
                    name: 'observations',
                    component: () => import('@/views/crops/ObservationsList.vue'),
                    meta: { breadcrumb: ['Crops', 'Observations'] }
                },
                {
                    path: '/crops/inputs',
                    name: 'input-applications',
                    component: () => import('@/views/crops/InputApplicationsList.vue'),
                    meta: { breadcrumb: ['Crops', 'Input Applications'] }
                },
                {
                    path: '/crops/pest-disease',
                    name: 'pest-disease',
                    component: () => import('@/views/crops/PestDiseaseList.vue'),
                    meta: { breadcrumb: ['Crops', 'Pest & Disease'] }
                },
                {
                    path: '/crops/care-plans',
                    name: 'care-plans',
                    component: () => import('@/views/crops/CarePlanList.vue'),
                    meta: { breadcrumb: ['Crops', 'Care Plans'] }
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
                    meta: { breadcrumb: ['Crops', 'Care Schedules'] }
                },
                // Animal Management
                {
                    path: '/animals',
                    name: 'animals',
                    component: () => import('@/views/animals/AnimalOverview.vue'),
                    meta: { breadcrumb: ['Animals', 'Overview'] }
                },
                {
                    path: '/animals/list',
                    name: 'animal-list',
                    component: () => import('@/views/animals/AnimalList.vue'),
                    meta: { breadcrumb: ['Animals', 'Individual Animals'] }
                },
                {
                    path: '/animals/:id',
                    name: 'animal-detail',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Animals', 'Animal Detail'] }
                },
                {
                    path: '/animals/groups',
                    name: 'animal-groups',
                    component: () => import('@/views/animals/AnimalGroupList.vue'),
                    meta: { breadcrumb: ['Animals', 'Groups'] }
                },
                {
                    path: '/animals/groups/:id',
                    name: 'animal-group-detail',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Animals', 'Group Detail'] }
                },
                {
                    path: '/animals/care-plans',
                    name: 'animal-care-plans',
                    component: () => import('@/views/animals/AnimalCarePlanList.vue'),
                    meta: { breadcrumb: ['Animals', 'Care Plans'] }
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
                    meta: { breadcrumb: ['Animals', 'Scheduled Tasks'] }
                },
                {
                    path: '/animals/care-schedules',
                    name: 'animal-care-schedules',
                    component: () => import('@/views/animals/AnimalCareScheduleList.vue'),
                    meta: { breadcrumb: ['Animals', 'Care Schedules'] }
                },
                {
                    path: '/animals/production',
                    name: 'animal-production',
                    component: () => import('@/views/animals/AnimalProduction.vue'),
                    meta: { breadcrumb: ['Animals', 'Production'] }
                },
                {
                    path: '/animals/health-records',
                    name: 'animal-health-records',
                    component: () => import('@/views/animals/AnimalHealthRecords.vue'),
                    meta: { breadcrumb: ['Animals', 'Health Records'] }
                },
                {
                    path: '/animals/diseases-treatments',
                    name: 'animal-diseases-treatments',
                    component: () => import('@/views/animals/AnimalDiseasesList.vue'),
                    meta: { breadcrumb: ['Animals', 'Diseases & Treatments'] }
                },
                {
                    path: '/animals/feed-records',
                    name: 'animal-feed-records',
                    component: () => import('@/views/animals/AnimalFeedRecords.vue'),
                    meta: { breadcrumb: ['Animals', 'Feed Records'] }
                },
                {
                    path: '/animals/breeding-records',
                    name: 'animal-breeding-records',
                    component: () => import('@/views/animals/AnimalBreedingRecords.vue'),
                    meta: { breadcrumb: ['Animals', 'Breeding Records'] }
                },
                {
                    path: '/animals/sales',
                    name: 'animal-sales',
                    component: () => import('@/views/animals/AnimalSales.vue'),
                    meta: { breadcrumb: ['Animals', 'Sales'] }
                },
                {
                    path: '/animals/incubation',
                    name: 'incubation-records',
                    component: () => import('@/views/animals/IncubationRecords.vue'),
                    meta: { breadcrumb: ['Animals', 'Incubation'] }
                },
                // Inventory Management
                {
                    path: '/inventory',
                    name: 'inventory',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Inventory', 'Items'] }
                },
                // Financial Management
                {
                    path: '/finance',
                    name: 'finance',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Finance', 'Overview'] }
                },
                {
                    path: '/finance/transactions',
                    name: 'transactions',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Finance', 'Transactions'] }
                },
                {
                    path: '/finance/sales',
                    name: 'sales',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Finance', 'Sales'] }
                },
                // Employee Management
                {
                    path: '/employees',
                    name: 'employees',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Employees', 'List'] }
                },
                {
                    path: '/employees/attendance',
                    name: 'attendance',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Employees', 'Attendance'] }
                },
                {
                    path: '/employees/salaries',
                    name: 'salaries',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Employees', 'Salaries'] }
                },
                // Task Management
                {
                    path: '/tasks',
                    name: 'tasks',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Tasks', 'List'] }
                },
                {
                    path: '/tasks/calendar',
                    name: 'task-calendar',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Tasks', 'Calendar'] }
                },
                // Settings & Profile
                {
                    path: '/profile',
                    name: 'profile',
                    component: () => import('@/views/pages/Empty.vue'),
                    meta: { breadcrumb: ['Settings', 'Profile'] }
                },
                // Keep some UI kit pages for reference during development
                {
                    path: '/uikit/formlayout',
                    name: 'formlayout',
                    component: () => import('@/views/uikit/FormLayout.vue')
                },
                {
                    path: '/uikit/table',
                    name: 'table',
                    component: () => import('@/views/uikit/TableDoc.vue')
                },
                {
                    path: '/uikit/charts',
                    name: 'charts',
                    component: () => import('@/views/uikit/ChartDoc.vue')
                },
                {
                    path: '/pages/crud',
                    name: 'crud',
                    component: () => import('@/views/pages/Crud.vue')
                }
            ]
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
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
    ]
});

// Navigation guard for authentication
router.beforeEach(async (to, from, next) => {
    const token = localStorage.getItem('accessToken');
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

    if (requiresAuth && !token) {
        // Redirect to login if trying to access protected route without token
        next({ name: 'login', query: { redirect: to.fullPath } });
    } else if (to.name === 'login' && token) {
        // Redirect to dashboard if already logged in
        next({ name: 'dashboard' });
    } else {
        next();
    }
});

export default router;
