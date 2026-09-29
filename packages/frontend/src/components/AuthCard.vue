<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';

defineProps({
    title: { type: String, default: 'Farm Management System' },
    subtitle: { type: String, default: '' }
});
</script>

<template>
    <FloatingConfigurator />
    <Toast />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden px-4">
        <div class="flex flex-col items-center justify-center w-full max-w-[36rem]">
            <div class="w-full" style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-16 px-6 sm:px-16" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <i class="pi pi-sun text-6xl text-primary mb-4"></i>
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">{{ title }}</div>
                        <span v-if="subtitle" class="text-muted-color font-medium">{{ subtitle }}</span>
                    </div>
                    <slot />
                </div>
            </div>
        </div>
    </div>
</template>
