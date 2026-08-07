import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from '../../../../shared/utils/toast.js';
import {
  CreditCard,
  Grid2X2,
  LoaderCircle,
  Pencil,
  Percent,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import fareOperationsService from '../services/fareOperationsService.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const tabs = [
  { key: 'matrix', label: 'Ma trận giá vé', icon: Grid2X2 },
  { key: 'monthly', label: 'Giá vé tháng', icon: CreditCard },
  { key: 'discounts', label: 'Giảm giá ưu tiên', icon: Percent },
];

const pricingTypeHelp = {
  DEFAULT: {
    title: 'Giá mặc định',
    description: 'Dùng làm giá dự phòng cho mọi tuyến khi không tìm thấy chính sách theo tuyến hoặc theo khoảng cách.',
    example: 'Ví dụ: mọi vé lẻ mặc định là 7.000 VND.',
  },
  ROUTE_BASED: {
    title: 'Giá theo tuyến',
    description: 'Dùng khi một tuyến có giá riêng. Chỉ trường hợp này mới cần nhập ID tuyến đường.',
    example: 'Ví dụ: tuyến R01 có giá cố định 10.000 VND.',
  },
  DISTANCE_BASED: {
    title: 'Giá theo khoảng cách',
    description: 'Dùng khi giá vé phụ thuộc vào số km hành khách đi. Chỉ trường hợp này mới cần nhập min/max km.',
    example: 'Ví dụ: từ 0 đến 5 km là 8.000 VND, từ 5 đến 10 km là 12.000 VND.',
  },
};

const passTypeHelp = {
  NETWORK_PASS: 'Vé tháng dùng cho toàn bộ mạng tuyến. Không cần nhập tuyến.',
  ROUTE_PASS: 'Vé tháng chỉ dùng cho một tuyến cụ thể. Cần nhập ID tuyến đường.',
};

const priorityTypeLabel = {
  STUDENT: 'Học sinh / sinh viên',
  ELDERLY: 'Người cao tuổi',
  DISABILITY: 'Người khuyết tật',
  OTHER: 'Nhóm ưu tiên khác',
};

const statusClassName = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-surface-container text-on-surface-variant border-outline-variant',
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch {
    return 'N/A';
  }
};

const toDateInput = (value) => {
  if (!value) return '';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

const formatMoney = (value, currency = 'VND') => `${Number(value || 0).toLocaleString('vi-VN')} ${currency}`;

const routeLabel = (item) => {
  if (item.passType === 'NETWORK_PASS' || item.pricingType === 'DEFAULT') return 'Tất cả tuyến';
  if (item.pricingType === 'DISTANCE_BASED') return 'Theo khoảng cách';
  return item.routeId?.routeNumber || item.routeCode || item.routeName || item.routeId || 'Cần chọn tuyến';
};

const defaults = {
  matrix: {
    routeId: '',
    routeName: '',
    routeCode: '',
    pricingType: 'DEFAULT',
    minDistanceKm: '',
    maxDistanceKm: '',
    baseFare: '',
    currency: 'VND',
    effectiveFrom: '',
    effectiveTo: '',
    status: 'ACTIVE',
    note: '',
  },
  monthly: {
    routeId: '',
    routeName: '',
    routeCode: '',
    passType: 'NETWORK_PASS',
    price: '',
    validityDays: 30,
    currency: 'VND',
    effectiveFrom: '',
    effectiveTo: '',
    status: 'ACTIVE',
    note: '',
  },
  discounts: {
    priorityType: 'STUDENT',
    discountPercent: '',
    maxDiscountAmount: '',
    status: 'ACTIVE',
    effectiveFrom: '',
    effectiveTo: '',
    requiredApproval: true,
    note: '',
  },
};

const normalizeNumber = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

const buildInitialValues = (tab, item) => {
  if (!item) return defaults[tab];
  return {
    ...defaults[tab],
    ...item,
    routeId: item.routeId?._id || item.routeId || '',
    effectiveFrom: toDateInput(item.effectiveFrom),
    effectiveTo: toDateInput(item.effectiveTo),
    minDistanceKm: item.minDistanceKm ?? '',
    maxDistanceKm: item.maxDistanceKm ?? '',
    maxDiscountAmount: item.maxDiscountAmount ?? '',
  };
};

const validate = (tab, values) => {
  const errors = {};

  if (!values.effectiveFrom) errors.effectiveFrom = 'Effective from is required';

  if (tab === 'matrix') {
    if (Number(values.baseFare) <= 0) errors.baseFare = 'Base fare must be greater than 0';
    if (values.pricingType === 'ROUTE_BASED' && !values.routeId) errors.routeId = 'Route ID is required';
    if (values.pricingType === 'DISTANCE_BASED' && values.minDistanceKm === '') {
      errors.minDistanceKm = 'Minimum distance is required';
    }
    if (values.pricingType === 'DISTANCE_BASED' && values.maxDistanceKm === '') {
      errors.maxDistanceKm = 'Maximum distance is required';
    }
    if (values.minDistanceKm !== '' && values.maxDistanceKm !== '' && Number(values.maxDistanceKm) <= Number(values.minDistanceKm)) {
      errors.maxDistanceKm = 'Max distance must be greater than min distance';
    }
  }

  if (tab === 'monthly') {
    if (Number(values.price) <= 0) errors.price = 'Price must be greater than 0';
    if (values.passType === 'ROUTE_PASS' && !values.routeId) errors.routeId = 'Route ID is required';
  }

  if (tab === 'discounts') {
    const percent = Number(values.discountPercent);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      errors.discountPercent = 'Discount percent must be from 0 to 100';
    }
  }

  return errors;
};

const buildPayload = (tab, values) => {
  if (tab === 'matrix') {
    const isRouteBased = values.pricingType === 'ROUTE_BASED';
    const isDistanceBased = values.pricingType === 'DISTANCE_BASED';
    return {
      ...values,
      routeId: isRouteBased ? values.routeId : null,
      baseFare: normalizeNumber(values.baseFare),
      minDistanceKm: isDistanceBased ? normalizeNumber(values.minDistanceKm) : null,
      maxDistanceKm: isDistanceBased ? normalizeNumber(values.maxDistanceKm) : null,
      routeName: isRouteBased ? values.routeName.trim() : '',
      routeCode: isRouteBased ? values.routeCode.trim() : '',
      note: values.note.trim(),
      effectiveTo: values.effectiveTo || null,
    };
  }

  if (tab === 'monthly') {
    return {
      ...values,
      routeId: values.passType === 'ROUTE_PASS' ? values.routeId : null,
      price: normalizeNumber(values.price),
      validityDays: Number(values.validityDays) || 30,
      routeName: values.routeName.trim(),
      routeCode: values.routeCode.trim(),
      note: values.note.trim(),
      effectiveTo: values.effectiveTo || null,
    };
  }

  return {
    ...values,
    discountPercent: normalizeNumber(values.discountPercent),
    maxDiscountAmount: normalizeNumber(values.maxDiscountAmount),
    note: values.note.trim(),
    effectiveTo: values.effectiveTo || null,
  };
};

const PolicyModal = ({ tab, item, isSaving, onClose, onSubmit }) => {
  const [values, setValues] = useState(() => buildInitialValues(tab, item));
  const [errors, setErrors] = useState({});
  const activePricingHelp = pricingTypeHelp[values.pricingType] || pricingTypeHelp.DEFAULT;
  const showRouteFields = (tab === 'matrix' && values.pricingType === 'ROUTE_BASED')
    || (tab === 'monthly' && values.passType === 'ROUTE_PASS');
  const showDistanceFields = tab === 'matrix' && values.pricingType === 'DISTANCE_BASED';

  const updateValue = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validate(tab, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit(buildPayload(tab, values));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-outline">
              {tabs.find((entry) => entry.key === tab)?.label}
            </p>
            <h2 className="mt-2 text-2xl font-headline font-extrabold text-primary">
              {item ? 'Sửa chính sách' : 'Tạo chính sách'}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Thay đổi chỉ áp dụng cho các lượt mua trong tương lai, không tính lại vé hoặc thẻ đã bán.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {tab === 'matrix' ? (
            <>
              <div className="rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/5 p-4 md:col-span-2">
                <p className="text-sm font-black text-primary">{activePricingHelp.title}</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">{activePricingHelp.description}</p>
                <p className="mt-2 text-xs font-bold text-on-tertiary-container">{activePricingHelp.example}</p>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold">Cách áp dụng giá</span>
                <select value={values.pricingType} onChange={(event) => updateValue('pricingType', event.target.value)} className={fieldClassName}>
                  <option value="DEFAULT">Giá mặc định cho mọi tuyến</option>
                  <option value="ROUTE_BASED">Giá riêng cho một tuyến</option>
                  <option value="DISTANCE_BASED">Giá theo khoảng cách di chuyển</option>
                </select>
              </label>
              <NumberField
                label="Giá vé áp dụng"
                help="Số tiền hành khách phải trả trước khi áp dụng giảm giá ưu tiên."
                placeholder="Ví dụ: 10000"
                value={values.baseFare}
                error={errors.baseFare}
                onChange={(value) => updateValue('baseFare', value)}
              />
              {showRouteFields ? <RouteFields values={values} errors={errors} updateValue={updateValue} /> : null}
              {showDistanceFields ? (
                <>
                  <NumberField
                    label="Từ km"
                    help="Cận dưới của khoảng cách. Nhập 0 nếu chính sách áp dụng từ đầu chuyến."
                    placeholder="Ví dụ: 0"
                    value={values.minDistanceKm}
                    error={errors.minDistanceKm}
                    onChange={(value) => updateValue('minDistanceKm', value)}
                  />
                  <NumberField
                    label="Đến dưới km"
                    help="Cận trên của khoảng cách. Phải lớn hơn 'Từ km'."
                    placeholder="Ví dụ: 5"
                    value={values.maxDistanceKm}
                    error={errors.maxDistanceKm}
                    onChange={(value) => updateValue('maxDistanceKm', value)}
                  />
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'monthly' ? (
            <>
              <div className="rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/5 p-4 md:col-span-2">
                <p className="text-sm font-black text-primary">Giá vé tháng</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">{passTypeHelp[values.passType]}</p>
                <p className="mt-2 text-xs font-bold text-on-tertiary-container">Chính sách này chỉ ảnh hưởng các lượt mua vé tháng trong tương lai.</p>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Loại vé tháng</span>
                <select value={values.passType} onChange={(event) => updateValue('passType', event.target.value)} className={fieldClassName}>
                  <option value="NETWORK_PASS">Vé tháng toàn mạng</option>
                  <option value="ROUTE_PASS">Vé tháng theo tuyến</option>
                </select>
              </label>
              <NumberField label="Giá vé tháng" help="Số tiền hành khách trả cho một chu kỳ vé tháng." placeholder="Ví dụ: 200000" value={values.price} error={errors.price} onChange={(value) => updateValue('price', value)} />
              <NumberField label="Số ngày hiệu lực" help="Thường là 30 ngày kể từ ngày mua." placeholder="30" value={values.validityDays} onChange={(value) => updateValue('validityDays', value)} />
              {showRouteFields ? <RouteFields values={values} errors={errors} updateValue={updateValue} /> : null}
            </>
          ) : null}

          {tab === 'discounts' ? (
            <>
              <div className="rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/5 p-4 md:col-span-2">
                <p className="text-sm font-black text-primary">Giảm giá nhóm ưu tiên</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                  Dùng để giảm giá khi hành khách thuộc nhóm ưu tiên và hồ sơ đã được duyệt.
                </p>
                <p className="mt-2 text-xs font-bold text-on-tertiary-container">Ví dụ: sinh viên được giảm 20%, tối đa 5.000 VND mỗi vé.</p>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Nhóm ưu tiên</span>
                <select value={values.priorityType} onChange={(event) => updateValue('priorityType', event.target.value)} className={fieldClassName}>
                  {Object.entries(priorityTypeLabel).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <NumberField label="Phần trăm giảm" help="Nhập số từ 0 đến 100." placeholder="Ví dụ: 20" value={values.discountPercent} error={errors.discountPercent} onChange={(value) => updateValue('discountPercent', value)} />
              <NumberField label="Số tiền giảm tối đa" help="Để trống nếu không giới hạn số tiền giảm." placeholder="Ví dụ: 5000" value={values.maxDiscountAmount} onChange={(value) => updateValue('maxDiscountAmount', value)} />
              <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3">
                <input type="checkbox" checked={values.requiredApproval} onChange={(event) => updateValue('requiredApproval', event.target.checked)} />
                <span className="text-sm font-semibold">Chỉ áp dụng khi hồ sơ ưu tiên đã được duyệt</span>
              </label>
            </>
          ) : null}

          <label className="space-y-2">
            <span className="text-sm font-semibold">Có hiệu lực từ</span>
            <input type="date" value={values.effectiveFrom} onChange={(event) => updateValue('effectiveFrom', event.target.value)} className={fieldClassName} />
            {errors.effectiveFrom ? <span className="text-sm text-error">{errors.effectiveFrom}</span> : null}
            <span className="block text-xs leading-5 text-on-surface-variant">Ngày bắt đầu dùng chính sách này cho giao dịch mới.</span>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Có hiệu lực đến</span>
            <input type="date" value={values.effectiveTo} onChange={(event) => updateValue('effectiveTo', event.target.value)} className={fieldClassName} />
            <span className="block text-xs leading-5 text-on-surface-variant">Có thể để trống nếu chính sách chưa có ngày kết thúc.</span>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Tiền tệ</span>
            <input value={values.currency || 'VND'} onChange={(event) => updateValue('currency', event.target.value.toUpperCase())} className={fieldClassName} disabled={tab === 'discounts'} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Trạng thái</span>
            <select value={values.status} onChange={(event) => updateValue('status', event.target.value)} className={fieldClassName}>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Tạm tắt</option>
            </select>
            <span className="block text-xs leading-5 text-on-surface-variant">Chỉ chính sách đang hoạt động mới được hệ thống dùng để tính tiền.</span>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold">Ghi chú nội bộ</span>
            <textarea value={values.note} onChange={(event) => updateValue('note', event.target.value)} className={`${fieldClassName} min-h-[90px] resize-none`} placeholder="Ví dụ: áp dụng thử trong tháng 8 cho tuyến du lịch" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-outline-variant/60 px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low">
            Hủy
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:opacity-60">
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Lưu chính sách
          </button>
        </div>
      </form>
    </div>
  );
};

const NumberField = ({ label, value, error, help, placeholder, onChange }) => (
  <label className="space-y-2">
    <span className="text-sm font-semibold">{label}</span>
    <input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} className={fieldClassName} placeholder={placeholder} />
    {error ? <span className="text-sm text-error">{error}</span> : null}
    {help ? <span className="block text-xs leading-5 text-on-surface-variant">{help}</span> : null}
  </label>
);

const RouteFields = ({ values, errors, updateValue }) => (
  <>
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low/50 p-4 md:col-span-2">
      <p className="text-sm font-black text-primary">Thông tin tuyến áp dụng</p>
      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
        Chỉ nhập phần này khi chính sách áp dụng riêng cho một tuyến. ID tuyến đường là giá trị hệ thống dùng để đối chiếu khi mua vé.
      </p>
    </div>
    <label className="space-y-2">
      <span className="text-sm font-semibold">ID tuyến đường</span>
      <input value={values.routeId} onChange={(event) => updateValue('routeId', event.target.value)} className={fieldClassName} placeholder="Mongo ObjectId của tuyến" />
      {errors.routeId ? <span className="text-sm text-error">{errors.routeId}</span> : null}
      <span className="block text-xs leading-5 text-on-surface-variant">Bắt buộc để backend biết chính sách này thuộc tuyến nào.</span>
    </label>
    <label className="space-y-2">
      <span className="text-sm font-semibold">Mã tuyến hiển thị</span>
      <input value={values.routeCode} onChange={(event) => updateValue('routeCode', event.target.value)} className={fieldClassName} placeholder="Ví dụ: R01" />
      <span className="block text-xs leading-5 text-on-surface-variant">Chỉ dùng để admin dễ nhận diện trong bảng.</span>
    </label>
    <label className="space-y-2 md:col-span-2">
      <span className="text-sm font-semibold">Tên tuyến hiển thị</span>
      <input value={values.routeName} onChange={(event) => updateValue('routeName', event.target.value)} className={fieldClassName} placeholder="Ví dụ: Trung tâm thành phố - Hội An" />
      <span className="block text-xs leading-5 text-on-surface-variant">Không dùng để tính giá, chỉ để đọc dễ hơn.</span>
    </label>
  </>
);

const MonthlyPassSettingsPanel = ({ settings, isSaving, onChange, onSave }) => (
  <div className="border-b border-outline-variant/30 bg-white p-5">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
      <div>
        <p className="text-sm font-black text-primary">Monthly Pass Settings</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          Configure the maximum number of successful monthly-pass validations allowed per passenger each server day.
        </p>
      </div>
      <label className="space-y-2">
        <span className="text-sm font-semibold">Maximum rides per day</span>
        <input
          type="number"
          min="1"
          max="20"
          value={settings.maxRidesPerDay}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClassName}
        />
      </label>
      <button
        type="button"
        disabled={isSaving}
        onClick={onSave}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary-container disabled:opacity-60"
      >
        {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        Save
      </button>
    </div>
  </div>
);

const FareOperationsPage = () => {
  const [activeTab, setActiveTab] = useState('matrix');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', status: '', page: 1, limit: 20 });
  const [monthlyPassSettings, setMonthlyPassSettings] = useState({ maxRidesPerDay: 6 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const serviceMap = useMemo(() => ({
    matrix: {
      list: fareOperationsService.listFareMatrix,
      create: fareOperationsService.createFareMatrix,
      update: fareOperationsService.updateFareMatrix,
      status: fareOperationsService.updateFareMatrixStatus,
      delete: fareOperationsService.deleteFareMatrix,
    },
    monthly: {
      list: fareOperationsService.listMonthlyPassPricing,
      create: fareOperationsService.createMonthlyPassPricing,
      update: fareOperationsService.updateMonthlyPassPricing,
      status: fareOperationsService.updateMonthlyPassPricingStatus,
      delete: fareOperationsService.deleteMonthlyPassPricing,
    },
    discounts: {
      list: fareOperationsService.listPriorityDiscounts,
      create: fareOperationsService.createPriorityDiscount,
      update: fareOperationsService.updatePriorityDiscount,
      status: fareOperationsService.updatePriorityDiscountStatus,
      delete: fareOperationsService.deletePriorityDiscount,
    },
  }), []);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await serviceMap[activeTab].list(filters);
      setItems(response.data || []);
      setPagination(response.meta || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (error) {
      toast.error(error.message || 'Unable to load fare policies');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, filters, serviceMap]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        const response = await fareOperationsService.getMonthlyPassSettings();
        if (isMounted) setMonthlyPassSettings(response.data || { maxRidesPerDay: 6 });
      } catch (error) {
        toast.error(error.message || 'Unable to load monthly pass settings');
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setItems([]);
    setFilters({ search: '', status: '', page: 1, limit: 20 });
  };

  const savePolicy = async (payload) => {
    setIsSaving(true);
    try {
      if (modalItem) {
        await serviceMap[activeTab].update(modalItem._id, payload);
        toast.success('Policy updated');
      } else {
        await serviceMap[activeTab].create(payload);
        toast.success('Policy created');
      }
      setModalItem(null);
      setIsCreateOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(error.message || 'Policy save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (item) => {
    try {
      await serviceMap[activeTab].status(item._id, item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      toast.success('Status updated');
      await loadItems();
    } catch (error) {
      toast.error(error.message || 'Status update failed');
    }
  };

  const deletePolicy = async (item) => {
    try {
      await serviceMap[activeTab].delete(item._id);
      toast.success('Policy deactivated');
      await loadItems();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const saveMonthlyPassSettings = async () => {
    const maxRidesPerDay = Number(monthlyPassSettings.maxRidesPerDay);
    if (!Number.isInteger(maxRidesPerDay) || maxRidesPerDay < 1 || maxRidesPerDay > 20) {
      toast.error('Maximum rides per day must be an integer from 1 to 20');
      return;
    }

    setIsSavingSettings(true);
    try {
      const response = await fareOperationsService.updateMonthlyPassSettings({ maxRidesPerDay });
      setMonthlyPassSettings(response.data || { maxRidesPerDay });
      toast.success('Monthly pass settings updated');
    } catch (error) {
      toast.error(error.message || 'Monthly pass settings update failed');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <AdminPromotionShell
      title="Fare Operations"
      subtitle="Quản lý giá vé lẻ, giá vé tháng và chính sách giảm giá cho hành khách ưu tiên."
      action={(
        <button type="button" onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container">
          <Plus className="h-4 w-4" />
          Thêm chính sách mới
        </button>
      )}
    >
      <section className="overflow-hidden rounded-[28px] border border-outline-variant/35 bg-white/85 shadow-sm">
        <div className="flex flex-wrap gap-3 border-b border-outline-variant/30 px-5 pt-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} type="button" onClick={() => changeTab(tab.key)} className={`flex items-center gap-2 border-b-2 px-2 pb-4 text-sm font-bold ${isActive ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}>
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'monthly' ? (
          <MonthlyPassSettingsPanel
            settings={monthlyPassSettings}
            isSaving={isSavingSettings}
            onChange={(value) => setMonthlyPassSettings((current) => ({ ...current, maxRidesPerDay: value }))}
            onSave={saveMonthlyPassSettings}
          />
        ) : null}

        <div className="flex flex-col gap-3 border-b border-outline-variant/30 bg-surface-container-low/40 p-5 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} className={`${fieldClassName} pl-11`} placeholder="Tìm theo tuyến hoặc ghi chú" />
          </label>
          <div className="flex items-center gap-3">
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className={fieldClassName}>
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Tạm tắt</option>
            </select>
            <span className="whitespace-nowrap text-sm text-on-surface-variant">
              Đang hiển thị <strong className="text-on-surface">{items.length}</strong> kết quả
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'matrix' ? <FareMatrixTable items={items} isLoading={isLoading} onEdit={setModalItem} onStatus={toggleStatus} onDelete={deletePolicy} /> : null}
          {activeTab === 'monthly' ? <MonthlyTable items={items} isLoading={isLoading} onEdit={setModalItem} onStatus={toggleStatus} onDelete={deletePolicy} /> : null}
          {activeTab === 'discounts' ? <DiscountTable items={items} isLoading={isLoading} onEdit={setModalItem} onStatus={toggleStatus} onDelete={deletePolicy} /> : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface-variant">
            Trang {pagination.page} / {pagination.totalPages} - {pagination.total} chính sách
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40">
              Trước
            </button>
            <button type="button" disabled={filters.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40">
              Tiếp
            </button>
          </div>
        </div>
      </section>

      {(isCreateOpen || modalItem) ? (
        <PolicyModal tab={activeTab} item={modalItem} isSaving={isSaving} onClose={() => { setIsCreateOpen(false); setModalItem(null); }} onSubmit={savePolicy} />
      ) : null}
    </AdminPromotionShell>
  );
};

const TableActions = ({ item, onEdit, onStatus, onDelete }) => (
  <div className="flex justify-end gap-2">
    <button type="button" title="Edit" onClick={() => onEdit(item)} className="rounded-full p-2 text-primary hover:bg-surface-container">
      <Pencil className="h-4 w-4" />
    </button>
    <button type="button" title="Activate or deactivate" onClick={() => onStatus(item)} className="rounded-full p-2 text-primary hover:bg-surface-container">
      <Power className="h-4 w-4" />
    </button>
    <button type="button" title="Deactivate" onClick={() => onDelete(item)} className="rounded-full p-2 text-error hover:bg-error-container">
      <Trash2 className="h-4 w-4" />
    </button>
  </div>
);

const StatusBadge = ({ status }) => (
  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClassName[status] || statusClassName.INACTIVE}`}>
    {status}
  </span>
);

const EmptyRow = ({ isLoading, colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="px-5 py-10 text-center text-on-surface-variant">
      {isLoading ? 'Đang tải chính sách...' : 'Chưa có chính sách phù hợp.'}
    </td>
  </tr>
);

const FareMatrixTable = ({ items, isLoading, onEdit, onStatus, onDelete }) => (
  <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
    <thead className="bg-surface-container-high text-xs uppercase tracking-[0.14em] text-outline">
      <tr>
        <th className="px-5 py-4">Phạm vi áp dụng</th>
        <th className="px-5 py-4">Loại giá</th>
        <th className="px-5 py-4">Khoảng cách</th>
        <th className="px-5 py-4 text-right">Giá vé</th>
        <th className="px-5 py-4">Thời gian hiệu lực</th>
        <th className="px-5 py-4">Trạng thái</th>
        <th className="px-5 py-4 text-right">Thao tác</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-outline-variant/20">
      {items.length ? items.map((item) => (
        <tr key={item._id} className="hover:bg-surface-container-low/70">
          <td className="px-5 py-4 font-bold text-primary">{routeLabel(item)}</td>
          <td className="px-5 py-4">{item.pricingType}</td>
          <td className="px-5 py-4 text-on-surface-variant">{item.pricingType === 'DISTANCE_BASED' ? `${item.minDistanceKm ?? 0} - ${item.maxDistanceKm ?? 'trở lên'} km` : 'Không áp dụng'}</td>
          <td className="px-5 py-4 text-right font-bold">{formatMoney(item.baseFare, item.currency)}</td>
          <td className="px-5 py-4 text-on-surface-variant">{formatDate(item.effectiveFrom)} đến {formatDate(item.effectiveTo)}</td>
          <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
          <td className="px-5 py-4"><TableActions item={item} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} /></td>
        </tr>
      )) : <EmptyRow isLoading={isLoading} colSpan={7} />}
    </tbody>
  </table>
);

const MonthlyTable = ({ items, isLoading, onEdit, onStatus, onDelete }) => (
  <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
    <thead className="bg-surface-container-high text-xs uppercase tracking-[0.14em] text-outline">
      <tr>
        <th className="px-5 py-4">Pass Type</th>
        <th className="px-5 py-4">Route</th>
        <th className="px-5 py-4 text-right">Price</th>
        <th className="px-5 py-4">Validity Days</th>
        <th className="px-5 py-4">Effective Date</th>
        <th className="px-5 py-4">Status</th>
        <th className="px-5 py-4 text-right">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-outline-variant/20">
      {items.length ? items.map((item) => (
        <tr key={item._id} className="hover:bg-surface-container-low/70">
          <td className="px-5 py-4 font-bold text-primary">{item.passType}</td>
          <td className="px-5 py-4">{routeLabel(item)}</td>
          <td className="px-5 py-4 text-right font-bold">{formatMoney(item.price, item.currency)}</td>
          <td className="px-5 py-4">{item.validityDays} days</td>
          <td className="px-5 py-4 text-on-surface-variant">{formatDate(item.effectiveFrom)} to {formatDate(item.effectiveTo)}</td>
          <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
          <td className="px-5 py-4"><TableActions item={item} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} /></td>
        </tr>
      )) : <EmptyRow isLoading={isLoading} colSpan={7} />}
    </tbody>
  </table>
);

const DiscountTable = ({ items, isLoading, onEdit, onStatus, onDelete }) => (
  <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
    <thead className="bg-surface-container-high text-xs uppercase tracking-[0.14em] text-outline">
      <tr>
        <th className="px-5 py-4">Priority Type</th>
        <th className="px-5 py-4">Discount Percent</th>
        <th className="px-5 py-4">Max Discount</th>
        <th className="px-5 py-4">Effective Date</th>
        <th className="px-5 py-4">Approval</th>
        <th className="px-5 py-4">Status</th>
        <th className="px-5 py-4 text-right">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-outline-variant/20">
      {items.length ? items.map((item) => (
        <tr key={item._id} className="hover:bg-surface-container-low/70">
          <td className="px-5 py-4 font-bold text-primary">{item.priorityType}</td>
          <td className="px-5 py-4">{item.discountPercent}%</td>
          <td className="px-5 py-4">{item.maxDiscountAmount ? formatMoney(item.maxDiscountAmount) : 'No cap'}</td>
          <td className="px-5 py-4 text-on-surface-variant">{formatDate(item.effectiveFrom)} to {formatDate(item.effectiveTo)}</td>
          <td className="px-5 py-4">{item.requiredApproval ? 'Required' : 'Not required'}</td>
          <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
          <td className="px-5 py-4"><TableActions item={item} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} /></td>
        </tr>
      )) : <EmptyRow isLoading={isLoading} colSpan={7} />}
    </tbody>
  </table>
);

export default FareOperationsPage;
