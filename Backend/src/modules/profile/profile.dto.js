const formatTravelHistory = (travelHistory = []) =>
  travelHistory
    .slice()
    .sort((left, right) => new Date(right.boardedAt) - new Date(left.boardedAt))
    .slice(0, 6)
    .map((trip) => ({
      routeNumber: trip.routeNumber,
      fromStop: trip.fromStop,
      toStop: trip.toStop,
      boardedAt: trip.boardedAt,
      fare: trip.fare,
      vehicleLabel: trip.vehicleLabel,
      paymentMethod: trip.paymentMethod,
      status: trip.status,
    }));

const buildTicketStatistics = (user) => {
  const history = Array.isArray(user.travelHistory) ? user.travelHistory : [];
  const completedTrips = history.filter((trip) => trip.status === 'COMPLETED');
  const now = new Date();
  const currentMonthTrips = completedTrips.filter((trip) => {
    const boardedAt = new Date(trip.boardedAt);
    return boardedAt.getMonth() === now.getMonth() && boardedAt.getFullYear() === now.getFullYear();
  });

  const favoriteRouteEntry = completedTrips.reduce((accumulator, trip) => {
    const current = accumulator[trip.routeNumber] || 0;
    accumulator[trip.routeNumber] = current + 1;
    return accumulator;
  }, {});

  const favoriteRoute = Object.entries(favoriteRouteEntry).sort((left, right) => right[1] - left[1])[0];
  const amountSpent = completedTrips.reduce((total, trip) => total + (trip.fare || 0), 0);

  return {
    totalTrips: completedTrips.length,
    tripsThisMonth: currentMonthTrips.length,
    amountSpent,
    favoriteRouteNumber: favoriteRoute?.[0] || null,
    favoriteRouteTrips: favoriteRoute?.[1] || 0,
  };
};

const buildMonthlyPass = (user) => ({
  status: user.monthlyPassStatus,
  expireDate: user.monthlyPassExpireDate,
  isActive: user.monthlyPassStatus === 'ACTIVE',
  ridesThisMonth: buildTicketStatistics(user).tripsThisMonth,
});

export const ProfileResponseDTO = {
  format: (user) => ({
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phoneNumber,
    phoneNumber: user.phoneNumber,
    avatar: user.avatar,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    role: user.role,
    favoriteRoutes: user.favoriteRoutes || [],
    favoriteStops: user.favoriteStops || [],
    notificationEnabled: Boolean(user.notificationEnabled),
    notificationDevice: {
      deviceToken: user.notificationDevice?.deviceToken || '',
      permissionStatus: user.notificationDevice?.permissionStatus || 'DEFAULT',
      updatedAt: user.notificationDevice?.updatedAt || null,
    },
    notificationTypes: {
      arrivalAlerts: user.notificationTypes?.arrivalAlerts ?? true,
      delayAlerts: user.notificationTypes?.delayAlerts ?? true,
      routeChangeAlerts: user.notificationTypes?.routeChangeAlerts ?? true,
      tripUpdates: user.notificationTypes?.tripUpdates ?? true,
      accountUpdates: user.notificationTypes?.accountUpdates ?? true,
    },
    monthlyPassStatus: user.monthlyPassStatus,
    monthlyPassExpireDate: user.monthlyPassExpireDate,
    monthlyPass: buildMonthlyPass(user),
    ticketStatistics: buildTicketStatistics(user),
    recentTravelHistory: formatTravelHistory(user.travelHistory),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }),
};

export default ProfileResponseDTO;
