import { computed } from 'vue';
import { formatApiDate } from '@/utils/dates';
import { LOCALE, formatConfig, formatDateTime, formatMoney, formatNumber } from '@/utils/format';

/**
 * Formatting in the farm's currency and time zone, for templates.
 * Bind money inputs with `:currency="currency" :locale="locale"`.
 */
export function useFormat() {
    return {
        currency: computed(() => formatConfig.currency),
        timeZone: computed(() => formatConfig.timeZone),
        locale: LOCALE,
        formatMoney,
        formatNumber,
        formatDateTime,
        formatDate: formatApiDate
    };
}
