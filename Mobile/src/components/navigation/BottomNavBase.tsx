import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';

export type BottomNavKey = 'home' | 'explore' | 'tracking' | 'tickets' | 'activity' | 'history' | 'priority' | 'trips' | 'schedule' | 'notifications' | 'chat' | 'support' | 'profile' | 'validate' | 'sell' | 'revenue';

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
  const isCompact = items.length > 5;

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }, style]}>
      {items.map((item) => {
        const isActive = item.key === active;
        const isPrimaryScan = item.key === 'validate';
        return (
          <Pressable
            accessibilityRole="button"
            key={item.key}
            onPress={() => {
              if (item.href) {
                router.replace(item.href);
                return;
              }
              Alert.alert(item.unavailableTitle || item.label, `${item.label} hiện chưa có trên ứng dụng Mobile.`);
            }}
            style={[styles.navItem, isCompact && styles.navItemCompact, isActive && !isPrimaryScan && styles.navItemActive]}
          >
            <View style={isPrimaryScan ? [styles.primaryScanIcon, isActive && styles.primaryScanIconActive] : undefined}>
              <MaterialCommunityIcons
                color={isPrimaryScan ? colors.white : isActive ? colors.primary : colors.muted}
                name={item.icon}
                size={isPrimaryScan ? 23 : isCompact ? 20 : 21}
              />
            </View>
            {item.badgeCount ? (
              <View style={styles.badge} accessibilityLabel={`${item.badgeCount} thông báo chưa đọc`}>
                <Text style={styles.badgeText}>{item.badgeCount > 99 ? '99+' : item.badgeCount}</Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={[styles.navLabel, isCompact && styles.navLabelCompact, isActive && styles.navLabelActive]}>
              {item.label}
            </Text>
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
  navItemCompact: {
    minWidth: 48,
    paddingHorizontal: 5,
  },
  navItemActive: {
    backgroundColor: '#d7f4e6',
  },
  primaryScanIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#39bd7d',
  },
  primaryScanIconActive: {
    backgroundColor: colors.primary,
  },
  navLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  navLabelCompact: {
    fontSize: 9,
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
