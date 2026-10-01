const activityService = require('../services/activity.service');
const activitySyncService = require('../services/activity-sync.service');

/**
 * Controller for activity endpoints: the farm timeline and offline sync
 */
class ActivityController {
  async list(req, res, next) {
    try {
      const { page, limit, sort, order, ...filters } = req.query;
      const result = await activityService.getTimeline(parseInt(page, 10) || 1, parseInt(limit, 10) || 20, filters, {
        field: sort,
        order,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const activity = await activityService.getActivity(req.params.id);
      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

  async bulk(req, res, next) {
    try {
      const results = await activitySyncService.recordBulk(req.body.entries, req.user);
      const count = (status) => results.filter((r) => r.status === status).length;
      res.json({
        success: true,
        data: results,
        summary: { created: count('created'), duplicate: count('duplicate'), failed: count('failed') },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ActivityController();
