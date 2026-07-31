import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BottomNavKey } from '@/components/navigation/BottomNavBase';
import { PassengerBottomNav } from '@/components/navigation/PassengerBottomNav';
import { colors } from '@/constants/colors';

type PassengerLayoutProps = PropsWithChildren<{
  active: BottomNavKey;
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}>;

export function PassengerLayout({ active, title, subtitle, rightAction, refreshControl, children }: PassengerLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" hitSlop={10} onPress={() => router.canGoBack() ? router.back() : router.replace('/home')}>
            <MaterialCommunityIcons color={colors.primary} name="chevron-left" size={28} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {rightAction || <View style={styles.headerSpacer} />}
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        <PassengerBottomNav active={active} />
      </View>
    </SafeAreaView>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'inbox-outline', title, detail }: { icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; detail?: string }) {
  return (
    <View style={styles.stateBox}>
      <MaterialCommunityIcons color={colors.secondary} name={icon} size={32} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {detail ? <Text style={styles.stateText}>{detail}</Text> : null}
    </View>
  );
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return (
    <View style={[styles.pill, styles[`${tone}Pill`]]}>
      <Text style={[styles.pillText, styles[`${tone}PillText`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d5e4dd',
    backgroundColor: colors.surface,
  },
  headerCopy: { flex: 1 },
  title: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.secondary, fontSize: 12, fontWeight: '700' },
  headerSpacer: { width: 28 },
  content: { padding: 18, gap: 14 },
  stateBox: {
    minHeight: 144,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 20,
  },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  stateText: { color: colors.secondary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  neutralPill: { backgroundColor: '#edf3f0' },
  successPill: { backgroundColor: '#d8f6e7' },
  warningPill: { backgroundColor: '#fff4cc' },
  dangerPill: { backgroundColor: colors.errorContainer },
  pillText: { fontSize: 10, fontWeight: '900' },
  neutralPillText: { color: colors.muted },
  successPillText: { color: '#06613f' },
  warningPillText: { color: '#6f5200' },
  dangerPillText: { color: colors.error },
});
