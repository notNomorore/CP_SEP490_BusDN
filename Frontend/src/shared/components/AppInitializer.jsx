import { useEffect } from 'react';
import useAuthStore from '../../features/auth/stores/authStore.js';

/**
 * App Initializer - restores auth session on app load
 */
export const AppInitializer = ({ children }) => {
  const { restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return children;
};

export default AppInitializer;
