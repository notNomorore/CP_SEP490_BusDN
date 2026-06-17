import FeedbackAnalyticsService from './feedbackAnalytics.service.js';

export class FeedbackAnalyticsController {
  static async getFeedbackAnalytics(req, res) {
    const analytics = await FeedbackAnalyticsService.getFeedbackAnalytics(req.query, req.user);
    return res.success(analytics, 'Feedback analytics retrieved successfully');
  }

  static async getFeedbackDetail(req, res) {
    const detail = await FeedbackAnalyticsService.getFeedbackDetail(req.query, req.user);
    return res.success(detail, 'Feedback analytics detail retrieved successfully');
  }
}

export default FeedbackAnalyticsController;
