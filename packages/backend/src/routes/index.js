const express = require('express');
const authRoutes = require('./auth.routes');
const cropRoutes = require('./crop.routes');
const animalRoutes = require('./animal.routes');
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

// Crop management routes
router.use('/crops', cropRoutes);

// Animal management routes
router.use('/animals', animalRoutes);

// TODO: Add more route modules as they are implemented
// router.use('/inventory', inventoryRoutes);
// router.use('/financial', financialRoutes);
// router.use('/employees', employeeRoutes);
// router.use('/tasks', taskRoutes);
// router.use('/dashboard', dashboardRoutes);

module.exports = router;
