const { body, param, query } = require('express-validator');

/**
 * Validation rules for authentication and user management endpoints
 */

const ROLES = ['owner', 'manager', 'worker'];
const PASSWORD_MIN = 10;
// bcrypt ignores everything after 72 bytes
const PASSWORD_MAX = 72;

const email = (field = 'email') =>
  body(field).trim().toLowerCase().isEmail().withMessage('Please provide a valid email').isLength({ max: 255 });

const newPassword = (field) =>
  body(field)
    .isString()
    .isLength({ min: PASSWORD_MIN, max: PASSWORD_MAX })
    .withMessage(`Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters`);

const name = (field, label, { optional = false } = {}) => {
  let chain = body(field);
  if (optional) chain = chain.optional();
  return chain
    .isString()
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .isLength({ max: 100 })
    .withMessage(`${label} must be at most 100 characters`);
};

const phone = () =>
  body('phone')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 20 })
    .matches(/^\+?[0-9 ()-]*$/)
    .withMessage('Please provide a valid phone number');

const userId = () => param('id').isInt({ min: 1 }).withMessage('Invalid user ID').toInt();

const bootstrapValidation = [
  email(),
  newPassword('password'),
  name('first_name', 'First name'),
  name('last_name', 'Last name'),
  phone(),
];

const loginValidation = [
  email(),
  body('password').isString().notEmpty().withMessage('Password is required').isLength({ max: 1024 }),
];

const changePasswordValidation = [
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  newPassword('newPassword'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),
];

const updateProfileValidation = [
  name('first_name', 'First name', { optional: true }),
  name('last_name', 'Last name', { optional: true }),
  phone(),
];

const forgotPasswordValidation = [email()];

const resetPasswordValidation = [
  body('token').isString().notEmpty().withMessage('Reset token is required').isLength({ max: 200 }),
  newPassword('password'),
];

const listUsersValidation = [
  query('role').optional().isIn(ROLES).withMessage('Invalid role'),
  query('is_active').optional().isBoolean().withMessage('is_active must be true or false').toBoolean(),
  query('search').optional().isString().trim().isLength({ max: 100 }),
];

const createUserValidation = [
  email(),
  newPassword('password'),
  name('first_name', 'First name'),
  name('last_name', 'Last name'),
  body('role').isIn(ROLES).withMessage('Invalid role'),
  phone(),
];

const updateUserValidation = [
  userId(),
  email().optional(),
  name('first_name', 'First name', { optional: true }),
  name('last_name', 'Last name', { optional: true }),
  body('role').optional().isIn(ROLES).withMessage('Invalid role'),
  body('is_active').optional().isBoolean({ strict: true }).withMessage('is_active must be true or false'),
  phone(),
];

const setUserPasswordValidation = [userId(), newPassword('password')];

const userIdValidation = [userId()];

module.exports = {
  bootstrapValidation,
  loginValidation,
  changePasswordValidation,
  updateProfileValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  listUsersValidation,
  createUserValidation,
  updateUserValidation,
  setUserPasswordValidation,
  userIdValidation,
};
