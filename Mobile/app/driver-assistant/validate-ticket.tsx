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
import { useAuthStore } from '@/store/auth.store';
import type { TicketValidationResult } from '@/types/busAssistant';
import type { AssignedTrip } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { formatTime, getTodayRange, getTripStatus, isTripCompleted, toDateInput } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

type ValidationHistoryItem = TicketValidationResult & {
  savedAt?: string;
  savedDate?: string;
};

const money = (value?: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
const tripIdOf = (trip?: AssignedTrip | null) => String(trip?.tripId || '');

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
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

function TripChip({ trip, active, onPress }: { trip: AssignedTrip; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tripChip, active && styles.tripChipActive]}>
      <Text style={[styles.tripChipCode, active && styles.tripChipTextActive]}>{trip.route?.routeNumber || trip.tripCode || 'Chuyến'}</Text>
      <Text numberOfLines={1} style={[styles.tripChipMeta, active && styles.tripChipTextActive]}>
        {formatTime(trip.scheduledStart)} - {trip.vehicle?.code || trip.vehicle?.plateNumber || 'Chưa có xe'}
      </Text>
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'N/A'}</Text>
    </View>
  );
}

export default function ValidateTicketScreen() {
  const user = useAuthStore((state) => state.user);
  const [trips, setTrips] = useState<AssignedTrip[]>([]);
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

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || trips[0] || null,
    [selectedTripId, trips],
  );

  const loadTrips = useCallback(async () => {
    setIsLoadingTrips(true);
    try {
      const payload = await scheduleOperationsApi.getAssignedTrips(getTodayRange());
      const usableTrips = (payload.trips || []).filter((trip) => !isTripCompleted(trip));
      setTrips(usableTrips);
      setSelectedTripId((current) => current || usableTrips[0]?.id || '');
    } catch (error) {
      Alert.alert('Không thể tải chuyến', getErrorMessage(error, 'Không thể tải các chuyến được phân công.'));
    } finally {
      setIsLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

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
    const code = rawCode.trim();
    if (!code) {
      Alert.alert('Cần nhập mã vé', 'Hãy nhập hoặc dán mã QR/mã vé trước khi kiểm tra.');
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
      setCameraMessage('Đã nhận diện và kiểm tra mã QR.');
    } catch (error) {
      setError(getErrorMessage(error, 'Không thể kiểm tra vé.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [historyDate, loadHistory, selectedTrip]);

  const validateTicket = () => {
    void validateTicketCode(qrCode);
  };

  const startCamera = async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập camera', 'Hãy cho phép sử dụng camera để quét mã QR vé.');
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
          <Pressable accessibilityLabel="Quay lại" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>KIỂM TRA LÊN XE</Text>
            <Text style={styles.title}>Kiểm tra vé</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Chuyến đang hoạt động</Text>
            {isLoadingTrips ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          <View style={styles.tripList}>
            {trips.length ? trips.map((trip) => (
              <TripChip key={trip.id} trip={trip} active={selectedTrip?.id === trip.id} onPress={() => setSelectedTripId(trip.id)} />
            )) : <Text style={styles.emptyText}>Hôm nay chưa có chuyến được phân công. Bạn vẫn có thể quét mã vé.</Text>}
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
                <Text style={styles.closeCameraText}>Đóng</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={startCamera} style={styles.scanPrompt}>
              <MaterialCommunityIcons color={colors.accent} name="qrcode-scan" size={54} />
              <Text style={styles.scannerTitle}>Mở camera quét mã</Text>
              <Text style={styles.scannerSubtitle}>Quét mã QR vé của hành khách</Text>
            </Pressable>
          )}
          <Text style={styles.manualTitle}>Mã QR / mã vé</Text>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setQrCode}
            placeholder="Dán hoặc nhập mã vé"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={qrCode}
          />
          <View style={styles.buttonRow}>
            <AppButton title="Quét QR" disabled={cameraActive} onPress={startCamera} variant="secondary" style={styles.rowButton} />
            <AppButton title="Kiểm tra" loading={isSubmitting} onPress={validateTicket} style={styles.rowButton} />
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
            <Text style={styles.panelTitle}>Kết quả kiểm tra</Text>
            <View style={isValidResult(result) ? styles.statusSuccess : styles.statusError}>
              <Text style={isValidResult(result) ? styles.statusSuccessText : styles.statusErrorText}>
                {result.message || validationStatus}
              </Text>
            </View>
            <View style={styles.detailGrid}>
              <Detail label="Trạng thái" value={validationStatus} />
              <Detail label="Vé" value={displayTicket.ticketCode || displayTicket.passCode || displayTicket._id} />
              <Detail label="Hành khách" value={displayPassenger.fullName || result.passengerName} />
              <Detail label="Tuyến" value={displayRoute.name || displayRoute.routeCode || displayTicket.routeCode} />
              <Detail label="Điểm đi" value={displayTicket.departureLocation || displayTicket.fromStop} />
              <Detail label="Điểm đến" value={displayTicket.destinationLocation || displayTicket.toStop} />
              <Detail label="Loại vé" value={displayTicket.ticketType || result.ticketType} />
              <Detail label="Giá vé" value={displayTicket.amount || displayTicket.ticketPrice ? money(displayTicket.amount || displayTicket.ticketPrice) : 'Không có'} />
              <Detail label="Hiệu lực từ" value={formatDateTime(displayTicket.validFrom || result.validFrom)} />
              <Detail label="Hiệu lực đến" value={formatDateTime(displayTicket.validUntil || result.validUntil)} />
              <Detail label="Thời điểm quét" value={formatDateTime(displayTicket.usedAt || result.usedAt)} />
              <Detail label="Chuyến" value={displayTicket.tripId || result.tripId} />
            </View>
          </View>
        ) : null}

        <View style={[styles.panel, styles.bottomSpace]}>
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.panelTitle}>Lịch sử kiểm tra thành công</Text>
              <Text style={styles.historySubtitle}>{history.length} vé trong ngày đã chọn</Text>
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
              <Text style={styles.todayText}>Hôm nay</Text>
            </Pressable>
          </View>
          {history.length ? history.map((item, index) => (
            <View key={`${item.savedAt}-${getDisplayTicket(item).ticketCode || index}`} style={styles.transactionRow}>
              <View>
                <Text style={styles.transactionCode}>{getDisplayTicket(item).ticketCode || getDisplayTicket(item).passCode || getDisplayTicket(item)._id || 'Vé'}</Text>
                <Text style={styles.transactionMeta}>
                  {formatDateTime(item.savedAt)} - {getDisplayPassenger(item).fullName || item.passengerName || 'Hành khách'} - {getValidationStatus(item)}
                </Text>
                <Text style={styles.transactionMeta}>
                  {getDisplayRoute(item).name || getDisplayRoute(item).routeCode || getDisplayTicket(item).routeCode || 'Chưa có tuyến'}
                </Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>Ngày này chưa có lượt kiểm tra thành công.</Text>}
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
  tripChipTextActive: { color: colors.white },
  scannerCard: { alignItems: 'center', gap: 14, borderRadius: 26, backgroundColor: '#e6f7ef', padding: 20, marginBottom: 14 },
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
