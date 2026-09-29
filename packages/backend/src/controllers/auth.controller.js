const AuthService = require('../services/auth.service');
const { HTTP_STATUS } = require('../config/constants');

const REFRESH_COOKIE = 'rt';

/**
 * Options for the refresh-token cookie. Scoped to the auth routes so it is not
 * sent with every API call; httpOnly so page scripts can never read it.
 */
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions(),
    maxAge: AuthService.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

function requestMeta(req) {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

/**
 * Authentication controller
 */
class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Whether the first owner account still has to be created
   * @route GET /api/v1/auth/bootstrap
   */
  bootstrapStatus = async (req, res, next) => {
    try {
      const needsSetup = await this.authService.needsBootstrap();
      res.status(HTTP_STATUS.OK).json({ success: true, data: { needsSetup } });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create the first owner account (only while no users exist)
   * @route POST /api/v1/auth/bootstrap
   */
  bootstrap = async (req, res, next) => {
    try {
      const user = await this.authService.bootstrap(req.body);
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: user,
        message: 'Owner account created. You can now log in.',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Login user
   * @route POST /api/v1/auth/login
   */
  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password, requestMeta(req));

      setRefreshCookie(res, result.refreshToken);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { user: result.user, accessToken: result.accessToken },
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Rotate the refresh cookie and issue a new access token
   * @route POST /api/v1/auth/refresh
   */
  refreshToken = async (req, res, next) => {
    try {
      const result = await this.authService.refresh(req.cookies[REFRESH_COOKIE], requestMeta(req));

      setRefreshCookie(res, result.refreshToken);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { user: result.user, accessToken: result.accessToken },
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  };

  /**
   * Logout this device. Works without an access token so an expired
   * session can still be ended.
   * @route POST /api/v1/auth/logout
   */
  logout = async (req, res, next) => {
    try {
      await this.authService.logout(req.cookies[REFRESH_COOKIE]);
      clearRefreshCookie(res);
      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Logout successful' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Logout every device of the current user
   * @route POST /api/v1/auth/logout-all
   */
  logoutAll = async (req, res, next) => {
    try {
      await this.authService.logoutAll(req.user.id);
      clearRefreshCookie(res);
      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Logged out of all devices' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Request a password reset link. Always responds 200.
   * @route POST /api/v1/auth/forgot-password
   */
  forgotPassword = async (req, res, next) => {
    try {
      await this.authService.forgotPassword(req.body.email);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'If that email belongs to an active account, a reset link has been sent.',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Set a new password using a reset token
   * @route POST /api/v1/auth/reset-password
   */
  resetPassword = async (req, res, next) => {
    try {
      await this.authService.resetPassword(req.body.token, req.body.password);
      clearRefreshCookie(res);
      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Password has been reset. Please log in.' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current user profile
   * @route GET /api/v1/auth/me
   */
  getCurrentUser = async (req, res, next) => {
    try {
      const user = await this.authService.getCurrentUser(req.user.id);
      res.status(HTTP_STATUS.OK).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update current user profile
   * @route PUT /api/v1/auth/me
   */
  updateProfile = async (req, res, next) => {
    try {
      const user = await this.authService.updateProfile(req.user.id, req.body);
      res.status(HTTP_STATUS.OK).json({ success: true, data: user, message: 'Profile updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Change password (signs out other devices)
   * @route PUT /api/v1/auth/change-password
   */
  changePassword = async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await this.authService.changePassword(req.user.id, currentPassword, newPassword, req.cookies[REFRESH_COOKIE]);
      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AuthController();
module.exports.REFRESH_COOKIE = REFRESH_COOKIE;
