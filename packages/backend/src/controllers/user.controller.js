const UserService = require('../services/user.service');
const { HTTP_STATUS } = require('../config/constants');

/**
 * User management controller (owner only)
 */
class UserController {
  constructor() {
    this.userService = new UserService();
  }

  /**
   * @route GET /api/v1/users
   */
  list = async (req, res, next) => {
    try {
      const users = await this.userService.list(req.query);
      res.status(HTTP_STATUS.OK).json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @route GET /api/v1/users/:id
   */
  get = async (req, res, next) => {
    try {
      const user = await this.userService.get(req.params.id);
      res.status(HTTP_STATUS.OK).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @route POST /api/v1/users
   */
  create = async (req, res, next) => {
    try {
      const user = await this.userService.create(req.body, req.user.id);
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: user, message: 'User created successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @route PUT /api/v1/users/:id
   */
  update = async (req, res, next) => {
    try {
      const user = await this.userService.update(req.params.id, req.body, req.user.id);
      res.status(HTTP_STATUS.OK).json({ success: true, data: user, message: 'User updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @route PUT /api/v1/users/:id/password
   */
  setPassword = async (req, res, next) => {
    try {
      await this.userService.setPassword(req.params.id, req.body.password, req.user.id);
      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Password updated; the user has been signed out' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @route DELETE /api/v1/users/:id/sessions
   */
  revokeSessions = async (req, res, next) => {
    try {
      const revoked = await this.userService.revokeSessions(req.params.id);
      res.status(HTTP_STATUS.OK).json({ success: true, data: { revoked }, message: 'User signed out of all devices' });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new UserController();
