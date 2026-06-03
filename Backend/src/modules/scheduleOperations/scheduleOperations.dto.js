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

const addMinutes = (value, minutes) => {
  if (!value) return null;
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
};

const formatInspection = (inspection) => {
  if (!inspection) {
    return {
      status: 'NOT_STARTED',
      checklist: {},
      issueCategory: null,
      issueDescription: '',
      startedAt: null,
      confirmedAt: null,
      reportedAt: null,
    };
  }

  return {
    id: inspection._id,
    inspectionCode: inspection.inspectionCode,
    status: inspection.status,
    checklist: inspection.checklist || {},
    issueCategory: inspection.issueCategory || null,
    issueDescription: inspection.issueDescription || '',
    startedAt: inspection.startedAt,
    confirmedAt: inspection.confirmedAt,
    reportedAt: inspection.reportedAt,
  };
};

export const ShiftAssignmentResponseDTO = {
  format: (assignment, actorId, actorRole) => {
    const trip = assignment.trip || {};
    const resolvedActorRole = actorRole || (
      String(assignment.driver?._id || assignment.driver) === String(actorId)
        ? 'DRIVER'
        : 'BUS_ASSISTANT'
    );

    return ({
    id: assignment._id,
    shiftCode: assignment.shiftCode,
    tripCode: trip.tripCode,
    actorRole: resolvedActorRole,
    route: formatRoute(trip.route),
    vehicle: trip.vehicle,
    driver: formatStaff(assignment.driver),
    busAssistant: formatStaff(assignment.busAssistant),
    scheduledStart: trip.scheduledStart,
    scheduledEnd: trip.scheduledEnd,
    dutyStart: addMinutes(trip.scheduledStart, -30),
    checkInDeadline: addMinutes(trip.scheduledStart, -15),
    dutyEnd: addMinutes(trip.scheduledEnd, 15),
    reportLocation: trip.route?.origin || '',
    dutyInstructions: resolvedActorRole === 'DRIVER'
      ? [
        'Co mat tai diem tap ket truoc gio khoi hanh.',
        'Kiem tra tinh trang phuong tien truoc chuyen.',
        'Chi khoi hanh khi xe da duoc xac nhan san sang.',
      ]
      : [
        'Co mat tai diem tap ket truoc gio khoi hanh.',
        'Ho tro hanh khach len xe va kiem tra thong tin chuyen.',
        'Phoi hop voi tai xe trong suot ca lam viec.',
      ],
    shiftStatus: assignment.shiftStatus,
    tripStatus: trip.status,
    inspection: formatInspection(assignment.inspectionRecord),
    notes: assignment.notes,
    });
  },
};

export const VehicleInspectionResponseDTO = {
  format: formatInspection,
};

export default ShiftAssignmentResponseDTO;
