/**
 * Application constants
 */

module.exports = {
  // User roles
  USER_ROLES: {
    OWNER: 'owner',
    MANAGER: 'manager',
    WORKER: 'worker',
  },

  // Employee status
  EMPLOYEE_STATUS: {
    ACTIVE: 'active',
    ON_LEAVE: 'on_leave',
    TERMINATED: 'terminated',
  },

  // Employment types
  EMPLOYMENT_TYPES: {
    PERMANENT: 'permanent',
    CASUAL: 'casual',
    SEASONAL: 'seasonal',
  },

  // Salary types
  SALARY_TYPES: {
    MONTHLY: 'monthly',
    DAILY: 'daily',
    HOURLY: 'hourly',
  },

  // Crop batch status
  CROP_STATUS: {
    PLANTED: 'planted',
    GROWING: 'growing',
    HARVESTING: 'harvesting',
    COMPLETED: 'completed',
  },

  // Animal status
  ANIMAL_STATUS: {
    ACTIVE: 'active',
    SOLD: 'sold',
    DECEASED: 'deceased',
    CULLED: 'culled',
  },

  // Task status
  TASK_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  // Task priority
  TASK_PRIORITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
  },

  // Pest/Disease severity
  SEVERITY_LEVELS: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },

  // Transaction types
  TRANSACTION_TYPES: {
    INCOME: 'income',
    EXPENSE: 'expense',
  },

  // Payment methods
  PAYMENT_METHODS: {
    CASH: 'cash',
    MPESA: 'mpesa',
    BANK_TRANSFER: 'bank_transfer',
    CHEQUE: 'cheque',
  },

  // Inventory categories
  INVENTORY_CATEGORIES: {
    SEEDS: 'Seeds',
    FEED: 'Feed',
    FERTILIZER: 'Fertilizer',
    PESTICIDE: 'Pesticide',
    MEDICINE: 'Medicine',
    EQUIPMENT: 'Equipment',
    SUPPLIES: 'Supplies',
  },

  // Inventory transaction types
  INVENTORY_TRANSACTION_TYPES: {
    PURCHASE: 'purchase',
    USAGE: 'usage',
    ADJUSTMENT: 'adjustment',
    RETURN: 'return',
    EXPIRED: 'expired',
    TRANSFER: 'transfer',
    WASTE: 'waste',
  },

  // Ledger quantities are magnitudes; these types add to stock, the others
  // (except the signed 'adjustment') remove from it
  INVENTORY_INCOMING_TYPES: ['purchase', 'return'],
  INVENTORY_OUTGOING_TYPES: ['usage', 'expired', 'transfer', 'waste'],

  // Inventory reference types (for linking transactions to other entities)
  INVENTORY_REFERENCE_TYPES: {
    CROP_BATCH: 'crop_batch',
    ANIMAL: 'animal',
    ANIMAL_GROUP: 'animal_group',
    TASK: 'task',
    MANUAL: 'manual',
  },

  // HTTP status codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
  },
};
