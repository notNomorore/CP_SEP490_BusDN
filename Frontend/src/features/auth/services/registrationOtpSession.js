const STORAGE_KEY = 'busdn.pendingRegistrationOtp';

export const savePendingRegistrationOtp = (payload) => {
  if (typeof window === 'undefined') return;

  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      email: payload.email || '',
      phone: payload.phone || '',
      identifier: payload.identifier || payload.email || payload.phone || '',
      expiresAt: payload.expiresAt || '',
    })
  );
};

export const loadPendingRegistrationOtp = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const updatePendingRegistrationOtp = (patch) => {
  const current = loadPendingRegistrationOtp() || {};
  const next = { ...current, ...patch };
  savePendingRegistrationOtp(next);
  return next;
};

export const clearPendingRegistrationOtp = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
};
