import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCcw, X } from 'lucide-react';
import toast from '../../../../shared/utils/toast.js';
import vehicleReassignmentService from '../services/vehicleReassignmentService.js';

const fieldClassName =
  'w-full rounded-xl border border-outline-variant/50 bg-surface px-3 py-2.5 text-sm text-on-surface focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const reasons = [
  ['breakdown', 'Breakdown'],
  ['maintenance_required', 'Maintenance required'],
  ['accident', 'Accident'],
  ['gps_device_failure', 'GPS device failure'],
  ['capacity_issue', 'Capacity issue'],
  ['manual_reassignment', 'Manual reassignment'],
  ['other', 'Other'],
];

const labelize = (value) => String(value || 'N/A').replaceAll('_', ' ');

const ReplacementVehicleModal = ({
  open,
  tripId,
  routeId,
  requiredCapacity,
  title = 'Assign Replacement Vehicle',
  onConfirm,
  onClose,
  onAssigned,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidateResponse, setCandidateResponse] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [reason, setReason] = useState('breakdown');
  const [note, setNote] = useState('');
  const [notifyStaff, setNotifyStaff] = useState(true);
  const [notifyPassengers, setNotifyPassengers] = useState(false);

  const candidates = useMemo(() => candidateResponse?.data?.candidates || [], [candidateResponse]);
  const message = candidateResponse?.data?.message || '';

  const loadCandidates = async () => {
    if (!tripId && !routeId) return;
    setLoading(true);
    try {
      const response = await vehicleReassignmentService.getCandidates({ tripId, routeId, requiredCapacity });
      setCandidateResponse(response);
      setSelectedVehicleId(response.data?.candidates?.[0]?.id || '');
    } catch (error) {
      toast.error(error.message || 'Unable to load replacement candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setCandidateResponse(null);
    setSelectedVehicleId('');
    setReason('breakdown');
    setNote('');
    setNotifyStaff(true);
    setNotifyPassengers(false);
    loadCandidates();
  }, [open, tripId, routeId, requiredCapacity]);

  if (!open) return null;

  const submit = async () => {
    if (!selectedVehicleId) {
      toast.error('Select an eligible replacement vehicle');
      return;
    }
    if (!note.trim()) {
      toast.error('Emergency replacement note is required');
      return;
    }

    const payload = {
      replacementVehicleId: selectedVehicleId,
      reason,
      note: note.trim(),
      notifyStaff,
      notifyPassengers,
    };

    setSaving(true);
    try {
      const response = onConfirm
        ? await onConfirm(payload)
        : await vehicleReassignmentService.assignReplacementVehicle(tripId, payload);
      toast.success('Replacement vehicle assigned');
      onAssigned?.(response.data, payload);
      onClose?.();
    } catch (error) {
      toast.error(error.message || 'Unable to assign replacement vehicle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">Emergency operations</p>
            <h3 className="mt-2 text-xl font-headline font-black text-primary">{title}</h3>
          </div>
          <button type="button" title="Close" onClick={onClose} className="rounded-full p-2 hover:bg-surface-container">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-sm text-on-surface-variant">
            Required capacity: <span className="font-black text-primary">{candidateResponse?.data?.requiredCapacity || requiredCapacity || 'N/A'}</span>
          </div>
          <button
            type="button"
            onClick={loadCandidates}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl border border-outline-variant/30">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-[0.12em] text-outline">
                <tr>
                  {['', 'Plate', 'Capacity', 'Status', 'Current assignment', 'Suitability'].map((heading) => (
                    <th key={heading} className="px-4 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {loading ? (
                  <tr><td colSpan="6" className="px-4 py-12 text-center text-on-surface-variant">Loading eligible vehicles...</td></tr>
                ) : candidates.length ? candidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    onClick={() => setSelectedVehicleId(candidate.id)}
                    className={`cursor-pointer ${selectedVehicleId === candidate.id ? 'bg-primary-fixed/60' : 'hover:bg-surface-container-low'}`}
                  >
                    <td className="px-4 py-4">
                      <input type="radio" checked={selectedVehicleId === candidate.id} onChange={() => setSelectedVehicleId(candidate.id)} />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-primary">{candidate.plateNumber || 'N/A'}</p>
                      <p className="text-xs text-on-surface-variant">{candidate.vehicleCode || candidate.busCode || candidate.source}</p>
                    </td>
                    <td className="px-4 py-4 font-bold text-primary">{candidate.capacity || 'N/A'}</td>
                    <td className="px-4 py-4 capitalize">{labelize(candidate.status)}</td>
                    <td className="px-4 py-4 text-on-surface-variant">
                      {candidate.currentAssignment?.scheduleCode || candidate.currentAssignment?.tripId || 'None'}
                    </td>
                    <td className="px-4 py-4 text-on-surface-variant">{candidate.suitabilityReason}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center">
                      <AlertTriangle className="mx-auto h-8 w-8 text-error" />
                      <p className="mt-2 font-black text-primary">No eligible replacement vehicles</p>
                      <p className="mx-auto mt-1 max-w-xl text-sm text-on-surface-variant">
                        {message || 'Check vehicle status, maintenance, capacity, and overlapping assignments.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Reason</span>
            <select value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClassName}>
              {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="space-y-3 rounded-2xl bg-surface-container-low p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <input type="checkbox" checked={notifyStaff} onChange={(event) => setNotifyStaff(event.target.checked)} />
              Notify driver and bus assistant
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <input type="checkbox" checked={notifyPassengers} onChange={(event) => setNotifyPassengers(event.target.checked)} />
              Notify affected passengers
            </label>
          </div>
        </section>

        <label className="mt-4 block space-y-2">
          <span className="text-sm font-semibold text-on-surface">Emergency note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={`${fieldClassName} min-h-[120px] resize-none`}
            placeholder="Describe why this replacement is needed and any operational instructions."
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border px-5 py-2.5 text-sm font-bold">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || loading || !candidates.length}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirm replacement
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplacementVehicleModal;
