import { computed, ref, watch } from 'vue';

/**
 * Query parameters for a paged list endpoint: page and limit, the sort as
 * `sort` and `order`, and the filters that have a value (an empty list has none)
 * @param {{first: number, rows: number, sortField: string|null, sortOrder: number, filters: Object}} state
 * @returns {Object}
 */
export function toPageParams({ first, rows, sortField, sortOrder, filters }) {
    const params = { page: Math.floor(first / rows) + 1, limit: rows };
    if (sortField) {
        params.sort = sortField;
        params.order = sortOrder === -1 ? 'desc' : 'asc';
    }
    for (const [key, value] of Object.entries(filters || {})) {
        const trimmed = typeof value === 'string' ? value.trim() : value;
        if (Array.isArray(trimmed) && trimmed.length === 0) continue;
        if (trimmed !== null && trimmed !== undefined && trimmed !== '') params[key] = trimmed;
    }
    return params;
}

/**
 * Server-side paging, sorting and filtering for a PrimeVue DataTable in lazy
 * mode. Bind the table with
 * `:value="data" lazy paginator :first="first" :rows="rows" :totalRecords="totalRecords"
 * :sortField="sortField" :sortOrder="sortOrder" @page="onPage" @sort="onSort"`.
 *
 * Changing a filter goes back to the first page and reloads after a pause, so
 * typing in a search box sends one request.
 *
 * @param {(params: Object) => Promise<{data: Object}>} fetchPage - A service call; its
 *   response body is `{ data, pagination: { total } }`
 * @param {Object} [options]
 * @param {number} [options.rows=20] - Rows per page
 * @param {string|null} [options.sortField=null] - null for the endpoint's own order
 * @param {number} [options.sortOrder=1] - 1 ascending, -1 descending
 * @param {Object} [options.filters={}] - Initial filters, sent when set
 * @param {number} [options.debounce=300] - Milliseconds to wait after a filter changes
 * @param {(error: Error) => void} [options.onError] - Defaults to logging it
 */
export function useLazyTable(
    fetchPage,
    { rows: initialRows = 20, sortField: initialSortField = null, sortOrder: initialSortOrder = 1, filters: initialFilters = {}, debounce = 300, onError = (error) => console.error('Failed to load:', error) } = {}
) {
    const data = ref([]);
    /** The last response body, for anything the endpoint sends beside the rows */
    const body = ref(null);
    const totalRecords = ref(0);
    const loading = ref(false);
    const first = ref(0);
    const rows = ref(initialRows);
    const sortField = ref(initialSortField);
    const sortOrder = ref(initialSortOrder);
    const filters = ref({ ...initialFilters });

    const params = computed(() => toPageParams({ first: first.value, rows: rows.value, sortField: sortField.value, sortOrder: sortOrder.value, filters: filters.value }));

    let latest = 0;
    let timer = null;

    const load = async () => {
        clearTimeout(timer);
        const request = ++latest;
        loading.value = true;
        try {
            const response = await fetchPage(params.value);
            // A slower, older request must not overwrite a newer one
            if (request !== latest) return;
            const total = response.data.pagination?.total ?? 0;
            // After a delete empties the last page, show the page before it
            if (!response.data.data?.length && first.value > 0 && total > 0) {
                first.value = Math.max(0, (Math.ceil(total / rows.value) - 1) * rows.value);
                return load();
            }
            data.value = response.data.data || [];
            body.value = response.data;
            totalRecords.value = total;
        } catch (error) {
            if (request === latest) onError(error);
        } finally {
            if (request === latest) loading.value = false;
        }
    };

    const onPage = (event) => {
        first.value = event.first;
        rows.value = event.rows;
        load();
    };

    const onSort = (event) => {
        sortField.value = event.sortField || null;
        sortOrder.value = event.sortOrder ?? 1;
        first.value = 0;
        load();
    };

    watch(
        filters,
        () => {
            first.value = 0;
            clearTimeout(timer);
            timer = setTimeout(load, debounce);
        },
        { deep: true }
    );

    return { data, body, totalRecords, loading, first, rows, sortField, sortOrder, filters, params, load, onPage, onSort };
}
