<script setup>
import Tag from 'primevue/tag';
import { holdBadgeLabel, holdTooltip } from '@/utils/withdrawals';

/**
 * A badge per held product (harvest, milk, meat, eggs), with the safe date on hover
 */
defineProps({
    /** Entries from useActiveHolds (forAnimal, forGroup, or [forBatch]) */
    entries: { type: Array, default: () => [] }
});
</script>

<template>
    <span v-if="entries.length" class="inline-flex flex-wrap gap-1">
        <Tag v-for="entry in entries" :key="entry.product" v-tooltip.top="holdTooltip(entry)" :value="holdBadgeLabel(entry)" severity="warn" icon="pi pi-clock" class="text-xs" />
    </span>
</template>
