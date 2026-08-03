import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';

export type BottomNavKey = 'home' | 'explore' | 'tickets' | 'activity' | 'history' | 'priority' | 'trips' | 'schedule' | 'chat' | 'support' | 'profile' | 'validate' | 'sell' | 'revenue';

export type BottomNavItemConfig = {
  key: BottomNavKey;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  href?: Href;
  unavailableTitle?: string;
  badgeCount?: number;
};

type BottomNavBaseProps = {
  active: BottomNavKey;
  items: BottomNavItemConfig[];
  style?: ViewStyle;
};

export function BottomNavBase({ active, items, style }: BottomNavBaseProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }, style]}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            accessibilityRole="button"
            key={item.key}
            onPress={() => {
              if (item.href) {
                router.replace(item.href);
                return;
              }
              Alert.alert(item.unavailableTitle || item.label, `${item.label} is not available in the mobile app yet.`);
            }}
            style={[styles.navItem, isActive && styles.navItemActive]}
          >
            <MaterialCommunityIcons
              color={isActive ? colors.primary : colors.muted}
              name={item.icon}
              size={21}
            />
            {item.badgeCount ? (
              <View style={styles.badge} accessibilityLabel={`${item.badgeCount} unread notifications`}>
                <Text style={styles.badgeText}>{item.badgeCount > 99 ? '99+' : item.badgeCount}</Text>
              </View>
            ) : null}
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d5e4dd',
    backgroundColor: '#e8f1ed',
    paddingTop: 9,
    paddingHorizontal: 8,
  },
  navItem: {
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 7,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#d7f4e6',
  },
  navLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.error,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
});
