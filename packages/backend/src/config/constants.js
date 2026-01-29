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
