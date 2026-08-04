import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useAuthStore } from '@/store/auth.store';

export function useLogout() {
  const storeLogout = useAuthStore((state) => state.logout);
  const [loading, setLoading] = useState(false);

  const performLogout = useCallback(async () => {
    setLoading(true);
    try {
      await storeLogout();
      router.replace('/auth/login');
    } finally {
      setLoading(false);
    }
  }, [storeLogout]);

  const logout = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        void performLogout();
      }
      return;
    }

    Alert.alert('Logout Account', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => void performLogout(),
      },
    ]);
  }, [performLogout]);

  return {
    loading,
    logout,
  };
}

export default useLogout;
