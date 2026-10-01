import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth.store';
import { useWithdrawalGuard } from '@/composables/useWithdrawalGuard';

const refusal = () =>
    Object.assign(new Error('Conflict'), {
        response: {
            status: 409,
            data: { error: { code: 'WITHDRAWAL_ACTIVE', message: 'This sale falls within the withdrawal period of Oxytetracycline; it is safe from 2026-03-16', details: { safe_from: '2026-03-16', holds: [] } } }
        }
    });
const forbidden = () => Object.assign(new Error('Forbidden'), { response: { status: 403, data: { error: { message: 'Only the owner can override a withdrawal period' } } } });

describe('useWithdrawalGuard', () => {
    let authStore;

    beforeEach(() => {
        setActivePinia(createPinia());
        authStore = useAuthStore();
        authStore.user = { id: 1, role: 'owner' };
    });

    it('saves straight away when nothing is held', async () => {
        const guard = useWithdrawalGuard();
        const submit = vi.fn().mockResolvedValue({ data: { data: { id: 5 } } });
        const onSaved = vi.fn();

        expect(await guard.attempt(submit, onSaved)).toBe(true);

        expect(submit).toHaveBeenCalledWith({});
        expect(onSaved).toHaveBeenCalledWith({ data: { data: { id: 5 } } });
        expect(guard.visible).toBe(false);
    });

    it('opens on a refusal and lets the owner save with a reason', async () => {
        const guard = useWithdrawalGuard();
        const submit = vi.fn().mockRejectedValueOnce(refusal()).mockResolvedValueOnce({ data: {} });
        const onSaved = vi.fn();

        expect(await guard.attempt(submit, onSaved)).toBe(false);
        expect(guard.visible).toBe(true);
        expect(guard.canOverride).toBe(true);
        expect(guard.conflict.safe_from).toBe('2026-03-16');
        expect(onSaved).not.toHaveBeenCalled();

        expect(await guard.confirm('   ')).toBe(false);
        expect(submit).toHaveBeenCalledTimes(1);

        expect(await guard.confirm('  Sold as breeding stock ')).toBe(true);
        expect(submit).toHaveBeenLastCalledWith({ override_reason: 'Sold as breeding stock' });
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(guard.visible).toBe(false);
        expect(guard.conflict).toBeNull();
    });

    it('keeps the dialog open with the error when the override fails', async () => {
        const guard = useWithdrawalGuard();
        const submit = vi.fn().mockRejectedValueOnce(refusal()).mockRejectedValueOnce(forbidden());
        const onSaved = vi.fn();

        await guard.attempt(submit, onSaved);
        expect(await guard.confirm('Breeding stock')).toBe(false);

        expect(guard.visible).toBe(true);
        expect(guard.error).toBe('Only the owner can override a withdrawal period');
        expect(guard.submitting).toBe(false);
        expect(onSaved).not.toHaveBeenCalled();

        guard.close();
        expect(guard.visible).toBe(false);
        expect(await guard.confirm('Breeding stock')).toBe(false);
    });

    it('only lets the owner override, and rethrows other errors', async () => {
        authStore.user = { id: 2, role: 'manager' };
        const guard = useWithdrawalGuard();
        expect(guard.canOverride).toBe(false);

        const failure = new Error('Network Error');
        await expect(guard.attempt(vi.fn().mockRejectedValue(failure))).rejects.toBe(failure);
        expect(guard.visible).toBe(false);
    });
});
