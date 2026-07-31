import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { getRoleHomeRoute } from '@/utils/roleNavigation';

export default function IndexScreen() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Restoring your session" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? getRoleHomeRoute(user?.role) : '/route-search'} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
