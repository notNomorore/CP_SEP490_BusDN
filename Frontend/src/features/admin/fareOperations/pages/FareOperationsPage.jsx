import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
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
  { key: 'matrix', label: 'Fare Matrix', icon: Grid2X2 },
  { key: 'monthly', label: 'Monthly Pass Pricing', icon: CreditCard },
  { key: 'discounts', label: 'Priority Discounts', icon: Percent },
];

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
  if (item.passType === 'NETWORK_PASS' || item.pricingType === 'DEFAULT') return 'All routes';
  return item.routeId?.routeNumber || item.routeCode || item.routeName || item.routeId || 'Route required';
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
    return {
      ...values,
      routeId: values.pricingType === 'ROUTE_BASED' ? values.routeId : null,
      baseFare: normalizeNumber(values.baseFare),
      minDistanceKm: normalizeNumber(values.minDistanceKm),
      maxDistanceKm: normalizeNumber(values.maxDistanceKm),
      routeName: values.routeName.trim(),
      routeCode: values.routeCode.trim(),
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
              {item ? 'Edit policy' : 'Create policy'}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Changes apply to future purchases and do not recalculate existing tickets or passes.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {tab === 'matrix' ? (
            <>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Pricing type</span>
                <select value={values.pricingType} onChange={(event) => updateValue('pricingType', event.target.value)} className={fieldClassName}>
                  <option value="DEFAULT">Default</option>
                  <option value="ROUTE_BASED">Route based</option>
                  <option value="DISTANCE_BASED">Distance based</option>
                </select>
              </label>
              <NumberField label="Base fare" value={values.baseFare} error={errors.baseFare} onChange={(value) => updateValue('baseFare', value)} />
              <RouteFields values={values} errors={errors} updateValue={updateValue} disabled={values.pricingType !== 'ROUTE_BASED'} />
              <NumberField label="Min distance km" value={values.minDistanceKm} onChange={(value) => updateValue('minDistanceKm', value)} />
              <NumberField label="Max distance km" value={values.maxDistanceKm} error={errors.maxDistanceKm} onChange={(value) => updateValue('maxDistanceKm', value)} />
            </>
          ) : null}

          {tab === 'monthly' ? (
            <>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Pass type</span>
                <select value={values.passType} onChange={(event) => updateValue('passType', event.target.value)} className={fieldClassName}>
                  <option value="NETWORK_PASS">Network pass</option>
                  <option value="ROUTE_PASS">Route pass</option>
                </select>
              </label>
              <NumberField label="Price" value={values.price} error={errors.price} onChange={(value) => updateValue('price', value)} />
              <NumberField label="Validity days" value={values.validityDays} onChange={(value) => updateValue('validityDays', value)} />
              <RouteFields values={values} errors={errors} updateValue={updateValue} disabled={values.passType !== 'ROUTE_PASS'} />
            </>
          ) : null}

          {tab === 'discounts' ? (
            <>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Priority type</span>
                <select value={values.priorityType} onChange={(event) => updateValue('priorityType', event.target.value)} className={fieldClassName}>
                  <option value="STUDENT">Student</option>
                  <option value="ELDERLY">Elderly</option>
                  <option value="DISABILITY">Disability</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <NumberField label="Discount percent" value={values.discountPercent} error={errors.discountPercent} onChange={(value) => updateValue('discountPercent', value)} />
              <NumberField label="Max discount amount" value={values.maxDiscountAmount} onChange={(value) => updateValue('maxDiscountAmount', value)} />
              <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3">
                <input type="checkbox" checked={values.requiredApproval} onChange={(event) => updateValue('requiredApproval', event.target.checked)} />
                <span className="text-sm font-semibold">Require approved priority profile</span>
              </label>
            </>
          ) : null}

          <label className="space-y-2">
            <span className="text-sm font-semibold">Effective from</span>
            <input type="date" value={values.effectiveFrom} onChange={(event) => updateValue('effectiveFrom', event.target.value)} className={fieldClassName} />
            {errors.effectiveFrom ? <span className="text-sm text-error">{errors.effectiveFrom}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Effective to</span>
            <input type="date" value={values.effectiveTo} onChange={(event) => updateValue('effectiveTo', event.target.value)} className={fieldClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Currency</span>
            <input value={values.currency || 'VND'} onChange={(event) => updateValue('currency', event.target.value.toUpperCase())} className={fieldClassName} disabled={tab === 'discounts'} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Status</span>
            <select value={values.status} onChange={(event) => updateValue('status', event.target.value)} className={fieldClassName}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold">Note</span>
            <textarea value={values.note} onChange={(event) => updateValue('note', event.target.value)} className={`${fieldClassName} min-h-[90px] resize-none`} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-outline-variant/60 px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:opacity-60">
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Save policy
          </button>
        </div>
      </form>
    </div>
  );
};

const NumberField = ({ label, value, error, onChange }) => (
  <label className="space-y-2">
    <span className="text-sm font-semibold">{label}</span>
    <input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} className={fieldClassName} />
    {error ? <span className="text-sm text-error">{error}</span> : null}
  </label>
);

const RouteFields = ({ values, errors, updateValue, disabled }) => (
  <>
    <label className="space-y-2">
      <span className="text-sm font-semibold">Route ID</span>
      <input value={values.routeId} disabled={disabled} onChange={(event) => updateValue('routeId', event.target.value)} className={fieldClassName} placeholder="Mongo route ObjectId" />
      {errors.routeId ? <span className="text-sm text-error">{errors.routeId}</span> : null}
    </label>
    <label className="space-y-2">
      <span className="text-sm font-semibold">Route code</span>
      <input value={values.routeCode} disabled={disabled} onChange={(event) => updateValue('routeCode', event.target.value)} className={fieldClassName} placeholder="R01" />
    </label>
    <label className="space-y-2 md:col-span-2">
      <span className="text-sm font-semibold">Route name</span>
      <input value={values.routeName} disabled={disabled} onChange={(event) => updateValue('routeName', event.target.value)} className={fieldClassName} placeholder="City Center" />
    </label>
  </>
);

const FareOperationsPage = () => {
  const [activeTab, setActiveTab] = useState('matrix');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', status: '', page: 1, limit: 20 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  return (
    <AdminPromotionShell
      title="Fare Operations"
      subtitle="Manage ticket fares, monthly pass pricing, and approved priority discount policies."
      action={(
        <button type="button" onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container">
          <Plus className="h-4 w-4" />
          Add New Policy
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

        <div className="flex flex-col gap-3 border-b border-outline-variant/30 bg-surface-container-low/40 p-5 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} className={`${fieldClassName} pl-11`} placeholder="Search route or policy note" />
          </label>
          <div className="flex items-center gap-3">
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className={fieldClassName}>
              <option value="">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <span className="whitespace-nowrap text-sm text-on-surface-variant">
              Showing <strong className="text-on-surface">{items.length}</strong> results
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
            Page {pagination.page} of {pagination.totalPages} - {pagination.total} policies
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={filters.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-bold text-primary disabled:opacity-40">
              Next
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
      {isLoading ? 'Loading policies...' : 'No policies found.'}
    </td>
  </tr>
);

const FareMatrixTable = ({ items, isLoading, onEdit, onStatus, onDelete }) => (
  <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
    <thead className="bg-surface-container-high text-xs uppercase tracking-[0.14em] text-outline">
      <tr>
        <th className="px-5 py-4">Route</th>
        <th className="px-5 py-4">Pricing Type</th>
        <th className="px-5 py-4">Distance Range</th>
        <th className="px-5 py-4 text-right">Base Fare</th>
        <th className="px-5 py-4">Effective Date</th>
        <th className="px-5 py-4">Status</th>
        <th className="px-5 py-4 text-right">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-outline-variant/20">
      {items.length ? items.map((item) => (
        <tr key={item._id} className="hover:bg-surface-container-low/70">
          <td className="px-5 py-4 font-bold text-primary">{routeLabel(item)}</td>
          <td className="px-5 py-4">{item.pricingType}</td>
          <td className="px-5 py-4 text-on-surface-variant">{item.pricingType === 'DISTANCE_BASED' ? `${item.minDistanceKm ?? 0} - ${item.maxDistanceKm ?? 'above'} km` : 'N/A'}</td>
          <td className="px-5 py-4 text-right font-bold">{formatMoney(item.baseFare, item.currency)}</td>
          <td className="px-5 py-4 text-on-surface-variant">{formatDate(item.effectiveFrom)} to {formatDate(item.effectiveTo)}</td>
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
