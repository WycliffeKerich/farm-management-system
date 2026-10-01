const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const cropRoutes = require('./crop.routes');
const animalRoutes = require('./animal.routes');
const inventoryRoutes = require('./inventory.routes');
const supplierRoutes = require('./supplier.routes');
const withdrawalRoutes = require('./withdrawal.routes');
const activityRoutes = require('./activity.routes');
const enterpriseRoutes = require('./enterprise.routes');
const auditLogRoutes = require('./audit-log.routes');
const { db } = require('../config/database');

const router = express.Router();

/**
 * API Routes
 */

// Health check endpoint (also verifies the database is reachable)
router.get('/health', async (req, res) => {
  let database = 'up';
  try {
    await db.one('SELECT 1');
  } catch (error) {
    database = 'down';
  }
  res.status(database === 'up' ? 200 : 503).json({
    success: database === 'up',
    message: database === 'up' ? 'API is running' : 'Database unavailable',
    database,
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
router.use('/auth', authRoutes);

// User management (owner only)
router.use('/users', userRoutes);

// Crop management routes
router.use('/crops', cropRoutes);

// Animal management routes
router.use('/animals', animalRoutes);

// Inventory management routes
router.use('/inventory', inventoryRoutes);

// Supplier routes
router.use('/suppliers', supplierRoutes);

// Withdrawal periods and pre-harvest intervals in force
router.use('/withdrawals', withdrawalRoutes);

// The farm timeline and offline sync
router.use('/activities', activityRoutes);

// Enterprises: the lines of business costed on their own
router.use('/enterprises', enterpriseRoutes);

// Who changed what (owner only)
router.use('/audit-log', auditLogRoutes);

// TODO: Add more route modules as they are implemented
// router.use('/financial', financialRoutes);
// router.use('/employees', employeeRoutes);
// router.use('/tasks', taskRoutes);
// router.use('/dashboard', dashboardRoutes);

module.exports = router;
