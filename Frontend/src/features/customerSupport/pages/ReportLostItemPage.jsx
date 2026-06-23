import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  FileImage,
  LoaderCircle,
  MapPin,
  PackageSearch,
  RotateCcw,
  Send,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import customerSupportService, { LOST_ITEM_CATEGORIES } from '../services/customerSupportService.js';
import travelHistoryService from '../../travelHistory/services/travelHistoryService.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-semibold text-primary outline-none focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const initialForm = {
  itemName: '',
  itemCategory: 'PERSONAL_BELONGINGS',
  itemDescription: '',
  relatedTripId: '',
  routeName: '',
  lostAt: '',
  lastSeenLocation: '',
  contactPhone: '',
  contactEmail: '',
};

const formatTripLabel = (record) => {
  const date = record.travelDate ? format(new Date(record.travelDate), 'dd MMM yyyy') : 'Travel date';
  return `${record.routeNumber} - ${record.boardingStop} to ${record.destinationStop} (${date})`;
};

const getErrorMessage = (error) => {
  if (!error) return 'Unable to submit lost item report. Please try again later.';
  if (typeof error === 'string') return error;
  if (error.errors && typeof error.errors === 'object') return Object.values(error.errors).join(' ');
  return error.message || 'Unable to submit lost item report. Please try again later.';
};

const ReportLostItemPage = () => {
  const [form, setForm] = useState(initialForm);
  const [attachments, setAttachments] = useState([]);
  const [travelRecords, setTravelRecords] = useState([]);
  const [errors, setErrors] = useState({});
  const [submittedCase, setSubmittedCase] = useState(null);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadTrips = async () => {
      setIsLoadingTrips(true);

      try {
        const payload = await travelHistoryService.getTravelHistory();
        setTravelRecords(payload.records || []);
      } catch {
        setTravelRecords([]);
      } finally {
        setIsLoadingTrips(false);
      }
    };

    loadTrips();
  }, []);

  const selectedTrip = useMemo(() => travelRecords.find((record) => (
    record.tripId === form.relatedTripId || record.ticketId === form.relatedTripId
  )), [form.relatedTripId, travelRecords]);

  const validateForm = () => {
    const nextErrors = {};

    if (!form.itemName.trim()) nextErrors.itemName = 'Item name is required.';
    if (!form.itemDescription.trim() || form.itemDescription.trim().length < 10) {
      nextErrors.itemDescription = 'Item description must contain at least 10 characters.';
    }
    if (!LOST_ITEM_CATEGORIES.some((category) => category.value === form.itemCategory)) {
      nextErrors.itemCategory = 'Please select a valid item category.';
    }
    if (!form.lostAt) nextErrors.lostAt = 'Estimated lost date and time is required.';
    if (!form.lastSeenLocation.trim()) nextErrors.lastSeenLocation = 'Estimated lost location is required.';
    if (!form.contactPhone.trim() && !form.contactEmail.trim()) {
      nextErrors.contact = 'Contact phone or contact email is required.';
    }
    if (attachments.length > 5) nextErrors.attachments = 'You can upload up to 5 supporting images.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleTripChange = (event) => {
    const relatedTripId = event.target.value;
    const trip = travelRecords.find((record) => (
      record.tripId === relatedTripId || record.ticketId === relatedTripId
    ));

    setForm((current) => ({
      ...current,
      relatedTripId,
      routeName: trip ? `${trip.routeNumber} - ${trip.routeName}` : current.routeName,
      lastSeenLocation: trip ? `${trip.boardingStop} to ${trip.destinationStop}` : current.lastSeenLocation,
    }));
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/jpg', 'image/webp']);
    const validFiles = files.filter((file) => allowedTypes.has(file.type) && file.size <= 5 * 1024 * 1024);

    setAttachments(validFiles.slice(0, 5));
    if (validFiles.length !== files.length) {
      setErrors((current) => ({
        ...current,
        attachments: 'Some files were rejected. Supported images: JPG, PNG, WEBP up to 5 MB.',
      }));
    } else {
      setErrors((current) => ({ ...current, attachments: '' }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmittedCase(null);

    try {
      const response = await customerSupportService.submitLostItem({
        type: 'LOST_ITEM',
        title: `Lost item: ${form.itemName.trim()}`,
        description: form.itemDescription.trim(),
        category: 'LOST_ITEM',
        relatedTripId: form.relatedTripId,
        tripCode: selectedTrip?.tripId || form.relatedTripId,
        routeName: form.routeName.trim(),
        incidentAt: form.lostAt,
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
        priority: 'NORMAL',
        lostItem: {
          itemName: form.itemName.trim(),
          itemCategory: form.itemCategory,
          itemDescription: form.itemDescription.trim(),
          lastSeenLocation: form.lastSeenLocation.trim(),
          lostAt: form.lostAt,
        },
        attachments,
      });

      setSubmittedCase(response.data);
      toast.success(response.message || 'Lost item report submitted successfully');
      setForm(initialForm);
      setAttachments([]);
      setErrors({});
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setForm(initialForm);
    setAttachments([]);
    setErrors({});
    setSubmittedCase(null);
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-4 border-b border-outline-variant/40 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Customer Service</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Report Lost Item</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Report belongings lost during trips so administrators can review and track recovery cases.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-fixed px-4 py-2 text-sm font-black text-on-primary-fixed">
              <PackageSearch className="h-4 w-4" />
              Lost item case
            </div>
          </div>

          {submittedCase ? (
            <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-black">Lost item report submitted successfully</p>
                  <p className="mt-1">Case number: <strong>{submittedCase.referenceNumber}</strong></p>
                  <p>Status: {submittedCase.status} - Recovery: {submittedCase.lostItem?.recoveryStatus}</p>
                </div>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_340px]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-primary">Item name</span>
                  <input
                    value={form.itemName}
                    onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))}
                    className={fieldClassName}
                    placeholder="Wallet, phone, backpack..."
                  />
                  {errors.itemName ? <p className="text-sm font-semibold text-red-700">{errors.itemName}</p> : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-primary">Item category</span>
                  <select
                    value={form.itemCategory}
                    onChange={(event) => setForm((current) => ({ ...current, itemCategory: event.target.value }))}
                    className={fieldClassName}
                  >
                    {LOST_ITEM_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-black text-primary">Item description</span>
                <textarea
                  value={form.itemDescription}
                  onChange={(event) => setForm((current) => ({ ...current, itemDescription: event.target.value }))}
                  className={`${fieldClassName} min-h-32 resize-y`}
                  placeholder="Describe color, brand, size, marks, contents, or any detail that helps identify the item."
                />
                {errors.itemDescription ? <p className="text-sm font-semibold text-red-700">{errors.itemDescription}</p> : null}
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-primary">Related trip</span>
                  <select value={form.relatedTripId} onChange={handleTripChange} className={fieldClassName} disabled={isLoadingTrips}>
                    <option value="">No related trip</option>
                    {travelRecords.map((record) => (
                      <option key={record.id} value={record.tripId || record.ticketId}>{formatTripLabel(record)}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-primary">Route information</span>
                  <input
                    value={form.routeName}
                    onChange={(event) => setForm((current) => ({ ...current, routeName: event.target.value }))}
                    className={fieldClassName}
                    placeholder="DN10 - Han Market to Tien Sa Port"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-primary">Estimated lost date and time</span>
                  <input
                    type="datetime-local"
                    value={form.lostAt}
                    onChange={(event) => setForm((current) => ({ ...current, lostAt: event.target.value }))}
                    className={fieldClassName}
                  />
                  {errors.lostAt ? <p className="text-sm font-semibold text-red-700">{errors.lostAt}</p> : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-primary">Estimated lost location</span>
                  <input
                    value={form.lastSeenLocation}
                    onChange={(event) => setForm((current) => ({ ...current, lastSeenLocation: event.target.value }))}
                    className={fieldClassName}
                    placeholder="Bus, stop, route segment, or seat area"
                  />
                  {errors.lastSeenLocation ? <p className="text-sm font-semibold text-red-700">{errors.lastSeenLocation}</p> : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-primary">Contact phone</span>
                  <input
                    value={form.contactPhone}
                    onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                    className={fieldClassName}
                    placeholder="Phone number"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-primary">Contact email</span>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                    className={fieldClassName}
                    placeholder="Email address"
                  />
                </label>
              </div>
              {errors.contact ? <p className="text-sm font-semibold text-red-700">{errors.contact}</p> : null}
            </div>

            <aside className="space-y-5">
              <label className="space-y-2">
                <span className="text-sm font-black text-primary">Supporting images</span>
                <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-6">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <FileImage className="h-8 w-8 text-on-tertiary-container" />
                    <input type="file" multiple accept=".jpg,.jpeg,.png,.webp" onChange={handleFileChange} className="max-w-full text-sm text-on-surface-variant" />
                    <p className="text-xs text-on-surface-variant">Up to 5 images. JPG, PNG, WEBP.</p>
                  </div>
                </div>
                {attachments.length ? (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file) => (
                      <span key={`${file.name}-${file.size}`} className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed">
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                {errors.attachments ? <p className="text-sm font-semibold text-red-700">{errors.attachments}</p> : null}
              </label>

              <div className="rounded-[24px] border border-outline-variant/40 bg-primary-fixed p-5 text-on-primary-fixed">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <MapPin className="h-5 w-5" />
                  Report policy
                </h2>
                <div className="mt-4 space-y-3 text-sm">
                  <p>Required lost item fields must be completed before submission.</p>
                  <p>Related trip must belong to your passenger account when selected.</p>
                  <p>A unique case number is generated after successful submission.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
                <button type="button" onClick={handleCancel} className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant px-5 py-3 text-sm font-black text-primary hover:bg-surface">
                  <RotateCcw className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </aside>
          </form>
        </section>
      </main>
    </div>
  );
};

export default ReportLostItemPage;
