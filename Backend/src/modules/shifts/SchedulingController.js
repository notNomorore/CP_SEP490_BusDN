import SchedulingService from './SchedulingService.js';
import OperationalPlanningService from './OperationalPlanningService.js';
import logger from '../../utils/logger.js';

const fail = (res, error) => res.status(error.statusCode || 500).json({
  success: false,
  message: error.message || 'Không thể xử lý kế hoạch vận hành.',
  errors: error.errors || [],
});

export default class SchedulingController {
  static async staffingDemand(req, res) {
    try {
      const demand = await OperationalPlanningService.staffingDemand(req.query);
      return res.json({ success: true, demand });
    } catch (error) { logger.error('Staffing demand error:', error); return fail(res, error); }
  }

  static async overview(req, res) {
    try {
      const overview = await SchedulingService.overview(req.query.date);
      return res.json({ success: true, overview });
    } catch (error) { logger.error('Scheduling overview error:', error); return fail(res, error); }
  }

  static async listConfigs(req, res) {
    try {
      const configs = await SchedulingService.listConfigs(req.query);
      return res.json({ success: true, configs });
    } catch (error) { logger.error('List route operating configs error:', error); return fail(res, error); }
  }

  static async saveConfigs(req, res) {
    try {
      const configs = await SchedulingService.saveConfigs({ ...req.body, actorId: req.user?.userId });
      return res.status(201).json({ success: true, message: 'Đã lưu nhu cầu vận hành của tuyến.', configs });
    } catch (error) { logger.error('Save route operating configs error:', error); return fail(res, error); }
  }

  static async eligibleDrivers(req, res) {
    try {
      const drivers = await SchedulingService.eligibleDrivers(req.query);
      return res.json({ success: true, drivers });
    } catch (error) { logger.error('Eligible drivers error:', error); return fail(res, error); }
  }

  static async generate(req, res) {
    try {
      const plan = await OperationalPlanningService.generate({ ...req.body, actorId: req.user?.userId });
      return res.status(201).json({ success: true, message: 'Đã tạo kế hoạch nháp để kiểm tra.', plan });
    } catch (error) { logger.error('Generate operating plan error:', error); return fail(res, error); }
  }

  static async listPlans(req, res) {
    try {
      const plans = await OperationalPlanningService.list(req.query);
      return res.json({ success: true, plans });
    } catch (error) { logger.error('List operating plans error:', error); return fail(res, error); }
  }

  static async cancelPlan(req, res) {
    try {
      const plan = await OperationalPlanningService.cancel({ planId: req.params.planId, actorId: req.user?.userId });
      return res.json({ success: true, message: 'Đã hủy kế hoạch nháp.', plan });
    } catch (error) { logger.error('Cancel operating plan error:', error); return fail(res, error); }
  }

  static async validate(req, res) {
    try {
      const plan = await OperationalPlanningService.validate(req.body);
      return res.json({ success: true, message: plan.hardErrors.length ? 'Kế hoạch còn lỗi bắt buộc.' : 'Kế hoạch hợp lệ để xác nhận.', plan });
    } catch (error) { logger.error('Validate operating plan error:', error); return fail(res, error); }
  }

  static async confirm(req, res) {
    try {
      const plan = await OperationalPlanningService.confirm({ ...req.body, actorId: req.user?.userId });
      return res.status(201).json({ success: true, message: 'Đã xác nhận và công bố lịch vận hành.', plan });
    } catch (error) { logger.error('Confirm operating plan error:', error); return fail(res, error); }
  }
}
