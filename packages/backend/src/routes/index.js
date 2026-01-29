const express = require('express');
const authRoutes = require('./auth.routes');
const cropRoutes = require('./crop.routes');
const animalRoutes = require('./animal.routes');

const router = express.Router();

/**
 * API Routes
 */

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
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
