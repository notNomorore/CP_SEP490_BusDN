import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';

const destinations = [
  {
    title: 'Hà Nội - Sa Pa',
    detail: '4.8 rating',
    price: 'From $24.00',
    badge: 'Popular',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBw2QLHKlIhgiQuJsKrfxH0bKnsKD3wUy8AsHHoQWP53W4cXESgJGrBrhXdMKNGYPedg6A6BFVrsEsz6M6vEvwpo6ydAUyayYkohp8SMJyO5wciNIvn6kS98CSXF0pBDmj9EoN9POhCnHx5cT3HAAjRIrxAdoyMKO0tfcPN9mTpYedq70fJ6erX87qooQQxszQveP-lvCW6dTmceYeHkf_ORXasEbGTVUaU1jpHpUMzrAcvmogKloRBb9HK0AJaQv6_4mG0bMAq5do',
  },
  {
    title: 'Đà Nẵng - Hội An',
    detail: '12 trips/day',
    price: 'From $12.00',
    badge: 'Trending',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBTclYWEMmSc9NLTgUwDv9on7AFX-SSpA5gPI1ogZN-TD9umRy6yxhLhY05HSnXwdnhNvtc5WOT_HWHnMvrQMl2CevyJtJwtUnTAWXtWdT3b0nQwKCki3s72wp73yTo9qn2sRdNen8AIa2e9n8CBbLOyU2DCghI_mQ2qJrCuGChKthcFGUc7k2ZJ5R6-NwZczM_XHtBDmCcV9s9rm2D0OrHdW-p-xAe3p1CQ7ZhiFTcC8JsrDLcPXA_mFT0glXrCoHpVvKmhNtQwoE',
  },
];

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function SearchField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.searchField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldContent}>
        <MaterialCommunityIcons color="#237356" name={icon} size={18} />
        {children}
      </View>
    </View>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.navItem, active && styles.navItemActive]}
    >
      <MaterialCommunityIcons
        color={active ? colors.white : '#527064'}
        name={icon}
        size={21}
      />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [departure, setDeparture] = useState('Hà Nội');
  const [destination, setDestination] = useState('');

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isHydrated, isAuthenticated]);

  const searchRoutes = () => {
    Alert.alert(
      'Route search',
      destination.trim()
        ? `Searching trips from ${departure} to ${destination}.`
        : 'Choose a destination before searching.',
    );
  };

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
              <Pressable accessibilityLabel="Open menu" hitSlop={10}>
                <MaterialCommunityIcons color={colors.primary} name="menu" size={25} />
              </Pressable>
              <Text style={styles.brandName}>Veridian Transit</Text>
            </View>
            <Pressable
              accessibilityLabel="Open profile"
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
            <Text style={styles.kicker}>PREMIUM TRAVEL</Text>
            <Text style={styles.title}>Where shall we lead you today?</Text>
          </View>

          <View style={styles.searchCard}>
            <SearchField icon="map-marker-outline" label="DEPARTURE">
              <TextInput
                accessibilityLabel="Departure"
                onChangeText={setDeparture}
                style={styles.fieldInput}
                value={departure}
              />
            </SearchField>
            <SearchField icon="map-outline" label="DESTINATION">
              <TextInput
                accessibilityLabel="Destination"
                onChangeText={setDestination}
                placeholder="Where to?"
                placeholderTextColor="#65766f"
                style={styles.fieldInput}
                value={destination}
              />
            </SearchField>

            <View style={styles.compactFields}>
              <View style={styles.compactField}>
                <Text style={styles.fieldLabel}>DATE</Text>
                <View style={styles.fieldContent}>
                  <MaterialCommunityIcons color="#237356" name="calendar-blank-outline" size={17} />
                  <Text style={styles.compactValue}>Oct 24</Text>
                </View>
              </View>
              <View style={styles.compactField}>
                <Text style={styles.fieldLabel}>PASSENGERS</Text>
                <View style={styles.fieldContent}>
                  <MaterialCommunityIcons color="#237356" name="account-outline" size={17} />
                  <Text style={styles.compactValue}>1 Adult</Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={searchRoutes}
              style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
            >
              <Text style={styles.searchButtonText}>Search Routes</Text>
              <MaterialCommunityIcons color={colors.white} name="arrow-right" size={21} />
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Now</Text>
            <Pressable onPress={() => Alert.alert('Trending routes', 'More routes are coming soon.')}>
              <Text style={styles.viewAll}>View all ↗</Text>
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
                onPress={() => setDestination(item.title.split(' - ')[1])}
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

          <Text style={[styles.sectionTitle, styles.flashTitle]}>Flash Sales</Text>
          <Pressable style={styles.mainSale}>
            <MaterialCommunityIcons
              color="rgba(255,255,255,0.08)"
              name="ticket-confirmation-outline"
              size={130}
              style={styles.saleWatermark}
            />
            <View style={styles.saleCopy}>
              <Text style={styles.saleKicker}>LIMITED TIME ONLY</Text>
              <Text style={styles.saleTitle}>50% OFF</Text>
              <Text style={styles.saleDescription}>All sleeper cabins to Central Highlands</Text>
            </View>
          </Pressable>

          <View style={styles.smallSales}>
            <Pressable style={[styles.smallSale, styles.firstRide]}>
              <MaterialCommunityIcons color="#34725a" name="tag-outline" size={30} />
              <View>
                <Text style={styles.smallSaleTitle}>First Ride</Text>
                <Text style={styles.smallSaleText}>Use code: VERIDIAN1</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.smallSale, styles.groupSale]}>
              <MaterialCommunityIcons color={colors.primary} name="account-group" size={30} />
              <View>
                <Text style={styles.smallSaleTitle}>Group Special</Text>
                <Text style={styles.smallSaleText}>Save 15% on 4+ seats</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>

        <Pressable
          accessibilityLabel="Contact support"
          style={[styles.supportButton, { bottom: 82 + insets.bottom }]}
        >
          <MaterialCommunityIcons color={colors.white} name="headset" size={23} />
        </Pressable>

        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <NavItem active icon="home" label="Home" />
          <NavItem icon="compass-outline" label="Explore" />
          <NavItem icon="ticket-confirmation-outline" label="Tickets" />
          <NavItem
            icon="account-outline"
            label="Profile"
            onPress={() => router.push('/profile')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingHorizontal: 20 },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandName: { color: colors.primary, fontSize: 15, fontWeight: '900', letterSpacing: -0.5 },
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
  hero: { paddingTop: 24, paddingBottom: 24 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: {
    maxWidth: 335,
    marginTop: 8,
    color: colors.primary,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
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
  sectionHeader: { marginTop: 31, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { color: colors.primary, fontSize: 20, fontWeight: '900', letterSpacing: -0.6 },
  viewAll: { color: '#16865b', fontSize: 10, fontWeight: '800' },
  cardsRow: { gap: 14, paddingRight: 20, paddingBottom: 3 },
  destinationCard: { width: 226, overflow: 'hidden', borderRadius: 22, backgroundColor: colors.card },
  destinationImage: { width: '100%', height: 139 },
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
  smallSaleTitle: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  smallSaleText: { marginTop: 3, color: '#52675e', fontSize: 9 },
  supportButton: { position: 'absolute', right: 19, zIndex: 3, width: 49, height: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: '#174c39', shadowColor: '#001a0f', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 7 },
  bottomNav: { position: 'absolute', right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 9, paddingHorizontal: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d5e4dd', backgroundColor: '#e8f1ed' },
  navItem: { minWidth: 62, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 24 },
  navItemActive: { backgroundColor: '#00291a' },
  navLabel: { marginTop: 2, color: '#527064', fontSize: 8, fontWeight: '600' },
  navLabelActive: { color: colors.white, fontWeight: '800' },
});
