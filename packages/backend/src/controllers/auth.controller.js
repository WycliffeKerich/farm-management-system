const AuthService = require('../services/auth.service');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Authentication controller
 */
class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Register new user
   * @route POST /api/v1/auth/register
   */
  register = async (req, res, next) => {
    try {
      const user = await this.authService.register(req.body);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: user,
        message: 'User registered successfully',
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
      const result = await this.authService.login(email, password);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Logout user
   * @route POST /api/v1/auth/logout
   */
  logout = async (req, res, next) => {
    try {
      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh access token
   * @route POST /api/v1/auth/refresh
   */
  refreshToken = async (req, res, next) => {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        throw new AuthenticationError('Refresh token not provided');
      }

      const result = await this.authService.refreshToken(refreshToken);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          accessToken: result.accessToken,
        },
        message: 'Token refreshed successfully',
      });
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

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: user,
      });
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

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: user,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Change password
   * @route PUT /api/v1/auth/change-password
   */
  changePassword = async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await this.authService.changePassword(req.user.id, currentPassword, newPassword);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AuthController();
