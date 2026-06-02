const formatStaff = (staff) => (
  staff
    ? {
      id: staff._id || staff,
      fullName: staff.fullName || '',
      role: staff.role || '',
      phoneNumber: staff.phoneNumber || staff.phone || '',
    }
    : null
);

const formatRoute = (route) => ({
  id: route?._id || route || null,
  routeNumber: route?.routeNumber || '',
  name: route?.name || '',
  origin: route?.origin || '',
  destination: route?.destination || '',
  estimatedDurationMinutes: route?.estimatedDurationMinutes || 0,
  stops: route?.stops || [],
});

export const ShiftAssignmentResponseDTO = {
  format: (assignment, actorId) => {
    const trip = assignment.trip || {};

    return ({
    id: assignment._id,
    shiftCode: assignment.shiftCode,
    tripCode: trip.tripCode,
    actorRole: String(assignment.driver?._id || assignment.driver) === String(actorId)
      ? 'DRIVER'
      : 'BUS_ASSISTANT',
    route: formatRoute(trip.route),
    vehicle: trip.vehicle,
    driver: formatStaff(assignment.driver),
    busAssistant: formatStaff(assignment.busAssistant),
    scheduledStart: trip.scheduledStart,
    scheduledEnd: trip.scheduledEnd,
    shiftStatus: assignment.shiftStatus,
    tripStatus: trip.status,
    notes: assignment.notes,
    });
  },
};

export default ShiftAssignmentResponseDTO;
