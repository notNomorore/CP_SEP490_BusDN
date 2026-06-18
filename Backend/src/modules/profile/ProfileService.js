import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import RouteService from '../routes/RouteService.js';
import ProfileRepository from './ProfileRepository.js';
import { ProfileResponseDTO } from './profile.dto.js';

export class ProfileService {
  static async getProfile(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return ProfileResponseDTO.format(user);
  }

  static async updateProfile(userId, payload) {
    const existingUser = await ProfileRepository.findById(userId);

    if (!existingUser) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const user = await ProfileRepository.updateById(userId, {
      fullName: payload.fullName.trim(),
      email: payload.email.toLowerCase(),
      phoneNumber: payload.phoneNumber,
      gender: payload.gender || 'PREFER_NOT_TO_SAY',
      dateOfBirth: payload.dateOfBirth || null,
      address: payload.address?.trim() || '',
      notificationEnabled:
        payload.notificationEnabled === undefined
          ? existingUser.notificationEnabled
          : payload.notificationEnabled,
      favoriteRoutes: Array.isArray(payload.favoriteRoutes)
        ? payload.favoriteRoutes
        : existingUser.favoriteRoutes,
      favoriteStops: Array.isArray(payload.favoriteStops)
        ? payload.favoriteStops
        : existingUser.favoriteStops,
    });

    return ProfileResponseDTO.format(user);
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const user = await ProfileRepository.findByIdWithPassword(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      throw new CustomError('Current password is incorrect', HTTP_STATUS.BAD_REQUEST);
    }

    user.password = newPassword;
    await ProfileRepository.save(user);

    return { success: true };
  }

  static async updateAvatar(userId, avatarPath) {
    const user = await ProfileRepository.updateById(userId, { avatar: avatarPath });

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return ProfileResponseDTO.format(user);
  }

  static async getFavoriteRoutes(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return (user.favoriteRoutes || []).filter((route) => route.favoriteStatus !== 'REMOVED');
  }

  static async getFavoriteStops(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return (user.favoriteStops || []).filter((stop) => stop.favoriteStatus !== 'REMOVED');
  }

  static buildStopId(route, stop) {
    const normalizedName = stop.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${route.routeNumber}-${stop.order}-${normalizedName}`;
  }

  static async findStopInRoutes({ routeId, routeNumber, stopId, stopName, order }) {
    const route = await RouteService.findActiveRoute(routeId, routeNumber);
    const routes = route ? [route] : [];

    for (const route of routes) {
      const stop = (route.stops || []).find((candidate) => {
        const candidateStopId = this.buildStopId(route, candidate);
        const sameStopId = stopId && candidateStopId === stopId;
        const sameOrder = order && Number(candidate.order) === Number(order);
        const sameName = stopName && candidate.name.toLowerCase() === stopName.trim().toLowerCase();

        return sameStopId || (sameOrder && sameName) || sameName;
      });

      if (stop) {
        return {
          route,
          stop,
          stopId: this.buildStopId(route, stop),
        };
      }
    }

    return null;
  }

  static async saveFavoriteStop(userId, payload) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const matchedStop = await this.findStopInRoutes(payload);

    if (!matchedStop) {
      throw new CustomError('Stop not found', HTTP_STATUS.NOT_FOUND);
    }

    const { route, stop, stopId } = matchedStop;
    const favoriteStops = user.favoriteStops || [];
    const existingIndex = favoriteStops.findIndex((favoriteStop) => (
      favoriteStop.stopId === stopId
      || (
        favoriteStop.stopName?.toLowerCase() === stop.name.toLowerCase()
        && favoriteStop.routeNumber === route.routeNumber
      )
    ));

    if (existingIndex >= 0 && favoriteStops[existingIndex].favoriteStatus !== 'REMOVED') {
      throw new CustomError('Stop already exists in favorites', HTTP_STATUS.CONFLICT);
    }

    const favoriteStop = {
      stopId,
      routeId: String(route._id),
      routeNumber: route.routeNumber,
      stopName: stop.name,
      address: payload.address?.trim() || `${route.name} stop`,
      nearbyArrivalText: payload.nearbyArrivalText?.trim() || `Every ${route.operatingHours?.frequencyMinutes || 30} min`,
      distanceMeters: Number(payload.distanceMeters) || 0,
      latitude: stop.latitude,
      longitude: stop.longitude,
      savedAt: new Date(),
      favoriteStatus: 'SAVED',
    };

    if (existingIndex >= 0) {
      user.favoriteStops.set(existingIndex, favoriteStop);
    } else {
      user.favoriteStops.push(favoriteStop);
    }

    await ProfileRepository.save(user);

    return favoriteStop;
  }

  static async removeFavoriteStop(userId, stopId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const favoriteStops = user.favoriteStops || [];
    const existingIndex = favoriteStops.findIndex((favoriteStop) => favoriteStop.stopId === stopId);

    if (existingIndex < 0 || favoriteStops[existingIndex].favoriteStatus === 'REMOVED') {
      throw new CustomError('Favorite stop not found', HTTP_STATUS.NOT_FOUND);
    }

    const removedStop = favoriteStops[existingIndex].toObject
      ? favoriteStops[existingIndex].toObject()
      : favoriteStops[existingIndex];

    user.favoriteStops.splice(existingIndex, 1);
    await ProfileRepository.save(user);

    return {
      ...removedStop,
      favoriteStatus: 'REMOVED',
    };
  }

  static buildArrivalNotificationId(route, stop) {
    return `${route.routeNumber}-${this.buildStopId(route, stop)}-arrival`;
  }

  static async getArrivalNotifications(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return (user.arrivalNotifications || []).filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
    ));
  }

  static async subscribeArrivalNotification(userId, payload) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const matchedStop = await this.findStopInRoutes(payload);

    if (!matchedStop) {
      throw new CustomError('Stop not found', HTTP_STATUS.NOT_FOUND);
    }

    const { route, stop, stopId } = matchedStop;
    const arrivalNotifications = user.arrivalNotifications || [];
    const subscriptionId = this.buildArrivalNotificationId(route, stop);
    const existingIndex = arrivalNotifications.findIndex((subscription) => (
      subscription.subscriptionId === subscriptionId
      || (
        subscription.routeNumber === route.routeNumber
        && subscription.stopId === stopId
      )
    ));

    if (existingIndex >= 0 && arrivalNotifications[existingIndex].notificationStatus !== 'DISABLED') {
      throw new CustomError('Arrival notification already enabled', HTTP_STATUS.CONFLICT);
    }

    const subscription = {
      subscriptionId,
      routeId: String(route._id),
      routeNumber: route.routeNumber,
      stopId,
      stopName: stop.name,
      busId: payload.busId?.trim() || '',
      etaThresholdMinutes: Number(payload.etaThresholdMinutes) || 5,
      notificationStatus: 'ENABLED',
      subscribedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      user.arrivalNotifications.set(existingIndex, subscription);
    } else {
      user.arrivalNotifications.push(subscription);
    }

    await ProfileRepository.save(user);

    return subscription;
  }

  static async removeArrivalNotification(userId, subscriptionId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const arrivalNotifications = user.arrivalNotifications || [];
    const existingIndex = arrivalNotifications.findIndex((subscription) => (
      subscription.subscriptionId === subscriptionId
    ));

    if (
      existingIndex < 0
      || arrivalNotifications[existingIndex].notificationStatus === 'DISABLED'
    ) {
      throw new CustomError('Arrival notification not found', HTTP_STATUS.NOT_FOUND);
    }

    const removedSubscription = arrivalNotifications[existingIndex].toObject
      ? arrivalNotifications[existingIndex].toObject()
      : arrivalNotifications[existingIndex];

    user.arrivalNotifications.splice(existingIndex, 1);
    await ProfileRepository.save(user);

    return {
      ...removedSubscription,
      notificationStatus: 'DISABLED',
    };
  }

  static buildDelayNotificationId(route) {
    return `${route.routeNumber}-delay`;
  }

  static async findRouteForNotification({ routeId, routeNumber }) {
    return RouteService.findActiveRoute(routeId, routeNumber);
  }

  static async getDelayNotifications(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return (user.delayNotifications || []).filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
    ));
  }

  static async subscribeDelayNotification(userId, payload) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const route = await this.findRouteForNotification(payload);

    if (!route) {
      throw new CustomError('Route not found', HTTP_STATUS.NOT_FOUND);
    }

    const delayNotifications = user.delayNotifications || [];
    const subscriptionId = this.buildDelayNotificationId(route);
    const existingIndex = delayNotifications.findIndex((subscription) => (
      subscription.subscriptionId === subscriptionId
      || String(subscription.routeId) === String(route._id)
      || subscription.routeNumber === route.routeNumber
    ));

    if (existingIndex >= 0 && delayNotifications[existingIndex].notificationStatus !== 'DISABLED') {
      throw new CustomError('Delay notification already enabled', HTTP_STATUS.CONFLICT);
    }

    const subscription = {
      subscriptionId,
      routeId: String(route._id),
      routeNumber: route.routeNumber,
      busId: payload.busId?.trim() || '',
      tripId: payload.tripId?.trim() || '',
      delayThresholdMinutes: Number(payload.delayThresholdMinutes) || 5,
      notificationStatus: 'ENABLED',
      subscribedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      user.delayNotifications.set(existingIndex, subscription);
    } else {
      user.delayNotifications.push(subscription);
    }

    await ProfileRepository.save(user);

    return subscription;
  }

  static async removeDelayNotification(userId, subscriptionId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const delayNotifications = user.delayNotifications || [];
    const existingIndex = delayNotifications.findIndex((subscription) => (
      subscription.subscriptionId === subscriptionId
    ));

    if (
      existingIndex < 0
      || delayNotifications[existingIndex].notificationStatus === 'DISABLED'
    ) {
      throw new CustomError('Delay notification not found', HTTP_STATUS.NOT_FOUND);
    }

    const removedSubscription = delayNotifications[existingIndex].toObject
      ? delayNotifications[existingIndex].toObject()
      : delayNotifications[existingIndex];

    user.delayNotifications.splice(existingIndex, 1);
    await ProfileRepository.save(user);

    return {
      ...removedSubscription,
      notificationStatus: 'DISABLED',
    };
  }

  static buildRouteChangeNotificationId(route) {
    return `${route.routeNumber}-route-change`;
  }

  static async getRouteChangeNotifications(userId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    return (user.routeChangeNotifications || []).filter((subscription) => (
      subscription.notificationStatus !== 'DISABLED'
    ));
  }

  static async subscribeRouteChangeNotification(userId, payload) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const route = await this.findRouteForNotification(payload);

    if (!route) {
      throw new CustomError('Route not found', HTTP_STATUS.NOT_FOUND);
    }

    const routeChangeNotifications = user.routeChangeNotifications || [];
    const subscriptionId = this.buildRouteChangeNotificationId(route);
    const existingIndex = routeChangeNotifications.findIndex((subscription) => (
      subscription.subscriptionId === subscriptionId
      || String(subscription.routeId) === String(route._id)
      || subscription.routeNumber === route.routeNumber
    ));

    if (
      existingIndex >= 0
      && routeChangeNotifications[existingIndex].notificationStatus !== 'DISABLED'
    ) {
      throw new CustomError('Route change notification already enabled', HTTP_STATUS.CONFLICT);
    }

    const subscription = {
      subscriptionId,
      routeId: String(route._id),
      routeNumber: route.routeNumber,
      tripId: payload.tripId?.trim() || '',
      notificationStatus: 'ENABLED',
      subscribedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      user.routeChangeNotifications.set(existingIndex, subscription);
    } else {
      user.routeChangeNotifications.push(subscription);
    }

    await ProfileRepository.save(user);

    return subscription;
  }

  static async removeRouteChangeNotification(userId, subscriptionId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const routeChangeNotifications = user.routeChangeNotifications || [];
    const existingIndex = routeChangeNotifications.findIndex((subscription) => (
      subscription.subscriptionId === subscriptionId
    ));

    if (
      existingIndex < 0
      || routeChangeNotifications[existingIndex].notificationStatus === 'DISABLED'
    ) {
      throw new CustomError('Route change notification not found', HTTP_STATUS.NOT_FOUND);
    }

    const removedSubscription = routeChangeNotifications[existingIndex].toObject
      ? routeChangeNotifications[existingIndex].toObject()
      : routeChangeNotifications[existingIndex];

    user.routeChangeNotifications.splice(existingIndex, 1);
    await ProfileRepository.save(user);

    return {
      ...removedSubscription,
      notificationStatus: 'DISABLED',
    };
  }

  static async saveFavoriteRoute(userId, routeId) {
    await RouteService.ensureSampleRoutes();

    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const route = await RouteService.findActiveRoute(routeId, routeId);

    if (!route) {
      throw new CustomError('Route not found', HTTP_STATUS.NOT_FOUND);
    }

    const favoriteRoutes = user.favoriteRoutes || [];
    const existingIndex = favoriteRoutes.findIndex((favoriteRoute) => (
      String(favoriteRoute.routeId) === String(route._id)
      || favoriteRoute.routeNumber === route.routeNumber
    ));

    if (existingIndex >= 0 && favoriteRoutes[existingIndex].favoriteStatus !== 'REMOVED') {
      throw new CustomError('Route already exists in favorites', HTTP_STATUS.CONFLICT);
    }

    const favoriteRoute = {
      routeId: String(route._id),
      routeNumber: route.routeNumber,
      destination: route.destination,
      quickAccessPath: `/search?q=${encodeURIComponent(route.routeNumber)}`,
      color: '#059669',
      savedAt: new Date(),
      favoriteStatus: 'SAVED',
    };

    if (existingIndex >= 0) {
      user.favoriteRoutes.set(existingIndex, favoriteRoute);
    } else {
      user.favoriteRoutes.push(favoriteRoute);
    }

    await ProfileRepository.save(user);

    return favoriteRoute;
  }

  static async removeFavoriteRoute(userId, routeId) {
    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const favoriteRoutes = user.favoriteRoutes || [];
    const existingIndex = favoriteRoutes.findIndex((favoriteRoute) => (
      String(favoriteRoute.routeId) === String(routeId)
    ));

    if (existingIndex < 0 || favoriteRoutes[existingIndex].favoriteStatus === 'REMOVED') {
      throw new CustomError('Favorite route not found', HTTP_STATUS.NOT_FOUND);
    }

    const removedRoute = favoriteRoutes[existingIndex].toObject
      ? favoriteRoutes[existingIndex].toObject()
      : favoriteRoutes[existingIndex];

    user.favoriteRoutes.splice(existingIndex, 1);
    await ProfileRepository.save(user);

    return {
      ...removedRoute,
      favoriteStatus: 'REMOVED',
    };
  }
}

export default ProfileService;
