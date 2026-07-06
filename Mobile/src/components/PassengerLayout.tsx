import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type NavKey = 'home' | 'routes' | 'tickets' | 'notifications' | 'profile';

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Quay lại" hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
        <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={24} />
      </Pressable>
      <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerButton}>{right}</View>
    </View>
  );
}

export function PassengerScreen({
  title,
  children,
  refreshing = false,
  onRefresh,
}: PropsWithChildren<{ title: string; refreshing?: boolean; onRefresh?: () => void }>) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScreenHeader title={title} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 118 + insets.bottom }]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export function StateView({
  loading,
  error,
  empty,
  emptyText = 'Chưa có dữ liệu.',
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.stateText}>Đang tải...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateCard}>
        <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={24} />
        <Text style={styles.stateText}>{error}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.stateCard}>
        <MaterialCommunityIcons color={colors.muted} name="inbox-outline" size={24} />
        <Text style={styles.stateText}>{emptyText}</Text>
      </View>
    );
  }

  return null;
}

export function InfoCard({ children, onPress }: PropsWithChildren<{ onPress?: () => void }>) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, active = false, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function BottomNav({ active }: { active: NavKey }) {
  const insets = useSafeAreaInsets();
  const items: Array<{ key: NavKey; icon: IconName; label: string; href: string }> = [
    { key: 'home', icon: 'home-outline', label: 'Trang chủ', href: '/home' },
    { key: 'routes', icon: 'compass-outline', label: 'Tuyến', href: '/search-routes' },
    { key: 'tickets', icon: 'ticket-confirmation-outline', label: 'Vé', href: '/my-tickets' },
    { key: 'notifications', icon: 'bell-outline', label: 'Thông báo', href: '/notifications' },
    { key: 'profile', icon: 'account-outline', label: 'Tài khoản', href: '/profile' },
  ];

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable key={item.key} onPress={() => router.replace(item.href as any)} style={[styles.navItem, isActive && styles.navItemActive]}>
            <MaterialCommunityIcons color={isActive ? '#17503a' : '#527064'} name={item.icon} size={21} />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, backgroundColor: 'rgba(242,252,248,0.97)' },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.primary, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12 },
  card: { marginBottom: 13, padding: 16, borderRadius: 22, backgroundColor: colors.card, shadowColor: colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  stateCard: { alignItems: 'center', gap: 10, marginVertical: 16, padding: 18, borderRadius: 22, backgroundColor: colors.card },
  stateText: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  retryButton: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primaryContainer },
  retryText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.surfaceLow },
  chipActive: { backgroundColor: '#b5efd1' },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#17503a' },
  bottomNav: { position: 'absolute', right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 9, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d5e4dd', backgroundColor: '#e8f1ed' },
  navItem: { minWidth: 57, alignItems: 'center', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 24 },
  navItemActive: { backgroundColor: '#b5efd1' },
  navLabel: { marginTop: 2, color: '#527064', fontSize: 8, fontWeight: '600' },
  navLabelActive: { color: '#17503a', fontWeight: '800' },
});

export const sharedStyles = styles;
