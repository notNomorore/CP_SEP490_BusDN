import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { ShiftSchedule } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { addDays, formatDate, formatDateKey, getShiftStatus, getTodayRange, getWeekRange, toDateInput } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const assignedStatuses = new Set(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);

const getShiftDurationHours = (shift: ShiftSchedule) => {
  if (!/^\d{2}:\d{2}$/.test(String(shift.startTime || '')) || !/^\d{2}:\d{2}$/.test(String(shift.endTime || ''))) {
    return 0;
  }
  const [startHour, startMinute] = String(shift.startTime).split(':').map(Number);
  const [endHour, endMinute] = String(shift.endTime).split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;
  return Math.max((end - start) / 60, 0);
};

function DetailPill({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value?: string | null }) {
  return (
    <View style={styles.detailPill}>
      <View style={styles.detailIcon}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={21} />
      </View>
      <View style={styles.detailTextBlock}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.detailValue}>{value || 'N/A'}</Text>
      </View>
    </View>
  );
}

export default function ShiftScheduleScreen() {
  const user = useAuthStore((state) => state.user);
  const [range, setRange] = useState(() => getWeekRange());
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const payload = await scheduleOperationsApi.getShiftSchedule(range);
      setShifts(payload.shifts || []);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load shift schedule.');
      setError(message);
      Alert.alert('Unable to load shift schedule', message);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => toDateInput(addDays(range.from, index)))
  ), [range.from]);

  const todayShift = useMemo(() => (
    shifts.find((shift) => formatDateKey(shift.workDate) === getTodayRange().from) || null
  ), [shifts]);

  const shiftsByDate = useMemo(() => shifts.reduce<Record<string, ShiftSchedule[]>>((result, shift) => {
    const key = formatDateKey(shift.workDate);
    result[key] = [...(result[key] || []), shift];
    return result;
  }, {}), [shifts]);

  const weeklyStats = useMemo(() => ({
    totalHours: shifts.reduce((total, shift) => total + getShiftDurationHours(shift), 0),
    shiftCount: shifts.length,
    assignedCount: shifts.filter((shift) => assignedStatuses.has(String(shift.assignmentStatus || ''))).length,
    completedCount: shifts.filter((shift) => shift.assignmentStatus === 'COMPLETED').length,
  }), [shifts]);

  const changeWeek = (offset: number) => {
    setRange(getWeekRange(addDays(range.from, offset * 7)));
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
          <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>SCHEDULE & ASSIGNMENT</Text>
          <Text style={styles.title}>My Shift Schedule</Text>
        </View>
      </View>

      <View style={styles.weekControls}>
        <Pressable accessibilityRole="button" onPress={() => changeWeek(-1)} style={styles.weekButton}>
          <MaterialCommunityIcons color={colors.primary} name="chevron-left" size={23} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setRange(getWeekRange())} style={styles.weekCenter}>
          <Text style={styles.weekLabel}>{formatDate(range.from)} - {formatDate(range.to)}</Text>
          <Text style={styles.weekHint}>Tap for current week</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => changeWeek(1)} style={styles.weekButton}>
          <MaterialCommunityIcons color={colors.primary} name="chevron-right" size={23} />
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Hours</Text>
          <Text style={styles.statValue}>{weeklyStats.totalHours.toFixed(1)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Shifts</Text>
          <Text style={styles.statValue}>{weeklyStats.shiftCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Assigned</Text>
          <Text style={styles.statValueAccent}>{weeklyStats.assignedCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statValue}>{weeklyStats.completedCount}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading shift schedule...</Text>
        </View>
      ) : error ? (
        <View>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void loadSchedule()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : shifts.length === 0 ? (
        <Text style={styles.emptyText}>No shift schedule assigned for this week.</Text>
      ) : (
        <>
          <View style={styles.calendarRow}>
            {weekDays.map((day) => {
              const isToday = day === toDateInput();
              return (
                <View key={day} style={[styles.dayTile, isToday && styles.dayTileActive]}>
                  <Text style={[styles.dayName, isToday && styles.dayTextActive]}>{formatDate(day).slice(0, 3).toUpperCase()}</Text>
                  <Text style={[styles.dayNumber, isToday && styles.dayTextActive]}>{new Date(day).getDate()}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.todaySection}>
            <Text style={styles.sectionTitle}>Today's Shift</Text>
            {todayShift ? (
              <View style={styles.todayCard}>
                <View style={styles.todayHeader}>
                  <View>
                    <View style={styles.shiftBadge}>
                      <MaterialCommunityIcons color={colors.primary} name="white-balance-sunny" size={18} />
                      <Text style={styles.shiftBadgeText}>{todayShift.shiftName || 'Shift'}</Text>
                    </View>
                    <Text style={styles.shiftTime}>{todayShift.startTime || 'N/A'} - {todayShift.endTime || 'N/A'}</Text>
                  </View>
                  <View style={styles.statusBlock}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <Text style={styles.statusValue}>{getShiftStatus(todayShift)}</Text>
                  </View>
                </View>
                <View style={styles.detailGrid}>
                  <DetailPill icon="bus" label="Assigned Bus" value="From assigned trip" />
                  <DetailPill icon="routes" label="Assigned Route" value={todayShift.route?.routeCode || todayShift.route?.routeName} />
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>No shift assigned today.</Text>
            )}
          </View>

          <View style={styles.timelineSection}>
            <Text style={styles.sectionTitle}>Weekly Schedule</Text>
            {weekDays.map((day) => {
              const dayShifts = shiftsByDate[day] || [];
              return (
                <View key={day} style={styles.timelineGroup}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineDate}>{formatDate(day)}</Text>
                    {dayShifts.length ? dayShifts.map((shift) => (
                      <View key={shift.id} style={styles.shiftRow}>
                        <View>
                          <Text style={styles.shiftRowTime}>{shift.startTime || 'N/A'} - {shift.endTime || 'N/A'}</Text>
                          <Text style={styles.shiftRowName}>{shift.shiftName || 'Shift'}</Text>
                        </View>
                        <Text style={styles.routeChip}>{shift.route?.routeCode || 'Route'}</Text>
                      </View>
                    )) : (
                      <View style={styles.dayOffRow}>
                        <Text style={styles.dayOffText}>Day Off</Text>
                        <MaterialCommunityIcons color={colors.error} name="calendar-remove-outline" size={20} />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
      </Screen>
      <RoleBottomNav active="schedule" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  weekControls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  weekButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card },
  weekCenter: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 12 },
  weekLabel: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  weekHint: { marginTop: 2, color: colors.muted, fontSize: 10, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  statCard: { width: '47%', borderRadius: 18, backgroundColor: colors.card, padding: 14 },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statValue: { marginTop: 8, color: colors.primary, fontSize: 22, fontWeight: '900' },
  statValueAccent: { marginTop: 8, color: colors.accent, fontSize: 22, fontWeight: '900' },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontWeight: '700' },
  emptyText: { borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 16, color: colors.muted, fontSize: 13, fontWeight: '700' },
  retryButton: { alignSelf: 'flex-start', marginTop: 12, borderRadius: 18, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  calendarRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dayTile: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.surfaceLow },
  dayTileActive: { backgroundColor: colors.primary },
  dayName: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  dayNumber: { marginTop: 3, color: colors.text, fontSize: 15, fontWeight: '900' },
  dayTextActive: { color: colors.white },
  sectionTitle: { marginBottom: 12, color: colors.text, fontSize: 17, fontWeight: '900' },
  todaySection: { marginBottom: 24 },
  todayCard: { overflow: 'hidden', borderLeftWidth: 4, borderLeftColor: colors.primary, borderRadius: 22, backgroundColor: colors.card, padding: 18 },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  shiftBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, backgroundColor: '#d4f2e5', paddingHorizontal: 10, paddingVertical: 6 },
  shiftBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  shiftTime: { marginTop: 10, color: colors.text, fontSize: 24, fontWeight: '900' },
  statusBlock: { alignItems: 'flex-end' },
  statusLabel: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  statusValue: { marginTop: 4, color: colors.primary, fontSize: 15, fontWeight: '900' },
  detailGrid: { marginTop: 18, flexDirection: 'row', gap: 12 },
  detailPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surfaceLow },
  detailTextBlock: { flex: 1 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  detailValue: { marginTop: 2, color: colors.text, fontSize: 13, fontWeight: '900' },
  timelineSection: { paddingBottom: 96 },
  timelineGroup: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timelineDot: { width: 14, height: 14, marginTop: 4, borderRadius: 7, borderWidth: 3, borderColor: colors.outline, backgroundColor: colors.surface },
  timelineContent: { flex: 1, gap: 8 },
  timelineDate: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  shiftRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 14 },
  shiftRowTime: { color: colors.text, fontSize: 15, fontWeight: '900' },
  shiftRowName: { marginTop: 3, color: colors.muted, fontSize: 12 },
  routeChip: { overflow: 'hidden', borderRadius: 10, backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, color: colors.primary, fontSize: 12, fontWeight: '900' },
  dayOffRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, backgroundColor: colors.errorContainer, padding: 14 },
  dayOffText: { color: colors.muted, fontSize: 14, fontWeight: '800', fontStyle: 'italic' },
});
