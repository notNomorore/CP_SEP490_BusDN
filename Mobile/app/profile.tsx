import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import profileApi from '@/api/profile.api';
import { useLogout } from '@/auth/hooks/useLogout';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { colors } from '@/constants/colors';
import { resolveBackendUrl } from '@/constants/config';
import { useDriverI18n } from '@/i18n/driver';
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

function formatMemberSince(value: string | undefined, locale: string) {
  if (!value) return 'Jan 2024';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Jan 2024';
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date);
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const storedUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const { logout, loading: isLoggingOut } = useLogout();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const { language, toggleLanguage, t } = useDriverI18n();

  const displayUser = profile || storedUser || fallbackUser;
  const normalizedRole = String(displayUser.role || '').toUpperCase();
  const isStaffProfile = normalizedRole === 'DRIVER'
    || normalizedRole === 'BUS_ASSISTANT'
    || normalizedRole === 'CONDUCTOR';
  const staffRoleLabel = normalizedRole === 'DRIVER' ? t.common.driver : t.common.busAssistant;
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
    Alert.alert(title, `${title} hiện chưa có trên ứng dụng Mobile.`);
  };

  const uploadAvatar = async () => {
    if (isUploadingAvatar) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Chưa có quyền truy cập ảnh', 'Vui lòng cấp quyền để chọn ảnh đại diện.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.86,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const asset = result.assets[0];
    setIsUploadingAvatar(true);
    try {
      const updatedProfile = await profileApi.uploadAvatar({
        uri: asset.uri,
        fileName: asset.fileName || `avatar-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      });
      setProfile(updatedProfile);
      Alert.alert('Đã cập nhật ảnh', 'Ảnh đại diện của bạn đã được lưu.');
    } catch (error) {
      Alert.alert(
        'Không thể tải ảnh',
        (error as { message?: string })?.message || 'Vui lòng thử lại sau.',
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel={isStaffProfile ? t.common.back : 'Quay lại'} hitSlop={8} onPress={() => router.back()} style={styles.headerButton}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>{isStaffProfile ? t.profile.title : 'Hồ sơ của tôi'}</Text>
          {isStaffProfile ? (
            <View style={styles.headerButton} />
          ) : (
            <Pressable accessibilityLabel="Tùy chọn hồ sơ" hitSlop={8} onPress={() => unavailable('Tùy chọn hồ sơ')} style={styles.headerButton}>
              <MaterialCommunityIcons color={colors.primary} name="dots-vertical" size={24} />
            </Pressable>
          )}
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
                  <Image source={{ uri: resolveBackendUrl(displayUser.avatar) }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              {isStaffProfile ? null : (
                <Pressable
                  accessibilityLabel="Đổi ảnh đại diện"
                  disabled={isUploadingAvatar}
                  onPress={uploadAvatar}
                  style={[styles.cameraButton, isUploadingAvatar && styles.disabledButton]}
                >
                  {isUploadingAvatar ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <MaterialCommunityIcons color={colors.white} name="camera" size={18} />
                  )}
                </Pressable>
              )}
            </View>
            <Text style={styles.name}>{displayUser.fullName}</Text>
            <Text style={styles.contact}>{displayUser.email || (isStaffProfile ? t.common.noEmail : 'Chưa cung cấp email')}</Text>
            <Text style={styles.phone}>{displayUser.phoneNumber || displayUser.phone || (isStaffProfile ? t.common.noPhone : 'Chưa cung cấp số điện thoại')}</Text>
          </View>

          {isLoading && !profile ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : null}

          {isStaffProfile ? (
            <>
              <View style={styles.statusCard}>
                <View>
                  <View style={styles.verifiedBadge}>
                    <MaterialCommunityIcons color="#17503a" name="check-decagram" size={15} />
                    <Text style={styles.verifiedText}>{displayUser.isVerified === false ? t.common.accountOnly : t.common.verifiedAccount}</Text>
                  </View>
                  <Text style={styles.memberText}>{t.common.memberSince} {formatMemberSince(displayUser.createdAt, language === 'VN' ? 'vi-VN' : 'en-US')}</Text>
                </View>
                <View style={styles.passengerBlock}>
                  <Text style={styles.passengerLabel}>{t.common.role}</Text>
                  <Text style={styles.passengerValue}>{staffRoleLabel}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>{t.common.account}</Text>
              <View style={styles.settingsCard}>
                <SettingRow icon="lock-outline" label={t.common.changePassword} onPress={() => router.push('/change-password')} />
                <SettingRow
                  icon="translate"
                  label={`${t.common.language}: ${language}`}
                  onPress={toggleLanguage}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.statusCard}>
                <View>
                  <View style={styles.verifiedBadge}>
                    <MaterialCommunityIcons color="#17503a" name="check-decagram" size={15} />
                    <Text style={styles.verifiedText}>
                      {displayUser.isVerified === false ? 'TÀI KHOẢN' : 'TÀI KHOẢN ĐÃ XÁC THỰC'}
                    </Text>
                  </View>
                  <Text style={styles.memberText}>Thành viên từ {formatMemberSince(displayUser.createdAt, 'vi-VN')}</Text>
                </View>
                <View style={styles.passengerBlock}>
                  <Text style={styles.passengerLabel}>MÃ HÀNH KHÁCH</Text>
                  <Text style={styles.passengerValue}>{passengerId(displayUser.id)}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Tổng quan hành trình</Text>
              <View style={styles.passCard}>
                <View>
                  <Text style={styles.passKicker}>VÉ THÁNG</Text>
                  <Text style={styles.passTitle}>{passActive ? 'Đang hiệu lực' : 'Chưa kích hoạt'}</Text>
                </View>
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${passProgress * 100}%` }]} />
                  </View>
                  <Text style={styles.daysText}>Còn {daysLeft} ngày</Text>
                </View>
                <View style={styles.passGlow} />
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <MaterialCommunityIcons color={colors.accent} name="bus" size={23} />
                  <View>
                    <Text style={styles.statValue}>{totalTrips}</Text>
                    <Text style={styles.statLabel}>Tổng chuyến</Text>
                  </View>
                </View>
                <View style={styles.statCard}>
                  <MaterialCommunityIcons color={colors.secondary} name="ticket-confirmation-outline" size={23} />
                  <View>
                    <Text style={styles.statValue}>{String(activeTickets).padStart(2, '0')}</Text>
                    <Text style={styles.statLabel}>Vé hiệu lực</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
              <View style={styles.actionGrid}>
                <ActionCard icon="ticket-confirmation-outline" label="Vé của tôi" onPress={() => router.push('/my-tickets')} />
                <ActionCard icon="history" label="Lịch sử hành trình" onPress={() => router.push('/travel-history')} />
                <ActionCard icon="heart-outline" label="Yêu thích" onPress={() => router.push('/favorites' as Href)} />
                <ActionCard icon="bell-ring-outline" label="Thông báo" onPress={() => router.push('/notifications')} />
                <ActionCard icon="message-text-outline" label="Góp ý" onPress={() => router.push('/my-feedback' as Href)} />
                <ActionCard icon="package-variant-closed" label="Đồ thất lạc" onPress={() => router.push('/my-lost-items' as Href)} />
                <ActionCard icon="lock-outline" label="Bảo mật" onPress={() => router.push('/change-password')} />
              </View>

              <View style={styles.settingsCard}>
                <SettingRow icon="shield-check-outline" label="Chính sách riêng tư" onPress={() => unavailable('Chính sách riêng tư')} />
                <SettingRow icon="file-document-outline" label="Điều khoản dịch vụ" onPress={() => unavailable('Điều khoản dịch vụ')} />
                <SettingRow icon="help-box-outline" label="Trung tâm trợ giúp" onPress={() => unavailable('Trung tâm trợ giúp')} />
              </View>
            </>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={isLoggingOut}
            onPress={logout}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          >
            {isLoggingOut ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.error} name="logout" size={21} />
                <Text style={styles.logoutText}>{isStaffProfile ? t.common.logout : 'Đăng xuất'}</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>BUSDN MOBILE</Text>
            <Text style={styles.footerVersion}>{isStaffProfile ? t.common.version : 'PHIÊN BẢN 4.2.0 ỔN ĐỊNH'}</Text>
          </View>
        </ScrollView>

        <RoleBottomNav active="profile" role={displayUser.role} />
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
  disabledButton: { opacity: 0.64 },
  name: { color: colors.primary, fontSize: 23, fontWeight: '900', letterSpacing: -0.6 },
  contact: { marginTop: 5, color: colors.muted, fontSize: 13, fontWeight: '600' },
  phone: { marginTop: 3, color: '#65716c', fontSize: 12 },
  loader: { marginBottom: 12 },
  statusCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 18, borderRadius: 24, backgroundColor: colors.white, shadowColor: colors.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 3 },
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
});
