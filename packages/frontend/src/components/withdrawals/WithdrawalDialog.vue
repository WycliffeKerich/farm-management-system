<script setup>
import { ref, watch } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import Textarea from 'primevue/textarea';
import { formatApiDate } from '@/utils/dates';
import { describeHold } from '@/utils/withdrawals';

/**
 * Shows a 409 WITHDRAWAL_ACTIVE refusal from useWithdrawalGuard. The owner can
 * give a reason, which is stored with the entry, and save anyway.
 */
const props = defineProps({
    /** The object useWithdrawalGuard() returns */
    guard: { type: Object, required: true }
});

const reason = ref('');

watch(
    () => props.guard.visible,
    (visible) => {
        if (visible) reason.value = '';
    }
);

const onVisible = (visible) => {
    if (!visible) props.guard.close();
};
</script>

<template>
    <Dialog :visible="guard.visible" header="Withdrawal period" :style="{ width: '520px' }" :modal="true" @update:visible="onVisible">
        <div v-if="guard.conflict" class="flex flex-col gap-4">
            <Message severity="warn" :closable="false">{{ guard.conflict.message }}</Message>

            <ul v-if="guard.conflict.holds.length" class="list-disc pl-5 text-sm flex flex-col gap-1">
                <li v-for="hold in guard.conflict.holds" :key="`${hold.source}-${hold.id}`">{{ describeHold(hold) }}</li>
            </ul>

            <template v-if="guard.canOverride">
                <div class="flex flex-col gap-2">
                    <label for="withdrawal-override-reason" class="font-semibold">Reason for saving anyway *</label>
                    <Textarea id="withdrawal-override-reason" v-model="reason" rows="3" placeholder="e.g. Milk kept for the calves, not sold" autofocus />
                    <small class="text-surface-500">The reason and your name are kept with the entry.</small>
                </div>
                <Message v-if="guard.error" severity="error" :closable="false">{{ guard.error }}</Message>
            </template>
            <div v-else class="text-sm text-surface-600 dark:text-surface-300 flex flex-col gap-1">
                <p>Only the owner can override a withdrawal period; ask them if this cannot wait.</p>
                <p>
                    It can be recorded from <strong>{{ formatApiDate(guard.conflict.safe_from) }}</strong>
                </p>
            </div>
        </div>

        <template #footer>
            <template v-if="guard.canOverride">
                <Button label="Cancel" icon="pi pi-times" text @click="guard.close()" />
                <Button label="Save anyway" icon="pi pi-exclamation-triangle" severity="warn" :loading="guard.submitting" :disabled="!reason.trim()" @click="guard.confirm(reason)" />
            </template>
            <Button v-else label="Close" icon="pi pi-times" text @click="guard.close()" />
        </template>
    </Dialog>
</template>
