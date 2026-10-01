const settingsService = require('../services/settings.service');

/**
 * Controller for farm settings
 */
class SettingsController {
  async get(req, res, next) {
    try {
      res.json({ success: true, data: await settingsService.getAll() });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      res.json({ success: true, data: await settingsService.update(body, req.user) });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SettingsController();
