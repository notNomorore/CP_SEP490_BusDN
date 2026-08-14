import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import busAssistantApi from '@/api/busAssistant.api';
import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useDriverI18n } from '@/i18n/driver';
import { useAuthStore } from '@/store/auth.store';
import type { TicketValidationResult } from '@/types/busAssistant';
import type { AssignedTrip } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import {
  getTodayRange,
  getTripDepartureTimeLabel,
  getTripPlannedEndDate,
  getTripPlannedStartDate,
  getTripStatus,
  isTripToday,
  toDateInput,
} from '@/utils/scheduleOperations';
import { getErrorMessage, isPermissionError } from '@/utils/validation';

type ValidationHistoryItem = TicketValidationResult & {
  savedAt?: string;
  savedDate?: string;
};

const money = (value?: number, locale = 'vi-VN') => new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
const tripIdOf = (trip?: AssignedTrip | null) => String(trip?.tripId || '');
const getTripDirectionMarker = (trip: AssignedTrip) => {
  const codeMarker = String(trip.tripCode || '').match(/-([DV])$/i)?.[1]?.toUpperCase();
  if (codeMarker) return codeMarker;
  const direction = String(trip.route?.direction || '').toUpperCase();
  if (direction === 'OUTBOUND') return 'D';
  if (direction === 'INBOUND') return 'V';
  return '';
};

const formatDateTime = (value?: string | null, locale = 'vi-VN', emptyValue = 'N/A') => {
  if (!value) return emptyValue;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const getDisplayTicket = (result?: TicketValidationResult | null) => result?.ticketInfo || {
  ticketCode: result?.ticketCode || result?.passCode || '',
  passCode: result?.passCode,
  ticketType: result?.ticketType || '',
  status: result?.status || result?.result || '',
  routeCode: result?.routeCode || result?.routeNumber || '',
  validFrom: result?.validFrom,
  validUntil: result?.validUntil,
  usedAt: result?.usedAt,
  tripId: result?.tripId,
};

const getDisplayPassenger = (result?: TicketValidationResult | null) => result?.passengerInfo || {
  fullName: result?.passengerName || '',
};

const getDisplayRoute = (result?: TicketValidationResult | null) => result?.routeInfo || {
  name: result?.routeCode || result?.routeNumber || '',
  routeCode: result?.routeCode || result?.routeNumber || '',
};

const getValidationStatus = (result?: TicketValidationResult | null) => (
  result?.validationStatus || result?.result || result?.status || 'UNKNOWN'
);

const isValidResult = (result?: TicketValidationResult | null) => (
  Boolean(result?.ok) || ['VALID', 'VALIDATED'].includes(getValidationStatus(result))
);

const addDateDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return toDateInput();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

function TripChip({
  trip,
  active,
  onPress,
  tripFallback,
  noVehicle,
}: {
  trip: AssignedTrip;
  active: boolean;
  onPress: () => void;
  tripFallback: string;
  noVehicle: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tripChip, active && styles.tripChipActive]}>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.tripChipCode, active && styles.tripChipTextActive]}>
        {trip.route?.routeNumber || trip.tripCode || tripFallback} <Text style={[styles.tripChipMeta, active && styles.tripChipTextActive]}>{[getTripDepartureTimeLabel(trip), getTripDirectionMarker(trip), trip.vehicle?.code || trip.vehicle?.plateNumber || noVehicle].filter(Boolean).join(' · ')}</Text>
      </Text>
      <Text style={[styles.tripCapacity, active && styles.tripChipTextActive]}>
        Còn {trip.capacity?.remainingSeats ?? 25}/25 chỗ
      </Text>
    </Pressable>
  );
}

function Detail({ label, value, emptyValue }: { label: string; value?: string | number | null; emptyValue: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || emptyValue}</Text>
    </View>
  );
}

export default function ValidateTicketScreen() {
  const { language, t } = useDriverI18n();
  const user = useAuthStore((state) => state.user);
  const locale = language === 'VN' ? 'vi-VN' : 'en-US';
  const [assignedTrips, setAssignedTrips] = useState<AssignedTrip[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedTripId, setSelectedTripId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState<TicketValidationResult | null>(null);
  const [historyDate, setHistoryDate] = useState(toDateInput());
  const [history, setHistory] = useState<ValidationHistoryItem[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');
  const [error, setError] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const trips = useMemo(() => assignedTrips.filter((trip) => {
    const status = String(getTripStatus(trip)).toUpperCase();
    const acceptanceStatus = String(trip.acceptanceStatus || '').toUpperCase();
    const plannedEnd = getTripPlannedEndDate(trip);

    return isTripToday(trip)
      && (!acceptanceStatus || acceptanceStatus === 'ACCEPTED')
      && !['COMPLETED', 'DONE', 'CANCELLED'].includes(status)
      && Boolean(plannedEnd && !Number.isNaN(plannedEnd.getTime()) && plannedEnd.getTime() > nowMs);
  }), [assignedTrips, nowMs]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || trips[0] || null,
    [selectedTripId, trips],
  );
  const selectedTripStart = getTripPlannedStartDate(selectedTrip);
  const selectedTripEnd = getTripPlannedEndDate(selectedTrip);
  const scanOpensAt = selectedTripStart ? selectedTripStart.getTime() - (15 * 60 * 1000) : NaN;
  const canScanSelectedTrip = Boolean(
    selectedTrip
    && Number.isFinite(scanOpensAt)
    && selectedTripEnd
    && nowMs >= scanOpensAt
    && nowMs < selectedTripEnd.getTime()
  );
  const scanAvailabilityMessage = selectedTrip && !canScanSelectedTrip
    ? `Chỉ được quét vé từ 15 phút trước giờ khởi hành (${getTripDepartureTimeLabel(selectedTrip)}).`
    : '';

  const loadTrips = useCallback(async () => {
    setIsLoadingTrips(true);
    try {
      const payload = await scheduleOperationsApi.getAssignedTrips(getTodayRange());
      setAssignedTrips(payload.trips || []);
    } catch (error) {
      if (isPermissionError(error)) {
        setAssignedTrips([]);
        setSelectedTripId('');
        return;
      }

      Alert.alert(t.assistant.validate.loadTripsTitle, getErrorMessage(error, t.assistant.validate.loadTripsFallback));
    } finally {
      setIsLoadingTrips(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSelectedTripId((current) => (
      trips.some((trip) => trip.id === current) ? current : trips[0]?.id || ''
    ));
  }, [trips]);

  const loadHistory = useCallback(async (dateKey: string) => {
    setIsLoadingHistory(true);
    try {
      const payload = await busAssistantApi.getValidationHistory({ date: dateKey });
      setHistory(payload.validations || []);
    } catch {
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory(historyDate);
  }, [historyDate, loadHistory]);

  const validateTicketCode = useCallback(async (rawCode: string) => {
    if (!canScanSelectedTrip) {
      Alert.alert('Chưa đến thời gian quét vé', scanAvailabilityMessage || 'Vui lòng chọn chuyến đang trong thời gian quét vé.');
      return;
    }
    const code = rawCode.trim();
    if (!code) {
      Alert.alert(t.assistant.validate.needCodeTitle, t.assistant.validate.needCodeMessage);
      return;
    }
    setIsSubmitting(true);
    setError('');
    setCameraMessage('');
    try {
      const data = await busAssistantApi.validateTicket({
        qrCode: code,
        tripId: tripIdOf(selectedTrip) || undefined,
        routeId: selectedTrip?.route?.id || undefined,
        routeCode: selectedTrip?.route?.routeNumber || undefined,
      });
      setResult(data);
      if (isValidResult(data)) {
        const today = toDateInput();
        if (historyDate === today) {
          await loadHistory(today);
        } else {
          setHistoryDate(today);
        }
      }
      setQrCode('');
      setCameraMessage(t.assistant.validate.scannedMessage);
    } catch (error) {
      setError(getErrorMessage(error, t.assistant.validate.validateErrorFallback));
    } finally {
      setIsSubmitting(false);
    }
  }, [canScanSelectedTrip, historyDate, loadHistory, scanAvailabilityMessage, selectedTrip, t]);

  const validateTicket = () => {
    void validateTicketCode(qrCode);
  };

  const startCamera = async () => {
    if (!canScanSelectedTrip) {
      Alert.alert('Chưa đến thời gian quét vé', scanAvailabilityMessage || 'Vui lòng chọn chuyến đang trong thời gian quét vé.');
      return;
    }
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) {
      Alert.alert(t.assistant.validate.cameraPermissionTitle, t.assistant.validate.cameraPermissionMessage);
      return;
    }

    setScanLocked(false);
    setError('');
    setCameraMessage('');
    setCameraActive(true);
  };

  const handleBarcodeScanned = ({ data }: { data?: string }) => {
    const code = String(data || '').trim();
    if (scanLocked || !code) return;

    setScanLocked(true);
    setCameraActive(false);
    setQrCode(code);
    void validateTicketCode(code);
  };

  const displayTicket = getDisplayTicket(result);
  const displayPassenger = getDisplayPassenger(result);
  const displayRoute = getDisplayRoute(result);
  const validationStatus = getValidationStatus(result);

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel={t.common.back} hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>{t.assistant.validate.kicker}</Text>
            <Text style={styles.title}>{t.assistant.validate.title}</Text>
          </View>
          {scanAvailabilityMessage ? (
            <View style={styles.scanNotice}>
              <MaterialCommunityIcons color="#8a6400" name="clock-outline" size={18} />
              <Text style={styles.scanNoticeText}>{scanAvailabilityMessage}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{t.assistant.validate.activeTrips}</Text>
            {isLoadingTrips ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          <View style={styles.tripList}>
            {trips.length ? trips.map((trip) => (
              <TripChip
                key={trip.id}
                trip={trip}
                active={selectedTrip?.id === trip.id}
                onPress={() => setSelectedTripId(trip.id)}
                tripFallback={t.assistant.validate.tripFallback}
                noVehicle={t.assistant.validate.noVehicle}
              />
            )) : <Text style={styles.emptyText}>{t.assistant.validate.noTrips}</Text>}
          </View>
        </View>

        <View style={styles.scannerCard}>
          {cameraActive ? (
            <View style={styles.cameraBox}>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                facing="back"
                onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
                style={styles.camera}
              />
              <View pointerEvents="none" style={styles.scanFrame}>
                <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
                <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
                <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
                <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
              </View>
              <Pressable accessibilityRole="button" onPress={() => setCameraActive(false)} style={styles.closeCameraButton}>
                <MaterialCommunityIcons color={colors.white} name="close" size={18} />
                <Text style={styles.closeCameraText}>{t.assistant.validate.close}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={startCamera} style={styles.scanPrompt}>
              <MaterialCommunityIcons color={colors.accent} name="qrcode-scan" size={54} />
              <Text style={styles.scannerTitle}>{t.assistant.validate.openCamera}</Text>
              <Text style={styles.scannerSubtitle}>{t.assistant.validate.cameraHint}</Text>
            </Pressable>
          )}
          <Text style={styles.manualTitle}>{t.assistant.validate.manualTitle}</Text>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setQrCode}
            placeholder={t.assistant.validate.manualPlaceholder}
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={qrCode}
          />
          <View style={styles.buttonRow}>
            <AppButton title={t.assistant.validate.scanQr} disabled={cameraActive || !canScanSelectedTrip} onPress={startCamera} variant="secondary" style={styles.rowButton} />
            <AppButton title={t.assistant.validate.check} disabled={!canScanSelectedTrip} loading={isSubmitting} onPress={validateTicket} style={styles.rowButton} />
          </View>
          {cameraMessage ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{cameraMessage}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {result ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t.assistant.validate.resultTitle}</Text>
            <View style={isValidResult(result) ? styles.statusSuccess : styles.statusError}>
              <Text style={isValidResult(result) ? styles.statusSuccessText : styles.statusErrorText}>
                {result.message || validationStatus}
              </Text>
            </View>
            <View style={styles.detailGrid}>
              <Detail label={t.assistant.validate.labels.status} value={validationStatus} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.ticket} value={displayTicket.ticketCode || displayTicket.passCode || displayTicket._id} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.passenger} value={displayPassenger.fullName || result.passengerName} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.route} value={displayRoute.name || displayRoute.routeCode || displayTicket.routeCode} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.from} value={displayTicket.departureLocation || displayTicket.fromStop} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.to} value={displayTicket.destinationLocation || displayTicket.toStop} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.type} value={displayTicket.ticketType || result.ticketType} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.price} value={displayTicket.amount || displayTicket.ticketPrice ? money(displayTicket.amount || displayTicket.ticketPrice, locale) : t.common.notAvailable} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.validFrom} value={formatDateTime(displayTicket.validFrom || result.validFrom, locale, t.common.notAvailable)} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.validUntil} value={formatDateTime(displayTicket.validUntil || result.validUntil, locale, t.common.notAvailable)} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.scannedAt} value={formatDateTime(displayTicket.usedAt || result.usedAt, locale, t.common.notAvailable)} emptyValue={t.common.notAvailable} />
              <Detail label={t.assistant.validate.labels.trip} value={displayTicket.tripId || result.tripId} emptyValue={t.common.notAvailable} />
            </View>
          </View>
        ) : null}

        <View style={[styles.panel, styles.bottomSpace]}>
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.panelTitle}>{t.assistant.validate.historyTitle}</Text>
              <Text style={styles.historySubtitle}>{history.length} {t.assistant.validate.historySuffix}</Text>
            </View>
            {isLoadingHistory ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          <View style={styles.dateSelector}>
            <Pressable accessibilityLabel="Previous day" onPress={() => setHistoryDate((date) => addDateDays(date, -1))} style={styles.dateButton}>
              <MaterialCommunityIcons color={colors.primary} name="chevron-left" size={22} />
            </Pressable>
            <TextInput
              accessibilityLabel="Validation history date"
              onChangeText={setHistoryDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={styles.dateInput}
              value={historyDate}
            />
            <Pressable accessibilityLabel="Next day" onPress={() => setHistoryDate((date) => addDateDays(date, 1))} style={styles.dateButton}>
              <MaterialCommunityIcons color={colors.primary} name="chevron-right" size={22} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setHistoryDate(toDateInput())} style={styles.todayButton}>
              <Text style={styles.todayText}>{t.assistant.validate.today}</Text>
            </Pressable>
          </View>
          {history.length ? history.map((item, index) => (
            <View key={`${item.savedAt}-${getDisplayTicket(item).ticketCode || index}`} style={styles.transactionRow}>
              <View>
                <Text style={styles.transactionCode}>{getDisplayTicket(item).ticketCode || getDisplayTicket(item).passCode || getDisplayTicket(item)._id || t.assistant.validate.ticketFallback}</Text>
                <Text style={styles.transactionMeta}>
                  {formatDateTime(item.savedAt, locale, t.common.notAvailable)} - {getDisplayPassenger(item).fullName || item.passengerName || t.assistant.validate.passengerFallback} - {getValidationStatus(item)}
                </Text>
                <Text style={styles.transactionMeta}>
                  {getDisplayRoute(item).name || getDisplayRoute(item).routeCode || getDisplayTicket(item).routeCode || t.assistant.validate.routeFallback}
                </Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>{t.assistant.validate.emptyHistory}</Text>}
        </View>
      </Screen>
      <RoleBottomNav active="validate" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  panel: { gap: 12, borderRadius: 22, backgroundColor: colors.card, padding: 16, marginBottom: 14 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  tripList: { gap: 10 },
  tripChip: { minHeight: 64, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 14 },
  tripChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  tripChipCode: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  tripChipMeta: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700' },
  tripCapacity: { marginTop: 5, color: colors.accent, fontSize: 12, fontWeight: '800' },
  tripChipTextActive: { color: colors.white },
  scannerCard: { alignItems: 'center', gap: 14, borderRadius: 26, backgroundColor: '#e6f7ef', padding: 20, marginBottom: 14 },
  scanNotice: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: '#fff4cf', padding: 11 },
  scanNoticeText: { flex: 1, color: '#765600', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  scanPrompt: { width: '100%', alignItems: 'center', gap: 8, borderRadius: 22, backgroundColor: '#dff4e9', paddingVertical: 18 },
  scannerTitle: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  scannerSubtitle: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  manualTitle: { alignSelf: 'flex-start', color: colors.primary, fontSize: 15, fontWeight: '900' },
  cameraBox: { width: '100%', aspectRatio: 1, overflow: 'hidden', borderRadius: 24, backgroundColor: colors.primary },
  camera: { flex: 1 },
  scanFrame: { position: 'absolute', inset: '16%', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  scanCorner: { position: 'absolute', width: 34, height: 34, borderColor: '#7cf0b2' },
  scanCornerTopLeft: { left: -1, top: -1, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 10 },
  scanCornerTopRight: { right: -1, top: -1, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 10 },
  scanCornerBottomLeft: { left: -1, bottom: -1, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 10 },
  scanCornerBottomRight: { right: -1, bottom: -1, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 10 },
  closeCameraButton: { position: 'absolute', right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 18, backgroundColor: 'rgba(0,26,15,0.78)', paddingHorizontal: 10, paddingVertical: 7 },
  closeCameraText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  input: { width: '100%', minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14, fontSize: 16, fontWeight: '800' },
  buttonRow: { width: '100%', flexDirection: 'row', gap: 10 },
  rowButton: { flex: 1 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailBox: { width: '47%', gap: 4, borderRadius: 16, backgroundColor: colors.surfaceLow, padding: 12 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  statusSuccess: { alignSelf: 'flex-start', borderRadius: 18, backgroundColor: '#d7f4e6', paddingHorizontal: 12, paddingVertical: 7 },
  statusSuccessText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  statusError: { alignSelf: 'flex-start', borderRadius: 18, backgroundColor: colors.errorContainer, paddingHorizontal: 12, paddingVertical: 7 },
  statusErrorText: { color: colors.error, fontSize: 12, fontWeight: '900' },
  successBox: { width: '100%', borderRadius: 16, backgroundColor: '#d7f4e6', padding: 12 },
  successText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  errorBox: { width: '100%', borderRadius: 16, backgroundColor: colors.errorContainer, padding: 12 },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '800' },
  transactionRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingTop: 10 },
  transactionCode: { color: colors.text, fontSize: 14, fontWeight: '900' },
  transactionMeta: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: '700' },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  historySubtitle: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700' },
  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surfaceLow },
  dateInput: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 12, fontSize: 14, fontWeight: '900' },
  todayButton: { minHeight: 42, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary, paddingHorizontal: 12 },
  todayText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  bottomSpace: { marginBottom: 96 },
});
