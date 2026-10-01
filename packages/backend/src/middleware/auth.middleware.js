const jwt = require('jsonwebtoken');
const { db, runAsUser } = require('../config/database');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Load the user named in a verified token. Checking the database on every request
 * means deactivation and role changes take effect immediately, not when the token expires.
 * @param {number} id - User ID
 * @returns {Promise<Object|null>}
 */
function loadActiveUser(id) {
  return db.oneOrNone('SELECT id, email, role FROM users WHERE id = $1 AND is_active = true AND deleted_at IS NULL', [
    id,
  ]);
}

/**
 * Verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await loadActiveUser(decoded.id);
    if (!user) {
      throw new AuthenticationError('Account is not active', 'ACCOUNT_DISABLED');
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    // The rest of the request writes as this user (read by the audit trigger)
    runAsUser(user.id, next);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Token expired', 'TOKEN_EXPIRED'));
    } else if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      next(new AuthenticationError('Invalid token', 'INVALID_TOKEN'));
    } else {
      next(error);
    }
  }
}

/**
 * Check if user has required role(s)
 * @param {...(string|Array<string>)} roles - Allowed roles, as arguments or arrays
 * @returns {Function} Middleware function
 */
function authorize(...roles) {
  const allowedRoles = roles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Authorization failed for user ${req.user.id} with role ${req.user.role}`);
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Optional authentication - attach user if a valid token exists but don't require it
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      const user = await loadActiveUser(decoded.id);
      if (user) {
        req.user = { id: user.id, email: user.email, role: user.role };
      }
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
}

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
};
