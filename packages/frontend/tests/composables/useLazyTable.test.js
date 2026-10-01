import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { toPageParams, useLazyTable } from '@/composables/useLazyTable';

const page = (rows, total = rows.length, extra = {}) => ({ data: { success: true, data: rows, pagination: { total }, ...extra } });

describe('toPageParams', () => {
    it('turns the table state into page, limit, sort and the filters that are set', () => {
        expect(toPageParams({ first: 40, rows: 20, sortField: 'current_stock', sortOrder: -1, filters: { search: '  maize ', category_id: null, stock_status: '', low: 0 } })).toEqual({
            page: 3,
            limit: 20,
            sort: 'current_stock',
            order: 'desc',
            search: 'maize',
            low: 0
        });
        expect(toPageParams({ first: 0, rows: 10, sortField: null, sortOrder: 1, filters: {} })).toEqual({ page: 1, limit: 10 });
    });

    it('sends a list filter only when it has values', () => {
        expect(toPageParams({ first: 0, rows: 10, sortField: null, sortOrder: 1, filters: { action: [] } })).toEqual({ page: 1, limit: 10 });
        expect(toPageParams({ first: 0, rows: 10, sortField: null, sortOrder: 1, filters: { action: ['insert', 'update'] } })).toEqual({ page: 1, limit: 10, action: ['insert', 'update'] });
    });
});

describe('useLazyTable', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('loads a page and keeps the rows, total and response body', async () => {
        const fetchPage = vi.fn().mockResolvedValue(page([{ id: 1 }], 41, { stock_counts: { total: 41 } }));
        const table = useLazyTable(fetchPage, { rows: 10, filters: { search: '' } });

        await table.load();

        expect(fetchPage).toHaveBeenCalledWith({ page: 1, limit: 10 });
        expect(table.data.value).toEqual([{ id: 1 }]);
        expect(table.totalRecords.value).toBe(41);
        expect(table.body.value.stock_counts).toEqual({ total: 41 });
        expect(table.loading.value).toBe(false);
    });

    it('pages and sorts on the table events, a new sort starting from the first page', async () => {
        const fetchPage = vi.fn().mockResolvedValue(page([{ id: 1 }], 100));
        const table = useLazyTable(fetchPage, { rows: 10 });

        table.onPage({ first: 30, rows: 10 });
        await vi.runAllTimersAsync();
        expect(fetchPage).toHaveBeenLastCalledWith({ page: 4, limit: 10 });

        table.onSort({ sortField: 'name', sortOrder: -1 });
        await vi.runAllTimersAsync();
        expect(fetchPage).toHaveBeenLastCalledWith({ page: 1, limit: 10, sort: 'name', order: 'desc' });
        expect(table.first.value).toBe(0);
    });

    it('waits for filters to settle, then reloads from the first page once', async () => {
        const fetchPage = vi.fn().mockResolvedValue(page([], 0));
        const table = useLazyTable(fetchPage, { rows: 10, filters: { search: '' }, debounce: 300 });
        table.first.value = 20;

        table.filters.value.search = 'ma';
        await nextTick();
        table.filters.value.search = 'maize';
        await nextTick();
        expect(fetchPage).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(300);
        expect(fetchPage).toHaveBeenCalledTimes(1);
        expect(fetchPage).toHaveBeenCalledWith({ page: 1, limit: 10, search: 'maize' });
    });

    it('ignores a slower response to an older request', async () => {
        let resolveOld;
        const fetchPage = vi
            .fn()
            .mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
            .mockResolvedValueOnce(page([{ id: 'new' }]));
        const table = useLazyTable(fetchPage);

        const old = table.load();
        await table.load();
        resolveOld(page([{ id: 'old' }]));
        await old;

        expect(table.data.value).toEqual([{ id: 'new' }]);
        expect(table.loading.value).toBe(false);
    });

    it('steps back a page when the last one comes back empty', async () => {
        const fetchPage = vi
            .fn()
            .mockResolvedValueOnce(page([], 20))
            .mockResolvedValueOnce(page([{ id: 11 }], 20));
        const table = useLazyTable(fetchPage, { rows: 10 });
        table.first.value = 20;

        await table.load();

        expect(fetchPage).toHaveBeenLastCalledWith({ page: 2, limit: 10 });
        expect(table.first.value).toBe(10);
        expect(table.data.value).toEqual([{ id: 11 }]);
    });

    it('reports a failed load and stops loading', async () => {
        const onError = vi.fn();
        const error = new Error('Network Error');
        const table = useLazyTable(vi.fn().mockRejectedValue(error), { onError });

        await table.load();

        expect(onError).toHaveBeenCalledWith(error);
        expect(table.loading.value).toBe(false);
    });
});
