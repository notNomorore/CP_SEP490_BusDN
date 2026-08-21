import TripSchedule from '../admin/TripSchedule.js';
import { endOfLocalDay, startOfLocalDay, timeStringToMinutes } from './utils/time.js';
import routeRecommendationConfig from './routeRecommendation.config.js';

const ACTIVE_SCHEDULE_STATUSES = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'];

export class WaitingTimeService {
  constructor({ schedules = null, now = new Date(), config = routeRecommendationConfig } = {}) {
    this.now = now;
    this.config = config;
    this.scheduleMap = new Map();

    if (Array.isArray(schedules)) {
      this.setSchedules(schedules);
    }
  }

  static async createForRoutes(routeIds, options = {}) {
    const now = options.now || new Date();
    const schedules = routeIds.length
      ? await TripSchedule.find({
        routeId: { $in: routeIds },
        serviceDate: { $gte: startOfLocalDay(now), $lt: endOfLocalDay(now) },
        status: { $in: ACTIVE_SCHEDULE_STATUSES },
      }).lean()
      : [];

    return new WaitingTimeService({ schedules, now, config: options.config });
  }

  setSchedules(schedules) {
    schedules.forEach((schedule) => {
      const key = this.buildKey(schedule.routeId, schedule.direction);
      const current = this.scheduleMap.get(key) || [];
      current.push(schedule);
      this.scheduleMap.set(key, current);
    });
  }

  buildKey(routeId, direction) {
    return `${String(routeId)}|${direction}`;
  }

  getWaitingTimeMinutes({ routeId, direction, stop = {}, route = {} }) {
    const schedules = this.scheduleMap.get(this.buildKey(routeId, direction)) || [];
    const nowMinutes = this.now.getHours() * 60 + this.now.getMinutes();
    const stopOffset = Number(stop.departureOffsetMinutes ?? stop.arrivalOffsetMinutes) || 0;
    const upcomingWaits = schedules
      .map((schedule) => {
        const departureMinutes = timeStringToMinutes(schedule.departureTime);
        if (departureMinutes === null) return null;
        const delay = (Number(schedule.incidentDelayMinutes) || 0) + (Number(schedule.propagatedDelayMinutes) || 0);
        return departureMinutes + stopOffset + delay - nowMinutes;
      })
      .filter((wait) => Number.isFinite(wait) && wait >= 0)
      .sort((left, right) => left - right);

    if (upcomingWaits.length) {
      return {
        durationMinutes: Math.round(upcomingWaits[0]),
        reason: 'SCHEDULE',
      };
    }

    const headway = this.resolveHeadwayMinutes(schedules, route);
    return {
      durationMinutes: Math.max(Math.round(headway / 2), 1),
      reason: schedules.length ? 'HEADWAY' : 'DEFAULT_HEADWAY',
    };
  }

  resolveHeadwayMinutes(schedules, route) {
    const scheduleHeadways = schedules
      .map((schedule) => Number(schedule.headwayMinutes))
      .filter((headway) => Number.isFinite(headway) && headway > 0);
    if (scheduleHeadways.length) {
      return Math.min(...scheduleHeadways);
    }

    const routeHeadway = Number(route.scheduleConfig?.frequencyMinutes);
    if (Number.isFinite(routeHeadway) && routeHeadway > 0) {
      return routeHeadway;
    }

    return this.config.DEFAULT_HEADWAY_MINUTES;
  }
}

export default WaitingTimeService;
