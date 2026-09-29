<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { buildMenu } from '@/router/menu';
import AppMenuItem from './AppMenuItem.vue';

const router = useRouter();
const authStore = useAuthStore();

// Generated from route meta, so a link never outlives its route or its role check
const model = computed(() => buildMenu(router.options.routes, (roles) => authStore.hasRole(roles)));
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item.label">
            <app-menu-item :item="item" :index="i"></app-menu-item>
        </template>
    </ul>
</template>
