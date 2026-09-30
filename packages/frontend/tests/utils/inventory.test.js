import { describe, expect, it } from 'vitest';
import {
    applyItemToDose,
    emptyDose,
    emptyPurchase,
    formatSignedQuantity,
    itemSupplyFields,
    formatStock,
    isReducingMovement,
    signedQuantity,
    summariseUsage,
    toDosesPayload,
    toPurchasePayload,
    toTransactionPayload,
    transactionSeverity,
    withdrawalSummary
} from '@/utils/inventory';

describe('inventory movements', () => {
    it('knows which form movements take stock away', () => {
        expect(['usage', 'adjustment_remove', 'waste', 'expired', 'transfer'].every(isReducingMovement)).toBe(true);
        expect(['purchase', 'return', 'adjustment_add', null].some(isReducingMovement)).toBe(false);
    });

    it('sends adjustments as a signed adjustment and everything else as a magnitude', () => {
        expect(toTransactionPayload(3, { movement: 'adjustment_remove', quantity: 2.5, notes: 'Spilt' })).toEqual({
            item_id: 3,
            transaction_type: 'adjustment',
            quantity: -2.5,
            notes: 'Spilt'
        });
        expect(toTransactionPayload(3, { movement: 'adjustment_add', quantity: 4 })).toMatchObject({ transaction_type: 'adjustment', quantity: 4 });
        expect(toTransactionPayload(3, { movement: 'usage', quantity: 1 })).toEqual({ item_id: 3, transaction_type: 'usage', quantity: 1 });
    });
});

describe('ledger rows', () => {
    it('signs rows by type, and adjustments by their own quantity', () => {
        expect(signedQuantity({ transaction_type: 'purchase', quantity: 5 })).toBe(5);
        expect(signedQuantity({ transaction_type: 'waste', quantity: 5 })).toBe(-5);
        expect(signedQuantity({ transaction_type: 'adjustment', quantity: -1.5 })).toBe(-1.5);
        expect(formatSignedQuantity({ transaction_type: 'adjustment', quantity: -1.5 }, 'kg')).toBe('-1.5 kg');
        expect(formatSignedQuantity({ transaction_type: 'return', quantity: 2 })).toBe('+2');
    });

    it('colours a negative adjustment differently from a positive one', () => {
        expect(transactionSeverity({ transaction_type: 'adjustment', quantity: 3 })).toBe('success');
        expect(transactionSeverity({ transaction_type: 'adjustment', quantity: -3 })).toBe('warn');
        expect(transactionSeverity({ transaction_type: 'expired', quantity: 3 })).toBe('danger');
    });
});

describe('summariseUsage', () => {
    it('totals usage, receipts and the net change, and groups usage by reference', () => {
        const report = {
            summary: [
                { transaction_type: 'purchase', total_quantity: 10.5, net_change: 10.5 },
                { transaction_type: 'usage', total_quantity: 0.3, net_change: -0.3 },
                { transaction_type: 'adjustment', total_quantity: -1, net_change: -1 }
            ],
            transactions: [
                { transaction_type: 'usage', quantity: 0.1, reference_type: 'crop_batch' },
                { transaction_type: 'usage', quantity: 0.2, reference_type: 'crop_batch' },
                { transaction_type: 'purchase', quantity: 10.5, reference_type: null }
            ]
        };

        expect(summariseUsage(report)).toEqual({ used: 0.3, received: 10.5, net: 9.2, byReference: [{ reference_type: 'crop_batch', quantity: 0.3 }] });
        expect(summariseUsage(null)).toEqual({ used: 0, received: 0, net: 0, byReference: [] });
    });
});

describe('product pickers', () => {
    const wormer = { id: 7, name: 'Ivermectin', unit: 'ml', current_stock: '12.345', milk_withdrawal_days: 3, meat_withdrawal_days: 28, egg_withdrawal_days: null, pre_harvest_interval_days: null };

    it('shows stock on hand and the waiting period for crops or animals', () => {
        expect(formatStock(wormer)).toBe('12.35 ml in stock');
        expect(formatStock({ current_stock: null })).toBe('0 in stock');
        expect(withdrawalSummary(wormer, 'animal')).toBe('Milk 3 d · Meat 28 d');
        expect(withdrawalSummary(wormer, 'crop')).toBe('');
        expect(withdrawalSummary({ pre_harvest_interval_days: 14 }, 'crop')).toBe('PHI 14 d');
        expect(withdrawalSummary(null, 'crop')).toBe('');
    });

    it('fills a dose from the chosen item and unlinks it when cleared', () => {
        const dose = applyItemToDose(emptyDose(new Date(2026, 8, 1)), wormer);
        expect(dose).toMatchObject({ inventory_item_id: 7, product_name: 'Ivermectin', unit: 'ml', milk_withdrawal_days: 3, meat_withdrawal_days: 28, egg_withdrawal_days: null });

        expect(applyItemToDose({ ...dose, product_name: 'Ivermectin' }, null)).toMatchObject({ inventory_item_id: null, product_name: 'Ivermectin' });
    });

    it('sends only filled-in doses, with API dates', () => {
        const doses = [{ ...applyItemToDose(emptyDose(new Date(2026, 8, 1)), wormer), quantity: 5 }, { ...emptyDose(), product_name: '  Oxytet  ', quantity: 2 }, { ...emptyDose(), product_name: 'No quantity' }, emptyDose()];

        const payload = toDosesPayload(doses);
        expect(payload).toHaveLength(2);
        expect(payload[0]).toMatchObject({ inventory_item_id: 7, quantity: 5, administered_date: '2026-09-01' });
        expect(payload[1]).toMatchObject({ inventory_item_id: null, product_name: 'Oxytet', unit: null });
    });
});

describe('purchases', () => {
    const item = { id: 4, default_supplier_id: 2, cost_per_unit: 350, location: 'Chemical store' };

    it('starts a purchase from what the item was last bought as', () => {
        expect(emptyPurchase(item)).toMatchObject({ quantity: null, supplier_id: 2, unit_cost: 350, storage_location: 'Chemical store', expiry_date: null });
        expect(emptyPurchase(item).received_date).toBeInstanceOf(Date);
        expect(emptyPurchase({ id: 5 })).toMatchObject({ supplier_id: null, unit_cost: null, storage_location: '' });
    });

    it('sends dates as calendar days and leaves blank text out so the server numbers the batch', () => {
        const purchase = { ...emptyPurchase(item), quantity: 10, received_date: new Date(2026, 8, 30), expiry_date: new Date(2027, 2, 1), batch_number: '  ', notes: ' Invoice 118 ' };

        expect(toPurchasePayload(4, purchase)).toEqual({
            inventory_item_id: 4,
            quantity: 10,
            supplier_id: 2,
            unit_cost: 350,
            received_date: '2026-09-30',
            manufacture_date: null,
            expiry_date: '2027-03-01',
            batch_number: undefined,
            supplier_batch_number: undefined,
            storage_location: 'Chemical store',
            notes: 'Invoice 118'
        });
        expect(toPurchasePayload(5, { ...emptyPurchase({ id: 5 }), quantity: 1 })).toMatchObject({ supplier_id: undefined, unit_cost: undefined });
    });

    it("picks an item's supply fields for its edit form", () => {
        expect(itemSupplyFields({ ...item, reorder_quantity: 20, meat_withdrawal_days: 28, name: 'Ignored' })).toEqual({
            default_supplier_id: 2,
            reorder_quantity: 20,
            active_ingredient: null,
            pre_harvest_interval_days: null,
            milk_withdrawal_days: null,
            meat_withdrawal_days: 28,
            egg_withdrawal_days: null
        });
        expect(Object.values(itemSupplyFields())).toEqual(Array(7).fill(null));
    });
});
