const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { USER_ROLES } = require('../config/constants');
const {
  listUsersValidation,
  createUserValidation,
  updateUserValidation,
  setUserPasswordValidation,
  userIdValidation,
} = require('../validators/auth.validator');

const router = express.Router();

// User management is owner only
router.use(authenticate, authorize(USER_ROLES.OWNER));

/**
 * @route GET /api/v1/users
 * @desc List users (filters: role, is_active, search)
 */
router.get('/', listUsersValidation, validate, userController.list);

/**
 * @route GET /api/v1/users/:id
 * @desc Get a user and their active sessions
 */
router.get('/:id', userIdValidation, validate, userController.get);

/**
 * @route POST /api/v1/users
 * @desc Create a user
 */
router.post('/', createUserValidation, validate, userController.create);

/**
 * @route PUT /api/v1/users/:id
 * @desc Update details, role or active status
 */
router.put('/:id', updateUserValidation, validate, userController.update);

/**
 * @route PUT /api/v1/users/:id/password
 * @desc Set a new password (signs the user out everywhere)
 */
router.put('/:id/password', setUserPasswordValidation, validate, userController.setPassword);

/**
 * @route DELETE /api/v1/users/:id/sessions
 * @desc Sign the user out of every device
 */
router.delete('/:id/sessions', userIdValidation, validate, userController.revokeSessions);

module.exports = router;
