import type { Href } from 'expo-router';

const driverAssistantRoles = new Set(['DRIVER', 'BUS_ASSISTANT', 'BUS ASSISTANT', 'CONDUCTOR']);

export function normalizeRole(role?: string | null) {
  return String(role || '').trim().toUpperCase();
}

export function isDriverAssistantRole(role?: string | null) {
  return driverAssistantRoles.has(normalizeRole(role));
}

export function getRoleHomeRoute(role?: string | null): Href {
  return (isDriverAssistantRole(role) ? '/driver-assistant' : '/home') as Href;
}
