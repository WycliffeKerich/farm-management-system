const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const inventoryValidators = require('../validators/inventory.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// ==================== SUMMARY ====================

router.get(
  '/summary',
  inventoryController.getSummary.bind(inventoryController)
);

// ==================== STOCK ALERTS ====================

router.get(
  '/low-stock',
  inventoryController.getLowStockItems.bind(inventoryController)
);

router.get(
  '/expiring',
  inventoryValidators.expiringFilters,
  validate,
  inventoryController.getExpiringItems.bind(inventoryController)
);

// ==================== REPORTS ====================

router.get(
  '/reports/valuation',
  authorize(['owner', 'manager']),
  inventoryValidators.valuationReportFilters,
  validate,
  inventoryController.getValuationReport.bind(inventoryController)
);

router.get(
  '/reports/reorder',
  authorize(['owner', 'manager']),
  inventoryValidators.reorderReportFilters,
  validate,
  inventoryController.getReorderReport.bind(inventoryController)
);

router.get(
  '/reports/expiring',
  authorize(['owner', 'manager']),
  inventoryValidators.expiringFilters,
  validate,
  inventoryController.getExpiringReport.bind(inventoryController)
);

// ==================== CATEGORIES ====================

router.get(
  '/categories',
  inventoryController.getCategories.bind(inventoryController)
);

router.get(
  '/categories/:id',
  inventoryValidators.idParam,
  validate,
  inventoryController.getCategoryById.bind(inventoryController)
);

router.post(
  '/categories',
  authorize(['owner', 'manager']),
  inventoryValidators.createCategory,
  validate,
  inventoryController.createCategory.bind(inventoryController)
);

router.put(
  '/categories/:id',
  authorize(['owner', 'manager']),
  inventoryValidators.updateCategory,
  validate,
  inventoryController.updateCategory.bind(inventoryController)
);

router.delete(
  '/categories/:id',
  authorize(['owner', 'manager']),
  inventoryValidators.idParam,
  validate,
  inventoryController.deleteCategory.bind(inventoryController)
);

// ==================== ITEMS ====================

router.get(
  '/items',
  inventoryValidators.itemFilters,
  validate,
  inventoryController.getItems.bind(inventoryController)
);

router.get(
  '/items/code/:code',
  inventoryValidators.codeParam,
  validate,
  inventoryController.getItemByCode.bind(inventoryController)
);

router.get(
  '/items/:id',
  inventoryValidators.idParam,
  validate,
  inventoryController.getItemById.bind(inventoryController)
);

router.get(
  '/items/:id/transactions',
  inventoryValidators.itemTransactionFilters,
  validate,
  inventoryController.getItemTransactions.bind(inventoryController)
);

router.get(
  '/items/:id/usage-report',
  inventoryValidators.usageReportFilters,
  validate,
  inventoryController.getUsageReport.bind(inventoryController)
);

router.post(
  '/items',
  authorize(['owner', 'manager']),
  inventoryValidators.createItem,
  validate,
  inventoryController.createItem.bind(inventoryController)
);

router.put(
  '/items/:id',
  authorize(['owner', 'manager']),
  inventoryValidators.updateItem,
  validate,
  inventoryController.updateItem.bind(inventoryController)
);

router.delete(
  '/items/:id',
  authorize(['owner', 'manager']),
  inventoryValidators.idParam,
  validate,
  inventoryController.deleteItem.bind(inventoryController)
);

// ==================== TRANSACTIONS ====================

router.get(
  '/transactions',
  inventoryValidators.transactionFilters,
  validate,
  inventoryController.getTransactions.bind(inventoryController)
);

router.post(
  '/transactions',
  authorize(['owner', 'manager', 'worker']),
  inventoryValidators.createTransaction,
  validate,
  inventoryController.createTransaction.bind(inventoryController)
);

router.post(
  '/items/:id/use',
  authorize(['owner', 'manager', 'worker']),
  inventoryValidators.useStock,
  validate,
  inventoryController.useStock.bind(inventoryController)
);

// ==================== UNITS OF MEASURE ====================

router.get(
  '/units',
  inventoryController.getUnitsOfMeasure.bind(inventoryController)
);

router.get(
  '/units/categories',
  inventoryController.getUnitCategories.bind(inventoryController)
);

router.get(
  '/units/:id',
  inventoryValidators.idParam,
  validate,
  inventoryController.getUnitById.bind(inventoryController)
);

router.post(
  '/units',
  authorize(['owner', 'manager']),
  inventoryValidators.createUnit,
  validate,
  inventoryController.createUnit.bind(inventoryController)
);

router.put(
  '/units/:id',
  authorize(['owner', 'manager']),
  inventoryValidators.updateUnit,
  validate,
  inventoryController.updateUnit.bind(inventoryController)
);

router.delete(
  '/units/:id',
  authorize(['owner', 'manager']),
  inventoryValidators.idParam,
  validate,
  inventoryController.deleteUnit.bind(inventoryController)
);

router.post(
  '/units/convert',
  inventoryValidators.convertUnits,
  validate,
  inventoryController.convertUnits.bind(inventoryController)
);

// ==================== BATCHES ====================

router.get(
  '/batches',
  inventoryValidators.batchFilters,
  validate,
  inventoryController.getBatches.bind(inventoryController)
);

router.get(
  '/batches/expiring',
  inventoryValidators.expiringFilters,
  validate,
  inventoryController.getExpiringBatches.bind(inventoryController)
);

router.get(
  '/batches/expired',
  inventoryController.getExpiredBatches.bind(inventoryController)
);

router.get(
  '/batches/:id',
  inventoryValidators.idParam,
  validate,
  inventoryController.getBatchById.bind(inventoryController)
);

router.get(
  '/items/:id/batches',
  inventoryValidators.idParam,
  validate,
  inventoryController.getItemBatches.bind(inventoryController)
);

router.post(
  '/batches',
  authorize(['owner', 'manager']),
  inventoryValidators.createBatch,
  validate,
  inventoryController.createBatch.bind(inventoryController)
);

router.put(
  '/batches/:id',
  authorize(['owner', 'manager']),
  inventoryValidators.updateBatch,
  validate,
  inventoryController.updateBatch.bind(inventoryController)
);

router.delete(
  '/batches/:id',
  authorize(['owner', 'manager']),
  inventoryValidators.idParam,
  validate,
  inventoryController.deleteBatch.bind(inventoryController)
);

router.post(
  '/batches/mark-expired',
  authorize(['owner', 'manager']),
  inventoryController.markExpiredBatches.bind(inventoryController)
);

module.exports = router;
