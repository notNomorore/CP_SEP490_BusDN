import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  FileUp,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  Send,
  Star,
  X,
} from 'lucide-react';
import Header from '../../../shared/components/navigation/Header.jsx';
import customerSupportService, { FEEDBACK_CATEGORIES } from '../services/customerSupportService.js';
import travelHistoryService from '../../travelHistory/services/travelHistoryService.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-semibold text-primary outline-none focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const initialForm = {
  category: 'SERVICE_QUALITY',
  title: '',
  description: '',
  relatedTripId: '',
  ratingScore: '',
};

const formatTripLabel = (record) => {
  const date = record.travelDate ? format(new Date(record.travelDate), 'dd MMM yyyy') : 'Travel date';
  return `${record.routeNumber} - ${record.boardingStop} to ${record.destinationStop} (${date})`;
};

const getErrorMessage = (error) => {
  if (!error) return 'Unable to submit feedback. Please try again later.';
  if (typeof error === 'string') return error;
  if (error.errors && typeof error.errors === 'object') return Object.values(error.errors).join(' ');
  return error.message || 'Unable to submit feedback. Please try again later.';
};

const SubmitFeedbackPage = () => {
  const [form, setForm] = useState(initialForm);
  const [attachments, setAttachments] = useState([]);
  const [travelRecords, setTravelRecords] = useState([]);
  const [errors, setErrors] = useState({});
  const [submittedFeedback, setSubmittedFeedback] = useState(null);
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

    if (!FEEDBACK_CATEGORIES.some((category) => category.value === form.category)) {
      nextErrors.category = 'Please select a valid feedback category.';
    }
    if (!form.title.trim()) {
      nextErrors.title = 'Feedback title is required.';
    }
    if (!form.description.trim()) {
      nextErrors.description = 'Feedback description is required.';
    } else if (form.description.trim().length < 20) {
      nextErrors.description = 'Feedback description must contain at least 20 characters.';
    }
    if (form.ratingScore && (Number(form.ratingScore) < 1 || Number(form.ratingScore) > 5)) {
      nextErrors.ratingScore = 'Rating must be between 1 and 5.';
    }
    if (attachments.length > 5) {
      nextErrors.attachments = 'You can upload up to 5 supporting files.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    const validFiles = files.filter((file) => allowedTypes.has(file.type) && file.size <= 5 * 1024 * 1024);

    setAttachments(validFiles.slice(0, 5));
    if (validFiles.length !== files.length) {
      setErrors((current) => ({
        ...current,
        attachments: 'Some files were rejected. Supported files: JPG, PNG, WEBP, PDF, DOC, DOCX up to 5 MB.',
      }));
    } else {
      setErrors((current) => ({ ...current, attachments: '' }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmittedFeedback(null);

    try {
      const response = await customerSupportService.submitFeedback({
        type: 'SERVICE_FEEDBACK',
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim(),
        relatedTripId: form.relatedTripId,
        tripCode: selectedTrip?.tripId || form.relatedTripId,
        routeName: selectedTrip ? `${selectedTrip.routeNumber} - ${selectedTrip.routeName}` : '',
        ratingScore: form.ratingScore,
        priority: form.category === 'COMPLAINT' ? 'HIGH' : 'NORMAL',
        attachments,
      });

      setSubmittedFeedback(response.data);
      toast.success(response.message || 'Feedback submitted successfully');
      setForm(initialForm);
      setAttachments([]);
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
    setSubmittedFeedback(null);
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-primary/5">
          <div className="flex flex-col gap-4 border-b border-outline-variant/40 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-on-tertiary-container">Customer Service</p>
              <h1 className="mt-2 text-3xl font-headline font-black text-primary">Submit Service Feedback</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Send ratings, suggestions, complaints, or service evaluations about your BusDN experience.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-fixed px-4 py-2 text-sm font-black text-on-primary-fixed">
              <MessageSquareText className="h-4 w-4" />
              Passenger feedback
            </div>
          </div>

          {submittedFeedback ? (
            <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-black">Feedback submitted successfully</p>
                  <p className="mt-1">Reference number: <strong>{submittedFeedback.referenceNumber}</strong></p>
                  <p>Status: {submittedFeedback.status}</p>
                </div>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_340px]">
            <div className="space-y-5">
              <label className="space-y-2">
                <span className="text-sm font-black text-primary">Feedback category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className={fieldClassName}
                >
                  {FEEDBACK_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
                {errors.category ? <p className="text-sm font-semibold text-red-700">{errors.category}</p> : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-primary">Feedback title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className={fieldClassName}
                  placeholder="Short title for your feedback"
                />
                {errors.title ? <p className="text-sm font-semibold text-red-700">{errors.title}</p> : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-primary">Feedback description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className={`${fieldClassName} min-h-40 resize-y`}
                  placeholder="Describe what happened, what worked well, or what should be improved..."
                />
                {errors.description ? <p className="text-sm font-semibold text-red-700">{errors.description}</p> : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-primary">Related trip</span>
                <select
                  value={form.relatedTripId}
                  onChange={(event) => setForm((current) => ({ ...current, relatedTripId: event.target.value }))}
                  className={fieldClassName}
                  disabled={isLoadingTrips}
                >
                  <option value="">No related trip</option>
                  {travelRecords.map((record) => (
                    <option key={record.id} value={record.tripId || record.ticketId}>
                      {formatTripLabel(record)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-primary">Supporting images or documents</span>
                <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-6">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <FileUp className="h-8 w-8 text-on-tertiary-container" />
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="max-w-full text-sm text-on-surface-variant"
                    />
                    <p className="text-xs text-on-surface-variant">Up to 5 files. JPG, PNG, WEBP, PDF, DOC, DOCX.</p>
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
            </div>

            <aside className="space-y-5">
              <div className="rounded-[24px] border border-outline-variant/40 bg-surface p-5">
                <h2 className="flex items-center gap-2 text-lg font-black text-primary">
                  <Star className="h-5 w-5" />
                  Service rating
                </h2>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, ratingScore: String(score) }))}
                      className={`rounded-2xl border px-3 py-3 text-sm font-black ${
                        Number(form.ratingScore) === score
                          ? 'border-on-tertiary-container bg-primary text-white'
                          : 'border-outline-variant bg-white text-primary hover:bg-primary-fixed'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                {errors.ratingScore ? <p className="mt-3 text-sm font-semibold text-red-700">{errors.ratingScore}</p> : null}
              </div>

              <div className="rounded-[24px] border border-outline-variant/40 bg-primary-fixed p-5 text-on-primary-fixed">
                <h2 className="text-lg font-black">Submission policy</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <p>Required fields must be completed before submitting.</p>
                  <p>Feedback is linked to your passenger account and forwarded to administrators.</p>
                  <p>A unique reference number is generated after successful submission.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-black text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant px-5 py-3 text-sm font-black text-primary hover:bg-surface"
                >
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

export default SubmitFeedbackPage;
