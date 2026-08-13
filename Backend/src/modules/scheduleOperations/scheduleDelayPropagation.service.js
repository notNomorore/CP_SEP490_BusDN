import TripSchedule from '../admin/TripSchedule.js';
import OperationNotification from './OperationNotification.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const dayBounds = (value) => {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

const clockAt = (serviceDate, value) => {
  const date = new Date(serviceDate);
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const plannedWindow = (schedule) => {
  const start = clockAt(schedule.serviceDate, schedule.departureTime);
  let end = clockAt(
    schedule.serviceDate,
    schedule.expectedArrivalTime || schedule.turnaroundEndTime || schedule.departureTime
  );
  if (start && end && end <= start) end = new Date(end.getTime() + DAY_MS);
  return { start, end };
};

const resourceIds = (schedule) => [schedule.driver?.userId, schedule.assistant?.userId]
  .map((value) => String(value || '').trim())
  .filter(Boolean);

export const propagateIncidentDelay = async ({ scheduleId, delayMinutes, reason = '', actorId = null }) => {
  const source = await TripSchedule.findById(scheduleId).lean();
  if (!source) return [];

  const normalizedDelay = Math.max(0, Math.min(1440, Number(delayMinutes) || 0));
  await TripSchedule.updateOne(
    { _id: source._id },
    { $set: { incidentDelayMinutes: normalizedDelay, delayReason: String(reason || '').trim() } }
  );

  const { start, end } = dayBounds(source.serviceDate);
  const schedules = await TripSchedule.find({
    serviceDate: { $gte: start, $lt: end },
    status: { $nin: ['COMPLETED', 'CANCELLED'] },
  }).lean();

  schedules.sort((left, right) => (
    (plannedWindow(left).start?.getTime() || 0) - (plannedWindow(right).start?.getTime() || 0)
  ));

  const availableAt = new Map();
  const changes = [];
  for (const schedule of schedules) {
    const { start: plannedStart, end: plannedEnd } = plannedWindow(schedule);
    if (!plannedStart || !plannedEnd) continue;
    const resources = resourceIds(schedule);
    const resourceReadyAt = resources.reduce(
      (latest, id) => Math.max(latest, availableAt.get(id) || 0),
      0
    );
    const adjustedStartMs = Math.max(plannedStart.getTime(), resourceReadyAt);
    const isSourceSchedule = String(schedule._id) === String(source._id);
    const directDelay = isSourceSchedule
      ? normalizedDelay
      : Math.max(0, Number(schedule.incidentDelayMinutes) || 0);
    const durationMs = Math.max(plannedEnd.getTime() - plannedStart.getTime(), MINUTE_MS);
    const adjustedEndMs = adjustedStartMs + durationMs + directDelay * MINUTE_MS;
    const propagatedDelayMinutes = Math.max(0, Math.ceil((adjustedStartMs - plannedStart.getTime()) / MINUTE_MS));

    resources.forEach((id) => availableAt.set(id, adjustedEndMs));
    const isAdjusted = directDelay > 0 || propagatedDelayMinutes > 0;
    await TripSchedule.updateOne(
      { _id: schedule._id },
      {
        $set: {
          adjustedStartAt: isAdjusted ? new Date(adjustedStartMs) : null,
          adjustedEndAt: isAdjusted ? new Date(adjustedEndMs) : null,
          propagatedDelayMinutes,
          ...(isSourceSchedule ? {
            incidentDelayMinutes: normalizedDelay,
            delayReason: String(reason || '').trim(),
          } : {}),
        },
      }
    );

    if (propagatedDelayMinutes > 0) {
      changes.push({
        scheduleId: schedule._id,
        scheduleCode: schedule.scheduleCode,
        adjustedStartAt: new Date(adjustedStartMs),
        adjustedEndAt: new Date(adjustedEndMs),
        propagatedDelayMinutes,
      });
      if (actorId && resources.length) {
        await OperationNotification.findOneAndUpdate(
          { sourceType: 'PROPAGATED_TRIP_DELAY', sourceId: schedule._id },
          { $set: {
            title: `Điều chỉnh giờ chuyến ${schedule.scheduleCode}`,
            message: `Chuyến được dời ${propagatedDelayMinutes} phút để không trùng lịch nhân sự với chuyến trước bị trễ.`,
            category: 'SCHEDULE_CHANGE',
            priority: 'HIGH',
            targetRoles: ['DRIVER', 'BUS_ASSISTANT'],
            targetUsers: resources,
            route: schedule.routeId,
            trip: schedule._id,
            vehicle: schedule.vehicle?.busId || null,
            activeFrom: new Date(),
            expiresAt: null,
            status: 'ACTIVE',
            createdBy: actorId,
            metadata: {
              notificationKind: 'PROPAGATED_TRIP_DELAY',
              scheduleCode: schedule.scheduleCode,
              propagatedDelayMinutes,
              adjustedStartAt: new Date(adjustedStartMs),
              adjustedEndAt: new Date(adjustedEndMs),
            },
          } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }
  }

  return changes;
};

export default { propagateIncidentDelay };
