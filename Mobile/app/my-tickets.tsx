import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import passengerApi, { type MonthlyPassRecord, type TicketDetailRecord, type TicketRecord } from '@/api/passenger.api';
import { EmptyState, LoadingState, PassengerLayout, StatusPill } from '@/components/passenger/PassengerLayout';
import { colors } from '@/constants/colors';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const statusLabel = (value?: string) => ({ PAID: 'Đã thanh toán', PENDING: 'Đã đặt vé', COMPLETED: 'Hoàn tất', ACTIVE: 'Còn hiệu lực', UPCOMING: 'Sắp kích hoạt', USED: 'Đã sử dụng', EXPIRED: 'Đã hết hạn', CANCELLED: 'Đã hủy', REFUNDED: 'Đã hoàn tiền', FAILED: 'Thất bại', SUCCESS: 'Thành công' }[String(value || '').toUpperCase()] || value || 'Không xác định');
const dateLabel = (value?: string) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa có';
const displayStatus = (ticket: TicketRecord) => {
  const explicit = String(ticket.currentStatus || ticket.status || ticket.ticketStatus || '').toUpperCase();
  if (['CANCELLED', 'USED', 'REFUNDED'].includes(explicit)) return explicit;
  const date = String(ticket.serviceDate || '').slice(0, 10);
  const time = String(ticket.departureTime || '23:59');
  const journey = new Date(`${date}T${time}:00+07:00`).getTime();
  return Number.isFinite(journey) && journey <= Date.now() ? 'EXPIRED' : explicit || String(ticket.paymentStatus || 'PENDING').toUpperCase();
};
const isPending = (ticket: TicketRecord) => displayStatus(ticket) === 'PENDING' && String(ticket.paymentStatus).toUpperCase() === 'PENDING';
const canViewQr = (ticket: TicketRecord) => String(ticket.paymentStatus).toUpperCase() === 'PAID' && displayStatus(ticket) === 'ACTIVE';

export default function MyTicketsScreen() {
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [passes, setPasses] = useState<MonthlyPassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<TicketDetailRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [processingId, setProcessingId] = useState('');
  const [ticketView, setTicketView] = useState<'ONE_WAY' | 'MONTHLY'>('ONE_WAY');
  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const status = displayStatus(ticket);
    const keyword = query.trim().toLowerCase();
    const matchesQuery = !keyword || [ticket.ticketCode, ticket.routeCode, ticket.routeNumber, ticket.departureLocation, ticket.destinationLocation].some((value) => String(value || '').toLowerCase().includes(keyword));
    return matchesQuery && (statusFilter === 'ALL' || status === statusFilter);
  }), [query, statusFilter, tickets]);

  const openTicket = async (ticket: TicketRecord) => {
    if (!canViewQr(ticket)) {
      Alert.alert('Không thể xem mã QR', 'QR chưa khả dụng cho vé chưa thanh toán hoặc không còn hiệu lực.');
      return;
    }
    const ticketId = String(ticket.id || ticket._id || '');
    if (!ticketId) return;
    setLoadingDetail(true);
    try {
      setSelectedTicket(await passengerApi.getTicket(ticketId));
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể tải mã QR của vé.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ticketData, passData] = await Promise.all([
        passengerApi.getTickets(),
        passengerApi.getMonthlyPasses(),
      ]);
      setTickets(ticketData.tickets || []);
      setPasses(passData.passes || []);
    } catch (err) {
      setError((err as { message?: string })?.message || 'Không thể tải danh sách vé.');
    } finally {
      setLoading(false);
    }
  };

  const payPendingTicket = async (ticket: TicketRecord) => {
    const id = String(ticket.id || ticket._id || '');
    if (!id) return;
    setProcessingId(id);
    try {
      const payment = await passengerApi.createPendingTicketPayment(id);
      if (payment.status === 'PAID') await load();
      else if (payment.checkoutUrl) await Linking.openURL(payment.checkoutUrl);
      else Alert.alert('Đang chờ thanh toán', payment.message || 'Đơn thanh toán đang được xử lý.');
    } catch (err) {
      Alert.alert('Không thể thanh toán', (err as { message?: string })?.message || 'Vui lòng thử lại.');
    } finally { setProcessingId(''); }
  };

  const cancelPendingTicket = (ticket: TicketRecord) => {
    const id = String(ticket.id || ticket._id || '');
    Alert.alert('Hủy vé chưa thanh toán?', 'Vé sẽ bị hủy và không thể tiếp tục sử dụng.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Hủy vé', style: 'destructive', onPress: async () => {
        setProcessingId(id);
        try { await passengerApi.cancelTicket(id); await load(); }
        catch (err) { Alert.alert('Không thể hủy vé', (err as { message?: string })?.message || 'Vui lòng thử lại.'); }
        finally { setProcessingId(''); }
      } },
    ]);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <PassengerLayout
      active="tickets"
      subtitle="Vé một lượt và vé tháng của bạn"
      title="Vé của tôi"
      rightAction={(
        <Pressable accessibilityLabel="Lịch sử hành trình" onPress={() => router.push('/travel-history')} style={styles.iconButton}>
          <MaterialCommunityIcons color={colors.primary} name="history" size={20} />
        </Pressable>
      )}
    >
      <View style={styles.actions}>
        <Pressable onPress={() => setTicketView('ONE_WAY')} style={[styles.typeTab, ticketView === 'ONE_WAY' && styles.typeTabActive]}>
          <MaterialCommunityIcons color={ticketView === 'ONE_WAY' ? colors.white : colors.primary} name="ticket-outline" size={19} />
          <Text style={[styles.typeTabText, ticketView === 'ONE_WAY' && styles.typeTabTextActive]}>Vé một lượt</Text>
        </Pressable>
        <Pressable onPress={() => setTicketView('MONTHLY')} style={[styles.typeTab, ticketView === 'MONTHLY' && styles.typeTabActive]}>
          <MaterialCommunityIcons color={ticketView === 'MONTHLY' ? colors.white : colors.primary} name="calendar-month-outline" size={19} />
          <Text style={[styles.typeTabText, ticketView === 'MONTHLY' && styles.typeTabTextActive]}>Vé tháng</Text>
        </Pressable>
      </View>

      {!loading && ticketView === 'ONE_WAY' ? <View style={styles.filtersCard}>
        <View style={styles.searchBox}><MaterialCommunityIcons color={colors.muted} name="magnify" size={20} /><TextInput onChangeText={setQuery} placeholder="Tìm mã vé, tuyến hoặc điểm dừng..." placeholderTextColor={colors.muted} style={styles.searchInput} value={query} />{query ? <Pressable onPress={() => setQuery('')}><MaterialCommunityIcons color={colors.muted} name="close-circle" size={19} /></Pressable> : null}</View>
        <View style={styles.filterRow}>{[{ key: 'ALL', label: 'Tất cả' }, { key: 'ACTIVE', label: 'Còn hiệu lực' }, { key: 'PENDING', label: 'Đã đặt vé' }, { key: 'USED', label: 'Đã sử dụng' }, { key: 'EXPIRED', label: 'Hết hạn' }, { key: 'CANCELLED', label: 'Đã hủy' }].map((item) => <Pressable key={item.key} onPress={() => setStatusFilter(item.key)} style={[styles.filterChip, statusFilter === item.key && styles.filterChipActive]}><Text numberOfLines={1} style={[styles.filterText, statusFilter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</View>
        <View style={styles.filterSummary}><MaterialCommunityIcons color={colors.accent} name="ticket-confirmation-outline" size={16} /><Text style={styles.filterResult}><Text style={styles.filterResultStrong}>{filteredTickets.length}</Text>/{tickets.length} vé lượt</Text><View style={styles.summaryDivider} /><Text style={styles.filterResult}><Text style={styles.filterResultStrong}>{passes.length}</Text> vé tháng</Text></View>
      </View> : null}

      {loading ? <LoadingState label="Đang tải vé" /> : null}
      {!loading && error ? <EmptyState icon="alert-circle-outline" title="Không thể tải vé" detail={error} /> : null}
      {!loading && !error && !tickets.length && !passes.length ? <EmptyState icon="ticket-confirmation-outline" title="Bạn chưa có vé" detail="Hãy mua vé để bắt đầu hành trình cùng BusDN." /> : null}

      {!loading && !error && ticketView === 'ONE_WAY' ? <View style={styles.listHeading}><Text style={styles.sectionTitle}>Vé một lượt</Text><Pressable onPress={() => router.push('/buy-oneway-ticket')} style={styles.addTicketButton}><MaterialCommunityIcons color={colors.primary} name="plus" size={17} /><Text style={styles.addTicketText}>Mua vé mới</Text></Pressable></View> : null}
      {!loading && !error && ticketView === 'ONE_WAY' && filteredTickets.map((ticket) => (
        <Pressable key={String(ticket.id || ticket._id || ticket.ticketCode)} onPress={() => void openTicket(ticket)} style={styles.ticketCard}>
          <View style={styles.ticketTop}>
            <Text style={styles.code}>{ticket.ticketCode || 'Vé'}</Text>
            <StatusPill label={statusLabel(displayStatus(ticket))} tone={['ACTIVE', 'USED'].includes(displayStatus(ticket)) ? 'success' : 'warning'} />
          </View>
          <Text style={styles.path}>{ticket.departureLocation || 'Điểm đi'} đến {ticket.destinationLocation || 'Điểm đến'}</Text>
          <Text style={styles.meta}>{ticket.routeCode || ticket.routeNumber || 'Tuyến'} - {ticket.departureTime || 'Chưa có giờ'} - {currency.format(Number(ticket.ticketPrice || 0))}</Text>
          <Text style={styles.meta}>Thanh toán: {statusLabel(ticket.paymentStatus)} - Đặt vé: {statusLabel(ticket.bookingStatus)}</Text>
          {canViewQr(ticket) ? <View style={styles.viewQrRow}><MaterialCommunityIcons color={colors.accent} name="qrcode" size={18} /><Text style={styles.viewQrText}>Xem mã QR và chi tiết vé</Text><MaterialCommunityIcons color={colors.muted} name="chevron-right" size={19} /></View> : <View style={styles.qrUnavailableRow}><MaterialCommunityIcons color={colors.muted} name="qrcode-remove" size={17} /><Text style={styles.qrUnavailableText}>QR chưa khả dụng cho vé chưa thanh toán hoặc không còn hiệu lực.</Text></View>}
          {isPending(ticket) ? <View style={styles.pendingActions}><Pressable disabled={processingId === String(ticket.id || ticket._id)} onPress={(event) => { event.stopPropagation(); void payPendingTicket(ticket); }} style={styles.payButton}><MaterialCommunityIcons color={colors.white} name="credit-card-outline" size={17} /><Text style={styles.payButtonText}>Thanh toán</Text></Pressable><Pressable disabled={processingId === String(ticket.id || ticket._id)} onPress={(event) => { event.stopPropagation(); cancelPendingTicket(ticket); }} style={styles.cancelButton}><MaterialCommunityIcons color={colors.error} name="trash-can-outline" size={17} /><Text style={styles.cancelButtonText}>Hủy vé</Text></Pressable></View> : null}
        </Pressable>
      ))}
      {!loading && !error && ticketView === 'ONE_WAY' && tickets.length > 0 && filteredTickets.length === 0 ? <EmptyState icon="ticket-outline" title="Không tìm thấy vé" detail="Hãy thử từ khóa hoặc trạng thái khác." /> : null}

      {loadingDetail ? <View style={styles.detailLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.meta}>Đang tải mã QR...</Text></View> : null}

      <Modal animationType="slide" onRequestClose={() => setSelectedTicket(null)} transparent visible={Boolean(selectedTicket)}>
        <View style={styles.modalShade}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}><View><Text style={styles.detailKicker}>VÉ ĐIỆN TỬ</Text><Text style={styles.detailTitle}>Thông tin vé điện tử</Text><Text style={styles.detailSubtitle}>Xuất trình mã QR của vé khi lên xe</Text></View><Pressable accessibilityLabel="Đóng" onPress={() => setSelectedTicket(null)} style={styles.closeButton}><MaterialCommunityIcons color={colors.primary} name="close" size={22} /></Pressable></View>
            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              <View style={styles.statusBanner}><MaterialCommunityIcons color={colors.accent} name="check-decagram" size={19} /><Text style={styles.statusBannerText}>{statusLabel(selectedTicket?.status || selectedTicket?.currentStatus)}</Text></View>

              <View style={styles.qrCard}>
                <SectionHeading icon="qrcode" title="Mã QR của vé" />
                {selectedTicket?.qrCode?.image ? <Image resizeMode="contain" source={{ uri: selectedTicket.qrCode.image }} style={styles.qrImage} /> : <View style={styles.noQr}><MaterialCommunityIcons color={colors.muted} name="qrcode-remove" size={42} /><Text style={styles.meta}>Vé này chưa có mã QR.</Text></View>}
                <Text style={styles.qrHint}>Giữ mã rõ nét để phụ xe quét khi bạn lên xe</Text>
              </View>

              <View style={styles.detailCard}>
                <SectionHeading icon="ticket-confirmation-outline" title="Thông tin vé" />
                <DetailLine label="Mã vé" value={selectedTicket?.ticketCode || selectedTicket?.id} />
                <DetailLine label="Tuyến xe" value={selectedTicket?.routeCode || selectedTicket?.routeNumber} />
                <DetailLine label="Điểm đi" value={selectedTicket?.departureLocation || selectedTicket?.tripInfo?.boardingPoint} />
                <DetailLine label="Điểm đến" value={selectedTicket?.destinationLocation || selectedTicket?.tripInfo?.destinationPoint} />
                <DetailLine label="Khởi hành" value={`${selectedTicket?.serviceDate || ''} ${selectedTicket?.departureTime || ''}`.trim()} />
                <DetailLine label="Hành khách" value={selectedTicket?.passengerInfo?.fullName} />
                <DetailLine label="Giá vé" value={currency.format(Number(selectedTicket?.ticketPrice || 0))} />
              </View>

              <View style={styles.detailCard}>
                <SectionHeading icon="calendar-check-outline" title="Trạng thái và hiệu lực" />
                <DetailLine label="Trạng thái" value={statusLabel(selectedTicket?.status || selectedTicket?.currentStatus)} />
                <DetailLine label="Có hiệu lực từ" value={dateLabel(selectedTicket?.qrCode?.validFrom || selectedTicket?.validFrom)} />
                <DetailLine label="Có hiệu lực đến" value={dateLabel(selectedTicket?.qrCode?.validUntil || selectedTicket?.validUntil)} />
              </View>

              <View style={styles.detailCard}>
                <SectionHeading icon="map-marker-path" title="Thông tin hành trình" />
                <View style={styles.journeyEndpoints}><View style={styles.journeyRail}><View style={styles.journeyDot} /><View style={styles.journeyLine} /><View style={[styles.journeyDot, styles.journeyDotEnd]} /></View><View style={styles.journeyCopy}><View><Text style={styles.journeyLabel}>ĐIỂM LÊN XE</Text><Text style={styles.journeyValue}>{selectedTicket?.tripInfo?.boardingPoint || selectedTicket?.departureLocation || 'Chưa có'}</Text></View><View><Text style={styles.journeyLabel}>ĐIỂM XUỐNG</Text><Text style={styles.journeyValue}>{selectedTicket?.tripInfo?.destinationPoint || selectedTicket?.destinationLocation || 'Chưa có'}</Text></View></View></View>
                {selectedTicket?.tripInfo?.estimatedDurationMinutes ? <Text style={styles.journeyMeta}>Thời gian dự kiến: {selectedTicket.tripInfo.estimatedDurationMinutes} phút</Text> : null}
              </View>

              <View style={styles.noticeCard}><SectionHeading icon="information-outline" title="Lưu ý quan trọng" />{(selectedTicket?.importantNotes?.length ? selectedTicket.importantNotes : ['Có mặt tại điểm dừng ít nhất 5 phút trước giờ khởi hành.', 'Giữ mã QR rõ ràng và xuất trình khi lên xe.', 'Vé chỉ dành cho cá nhân và không được chuyển nhượng.']).map((note, index) => <View key={`${note}-${index}`} style={styles.noticeRow}><View style={styles.noticeDot} /><Text style={styles.noticeText}>{note}</Text></View>)}</View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {!loading && !error && ticketView === 'MONTHLY' ? <View style={styles.listHeading}><Text style={styles.sectionTitle}>Vé tháng</Text><Pressable onPress={() => router.push('/buy-monthly-pass')} style={styles.addTicketButton}><MaterialCommunityIcons color={colors.primary} name="plus" size={17} /><Text style={styles.addTicketText}>Mua vé tháng</Text></Pressable></View> : null}
      {!loading && !error && ticketView === 'MONTHLY' && !passes.length ? <EmptyState icon="calendar-month-outline" title="Bạn chưa có vé tháng" detail="Mua vé tháng để sử dụng thuận tiện hơn mỗi ngày." /> : null}
      {!loading && !error && ticketView === 'MONTHLY' && passes.map((pass) => (
        <View key={String(pass.id || pass._id || pass.passCode)} style={styles.ticketCard}>
          <View style={styles.ticketTop}>
            <Text style={styles.code}>{pass.passCode || 'Vé tháng'}</Text>
            <StatusPill label={statusLabel(pass.passStatus || pass.paymentStatus)} tone={pass.paymentStatus === 'PAID' ? 'success' : 'warning'} />
          </View>
          <Text style={styles.path}>{pass.passType || 'Tiêu chuẩn'} - {pass.routeCode || 'Tất cả tuyến'}</Text>
          <Text style={styles.meta}>{new Date(pass.startDate || Date.now()).toLocaleDateString('vi-VN')} đến {new Date(pass.expiryDate || Date.now()).toLocaleDateString('vi-VN')}</Text>
          <Text style={styles.meta}>{currency.format(Number(pass.passPrice || 0))} - Thanh toán: {statusLabel(pass.paymentStatus)}</Text>
          {pass.digitalPass?.qrCodeImage ? <View style={styles.passQrBlock}><Image resizeMode="contain" source={{ uri: pass.digitalPass.qrCodeImage }} style={styles.passQrImage} /><Text style={styles.qrHint}>Mã QR vé tháng</Text></View> : null}
        </View>
      ))}
    </PassengerLayout>
  );
}

function DetailLine({ label, value }: { label: string; value?: string }) {
  return <View style={styles.detailLine}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Chưa có'}</Text></View>;
}

function SectionHeading({ icon, title }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string }) {
  return <View style={styles.sectionHeading}><MaterialCommunityIcons color={colors.accent} name={icon} size={19} /><Text style={styles.sectionHeadingText}>{title}</Text></View>;
}

const styles = StyleSheet.create({
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.card },
  actions: { flexDirection: 'row', gap: 10 },
  typeTab: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 18, borderWidth: 1, borderColor: '#cfe2d9', backgroundColor: '#e8f8f0' },
  typeTabActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  typeTabText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  typeTabTextActive: { color: colors.white },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  addTicketButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 18, backgroundColor: '#dff6ea', paddingHorizontal: 11 },
  addTicketText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  filtersCard: { gap: 10, borderRadius: 22, borderWidth: 1, borderColor: '#e3ece8', backgroundColor: colors.card, padding: 12 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: colors.surfaceLow, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: colors.primary, fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  filterChip: { width: '31.5%', minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.white, paddingHorizontal: 5 },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.primary, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  filterTextActive: { color: colors.white },
  filterSummary: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, backgroundColor: '#edf9f3', paddingHorizontal: 10 },
  filterResult: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  filterResultStrong: { color: colors.primary, fontWeight: '900' },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 16, backgroundColor: colors.outline },
  sectionTitle: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  ticketCard: { gap: 9, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  code: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  path: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  meta: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  viewQrRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingTop: 9 },
  viewQrText: { flex: 1, color: colors.accent, fontSize: 12, fontWeight: '900' },
  qrUnavailableRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingTop: 9 },
  qrUnavailableText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  pendingActions: { flexDirection: 'row', gap: 8 },
  payButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, backgroundColor: colors.primary },
  payButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  cancelButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: '#f1b8b8', backgroundColor: '#fff7f7' },
  cancelButtonText: { color: colors.error, fontSize: 11, fontWeight: '900' },
  passQrBlock: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingTop: 10 },
  passQrImage: { width: 180, height: 180, borderRadius: 14, backgroundColor: colors.white },
  detailLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 12 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 25, 16, .45)' },
  detailSheet: { height: '94%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, padding: 18, paddingBottom: 20 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  detailKicker: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  detailTitle: { marginTop: 3, color: colors.primary, fontSize: 22, fontWeight: '900' },
  detailSubtitle: { marginTop: 3, color: colors.muted, fontSize: 10, fontWeight: '600' },
  detailContent: { gap: 12, paddingBottom: 20 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card },
  statusBanner: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, backgroundColor: '#d9f6e8', paddingHorizontal: 11, paddingVertical: 7 },
  statusBannerText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outline, padding: 14 },
  sectionHeadingText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  qrCard: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#dce9e3', backgroundColor: colors.card, paddingBottom: 13 },
  qrImage: { width: 235, height: 235, alignSelf: 'center', borderRadius: 16, backgroundColor: colors.white, marginTop: 12 },
  noQr: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, backgroundColor: colors.card },
  qrHint: { marginTop: 8, color: colors.secondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  detailCard: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.card },
  detailLine: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outline, paddingHorizontal: 14, paddingVertical: 9 },
  detailLabel: { width: 82, color: colors.muted, fontSize: 11, fontWeight: '700' },
  detailValue: { flex: 1, color: colors.primary, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  journeyEndpoints: { flexDirection: 'row', gap: 12, padding: 14 },
  journeyRail: { width: 12, alignItems: 'center', paddingVertical: 4 },
  journeyDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.white },
  journeyDotEnd: { backgroundColor: colors.accent },
  journeyLine: { width: 2, flex: 1, minHeight: 34, backgroundColor: '#b8dfce' },
  journeyCopy: { flex: 1, gap: 18 },
  journeyLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .6 },
  journeyValue: { marginTop: 3, color: colors.primary, fontSize: 12, lineHeight: 17, fontWeight: '900' },
  journeyMeta: { marginHorizontal: 14, marginBottom: 14, color: colors.secondary, fontSize: 11, fontWeight: '700' },
  noticeCard: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#a9dfc2', backgroundColor: '#dff7ea', paddingBottom: 12 },
  noticeRow: { flexDirection: 'row', gap: 9, paddingHorizontal: 14, paddingTop: 10 },
  noticeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginTop: 6 },
  noticeText: { flex: 1, color: colors.secondary, fontSize: 11, lineHeight: 17, fontWeight: '600' },
});
