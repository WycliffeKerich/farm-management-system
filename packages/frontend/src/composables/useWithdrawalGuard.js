import { computed, reactive } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { validationMessage } from '@/utils/forms';
import { withdrawalConflict } from '@/utils/withdrawals';

/**
 * Save something the server may refuse with 409 WITHDRAWAL_ACTIVE (a harvest,
 * a milk, egg or meat record, or a sale). A refusal opens WithdrawalDialog
 * with the holds; the owner can give a reason and save anyway, everyone else
 * can only close it.
 *
 *   const guard = useWithdrawalGuard();
 *   await guard.attempt((override) => service.save({ ...data, ...override }), onSaved);
 *
 * attempt() resolves true when saved, false when the dialog opened, and
 * rethrows any other error. onSaved runs after a save either way.
 */
export function useWithdrawalGuard() {
    const authStore = useAuthStore();
    let pending = null;

    const guard = reactive({
        visible: false,
        /** { message, safe_from, holds } of the refusal */
        conflict: null,
        /** Why the override itself failed */
        error: '',
        submitting: false,
        canOverride: computed(() => authStore.hasRole('owner'))
    });

    const close = () => {
        guard.visible = false;
        guard.conflict = null;
        guard.error = '';
        pending = null;
    };

    const attempt = async (submit, onSaved) => {
        let response;
        try {
            response = await submit({});
        } catch (err) {
            const conflict = withdrawalConflict(err);
            if (!conflict) throw err;
            pending = { submit, onSaved };
            guard.conflict = conflict;
            guard.error = '';
            guard.visible = true;
            return false;
        }
        await onSaved?.(response);
        return true;
    };

    const confirm = async (reason) => {
        const trimmed = typeof reason === 'string' ? reason.trim() : '';
        if (!pending || !trimmed) return false;

        const { submit, onSaved } = pending;
        guard.submitting = true;
        guard.error = '';
        let response;
        try {
            response = await submit({ override_reason: trimmed });
        } catch (err) {
            guard.error = validationMessage(err, 'Failed to save with the override');
            return false;
        } finally {
            guard.submitting = false;
        }
        close();
        await onSaved?.(response);
        return true;
    };

    return Object.assign(guard, { attempt, confirm, close });
}
