import mongoose from 'mongoose';
import { CustomError } from '../../middleware/errorHandler.js';
import { HTTP_STATUS } from '../../constants/index.js';
import PassengerTicket from './Ticket.js';
import WalkInTicket from '../walkInTickets/WalkInTicket.js';

export const TRIP_CAPACITY = 25;

const dayBounds = (value) => {
  const dateText = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));

  return {
    start: new Date(`${dateText}T00:00:00+07:00`),
    end: new Date(`${dateText}T23:59:59.999+07:00`),
  };
};

export const getTripCapacity = async ({ scheduleId, routeId, serviceDate, departureTime, direction }) => {
  const { start, end } = dayBounds(serviceDate);
  const passengerFilter = {
    routeId,
    serviceDate: { $gte: start, $lte: end },
    departureTime,
    paymentStatus: 'PAID',
    bookingStatus: 'SUCCESS',
    ticketStatus: { $nin: ['CANCELLED', 'REFUNDED'] },
  };
  if (direction) passengerFilter.direction = direction;

  const walkInFilter = {
    status: 'COMPLETED',
    ...(mongoose.isValidObjectId(scheduleId) ? { tripId: scheduleId } : { _id: null }),
  };

  const [onlineSeats, walkInSeats] = await Promise.all([
    PassengerTicket.countDocuments(passengerFilter),
    WalkInTicket.aggregate([
      { $match: walkInFilter },
      { $group: { _id: null, seats: { $sum: '$passengerCount' } } },
    ]),
  ]);

  const soldSeats = Number(onlineSeats || 0) + Number(walkInSeats[0]?.seats || 0);
  return {
    capacity: TRIP_CAPACITY,
    soldSeats,
    remainingSeats: Math.max(TRIP_CAPACITY - soldSeats, 0),
    isFull: soldSeats >= TRIP_CAPACITY,
  };
};

export const assertTripHasCapacity = async (trip, requestedSeats = 1) => {
  const availability = await getTripCapacity({
    scheduleId: trip._id,
    routeId: trip.routeId?._id || trip.routeId,
    serviceDate: trip.serviceDate,
    departureTime: trip.departureTime,
    direction: trip.direction,
  });

  if (availability.remainingSeats < requestedSeats) {
    throw new CustomError(
      availability.isFull
        ? 'Chuyến xe đã hết chỗ (25/25). Vui lòng chọn giờ khác.'
        : `Chuyến xe chỉ còn ${availability.remainingSeats} chỗ. Vui lòng giảm số hành khách hoặc chọn giờ khác.`,
      HTTP_STATUS.CONFLICT
    );
  }

  return availability;
};
