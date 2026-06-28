import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import profileApi from '@/api/profile.api';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { AuthUser, UserProfile } from '@/types/auth';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const fallbackUser: AuthUser = {
  id: 'BUS-DN',
  fullName: 'BusDN Passenger',
  email: 'passenger@busdn.vn',
  phoneNumber: 'Not provided',
  role: 'PASSENGER',
  isVerified: true,
};

function formatMemberSince(value?: string) {
  if (!value) return 'Jan 2024';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Jan 2024';
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(date);
}

function getDaysLeft(expireDate?: string) {
  if (!expireDate) return 12;
  const difference = new Date(expireDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(difference / 86_400_000));
}

function passengerId(id?: string) {
  if (!id) return 'BD-9981';
  return `BD-${id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase() || '9981'}`;
}

function ActionCard({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
    >
      <View style={styles.actionIcon}>
        <MaterialCommunityIcons color={colors.accent} name={icon} size={20} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function SettingRow({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && styles.settingPressed]}
    >
      <View style={styles.settingLabel}>
        <MaterialCommunityIcons color={colors.muted} name={icon} size={22} />
        <Text style={styles.settingText}>{label}</Text>
      </View>
      <MaterialCommunityIcons color={colors.outline} name="chevron-right" size={23} />
    </Pressable>
  );
}

function NavItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.navItem, active && styles.navItemActive]}
    >
      <MaterialCommunityIcons
        color={active ? '#17503a' : '#527064'}
        name={icon}
        size={21}
      />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const storedUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const logout = useAuthStore((state) => state.logout);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayUser = profile || storedUser || fallbackUser;
  const daysLeft = getDaysLeft(profile?.monthlyPass?.expireDate || displayUser.monthlyPassExpireDate);
  const passActive = profile?.monthlyPass?.isActive
    ?? (displayUser.monthlyPassStatus
      ? displayUser.monthlyPassStatus === 'ACTIVE'
      : true);
  const passProgress = Math.max(0.08, Math.min(1, daysLeft / 30));
  const totalTrips = profile?.ticketStatistics?.totalTrips ?? 0;
  const activeTickets = passActive ? 1 : 0;
  const initials = useMemo(
    () => displayUser.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    [displayUser.fullName],
  );

  const loadProfile = async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    try {
      setProfile(await profileApi.getMyProfile());
    } catch {
      // Persisted auth data remains a safe fallback when the profile endpoint is unavailable.
    } finally {
      refresh ? setIsRefreshing(false) : setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    if (isAuthenticated) void loadProfile();
  }, [isAuthenticated, isHydrated]);

  const unavailable = (title: string) => {
    Alert.alert(title, `${title} is not available in the mobile app yet.`);
  };

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/auth/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
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
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Pressable accessibilityLabel="More profile options" hitSlop={8} onPress={() => unavailable('Profile options')} style={styles.headerButton}>
            <MaterialCommunityIcons color={colors.primary} name="dots-vertical" size={24} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 118 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadProfile(true)} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileSection}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                {displayUser.avatar ? (
                  <Image source={{ uri: displayUser.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              <Pressable accessibilityLabel="Edit profile photo" onPress={() => unavailable('Profile photo')} style={styles.cameraButton}>
                <MaterialCommunityIcons color={colors.white} name="camera" size={18} />
              </Pressable>
            </View>
            <Text style={styles.name}>{displayUser.fullName}</Text>
            <Text style={styles.contact}>{displayUser.email || 'Email not provided'}</Text>
            <Text style={styles.phone}>{displayUser.phoneNumber || displayUser.phone || 'Phone not provided'}</Text>
          </View>

          {isLoading && !profile ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : null}

          <View style={styles.statusCard}>
            <View>
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons color="#17503a" name="check-decagram" size={15} />
                <Text style={styles.verifiedText}>
                  {displayUser.isVerified === false ? 'ACCOUNT' : 'VERIFIED ACCOUNT'}
                </Text>
              </View>
              <Text style={styles.memberText}>Member since {formatMemberSince(displayUser.createdAt)}</Text>
            </View>
            <View style={styles.passengerBlock}>
              <Text style={styles.passengerLabel}>PASSENGER ID</Text>
              <Text style={styles.passengerValue}>{passengerId(displayUser.id)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Travel Summary</Text>
          <View style={styles.passCard}>
            <View>
              <Text style={styles.passKicker}>MONTHLY PASS</Text>
              <Text style={styles.passTitle}>{passActive ? 'Active Status' : 'Inactive Status'}</Text>
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${passProgress * 100}%` }]} />
              </View>
              <Text style={styles.daysText}>{daysLeft} Days Left</Text>
            </View>
            <View style={styles.passGlow} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons color={colors.accent} name="bus" size={23} />
              <View>
                <Text style={styles.statValue}>{totalTrips}</Text>
                <Text style={styles.statLabel}>Total Trips</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons color={colors.secondary} name="ticket-confirmation-outline" size={23} />
              <View>
                <Text style={styles.statValue}>{String(activeTickets).padStart(2, '0')}</Text>
                <Text style={styles.statLabel}>Active Tickets</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <ActionCard icon="square-edit-outline" label="Edit Profile" onPress={() => unavailable('Edit Profile')} />
            <ActionCard icon="lock-outline" label="Security" onPress={() => router.push('/change-password')} />
            <ActionCard icon="bell-ring-outline" label="Alerts" onPress={() => unavailable('Alerts')} />
            <ActionCard icon="web" label="Language" onPress={() => unavailable('Language')} />
          </View>

          <View style={styles.settingsCard}>
            <SettingRow icon="shield-check-outline" label="Privacy Policy" onPress={() => unavailable('Privacy Policy')} />
            <SettingRow icon="file-document-outline" label="Terms of Service" onPress={() => unavailable('Terms of Service')} />
            <SettingRow icon="help-box-outline" label="Help Center" onPress={() => unavailable('Help Center')} />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isLoggingOut}
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          >
            {isLoggingOut ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.error} name="logout" size={21} />
                <Text style={styles.logoutText}>Logout Account</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>BUSDN MOBILE</Text>
            <Text style={styles.footerVersion}>VERSION 4.2.0-STABLE</Text>
          </View>
        </ScrollView>

        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <NavItem icon="home-outline" label="Home" onPress={() => router.replace('/home')} />
          <NavItem icon="history" label="History" onPress={() => unavailable('History')} />
          <NavItem icon="ticket-confirmation-outline" label="Tickets" onPress={() => unavailable('Tickets')} />
          <NavItem active icon="account" label="Account" onPress={() => undefined} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, backgroundColor: 'rgba(242,252,248,0.97)' },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  headerTitle: { color: colors.primary, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 12 },
  profileSection: { alignItems: 'center', marginBottom: 23 },
  avatarWrap: { marginBottom: 14 },
  avatar: { width: 124, height: 124, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 4, borderColor: colors.white, borderRadius: 62, backgroundColor: '#c4ebd7', shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 5 },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: colors.primaryContainer, fontSize: 35, fontWeight: '900' },
  cameraButton: { position: 'absolute', right: 2, bottom: 2, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface, borderRadius: 18, backgroundColor: colors.accent, elevation: 5 },
  name: { color: colors.primary, fontSize: 23, fontWeight: '900', letterSpacing: -0.6 },
  contact: { marginTop: 5, color: colors.muted, fontSize: 13, fontWeight: '600' },
  phone: { marginTop: 3, color: '#65716c', fontSize: 12 },
  loader: { marginBottom: 12 },
  statusCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 24, backgroundColor: colors.white, shadowColor: colors.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 3 },
  verifiedBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#b5efd1' },
  verifiedText: { color: '#17503a', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  memberText: { marginTop: 9, color: colors.muted, fontSize: 11 },
  passengerBlock: { alignItems: 'flex-end' },
  passengerLabel: { color: '#718079', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  passengerValue: { marginTop: 3, color: colors.primary, fontSize: 17, fontWeight: '900' },
  sectionTitle: { marginTop: 28, marginBottom: 13, paddingHorizontal: 2, color: colors.primary, fontSize: 18, fontWeight: '900' },
  passCard: { height: 132, justifyContent: 'space-between', overflow: 'hidden', padding: 20, borderRadius: 25, backgroundColor: colors.primaryContainer },
  passKicker: { color: '#669c82', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  passTitle: { marginTop: 4, color: colors.white, fontSize: 23, fontWeight: '900' },
  progressRow: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  daysText: { color: '#9bcab4', fontSize: 10, fontWeight: '800' },
  passGlow: { position: 'absolute', top: -40, right: -32, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(43,164,113,0.12)' },
  statsRow: { flexDirection: 'row', gap: 13, marginTop: 13 },
  statCard: { flex: 1, height: 112, justifyContent: 'space-between', padding: 17, borderWidth: 1, borderColor: 'rgba(193,200,195,0.18)', borderRadius: 24, backgroundColor: colors.white },
  statValue: { color: colors.primary, fontSize: 27, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { width: '48%', minHeight: 72, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 22, backgroundColor: colors.surfaceLow },
  actionIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.white },
  actionLabel: { flexShrink: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  settingsCard: { marginTop: 29, overflow: 'hidden', padding: 7, borderRadius: 24, backgroundColor: colors.white },
  settingRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderRadius: 18 },
  settingPressed: { backgroundColor: colors.surfaceLow },
  settingLabel: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  logoutButton: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 26, borderRadius: 24, backgroundColor: '#dbe5e1' },
  logoutText: { color: colors.error, fontSize: 14, fontWeight: '900' },
  footer: { alignItems: 'center', marginTop: 28 },
  footerBrand: { color: 'rgba(0,26,15,0.28)', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  footerVersion: { marginTop: 4, color: 'rgba(65,72,68,0.45)', fontSize: 8, fontWeight: '700', letterSpacing: 1.1 },
  bottomNav: { position: 'absolute', right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 9, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d5e4dd', borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#e8f1ed', shadowColor: colors.primary, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 10 },
  navItem: { minWidth: 67, alignItems: 'center', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 24 },
  navItemActive: { backgroundColor: '#b5efd1' },
  navLabel: { marginTop: 2, color: '#527064', fontSize: 8, fontWeight: '600' },
  navLabelActive: { color: '#17503a', fontWeight: '800' },
});
