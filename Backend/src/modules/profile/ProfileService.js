import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import Route from '../routes/Route.js';
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

  static async findStopInRoutes({ routeId, stopId, stopName, order }) {
    await RouteService.ensureSampleRoutes();

    const routeQuery = routeId ? { _id: routeId, status: 'ACTIVE' } : { status: 'ACTIVE' };
    const routes = await Route.find(routeQuery).lean();

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

  static async saveFavoriteRoute(userId, routeId) {
    await RouteService.ensureSampleRoutes();

    const user = await ProfileRepository.findById(userId);

    if (!user) {
      throw new CustomError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const route = await Route.findById(routeId).lean();

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
