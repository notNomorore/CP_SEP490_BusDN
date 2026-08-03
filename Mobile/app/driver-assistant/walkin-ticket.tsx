import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import busAssistantApi from '@/api/busAssistant.api';
import scheduleOperationsApi from '@/api/scheduleOperations.api';
import { AppButton } from '@/components/AppButton';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { WalkInTicketHistory, WalkInTicketResult } from '@/types/busAssistant';
import type { AssignedTrip } from '@/types/scheduleOperations';
import { goBackOrReplace } from '@/utils/navigation';
import { formatTime, getAssignedTripsRange, getTripStatus, toDateInput } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const passengerTypes = ['ADULT', 'STUDENT', 'CHILD', 'SENIOR'];
const paymentMethods = ['CASH', 'BANK_TRANSFER'];
const money = (value: number | string) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
const objectId = (value?: string | null) => String(value || '');
const optionLabels: Record<string, string> = { ADULT: 'Người lớn', STUDENT: 'Học sinh / sinh viên', CHILD: 'Trẻ em', SENIOR: 'Người cao tuổi', CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản QR' };

function DropdownSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Chọn thông tin',
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <View style={styles.dropdownGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={() => setOpen((current) => !current)} style={[styles.dropdownButton, open && styles.dropdownButtonOpen]}>
        <Text numberOfLines={1} style={[styles.dropdownValue, !selectedLabel && styles.dropdownPlaceholder]}>{selectedLabel || placeholder}</Text>
        <MaterialCommunityIcons color={colors.muted} name={open ? 'chevron-up' : 'chevron-down'} size={22} />
      </Pressable>
      {open ? (
        <View style={styles.dropdownMenu}>
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <Pressable
                key={`${option.value}-${index}`}
                onPress={() => { onChange(option.value); setOpen(false); }}
                style={[styles.dropdownOption, index < options.length - 1 && styles.dropdownOptionBorder, active && styles.dropdownOptionActive]}
              >
                <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>{option.label}</Text>
                {active ? <MaterialCommunityIcons color={colors.accent} name="check" size={19} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function WalkInTicketScreen() {
  const user = useAuthStore((state) => state.user);
  const [trips, setTrips] = useState<AssignedTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');
  const [passengerType, setPassengerType] = useState('ADULT');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [quantity, setQuantity] = useState('1');
  const [cashReceived, setCashReceived] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<WalkInTicketResult | null>(null);
  const [historyDate, setHistoryDate] = useState(toDateInput());
  const [history, setHistory] = useState<WalkInTicketHistory>({ date: toDateInput(), count: 0, totalRevenue: 0, tickets: [] });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [resumingId, setResumingId] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || trips[0] || null,
    [selectedTripId, trips],
  );
  const stops = selectedTrip?.route?.stops || [];
  const stopOptions = stops.map((stop) => ({ value: objectId(stop.stationId || stop.id), label: stop.stopName || 'Điểm dừng' }));
  const changeQuantity = (delta: number) => {
    const next = Math.min(20, Math.max(1, (Number.parseInt(quantity, 10) || 1) + delta));
    setQuantity(String(next));
  };
  const unitFare = useMemo(() => {
    const fares = selectedTrip?.route?.fareConfig;
    if (passengerType === 'STUDENT') return Number(fares?.studentFare) || Number(fares?.baseFare) || Number(selectedTrip?.route?.fare) || 0;
    if (passengerType === 'CHILD') return Number(fares?.childFare) || Number(fares?.baseFare) || Number(selectedTrip?.route?.fare) || 0;
    if (passengerType === 'SENIOR') return Number(fares?.seniorFare) || Number(fares?.baseFare) || Number(selectedTrip?.route?.fare) || 0;
    return Number(fares?.baseFare) || Number(selectedTrip?.route?.fare) || 0;
  }, [passengerType, selectedTrip]);
  const total = unitFare * Math.max(Number.parseInt(quantity, 10) || 1, 1);
  const received = Number(cashReceived) || 0;
  const changeAmount = Math.max(received - total, 0);
  const cashInsufficient = paymentMethod === 'CASH' && received < total;

  const loadHistory = useCallback(async (date = historyDate) => {
    setIsLoadingHistory(true);
    try {
      setHistory(await busAssistantApi.getWalkInTicketHistory({ date }));
    } catch (error) {
      Alert.alert('Không thể tải lịch sử', getErrorMessage(error, 'Không thể tải lịch sử bán vé.'));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyDate]);

  const loadTrips = useCallback(async () => {
    try {
      // Dùng cùng phạm vi với màn Chuyến để hai màn luôn nhận cùng danh sách.
      const payload = await scheduleOperationsApi.getAssignedTrips(getAssignedTripsRange());
      const usableTrips = (payload.trips || []).filter((trip) => !['COMPLETED', 'CANCELLED'].includes(getTripStatus(trip)));
      setTrips(usableTrips);
      const first = usableTrips[0];
      setSelectedTripId((current) => current || first?.id || '');
      const firstStops = first?.route?.stops || [];
      setFromStopId((current) => current || objectId(firstStops[0]?.stationId || firstStops[0]?.id));
      setToStopId((current) => current || objectId(firstStops[firstStops.length - 1]?.stationId || firstStops[firstStops.length - 1]?.id));
    } catch (error) {
      Alert.alert('Không thể tải chuyến', getErrorMessage(error, 'Không thể tải các chuyến được phân công.'));
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    void loadHistory(historyDate);
  }, [historyDate, loadHistory]);

  useEffect(() => {
    if (!selectedTrip) return;
    const nextStops = selectedTrip.route?.stops || [];
    setFromStopId(objectId(nextStops[0]?.stationId || nextStops[0]?.id));
    setToStopId(objectId(nextStops[nextStops.length - 1]?.stationId || nextStops[nextStops.length - 1]?.id));
  }, [selectedTrip?.id]);

  const createTicket = async () => {
    if (!selectedTrip?.route?.id || !selectedTrip.tripId || !fromStopId || !toStopId) {
      Alert.alert('Thiếu thông tin chuyến', 'Chuyến đã chọn cần đầy đủ tuyến, chuyến và điểm dừng trước khi bán vé.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await busAssistantApi.createWalkInTicket({
        routeId: objectId(selectedTrip.route.id),
        tripId: objectId(selectedTrip.tripId),
        fromStopId,
        toStopId,
        passengerType,
        passengerQuantity: Math.max(Number.parseInt(quantity, 10) || 1, 1),
        ticketType: 'SINGLE_RIDE',
        paymentMethod,
        amount: total,
        cashReceived: paymentMethod === 'CASH' ? received : undefined,
        changeAmount: paymentMethod === 'CASH' ? changeAmount : undefined,
      });
      setResult(data);
      await loadHistory(historyDate);
      Alert.alert(paymentMethod === 'CASH' ? 'Đã thu tiền và tạo vé' : 'Đã tạo mã thanh toán', paymentMethod === 'CASH' ? 'Hành khách có thể lên xe.' : 'Hãy đưa mã QR cho hành khách quét.');
    } catch (error) {
      Alert.alert('Không thể tạo vé', getErrorMessage(error, 'Không thể tạo vé trực tiếp.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmPayment = async () => {
    const ticketId = result?.ticketData?._id;
    if (!ticketId) return;
    setIsSubmitting(true);
    try {
      const data = await busAssistantApi.confirmWalkInPayment(ticketId);
      setResult((current) => current ? { ...current, ...data, requiresPaymentConfirmation: false, paymentCompleted: true, confirmed: true } : data);
      await loadHistory(historyDate);
      Alert.alert('Đã thanh toán', 'Đã xác nhận chuyển khoản. Hành khách có thể lên xe.');
    } catch (error) {
      Alert.alert('Chưa nhận được thanh toán', getErrorMessage(error, 'Giao dịch chuyển khoản chưa hoàn tất.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resumePayment = async (ticketId: string) => {
    setResumingId(ticketId);
    try {
      const data = await busAssistantApi.resumeWalkInPayment(ticketId);
      setResult(data);
      if (data.paymentCompleted) await loadHistory(historyDate);
    } catch (error) {
      Alert.alert('Không thể thanh toán lại', getErrorMessage(error, 'Mã thanh toán không còn khả dụng.'));
    } finally {
      setResumingId('');
    }
  };

  return (
    <View style={styles.screenShell}>
      <Screen>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Quay lại" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
            <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>BÁN VÉ TẠI XE</Text>
            <Text style={styles.title}>Vé trực tiếp</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeadingRow}>
            <Text style={styles.panelTitle}>Chuyến được phân công</Text>
            <Pressable accessibilityLabel="Tải lại chuyến" onPress={() => void loadTrips()} style={styles.reloadTripsButton}>
              <MaterialCommunityIcons color={colors.primary} name="refresh" size={19} />
            </Pressable>
          </View>
          <View style={styles.optionColumn}>
            {trips.length ? trips.map((trip) => (
              <Pressable key={trip.id} onPress={() => setSelectedTripId(trip.id)} style={[styles.tripChip, selectedTrip?.id === trip.id && styles.tripChipActive]}>
                <Text style={[styles.tripTitle, selectedTrip?.id === trip.id && styles.tripTextActive]}>{trip.route?.routeNumber || trip.tripCode || 'Chuyến'}</Text>
                <Text style={[styles.tripMeta, selectedTrip?.id === trip.id && styles.tripTextActive]}>{formatTime(trip.scheduledStart)} - {trip.vehicle?.code || trip.vehicle?.plateNumber || 'Chưa có xe'}</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>Không có chuyến đang hoạt động được phân công.</Text>}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeadingRow}><View style={styles.sectionIcon}><MaterialCommunityIcons color={colors.accent} name="map-marker-path" size={21} /></View><View style={styles.sectionToggleText}><Text style={styles.panelTitle}>Điểm dừng</Text><Text style={styles.sectionHint}>Chọn điểm lên và điểm xuống</Text></View></View>
          <DropdownSelect label="ĐIỂM LÊN" value={fromStopId} options={stopOptions} onChange={setFromStopId} placeholder="Chọn điểm lên" />
          <DropdownSelect label="ĐIỂM XUỐNG" value={toStopId} options={stopOptions} onChange={setToStopId} placeholder="Chọn điểm xuống" />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Thông tin vé</Text>
          <DropdownSelect label="ĐỐI TƯỢNG HÀNH KHÁCH" value={passengerType} options={passengerTypes.map((value) => ({ value, label: optionLabels[value] }))} onChange={setPassengerType} />
          <View style={styles.paymentGroup}>
            <Text style={styles.fieldLabel}>PHƯƠNG THỨC THANH TOÁN</Text>
            <View style={styles.paymentRow}>
              {paymentMethods.map((value) => {
                const active = paymentMethod === value;
                return (
                  <Pressable key={value} onPress={() => setPaymentMethod(value)} style={[styles.paymentButton, active && styles.paymentButtonActive]}>
                    <MaterialCommunityIcons color={active ? colors.white : colors.primary} name={value === 'CASH' ? 'cash' : 'qrcode'} size={21} />
                    <Text style={[styles.paymentButtonText, active && styles.paymentButtonTextActive]}>{optionLabels[value]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>SỐ LƯỢNG VÉ</Text>
              <View style={styles.stepper}><Pressable onPress={() => changeQuantity(-1)} style={styles.stepperButton}><MaterialCommunityIcons color={colors.primary} name="minus" size={20} /></Pressable><Text style={styles.stepperValue}>{quantity}</Text><Pressable onPress={() => changeQuantity(1)} style={styles.stepperButton}><MaterialCommunityIcons color={colors.primary} name="plus" size={20} /></Pressable></View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Tổng tiền</Text>
              <View style={styles.readonlyInput}><Text style={styles.readonlyValue}>{money(total)}</Text></View>
            </View>
          </View>
          {paymentMethod === 'CASH' ? (
            <View style={styles.cashPanel}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Khách đưa</Text>
                <TextInput keyboardType="number-pad" onChangeText={setCashReceived} placeholder="0" placeholderTextColor={colors.muted} style={styles.input} value={cashReceived} />
              </View>
              <View style={styles.changeBlock}>
                <Text style={styles.fieldLabel}>Tiền thối lại</Text>
                <Text style={[styles.changeValue, cashInsufficient && cashReceived !== '' && styles.changeError]}>{money(changeAmount)}</Text>
                {cashInsufficient && cashReceived !== '' ? <Text style={styles.insufficientText}>Số tiền khách đưa chưa đủ.</Text> : null}
              </View>
            </View>
          ) : null}
          <AppButton
            disabled={!selectedTrip || !fromStopId || !toStopId || cashInsufficient}
            title={paymentMethod === 'CASH' ? 'Thu tiền và tạo vé' : 'Tạo mã QR thanh toán'}
            loading={isSubmitting}
            onPress={createTicket}
          />
        </View>

        {result ? (
          <View style={[styles.panel, styles.resultPanel]}>
            <View style={styles.resultHeading}><MaterialCommunityIcons color={colors.accent} name="receipt-text-outline" size={21} /><Text style={styles.panelTitle}>Thông tin vé</Text></View>
            {result.qrCodeImage ? <><Image resizeMode="contain" source={{ uri: result.qrCodeImage }} style={styles.qrImage} /><Text style={styles.qrHint}>Đưa mã này cho hành khách quét bằng điện thoại.</Text></> : (
              <View style={styles.successBox}>
                <MaterialCommunityIcons color={colors.primary} name="check-circle-outline" size={34} />
                <Text style={styles.successTitle}>Đã thu tiền và tạo vé thành công.</Text>
                <View style={styles.cashResultRow}>
                  <View style={styles.cashResultItem}><Text style={styles.cashResultLabel}>Khách đưa</Text><Text style={styles.cashResultValue}>{money(result.cashReceived ?? received)}</Text></View>
                  <View style={styles.cashResultItem}><Text style={styles.cashResultLabel}>Tiền thối lại</Text><Text style={styles.cashResultValue}>{money(result.changeAmount ?? changeAmount)}</Text></View>
                </View>
              </View>
            )}
            <View style={styles.ticketIdentity}><Text style={styles.ticketCodeLabel}>Mã vé: <Text style={styles.ticketCodeValue}>{result.ticketData?.ticketCode}</Text></Text><Text style={styles.resultAmount}>{money(result.totalAmount || 0)}</Text></View>
            <View style={[styles.statusPill, result.requiresPaymentConfirmation ? styles.statusPending : styles.statusPaid]}>
              <Text style={styles.statusText}>{result.requiresPaymentConfirmation ? 'Chờ thanh toán' : 'Đã thanh toán'}</Text>
            </View>
            {result.checkoutUrl ? <Pressable onPress={() => void Linking.openURL(result.checkoutUrl!)}><Text style={styles.payOsLink}>Mở trang thanh toán PayOS</Text></Pressable> : null}
            {result.requiresPaymentConfirmation ? <AppButton title="Xác nhận đã nhận chuyển khoản" loading={isSubmitting} onPress={confirmPayment} /> : null}
            <AppButton title="Tạo vé mới" variant="secondary" onPress={() => { setResult(null); setCashReceived(''); }} />
          </View>
        ) : null}

        <View style={[styles.panel, styles.bottomSpace]}>
          <Pressable onPress={() => setShowHistory((value) => !value)} style={styles.historyHeader}>
            <View style={styles.historyTitleRow}>
              <MaterialCommunityIcons color={colors.accent} name="calendar-clock" size={22} />
              <View><Text style={styles.panelTitle}>Lịch sử bán vé</Text><Text style={styles.historyHint}>Xem lại vé đã bán theo ngày</Text></View>
            </View>
            <View style={styles.historyActions}><View style={styles.historyCount}><Text style={styles.historyCountText}>{history.tickets.length}</Text></View><MaterialCommunityIcons color={colors.muted} name={showHistory ? 'chevron-up' : 'chevron-down'} size={24} /></View>
          </Pressable>
          {showHistory ? <>
            <View style={styles.historyFilter}><TextInput onChangeText={setHistoryDate} placeholder="YYYY-MM-DD" style={styles.dateInput} value={historyDate} /><Pressable onPress={() => void loadHistory()} style={styles.refreshButton}>
              {isLoadingHistory ? <ActivityIndicator color={colors.primary} size="small" /> : <MaterialCommunityIcons color={colors.primary} name="refresh" size={21} />}
            </Pressable></View>
          {isLoadingHistory ? <ActivityIndicator color={colors.primary} /> : history.tickets.length ? history.tickets.map((ticket) => (
            <View key={ticket._id} style={styles.historyItem}>
              <View style={styles.historyItemTop}>
                <Text style={styles.historyCode}>{ticket.ticketCode || 'Vé'}</Text>
                <Text style={styles.historyAmount}>{money(ticket.totalAmount || 0)}</Text>
              </View>
              <Text style={styles.historyMeta}>{ticket.issuedAt ? new Date(ticket.issuedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'} · {ticket.routeCode || ticket.routeName || 'Chưa có tuyến'} · {ticket.passengerCount || 1} khách</Text>
              <View style={styles.historyFooter}>
                <Text style={styles.historyPayment}>{ticket.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản QR'}</Text>
                <Text style={ticket.status === 'COMPLETED' ? styles.paidText : styles.pendingText}>{ticket.status === 'COMPLETED' ? 'Đã thanh toán' : 'Chờ thanh toán'}</Text>
              </View>
              {ticket.canResumePayment ? <AppButton title={resumingId === ticket._id ? 'Đang mở...' : 'Thanh toán lại'} disabled={Boolean(resumingId)} onPress={() => void resumePayment(ticket._id)} /> : null}
            </View>
          )) : <Text style={styles.emptyText}>Chưa có vé nào được bán trong ngày này.</Text>}</> : null}
        </View>
      </Screen>
      <RoleBottomNav active="sell" role={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  panel: { gap: 14, borderRadius: 22, backgroundColor: colors.card, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e8efec' },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  panelHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reloadTripsButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.surfaceLow },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#e4f8ef' },
  sectionToggleText: { flex: 1 },
  sectionHint: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: '600' },
  routeSummary: { flexDirection: 'row', gap: 12, borderRadius: 17, backgroundColor: colors.surfaceLow, padding: 14 },
  routeTimeline: { width: 12, alignItems: 'center', paddingVertical: 5 },
  routeDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.white },
  routeDotEnd: { backgroundColor: colors.accent },
  routeLine: { width: 2, flex: 1, minHeight: 30, backgroundColor: '#adddca' },
  routeNames: { flex: 1, gap: 16 },
  routeCaption: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  routeName: { marginTop: 3, color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  stopPicker: { gap: 10, borderTopWidth: 1, borderTopColor: '#e8efec', paddingTop: 13 },
  optionColumn: { gap: 10 },
  tripChip: { borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, padding: 14 },
  tripChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  tripTitle: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  tripMeta: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700' },
  tripTextActive: { color: colors.white },
  fieldLabel: { color: colors.secondary, fontSize: 12, fontWeight: '900' },
  dropdownGroup: { gap: 7 },
  dropdownButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 14 },
  dropdownButtonOpen: { borderColor: colors.accent, backgroundColor: '#f7fffb' },
  dropdownValue: { flex: 1, color: colors.primary, fontSize: 14, fontWeight: '800' },
  dropdownPlaceholder: { color: colors.muted, fontWeight: '600' },
  dropdownMenu: { overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#d9e8e1', backgroundColor: colors.white },
  dropdownOption: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dropdownOptionBorder: { borderBottomWidth: 1, borderBottomColor: '#edf2f0' },
  dropdownOptionActive: { backgroundColor: '#e9f8f1' },
  dropdownOptionText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  dropdownOptionTextActive: { color: colors.primary, fontWeight: '900' },
  paymentGroup: { gap: 8 },
  paymentRow: { flexDirection: 'row', gap: 10 },
  paymentButton: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 10 },
  paymentButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  paymentButtonText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  paymentButtonTextActive: { color: colors.white },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 12 },
  stopChip: { maxWidth: '48%', minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 12 },
  optionChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  optionTextActive: { color: colors.white },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1, gap: 8 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, color: colors.text, paddingHorizontal: 14, fontSize: 16, fontWeight: '800' },
  stepper: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 6 },
  stepperButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.white },
  stepperValue: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  readonlyInput: { minHeight: 52, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, paddingHorizontal: 14 },
  readonlyValue: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  cashPanel: { flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#ccebdc', borderRadius: 18, backgroundColor: '#effaf5', padding: 14 },
  changeBlock: { flex: 1, justifyContent: 'center' },
  changeValue: { marginTop: 5, color: colors.primary, fontSize: 22, fontWeight: '900' },
  changeError: { color: colors.error },
  insufficientText: { marginTop: 2, color: colors.error, fontSize: 10, fontWeight: '700' },
  resultPanel: { borderColor: '#bfead6' },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  successBox: { alignItems: 'center', gap: 8, borderRadius: 17, backgroundColor: '#e8f9f1', padding: 16 },
  successTitle: { color: colors.primary, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  cashResultRow: { width: '100%', flexDirection: 'row', gap: 16, marginTop: 2 },
  cashResultItem: { flex: 1 },
  cashResultLabel: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  cashResultValue: { marginTop: 4, color: colors.primary, fontSize: 14, fontWeight: '900' },
  ticketIdentity: { alignItems: 'center', gap: 4 },
  ticketCodeLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  ticketCodeValue: { color: colors.primary, fontWeight: '900' },
  resultAmount: { color: colors.primary, fontSize: 27, fontWeight: '900' },
  qrImage: { width: '100%', aspectRatio: 1, alignSelf: 'center', borderRadius: 18, backgroundColor: colors.white },
  qrHint: { textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700' },
  statusPill: { alignSelf: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusPending: { backgroundColor: '#fff0c2' },
  statusPaid: { backgroundColor: '#d5f1e3' },
  statusText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  payOsLink: { textAlign: 'center', color: colors.accent, fontSize: 13, fontWeight: '900', textDecorationLine: 'underline' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  historyActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyCount: { minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#e4f8ef' },
  historyCountText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  historyFilter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyHint: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: '600' },
  refreshButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surfaceLow },
  dateInput: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceLow, color: colors.text, paddingHorizontal: 14, fontSize: 14, fontWeight: '800' },
  historyItem: { gap: 7, borderWidth: 1, borderColor: '#e0ebe6', borderRadius: 17, backgroundColor: '#fbfdfc', padding: 13 },
  historyItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyCode: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: '900' },
  historyAmount: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  historyMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  historyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyPayment: { color: colors.secondary, fontSize: 11, fontWeight: '800' },
  paidText: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  pendingText: { color: '#a46300', fontSize: 11, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  bottomSpace: { marginBottom: 96 },
});
