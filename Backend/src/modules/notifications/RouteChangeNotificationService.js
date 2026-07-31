import User from '../auth/User.js';
import logger from '../../utils/logger.js';

export class RouteChangeNotificationService {
  static buildNotificationId(subscription, routeChange) {
    return `${subscription.subscriptionId}-${routeChange.changeId}`;
  }

  static subscriptionMatchesRouteChange(subscription, routeChange) {
    const sameRoute = (
      String(subscription.routeId || '') === String(routeChange.routeId || '')
      || subscription.routeNumber === routeChange.routeNumber
    );
    const sameTrip = !subscription.tripId || !routeChange.tripId || subscription.tripId === routeChange.tripId;

    return sameRoute && sameTrip && subscription.notificationStatus !== 'DISABLED';
  }

  static buildAlert(subscription, routeChange) {
    return {
      notificationId: this.buildNotificationId(subscription, routeChange),
      subscriptionId: subscription.subscriptionId,
      routeId: String(routeChange.routeId),
      routeNumber: routeChange.routeNumber,
      tripId: routeChange.tripId || subscription.tripId || '',
      changedStops: routeChange.changedStops || [],
      updatedRoutePath: routeChange.updatedRoutePath || '',
      alternativeSuggestion: routeChange.alternativeSuggestion || '',
      reasonForChange: routeChange.reasonForChange || '',
      notificationStatus: 'UNREAD',
      detectedAt: routeChange.detectedAt ? new Date(routeChange.detectedAt) : new Date(),
      deliveredAt: new Date(),
    };
  }

  static async dispatch(routeChange) {
    if (!routeChange?.routeId || !routeChange?.routeNumber || routeChange.status !== 'ACTIVE') {
      return { deliveredCount: 0 };
    }

    const users = await User.find({
      notificationEnabled: { $ne: false },
      'notificationTypes.routeChangeAlerts': { $ne: false },
      routeChangeNotifications: {
        $elemMatch: {
          notificationStatus: 'ENABLED',
        },
      },
    });

    let deliveredCount = 0;

    for (const user of users) {
      const existingAlertIds = new Set((user.routeChangeAlerts || []).map((alert) => alert.notificationId));
      const activeSubscriptions = (user.routeChangeNotifications || []).filter((subscription) => (
        this.subscriptionMatchesRouteChange(subscription, routeChange)
      ));

      for (const subscription of activeSubscriptions) {
        const notificationId = this.buildNotificationId(subscription, routeChange);

        if (existingAlertIds.has(notificationId)) {
          continue;
        }

        user.routeChangeAlerts.push(this.buildAlert(subscription, routeChange));
        existingAlertIds.add(notificationId);
        deliveredCount += 1;
      }

      if (user.isModified('routeChangeAlerts')) {
        await user.save();
      }
    }

    if (deliveredCount > 0) {
      logger.info(`Delivered ${deliveredCount} route change notification(s) for ${routeChange.routeNumber}`);
    }

    return { deliveredCount };
  }
}

export default RouteChangeNotificationService;
