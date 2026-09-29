const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { loginLimiter, forgotPasswordLimiter, refreshLimiter } = require('../middleware/rate-limit.middleware');
const {
  bootstrapValidation,
  loginValidation,
  changePasswordValidation,
  updateProfileValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require('../validators/auth.validator');

const router = express.Router();

/**
 * There is no public registration. The first owner is created through
 * /bootstrap (only while the users table is empty); owners create everyone
 * else through /api/v1/users.
 */

/**
 * @route GET /api/v1/auth/bootstrap
 * @desc Whether initial setup (first owner) is still required
 * @access Public
 */
router.get('/bootstrap', authController.bootstrapStatus);

/**
 * @route POST /api/v1/auth/bootstrap
 * @desc Create the first owner account
 * @access Public, only while no users exist
 */
router.post('/bootstrap', loginLimiter, bootstrapValidation, validate, authController.bootstrap);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', loginLimiter, loginValidation, validate, authController.login);

/**
 * @route POST /api/v1/auth/refresh
 * @desc Rotate the refresh cookie and get a new access token
 * @access Public (refresh cookie)
 */
router.post('/refresh', refreshLimiter, authController.refreshToken);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout this device
 * @access Public (refresh cookie)
 */
router.post('/logout', authController.logout);

/**
 * @route POST /api/v1/auth/logout-all
 * @desc Logout every device
 * @access Private
 */
router.post('/logout-all', authenticate, authController.logoutAll);

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Request a password reset link
 * @access Public
 */
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordValidation,
  validate,
  authController.forgotPassword
);

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password with a token
 * @access Public
 */
router.post('/reset-password', forgotPasswordLimiter, resetPasswordValidation, validate, authController.resetPassword);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route PUT /api/v1/auth/me
 * @desc Update current user profile
 * @access Private
 */
router.put('/me', authenticate, updateProfileValidation, validate, authController.updateProfile);

/**
 * @route PUT /api/v1/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.put('/change-password', authenticate, changePasswordValidation, validate, authController.changePassword);

module.exports = router;
