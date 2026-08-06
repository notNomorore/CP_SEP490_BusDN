import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';

const priorityTypes = [
  { label: 'Student', icon: 'school-outline', text: 'Fare support for enrolled students.' },
  { label: 'Senior Citizen', icon: 'account-heart-outline', text: 'Priority support for older passengers.' },
  { label: 'Disabled Person', icon: 'wheelchair-accessibility', text: 'Assistance for accessibility needs.' },
  { label: 'Other Priority', icon: 'shield-star-outline', text: 'Other eligible priority programs.' },
] as const;

export default function PriorityPassengerHomeScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <Text style={styles.headerTitle}>Priority Passenger</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.badge}>
          <MaterialCommunityIcons color="#173b2e" name="check-decagram-outline" size={16} />
          <Text style={styles.badgeText}>OFFICIAL PROGRAM</Text>
        </View>
        <Text style={styles.title}>Register for Priority Support</Text>
        <Text style={styles.description}>
          Passengers can register for fare discounts, reserved support, and verification services
          throughout the BusDN network.
        </Text>
        <AppButton
          title="Start Registration"
          onPress={() => router.push('/priority-passenger/register')}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Available Priority Types</Text>
        <Pressable onPress={() => Alert.alert('Eligibility Criteria', 'Please prepare identification and priority proof documents before submitting.')}>
          <Text style={styles.linkText}>Eligibility Criteria</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {priorityTypes.map((item) => (
          <View key={item.label} style={styles.priorityCard}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons color="#173b2e" name={item.icon} size={26} />
            </View>
            <Text style={styles.cardTitle}>{item.label}</Text>
            <Text style={styles.cardText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Required Documents</Text>
          <Text style={styles.infoText}>Identity card, priority certificate, and supporting documents.</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Need Help?</Text>
          <Text style={styles.infoText}>Support is available while preparing your application.</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton
          title="Register Priority Profile"
          onPress={() => router.push('/priority-passenger/register')}
        />
        <AppButton
          title="View Application Status"
          onPress={() => router.push('/priority-passenger/status')}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerTitle: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  hero: {
    gap: 16,
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.card,
    shadowColor: '#003120',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, backgroundColor: '#c4ecd7', paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: '#173b2e', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 30, lineHeight: 35, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  sectionHeader: { marginTop: 28, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { flex: 1, color: colors.primary, fontSize: 20, fontWeight: '900' },
  linkText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  grid: { gap: 12 },
  priorityCard: { gap: 10, padding: 18, borderRadius: 22, backgroundColor: colors.card },
  iconBox: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#c4ecd7' },
  cardTitle: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  cardText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  infoRow: { marginTop: 18, gap: 12 },
  infoCard: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow },
  infoTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  infoText: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 19 },
  actions: { gap: 12, marginTop: 22, paddingBottom: 20 },
});
