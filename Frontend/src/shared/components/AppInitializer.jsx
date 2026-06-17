import React, { useEffect } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../../features/auth/stores/authStore.js';
import toast from '../utils/toast.js';

const getApiOrigin = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  return configured ? configured.replace(/\/$/, '') : 'http://localhost:3000';
};

const notificationTargetsCurrentUser = (notification, user) => {
  if (!user) return false;
  const userId = String(user.id || user._id || '');
  const role = String(user.role || '').toUpperCase();
  const recipients = (notification.recipientUserIds || []).map((id) => String(id));

  if (recipients.length > 0) {
    return recipients.includes(userId);
  }

  if (notification.targetAudience === 'all') return true;
  if (notification.targetAudience === 'passengers') return role === 'PASSENGER';
  if (notification.targetAudience === 'drivers') return role === 'DRIVER';
  if (notification.targetAudience === 'bus_assistants') return role === 'BUS_ASSISTANT';
  if (notification.targetAudience === 'admins') return role === 'ADMIN';

  return false;
};

const showNotificationToast = (notification) => {
  const isUrgent = notification.isUrgent || notification.priority === 'urgent' || notification.type === 'emergency';
  const content = React.createElement(
    'div',
    { className: 'max-w-sm' },
    React.createElement(
      'p',
      { className: `text-sm font-black ${isUrgent ? 'text-error' : 'text-primary'}` },
      notification.title
    ),
    React.createElement('p', { className: 'mt-1 text-sm text-on-surface' }, notification.message)
  );

  return toast.custom(content, {
    id: `notification:${notification._id}`,
    duration: isUrgent ? 12000 : 6000,
    className: isUrgent
      ? 'rounded-2xl border border-error bg-error-container px-4 py-3 shadow-xl'
      : 'rounded-2xl border border-outline-variant/40 bg-white px-4 py-3 shadow-xl',
  });
};

/**
 * App Initializer - restores auth session on app load
 */
export const AppInitializer = ({ children }) => {
  const { restoreSession, user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!isAuthenticated || !user) return undefined;

    const token = localStorage.getItem('authToken');
    const socket = io(getApiOrigin(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('server:notification:new', (notification) => {
      if (notificationTargetsCurrentUser(notification, user)) {
        showNotificationToast(notification);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, user]);

  return children;
};

export default AppInitializer;
