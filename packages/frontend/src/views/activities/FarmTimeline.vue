<script setup>
import ActivityTimeline from '@/components/activities/ActivityTimeline.vue';
</script>

<template>
    <div class="card">
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Farm Timeline</h2>
            <p class="text-surface-600 dark:text-surface-400">Everything done on the farm, with its labour and cost. Open a row for its details and attachments.</p>
        </div>
        <ActivityTimeline />
    </div>
</template>
