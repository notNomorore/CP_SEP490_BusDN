import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  FileWarning,
  PackageSearch,
  RefreshCw,
  Send,
  UsersRound,
} from 'lucide-react';
import useTheme from '../../../shared/hooks/useTheme.js';
import scheduleOperationsService from '../../scheduleOperations/services/scheduleOperationsService.js';

const INCIDENT_TYPES = [
  {
    value: 'PASSENGER_VIOLATION',
    code: 'UC50',
    title: 'Báo hành khách vi phạm',
    description: 'Ghi nhận hành khách vi phạm nội quy xe buýt để điều hành xử lý.',
    icon: FileWarning,
  },
  {
    value: 'PASSENGER_CONFLICT',
    code: 'UC51',
    title: 'Báo xung đột hành khách',
    description: 'Ghi nhận tranh chấp, cãi vã hoặc tình huống gây mất trật tự trên xe.',
    icon: UsersRound,
  },
  {
    value: 'FOUND_ITEM',
    code: 'UC52',
    title: 'Báo đồ tìm thấy',
    description: 'Ghi nhận đồ vật thất lạc tìm thấy trên xe, kể cả sau khi chuyến đã kết thúc.',
    icon: PackageSearch,
  },
];

const VIOLATION_CATEGORIES = [
  { value: 'NO_TICKET', label: 'Không có vé / không quét vé' },
  { value: 'WRONG_TICKET', label: 'Dùng sai loại vé' },
  { value: 'SMOKING', label: 'Hút thuốc trên xe' },
  { value: 'LITTERING', label: 'Xả rác trên xe' },
  { value: 'UNSAFE_BEHAVIOR', label: 'Hành vi mất an toàn' },
  { value: 'DISTURBANCE', label: 'Gây ồn / làm phiền hành khách' },
  { value: 'OTHER', label: 'Khác' },
];

const CONFLICT_CATEGORIES = [
  { value: 'ARGUMENT', label: 'Cãi vã / gây rối' },
  { value: 'FARE_DISPUTE', label: 'Tranh chấp vé / thanh toán' },
  { value: 'SEAT_DISPUTE', label: 'Tranh chấp chỗ ngồi' },
  { value: 'HARASSMENT', label: 'Quấy rối / đe dọa' },
  { value: 'SAFETY_RISK', label: 'Nguy cơ mất an toàn' },
  { value: 'OTHER', label: 'Khác' },
];

const SEVERITIES = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'CRITICAL', label: 'Khẩn cấp' },
];

const initialForm = {
  type: 'PASSENGER_VIOLATION',
  severity: 'MEDIUM',
  locationText: '',
  description: '',
  violationCategory: 'NO_TICKET',
  passengerDescription: '',
  conflictCategory: 'ARGUMENT',
  partiesInvolved: '',
  actionTaken: '',
  itemName: '',
  itemDescription: '',
  foundLocation: '',
  handedTo: '',
  evidenceFiles: [],
};

const toInputDate = (date) => date.toISOString().slice(0, 10);

const getDefaultRange = () => {
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 7);

  return {
    from: toInputDate(from),
    to: toInputDate(to),
  };
};

const formatDate = (value) => {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (value) => {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getErrorMessage = (error) => (
  error?.response?.data?.message
  || error?.message
  || 'Không thể thực hiện thao tác. Vui lòng thử lại.'
);

const getTripLabel = (assignment) => {
  const route = assignment?.route || {};
  const origin = route.origin || 'Điểm đầu';
  const destination = route.destination || route.name || 'Điểm cuối';
  return `${assignment?.tripCode || assignment?.shiftCode || 'Chuyến'} - ${origin} → ${destination}`;
};

const getAllowedTypes = (assignment) => {
  if (!assignment) return [];
  if (assignment.tripStatus === 'IN_PROGRESS') return INCIDENT_TYPES;
  if (assignment.tripStatus === 'COMPLETED') {
    return INCIDENT_TYPES.filter((type) => type.value === 'FOUND_ITEM');
  }
  return [];
};

const statusMeta = {
  IN_PROGRESS: 'Đang vận hành',
  COMPLETED: 'Hoàn thành',
  READY: 'Xe sẵn sàng',
  SCHEDULED: 'Đã lên lịch',
  CANCELLED: 'Đã hủy',
};

const IncidentReportPage = () => {
  const { isDarkMode } = useTheme();
  const [filters, setFilters] = useState(getDefaultRange);
  const [assignments, setAssignments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedId) || null,
    [assignments, selectedId]
  );

  const allowedTypes = useMemo(() => getAllowedTypes(selectedAssignment), [selectedAssignment]);
  const activeType = INCIDENT_TYPES.find((type) => type.value === form.type) || INCIDENT_TYPES[0];

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const payload = await scheduleOperationsService.getAssignedTrips(filters);
      const trips = payload.trips || [];
      setAssignments(trips);

      setSelectedId((current) => (
        trips.some((assignment) => assignment.id === current)
          ? current
          : trips[0]?.id || ''
      ));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (!allowedTypes.length) return;
    if (!allowedTypes.some((type) => type.value === form.type)) {
      setForm((current) => ({ ...current, type: allowedTypes[0].value }));
    }
  }, [allowedTypes, form.type]);

  const updateForm = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectType = (type) => {
    setForm((current) => ({
      ...current,
      type,
      locationText: type === 'FOUND_ITEM' ? current.foundLocation || current.locationText : current.locationText,
    }));
  };

  const handleEvidenceChange = (event) => {
    setForm((current) => ({
      ...current,
      evidenceFiles: Array.from(event.target.files || []).slice(0, 5),
    }));
  };

  const validateForm = () => {
    if (!selectedAssignment) return 'Vui lòng chọn chuyến cần báo cáo.';
    if (!allowedTypes.some((type) => type.value === form.type)) {
      return selectedAssignment.tripStatus === 'COMPLETED'
        ? 'Chuyến đã hoàn thành chỉ cho phép báo đồ tìm thấy.'
        : 'Chỉ có thể báo cáo khi chuyến đang vận hành.';
    }
    if (form.locationText.trim().length < 3) return 'Vui lòng nhập vị trí xảy ra/tìm thấy.';
    if (form.description.trim().length < 10) return 'Vui lòng mô tả tình huống tối thiểu 10 ký tự.';
    if (form.type === 'PASSENGER_VIOLATION' && form.actionTaken.trim().length < 3) {
      return 'Vui lòng nhập hành động đã xử lý với hành khách vi phạm.';
    }
    if (form.type === 'PASSENGER_CONFLICT' && form.actionTaken.trim().length < 3) {
      return 'Vui lòng nhập hành động đã xử lý xung đột.';
    }
    if (form.type === 'FOUND_ITEM' && form.itemName.trim().length < 2) {
      return 'Vui lòng nhập tên đồ vật tìm thấy.';
    }
    if (form.type === 'FOUND_ITEM' && form.foundLocation.trim().length < 3) {
      return 'Vui lòng nhập vị trí tìm thấy đồ vật.';
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await scheduleOperationsService.reportOperationIncident(selectedAssignment.id, {
        ...form,
        foundLocation: form.type === 'FOUND_ITEM' ? form.foundLocation : '',
        locationText: form.type === 'FOUND_ITEM' ? form.foundLocation : form.locationText,
      });
      setSuccess('Đã gửi báo cáo cho điều hành. Bạn vẫn có thể gửi thêm báo cáo nếu phát sinh tình huống mới.');
      setForm((current) => ({
        ...initialForm,
        type: current.type,
        severity: current.severity,
      }));
      await loadAssignments();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const shellClass = isDarkMode
    ? 'rounded border border-white/10 bg-white/[0.04] text-slate-100'
    : 'rounded border border-emerald-100 bg-white text-slate-950 shadow-sm';
  const inputClass = isDarkMode
    ? 'w-full rounded border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400'
    : 'w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-emerald-500';
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className={shellClass}>
        <div className={isDarkMode ? 'border-b border-white/10 p-4' : 'border-b border-slate-200 p-4'}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">UC50 - UC52</p>
              <h1 className="mt-2 text-xl font-black">Báo cáo sự cố hành khách</h1>
              <p className={`mt-1 text-sm ${mutedText}`}>
                Phụ xe gửi báo cáo vi phạm, xung đột hành khách hoặc đồ tìm thấy về trung tâm điều hành.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAssignments}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-60"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label>
              <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Từ ngày</span>
              <input className={inputClass} type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
            </label>
            <label>
              <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Đến ngày</span>
              <input className={inputClass} type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
            </label>
            <label>
              <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Chuyến</span>
              <select className={`${inputClass} min-w-[260px]`} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {assignments.length ? assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>{getTripLabel(assignment)}</option>
                )) : <option value="">Không có chuyến</option>}
              </select>
            </label>
          </div>
        </div>

        <div className="p-4">
          {selectedAssignment ? (
            <div className={isDarkMode ? 'rounded border border-white/10 bg-slate-950 p-4' : 'rounded border border-emerald-100 bg-emerald-50/60 p-4'}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-emerald-500">{selectedAssignment.tripCode || selectedAssignment.shiftCode}</p>
                  <h2 className="mt-1 text-lg font-black">{selectedAssignment.route?.origin || 'Điểm đầu'} → {selectedAssignment.route?.destination || 'Điểm cuối'}</h2>
                  <p className={`mt-1 text-sm ${mutedText}`}>{selectedAssignment.route?.name || 'Chưa có tên tuyến'}</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-800">
                  {statusMeta[selectedAssignment.tripStatus] || selectedAssignment.tripStatus}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className={isDarkMode ? 'rounded bg-white/5 p-3' : 'rounded bg-white p-3'}>
                  <p className={`text-xs font-bold uppercase ${mutedText}`}>Ngày vận hành</p>
                  <p className="mt-1 font-bold">{formatDate(selectedAssignment.scheduledStart)}</p>
                </div>
                <div className={isDarkMode ? 'rounded bg-white/5 p-3' : 'rounded bg-white p-3'}>
                  <p className={`text-xs font-bold uppercase ${mutedText}`}>Thời gian</p>
                  <p className="mt-1 font-bold">{formatTime(selectedAssignment.scheduledStart)} - {formatTime(selectedAssignment.scheduledEnd)}</p>
                </div>
                <div className={isDarkMode ? 'rounded bg-white/5 p-3' : 'rounded bg-white p-3'}>
                  <p className={`text-xs font-bold uppercase ${mutedText}`}>Phương tiện</p>
                  <p className="mt-1 font-bold">{selectedAssignment.vehicle?.plateNumber || selectedAssignment.vehicle?.code || 'Chưa có'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className={isDarkMode ? 'rounded border border-dashed border-white/10 p-10 text-center text-slate-400' : 'rounded border border-dashed border-slate-300 p-10 text-center text-slate-500'}>
              Không có chuyến phụ xe trong khoảng ngày đã chọn.
            </div>
          )}

          {error ? <div className="mt-4 rounded border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div> : null}
          {success ? <div className="mt-4 rounded border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{success}</div> : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div>
              <p className="mb-3 text-sm font-black">Chọn loại báo cáo</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {INCIDENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isAllowed = allowedTypes.some((item) => item.value === type.value);
                  const isActive = form.type === type.value;

                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => selectType(type.value)}
                      disabled={!isAllowed}
                      className={[
                        'rounded border p-4 text-left transition',
                        isActive
                          ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                          : isDarkMode
                            ? 'border-white/10 bg-white/[0.04] hover:border-emerald-400'
                            : 'border-slate-200 bg-white hover:border-emerald-400',
                        !isAllowed ? 'cursor-not-allowed opacity-40' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={18} />
                        <span className="font-black">{type.code}</span>
                      </div>
                      <p className="mt-2 font-bold">{type.title}</p>
                      <p className={`mt-1 text-xs ${isActive ? 'text-slate-800' : mutedText}`}>{type.description}</p>
                    </button>
                  );
                })}
              </div>
              {selectedAssignment && !allowedTypes.length ? (
                <p className="mt-3 rounded border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
                  Chỉ có thể báo UC50/UC51 khi chuyến đang vận hành. UC52 có thể báo sau khi chuyến hoàn thành.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label>
                <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Mức độ</span>
                <select className={inputClass} value={form.severity} onChange={updateForm('severity')}>
                  {SEVERITIES.map((severity) => <option key={severity.value} value={severity.value}>{severity.label}</option>)}
                </select>
              </label>
              <label className="lg:col-span-2">
                <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Vị trí trên chuyến</span>
                <input className={inputClass} value={form.locationText} onChange={updateForm('locationText')} placeholder="Ví dụ: cửa sau, hàng ghế số 12, trạm Duy Tân..." />
              </label>
            </div>

            {form.type === 'PASSENGER_VIOLATION' ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Loại vi phạm</span>
                  <select className={inputClass} value={form.violationCategory} onChange={updateForm('violationCategory')}>
                    {VIOLATION_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Mô tả hành khách</span>
                  <input className={inputClass} value={form.passengerDescription} onChange={updateForm('passengerDescription')} placeholder="Ví dụ: áo xanh, đứng gần cửa sau" />
                </label>
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Hành động đã xử lý</span>
                  <input className={inputClass} value={form.actionTaken} onChange={updateForm('actionTaken')} placeholder="Ví dụ: nhắc nội quy, yêu cầu quét vé" />
                </label>
              </div>
            ) : null}

            {form.type === 'PASSENGER_CONFLICT' ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Nhóm xung đột</span>
                  <select className={inputClass} value={form.conflictCategory} onChange={updateForm('conflictCategory')}>
                    {CONFLICT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Các bên liên quan</span>
                  <input className={inputClass} value={form.partiesInvolved} onChange={updateForm('partiesInvolved')} placeholder="Ví dụ: 2 hành khách ở hàng ghế giữa" />
                </label>
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Hành động đã xử lý</span>
                  <input className={inputClass} value={form.actionTaken} onChange={updateForm('actionTaken')} placeholder="Ví dụ: tách hành khách, báo tài xế" />
                </label>
              </div>
            ) : null}

            {form.type === 'FOUND_ITEM' ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Tên đồ vật</span>
                  <input className={inputClass} value={form.itemName} onChange={updateForm('itemName')} placeholder="Ví dụ: ví da màu đen" />
                </label>
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Vị trí tìm thấy</span>
                  <input className={inputClass} value={form.foundLocation} onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({ ...current, foundLocation: value, locationText: value }));
                  }} placeholder="Ví dụ: ghế số 12" />
                </label>
                <label>
                  <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Bàn giao cho</span>
                  <input className={inputClass} value={form.handedTo} onChange={updateForm('handedTo')} placeholder="Ví dụ: quầy điều hành bến" />
                </label>
              </div>
            ) : null}

            <label className="block">
              <span className={`mb-1 block text-xs font-bold uppercase ${mutedText}`}>Mô tả chi tiết</span>
              <textarea className={`${inputClass} min-h-[120px] resize-y`} value={form.description} onChange={updateForm('description')} placeholder={`Mô tả rõ nội dung ${activeType.title.toLowerCase()}, mức ảnh hưởng và hành động đã thực hiện.`} />
            </label>

            <label className="block">
              <span className={`mb-1 flex items-center gap-2 text-xs font-bold uppercase ${mutedText}`}>
                <Camera size={15} />
                Ảnh minh chứng
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                multiple
                onChange={handleEvidenceChange}
                className={isDarkMode
                  ? 'block w-full rounded border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950'
                  : 'block w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-sm file:font-bold file:text-emerald-800'}
              />
              <p className={`mt-1 text-xs ${mutedText}`}>Có thể chụp hoặc chọn tối đa 5 ảnh để admin xem tình hình rõ hơn.</p>
              {form.evidenceFiles.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {form.evidenceFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className={isDarkMode ? 'rounded border border-white/10 px-3 py-2 text-sm' : 'rounded border border-slate-200 px-3 py-2 text-sm'}>
                      <p className="truncate font-bold">{file.name}</p>
                      <p className={mutedText}>{Math.max(1, Math.round(file.size / 1024))} KB</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={`inline-flex items-center gap-2 text-sm ${mutedText}`}>
                <Clock3 size={16} />
                Mỗi tình huống phát sinh có thể gửi một báo cáo riêng.
              </p>
              <button
                type="submit"
                disabled={isSubmitting || !selectedAssignment || !allowedTypes.length}
                className="inline-flex items-center justify-center gap-2 rounded bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw size={17} className="animate-spin" /> : <Send size={17} />}
                Gửi báo cáo
              </button>
            </div>
          </form>
        </div>
      </section>

      <aside className={shellClass}>
        <div className={isDarkMode ? 'border-b border-white/10 p-4' : 'border-b border-slate-200 p-4'}>
          <h2 className="flex items-center gap-2 text-base font-black">
            <CheckCircle2 size={18} className="text-emerald-400" />
            Luồng xử lý
          </h2>
          <p className={`mt-1 text-sm ${mutedText}`}>
            Báo cáo được lưu vào Operation Incidents và đồng bộ sang Incident Reports để admin tiếp nhận.
          </p>
        </div>
        <div className="space-y-3 p-4 text-sm">
          {[
            ['UC50', 'Báo hành khách vi phạm khi chuyến đang vận hành.'],
            ['UC51', 'Báo xung đột hành khách khi chuyến đang vận hành.'],
            ['UC52', 'Báo đồ tìm thấy trong hoặc sau chuyến.'],
          ].map(([code, text]) => (
            <div key={code} className={isDarkMode ? 'rounded bg-white/5 p-3' : 'rounded bg-emerald-50 p-3'}>
              <p className="font-black text-emerald-500">{code}</p>
              <p className={mutedText}>{text}</p>
            </div>
          ))}
          <div className={isDarkMode ? 'rounded border border-amber-400/30 bg-amber-400/10 p-3 text-amber-100' : 'rounded border border-amber-200 bg-amber-50 p-3 text-amber-900'}>
            <div className="flex gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>
                UC50/UC51 không tự kết thúc chuyến. Điều hành sẽ xem và xử lý ở trang admin incidents.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default IncidentReportPage;
