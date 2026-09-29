const withdrawalService = require('../services/withdrawal.service');

/**
 * Controller for withdrawal periods and pre-harvest intervals
 */
class WithdrawalController {
  async active(req, res, next) {
    try {
      const holds = await withdrawalService.activeHolds(req.query.date || undefined);
      res.json({ success: true, data: holds });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WithdrawalController();
