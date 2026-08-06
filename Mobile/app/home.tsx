import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { isDriverAssistantRole } from '@/utils/roleNavigation';

const destinations = [
  {
    title: 'Hà Nội - Sa Pa',
    detail: 'Đánh giá 4.8',
    price: 'Từ 24 USD',
    badge: 'Phổ biến',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBw2QLHKlIhgiQuJsKrfxH0bKnsKD3wUy8AsHHoQWP53W4cXESgJGrBrhXdMKNGYPedg6A6BFVrsEsz6M6vEvwpo6ydAUyayYkohp8SMJyO5wciNIvn6kS98CSXF0pBDmj9EoN9POhCnHx5cT3HAAjRIrxAdoyMKO0tfcPN9mTpYedq70fJ6erX87qooQQxszQveP-lvCW6dTmceYeHkf_ORXasEbGTVUaU1jpHpUMzrAcvmogKloRBb9HK0AJaQv6_4mG0bMAq5do',
  },
  {
    title: 'Đà Nẵng - Hội An',
    detail: '12 chuyến/ngày',
    price: 'Từ 12 USD',
    badge: 'Nổi bật',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBTclYWEMmSc9NLTgUwDv9on7AFX-SSpA5gPI1ogZN-TD9umRy6yxhLhY05HSnXwdnhNvtc5WOT_HWHnMvrQMl2CevyJtJwtUnTAWXtWdT3b0nQwKCki3s72wp73yTo9qn2sRdNen8AIa2e9n8CBbLOyU2DCghI_mQ2qJrCuGChKthcFGUc7k2ZJ5R6-NwZczM_XHtBDmCcV9s9rm2D0OrHdW-p-xAe3p1CQ7ZhiFTcC8JsrDLcPXA_mFT0glXrCoHpVvKmhNtQwoE',
  },
];

const priorityPassengerRoute = '/priority-passenger' as Href;
const driverAssistantRoute = '/driver-assistant' as Href;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function ServiceTile({
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
      style={({ pressed }) => [styles.serviceTile, pressed && styles.pressed]}
    >
      <View style={styles.serviceIcon}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={21} />
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.serviceLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace('/auth/login');
      return;
    }

    if (isHydrated && isAuthenticated && isDriverAssistantRole(user?.role)) {
      router.replace(driverAssistantRoute);
    }
  }, [isHydrated, isAuthenticated, user?.role]);

  if (isHydrated && isAuthenticated && isDriverAssistantRole(user?.role)) {
    return null;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 180 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.brand}>
              <Pressable accessibilityLabel="Mở trình đơn" hitSlop={10}>
                <MaterialCommunityIcons color={colors.primary} name="menu" size={25} />
              </Pressable>
              <View><Text style={styles.brandName}>BusDN</Text><Text style={styles.brandSub}>Xe buýt Đà Nẵng</Text></View>
            </View>
            <Pressable
              accessibilityLabel="Mở hồ sơ"
              onPress={() => router.push('/profile')}
              style={styles.avatar}
            >
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {(user?.fullName || 'U').slice(0, 1).toUpperCase()}
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.kicker}>HÀNH TRÌNH TIỆN NGHI</Text>
            <Text style={styles.title}>Hôm nay bạn muốn đi đâu?</Text>
            <Text style={styles.heroText}>Tra cứu tuyến, theo dõi xe và mua vé nhanh chóng ngay trên BusDN.</Text>
            <Pressable onPress={() => router.push('/route-search')} style={styles.heroButton}><Text style={styles.heroButtonText}>Khám phá tuyến xe</Text><MaterialCommunityIcons color={colors.primary} name="arrow-right" size={19} /></Pressable>
          </View>

          <Text style={[styles.sectionTitle, styles.servicesTitle]}>Dịch vụ BusDN</Text>
          <View style={styles.serviceGrid}>
            <ServiceTile icon="compass-outline" label="Khám phá" onPress={() => router.push('/search-routes')} />
            <ServiceTile icon="crosshairs-gps" label="Theo dõi xe" onPress={() => router.push('/live-tracking')} />
            <ServiceTile icon="ticket-outline" label="Mua vé" onPress={() => router.push('/buy-oneway-ticket')} />
            <ServiceTile icon="package-variant-closed" label="Đồ thất lạc" onPress={() => router.push('/my-lost-items' as Href)} />
            <ServiceTile icon="ticket-confirmation-outline" label="Vé của tôi" onPress={() => router.push('/my-tickets')} />
            <ServiceTile icon="bell-ring-outline" label="Thông báo" onPress={() => router.push('/notifications')} />
            <ServiceTile icon="shield-star-outline" label="Hồ sơ ưu tiên" onPress={() => router.push(priorityPassengerRoute)} />
            <ServiceTile icon="directions" label="Lập hành trình" onPress={() => router.push('/plan-trip')} />
            <ServiceTile icon="history" label="Lịch sử" onPress={() => router.push('/travel-history')} />
            <ServiceTile icon="message-text-outline" label="Góp ý" onPress={() => router.push('/my-feedback' as Href)} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Đang nổi bật</Text>
            <Pressable onPress={() => router.push('/search-routes')}>
              <Text style={styles.viewAll}>Xem tất cả ↗</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.cardsRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {destinations.map((item) => (
              <Pressable
                key={item.title}
                onPress={() => router.push({ pathname: '/route-search', params: { to: item.title.split(' - ')[1] } })}
                style={styles.destinationCard}
              >
                <View>
                  <Image source={{ uri: item.image }} style={styles.destinationImage} />
                  <Text style={styles.badge}>{item.badge}</Text>
                </View>
                <View style={styles.destinationBody}>
                  <Text style={styles.destinationMeta}>↗ {item.detail.toUpperCase()}</Text>
                  <Text numberOfLines={1} style={styles.destinationTitle}>{item.title}</Text>
                  <Text style={styles.destinationPrice}>{item.price}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, styles.flashTitle]}>Ưu đãi nổi bật</Text>
          <Pressable style={styles.mainSale}>
            <MaterialCommunityIcons
              color="rgba(255,255,255,0.08)"
              name="ticket-confirmation-outline"
              size={130}
              style={styles.saleWatermark}
            />
            <View style={styles.saleCopy}>
              <Text style={styles.saleKicker}>ƯU ĐÃI CÓ HẠN</Text>
              <Text style={styles.saleTitle}>GIẢM 50%</Text>
              <Text style={styles.saleDescription}>Áp dụng cho các hành trình đủ điều kiện</Text>
            </View>
          </Pressable>

          <View style={styles.smallSales}>
            {isDriverAssistantRole(user?.role) ? (
              <Pressable
                onPress={() => router.push(driverAssistantRoute)}
                style={[styles.smallSale, styles.workSale]}
              >
                <MaterialCommunityIcons color={colors.white} name="bus-clock" size={30} />
                <View>
                  <Text style={[styles.smallSaleTitle, styles.workSaleTitle]}>Trang vận hành</Text>
                  <Text style={[styles.smallSaleText, styles.workSaleText]}>Chuyến và lịch làm việc</Text>
                </View>
              </Pressable>
            ) : null}
            <Pressable style={[styles.smallSale, styles.firstRide]}>
              <MaterialCommunityIcons color="#34725a" name="tag-outline" size={30} />
              <View>
                <Text style={styles.smallSaleTitle}>Chuyến đầu tiên</Text>
                <Text style={styles.smallSaleText}>Mã: BUSDN1</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.smallSale, styles.groupSale]}>
              <MaterialCommunityIcons color={colors.primary} name="account-group" size={30} />
              <View>
                <Text style={styles.smallSaleTitle}>Ưu đãi nhóm</Text>
                <Text style={styles.smallSaleText}>Giảm 15% từ 4 vé</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>

        <Pressable
          accessibilityLabel="Liên hệ hỗ trợ"
          onPress={() => router.push(priorityPassengerRoute)}
          style={[styles.supportButton, { bottom: 82 + insets.bottom }]}
        >
          <MaterialCommunityIcons color={colors.white} name="shield-star-outline" size={23} />
        </Pressable>

        <RoleBottomNav active="home" role={user?.role} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingHorizontal: 16 },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandName: { color: colors.primary, fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  brandSub: { marginTop: 1, color: colors.muted, fontSize: 9, fontWeight: '700' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#a8e5c7',
    backgroundColor: '#d8eee5',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  hero: { overflow: 'hidden', borderRadius: 26, backgroundColor: colors.primary, padding: 22, marginTop: 12 },
  kicker: { color: '#7fe0ae', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  title: {
    maxWidth: 335,
    marginTop: 8,
    color: colors.white,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  heroText: { maxWidth: 315, marginTop: 10, color: '#c9e9dc', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  heroButton: { alignSelf: 'flex-start', minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, backgroundColor: '#d7f5e6', paddingHorizontal: 16, marginTop: 18 },
  heroButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  searchCard: {
    gap: 11,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.card,
    shadowColor: '#003120',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  searchField: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, backgroundColor: '#eaf4f0' },
  fieldLabel: { marginBottom: 5, color: '#6c7c75', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  fieldContent: { minHeight: 21, flexDirection: 'row', alignItems: 'center', gap: 9 },
  fieldInput: { flex: 1, padding: 0, color: colors.text, fontSize: 13, fontWeight: '700' },
  compactFields: { flexDirection: 'row', gap: 10 },
  compactField: { flex: 1, minHeight: 61, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: '#eaf4f0' },
  compactValue: { color: colors.text, fontSize: 11, fontWeight: '800' },
  searchButton: { height: 49, marginTop: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 25, backgroundColor: colors.primaryContainer },
  searchButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  servicesTitle: { marginTop: 26, marginBottom: 13 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  serviceTile: { width: '31.5%', minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 20, borderWidth: 1, borderColor: '#e8efec', backgroundColor: colors.card, padding: 10 },
  serviceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#d8f6e7' },
  serviceLabel: { width: '100%', color: colors.primary, fontSize: 10, lineHeight: 14, fontWeight: '900', textAlign: 'center' },
  sectionHeader: { marginTop: 31, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { color: colors.primary, fontSize: 20, fontWeight: '900', letterSpacing: -0.6 },
  viewAll: { color: '#16865b', fontSize: 10, fontWeight: '800' },
  cardsRow: { gap: 14, paddingRight: 20, paddingBottom: 3 },
  destinationCard: { width: 255, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#e5eeea', backgroundColor: colors.card },
  destinationImage: { width: '100%', height: 150 },
  badge: { position: 'absolute', top: 11, right: 11, overflow: 'hidden', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 9, paddingVertical: 5, color: '#173b2e', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  destinationBody: { padding: 14 },
  destinationMeta: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  destinationTitle: { marginTop: 4, color: colors.primary, fontSize: 14, fontWeight: '900' },
  destinationPrice: { marginTop: 4, color: '#52675e', fontSize: 10, fontWeight: '600' },
  flashTitle: { marginTop: 29, marginBottom: 14 },
  mainSale: { height: 136, justifyContent: 'flex-end', overflow: 'hidden', padding: 18, borderRadius: 22, backgroundColor: '#00291a' },
  saleWatermark: { position: 'absolute', top: -29, right: -24, transform: [{ rotate: '12deg' }] },
  saleCopy: { zIndex: 1 },
  saleKicker: { color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  saleTitle: { color: colors.white, fontSize: 26, lineHeight: 30, fontWeight: '900' },
  saleDescription: { color: '#76e5ae', fontSize: 10, fontWeight: '700' },
  smallSales: { marginTop: 11, flexDirection: 'row', gap: 11 },
  smallSale: { flex: 1, height: 126, justifyContent: 'space-between', padding: 15, borderRadius: 20 },
  firstRide: { backgroundColor: '#bfead5' },
  groupSale: { backgroundColor: '#e1eae6' },
  workSale: { backgroundColor: colors.primary },
  workSaleTitle: { color: colors.white },
  workSaleText: { color: '#bfead5' },
  smallSaleTitle: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  smallSaleText: { marginTop: 3, color: '#52675e', fontSize: 9 },
  supportButton: { position: 'absolute', right: 19, zIndex: 3, width: 49, height: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: '#174c39', shadowColor: '#001a0f', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 7 },
  bottomNav: { position: 'absolute', right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 9, paddingHorizontal: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d5e4dd', backgroundColor: '#e8f1ed' },
  navItem: { minWidth: 62, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 24 },
  navItemActive: { backgroundColor: '#00291a' },
  navLabel: { marginTop: 2, color: '#527064', fontSize: 8, fontWeight: '600' },
  navLabelActive: { color: colors.white, fontWeight: '800' },
});
