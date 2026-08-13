import { io } from 'socket.io-client';

const DISCONNECT_DELAY_MS = 30000;

let fleetSocket = null;
let subscriberCount = 0;
let disconnectTimer = null;

const getApiOrigin = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return import.meta.env.VITE_SOCKET_URL?.trim().replace(/\/$/, '') || 'https://cp-sep490-busdn.onrender.com';
};

const getToken = () => (
  localStorage.getItem('authToken')
  || localStorage.getItem('token')
  || localStorage.getItem('accessToken')
  || ''
);

export const acquireFleetSocket = () => {
  if (disconnectTimer) {
    window.clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  subscriberCount += 1;

  const token = getToken();
  if (!fleetSocket) {
    fleetSocket = io(getApiOrigin(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  } else {
    fleetSocket.auth = { token };
    if (!fleetSocket.connected) fleetSocket.connect();
  }

  return fleetSocket;
};

export const releaseFleetSocket = () => {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount > 0 || !fleetSocket || disconnectTimer) return;

  fleetSocket.emit('admin:fleet:unsubscribe');
  disconnectTimer = window.setTimeout(() => {
    if (subscriberCount === 0 && fleetSocket) {
      fleetSocket.disconnect();
      fleetSocket = null;
    }
    disconnectTimer = null;
  }, DISCONNECT_DELAY_MS);
};
