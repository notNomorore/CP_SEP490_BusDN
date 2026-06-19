export const getRoleLandingPath = (user) => {
  const role = String(user?.role || '').toUpperCase();

  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'BUS_ASSISTANT') return '/bus-assistant/assigned-trips';
  if (role === 'DRIVER' || role === 'CONDUCTOR') return '/operations/schedule';

  return '/';
};

export default getRoleLandingPath;
