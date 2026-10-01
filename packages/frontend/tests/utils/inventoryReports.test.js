import { describe, expect, it } from 'vitest';
import { formatDaysOfCover, formatExpiryDistance, orderText, reorderBySupplier } from '@/utils/inventoryReports';

const row = (overrides) => ({ item_id: 1, name: 'Item', unit: 'kg', suggested_quantity: 10, estimated_cost: 100, supplier_id: null, supplier_name: null, supplier_phone: null, supplier_email: null, ...overrides });

describe('inventory report helpers', () => {
    it('groups the reorder list into one order per supplier, unassigned items last', () => {
        const orders = reorderBySupplier([
            row({ item_id: 1, name: 'Dairy meal', supplier_id: 3, supplier_name: 'Unga Feeds', estimated_cost: 2500 }),
            row({ item_id: 2, name: 'Twine', estimated_cost: null }),
            row({ item_id: 3, name: 'DAP', supplier_id: 5, supplier_name: 'Agrovet Ltd', supplier_phone: '0700000000', estimated_cost: 3800.5 }),
            row({ item_id: 4, name: 'Layers mash', supplier_id: 3, supplier_name: 'Unga Feeds', estimated_cost: 1200.25 })
        ]);

        expect(orders.map((order) => order.supplier_name)).toEqual(['Agrovet Ltd', 'Unga Feeds', null]);
        expect(orders[0]).toMatchObject({ supplier_id: 5, supplier_phone: '0700000000', estimated_cost: 3800.5, uncosted_count: 0 });
        expect(orders[1].items.map((item) => item.name)).toEqual(['Dairy meal', 'Layers mash']);
        expect(orders[1].estimated_cost).toBe(3700.25);
        expect(orders[2]).toMatchObject({ supplier_id: null, estimated_cost: 0, uncosted_count: 1 });
        expect(reorderBySupplier()).toEqual([]);
    });

    it('describes how long stock lasts and when it expires', () => {
        expect([null, 0, 1, 12].map(formatDaysOfCover)).toEqual(['No recent use', 'Under a day', '1 day', '12 days']);
        expect([-4, -1, 0, 1, 9].map(formatExpiryDistance)).toEqual(['Expired 4 days ago', 'Expired yesterday', 'Expires today', 'Tomorrow', 'In 9 days']);
    });

    it('writes an order to send to the supplier', () => {
        const [order] = reorderBySupplier([
            row({ name: 'DAP', unit: 'bags', suggested_quantity: 4, supplier_id: 5, supplier_name: 'Agrovet Ltd' }),
            row({ name: 'Gloves', unit: '', suggested_quantity: 20, supplier_id: 5, supplier_name: 'Agrovet Ltd' })
        ]);

        expect(orderText(order, 'Kerich Farm')).toBe(['Hello Agrovet Ltd,', '', 'Please supply the following for Kerich Farm:', '- DAP: 4 bags', '- Gloves: 20', '', 'Thank you.'].join('\n'));
        expect(orderText({ supplier_name: null, items: [] })).toMatch(/^Hello,\n\nPlease supply the following:/);
    });
});
