import WeeklyRosterService from './WeeklyRosterService.js';
import logger from '../../utils/logger.js';

const fail = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.message, errors: error.errors || [] });

export default class RosterController {
  static async get(req, res) { try { return res.json({ success: true, ...(await WeeklyRosterService.get(req.query)) }); } catch (error) { logger.error('Get weekly roster error:', error); return fail(res, error); } }
  static async availableStaff(req, res) { try { return res.json({ success: true, staff: await WeeklyRosterService.availableStaff(req.query) }); } catch (error) { logger.error('Get roster available staff error:', error); return fail(res, error); } }
  static async requirements(req, res) { try { return res.json({ success: true, requirements: await WeeklyRosterService.resolvedRequirements(req.query.weekStartDate) }); } catch (error) { logger.error('Get weekly requirements error:', error); return fail(res, error); } }
  static async saveRequirements(req, res) { try { return res.json({ success: true, ...(await WeeklyRosterService.saveRequirements({ ...req.body, actorId: req.user?.userId })) }); } catch (error) { logger.error('Save weekly requirements error:', error); return fail(res, error); } }
  static async resetRequirements(req, res) { try { return res.json({ success: true, ...(await WeeklyRosterService.resetRequirements({ ...req.body, actorId: req.user?.userId })) }); } catch (error) { logger.error('Reset weekly requirements error:', error); return fail(res, error); } }
  static async autoGenerate(req, res) { try { return res.status(201).json({ success: true, ...(await WeeklyRosterService.autoGenerate({ ...req.body, actorId: req.user?.userId })) }); } catch (error) { logger.error('Auto generate weekly roster error:', error); return fail(res, error); } }
  static async validate(req, res) { try { return res.json({ success: true, ...(await WeeklyRosterService.validate(req.body)) }); } catch (error) { logger.error('Validate weekly roster error:', error); return fail(res, error); } }
  static async publish(req, res) { try { return res.json({ success: true, roster: await WeeklyRosterService.publish({ ...req.body, actorId: req.user?.userId }) }); } catch (error) { logger.error('Publish weekly roster error:', error); return fail(res, error); } }
  static async reopen(req, res) { try { return res.json({ success: true, roster: await WeeklyRosterService.reopen({ ...req.body, actorId: req.user?.userId }) }); } catch (error) { logger.error('Reopen weekly roster error:', error); return fail(res, error); } }
}
