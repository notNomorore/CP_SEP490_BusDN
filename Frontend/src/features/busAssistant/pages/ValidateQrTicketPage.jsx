import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, ScanLine, VideoOff } from 'lucide-react';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import useTheme from '../../../shared/hooks/useTheme.js';
import { getBusAssistantText, translateBusAssistantError } from '../busAssistantI18n.js';
import busAssistantService from '../services/busAssistantService.js';
import { Alert, Field, Panel, inputClass, money } from './shared.jsx';

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return 'N/A';
  }
};

const getDisplayTicket = (result) => result?.ticketInfo || {
  ticketCode: result?.ticketCode || result?.passCode || '',
  ticketType: result?.ticketType || '',
  status: result?.status || result?.result || '',
  routeCode: result?.routeCode || result?.routeNumber || '',
  validFrom: result?.validFrom,
  validUntil: result?.validUntil,
  usedAt: result?.usedAt,
};

const getDisplayPassenger = (result) => result?.passengerInfo || {
  fullName: result?.passengerName || '',
};

const getDisplayRoute = (result) => result?.routeInfo || {
  name: result?.routeName || result?.routeCode || result?.routeNumber || '',
  routeCode: result?.routeCode || result?.routeNumber || '',
};

const getValidationStatus = (result) => (
  result?.validationStatus || result?.result || result?.status || 'UNKNOWN'
);

const isValidResult = (result) => result?.ok || getValidationStatus(result) === 'VALID' || getValidationStatus(result) === 'VALIDATED';

const waitForNextFrame = () => new Promise((resolve) => {
  window.requestAnimationFrame(() => resolve());
});

const loadQrReader = async () => {
  const { BrowserQRCodeReader } = await import('@zxing/browser');
  return BrowserQRCodeReader;
};

const DetailItem = ({ label, value, strong = false }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={isDarkMode ? 'rounded border border-white/10 bg-white/[0.04] px-3 py-2' : 'rounded border border-slate-200 bg-slate-50 px-3 py-2'}>
      <p className={isDarkMode ? 'text-[11px] font-semibold uppercase tracking-wide text-slate-400' : 'text-[11px] font-semibold uppercase tracking-wide text-slate-500'}>{label}</p>
      <p className={`mt-1 break-words text-sm ${strong ? 'font-bold text-emerald-500' : isDarkMode ? 'font-semibold text-slate-100' : 'font-semibold text-slate-900'}`}>
        {value || 'N/A'}
      </p>
    </div>
  );
};

const ValidateQrTicketPage = () => {
  const { language } = useLanguage();
  const { isDarkMode } = useTheme();
  const t = getBusAssistantText(language);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const scanControlsRef = useRef(null);
  const [form, setForm] = useState({ qrCode: '', ticketCode: '' });
  const [recent, setRecent] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');

  const stopCamera = useCallback(() => {
    if (scanControlsRef.current) {
      scanControlsRef.current.stop();
      scanControlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const getScanner = useCallback(async () => {
    if (scannerRef.current) return scannerRef.current;

    const BrowserQRCodeReader = await loadQrReader();
    scannerRef.current = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 250,
      delayBetweenScanSuccess: 500,
    });
    return scannerRef.current;
  }, []);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const validatePayload = useCallback(async (payload) => {
    const qrCode = String(payload.qrCode || payload.ticketCode || '').trim();
    if (!qrCode) {
      setError('Ticket code is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await busAssistantService.validateETicket({ qrCode });
      setResult(data);
      setRecent((items) => [data, ...items].slice(0, 6));
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Invalid QR code'));
    } finally {
      setLoading(false);
    }
  }, [language]);

  const handleDetectedQr = useCallback((qrCode) => {
    const nextForm = { ...form, qrCode, ticketCode: '' };
    setForm(nextForm);
    setCameraMessage(t.qrDetected);
    setError('');
    stopCamera();
    validatePayload(nextForm);
  }, [form, stopCamera, t.qrDetected, validatePayload]);

  const startCamera = async () => {
    setError('');
    setCameraMessage('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t.cameraUnsupported);
      return;
    }

    setCameraLoading(true);
    try {
      setCameraActive(true);
      await waitForNextFrame();

      if (!videoRef.current) {
        throw new Error(t.cameraUnsupported);
      }

      const reader = await getScanner();
      scanControlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (scanResult, scanError, controls) => {
          if (scanResult) {
            controls.stop();
            scanControlsRef.current = null;
            handleDetectedQr(scanResult.getText());
          } else if (scanError?.name && !['NotFoundException', 'ChecksumException', 'FormatException'].includes(scanError.name)) {
            setCameraMessage(scanError.message || '');
          }
        }
      );
    } catch (err) {
      setError(err?.message || t.cameraPermissionDenied);
      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  };

  const handleQrImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setCameraMessage('');

    try {
      const imageUrl = URL.createObjectURL(file);
      try {
        const reader = await getScanner();
        const decoded = await reader.decodeFromImageUrl(imageUrl);
        const qrCode = decoded?.getText?.() || '';

        if (!qrCode) {
          setError(t.noQrInImage);
          return;
        }

        const nextForm = { ...form, qrCode, ticketCode: '' };
        setForm(nextForm);
        setCameraMessage(t.qrDetected);
        validatePayload(nextForm);
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (err) {
      setError(err.message || t.noQrInImage);
    } finally {
      event.target.value = '';
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    validatePayload({ qrCode: form.ticketCode || form.qrCode });
  };

  const displayTicket = getDisplayTicket(result);
  const displayPassenger = getDisplayPassenger(result);
  const displayRoute = getDisplayRoute(result);
  const validationStatus = getValidationStatus(result);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(560px,0.95fr)_minmax(420px,1.05fr)]">
      <Panel title={t.validateQrTicket}>
        <form onSubmit={submit} className="space-y-5">
          <div className="flex justify-center">
            <div className={isDarkMode
              ? 'relative aspect-square w-full max-w-[620px] overflow-hidden rounded border border-emerald-300/50 bg-slate-950 text-center shadow-2xl shadow-emerald-950/30'
              : 'relative aspect-square w-full max-w-[620px] overflow-hidden rounded border border-emerald-300 bg-emerald-50/70 text-center shadow-xl shadow-emerald-100'}
            >
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    aria-label={t.cameraScannerArea}
                  />
                  <div className="pointer-events-none absolute inset-[12%] rounded border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(2,6,23,0.28)]" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-2/3 -translate-x-1/2 bg-emerald-300/80" />
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute right-3 top-3 inline-flex items-center gap-2 rounded bg-slate-950/85 px-3 py-2 text-sm font-semibold text-white"
                  >
                    <VideoOff size={16} />
                    {t.stopCamera}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="grid h-full w-full place-items-center text-center"
                  disabled={cameraLoading}
                >
                  <span>
                    <Camera className={isDarkMode ? 'mx-auto text-emerald-300' : 'mx-auto text-emerald-500'} size={64} />
                    <span className={isDarkMode ? 'mt-4 block text-base font-semibold text-slate-100' : 'mt-4 block text-base font-semibold text-slate-700'}>{t.cameraScannerArea}</span>
                    <span className="mt-4 inline-flex rounded bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950">
                      {cameraLoading ? t.cameraStarting : t.startCamera}
                    </span>
                  </span>
                </button>
              )}
            </div>
          </div>
          {cameraMessage ? <Alert type="success">{cameraMessage}</Alert> : null}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Field label="Ticket code">
              <input
                className={inputClass}
                value={form.ticketCode}
                onChange={update('ticketCode')}
                placeholder="Nhap ma ve, vi du TKT-F7BB16"
              />
            </Field>
            <button className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded bg-emerald-400 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading}>
              <ScanLine size={16} />
              {loading ? t.validating : t.validateTicket}
            </button>
            <Field label={t.uploadQrImage}>
              <label className={isDarkMode
                ? 'flex h-11 cursor-pointer items-center justify-center gap-2 rounded border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-200 hover:border-emerald-300/50'
                : 'flex h-11 cursor-pointer items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-emerald-400'}
              >
                <ImageUp size={16} />
                <span>{t.chooseFile}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleQrImageUpload} />
              </label>
            </Field>
          </div>
          {error ? <Alert type="error">{error}</Alert> : null}
        </form>
      </Panel>

      <div className="space-y-5">
        <Panel title={t.validationResult}>
          {result ? (
            <div className="space-y-3 text-sm">
              <Alert type={isValidResult(result) ? 'success' : 'error'}>{result.message}</Alert>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label={t.status} value={validationStatus} strong />
                <DetailItem label={t.ticket} value={displayTicket.ticketCode || displayTicket.passCode || displayTicket._id} strong />
                <DetailItem label={t.passenger} value={displayPassenger.fullName || result.passengerName} />
                <DetailItem label={t.route} value={displayRoute.name || displayRoute.routeCode || displayTicket.routeCode} />
                <DetailItem label="From" value={displayTicket.departureLocation || displayTicket.fromStop} />
                <DetailItem label="To" value={displayTicket.destinationLocation || displayTicket.toStop} />
                <DetailItem label="Ticket type" value={displayTicket.ticketType || result.ticketType} />
                <DetailItem label="Fare" value={displayTicket.amount || displayTicket.ticketPrice ? money(displayTicket.amount || displayTicket.ticketPrice) : 'N/A'} />
                <DetailItem label="Valid from" value={formatDateTime(displayTicket.validFrom || result.validFrom)} />
                <DetailItem label="Valid until" value={formatDateTime(displayTicket.validUntil || result.validUntil)} />
                <DetailItem label="Scanned at" value={formatDateTime(displayTicket.usedAt || result.usedAt)} />
                <DetailItem label="Trip" value={displayTicket.tripId || result.tripId} />
              </div>
            </div>
          ) : <p className="text-sm text-slate-400">{t.noValidationYet}</p>}
        </Panel>
        <Panel title={t.recentValidations}>
          <div className="space-y-2">
            {recent.length ? recent.map((item, index) => (
              <div key={`${getDisplayTicket(item).ticketCode || getDisplayTicket(item)._id || index}-${index}`} className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <p className="font-medium">{getDisplayTicket(item).ticketCode || getDisplayTicket(item).passCode || getDisplayTicket(item)._id}</p>
                <p className="text-slate-400">{getDisplayPassenger(item).fullName || item.passengerName || t.passengerFallback} - {getValidationStatus(item)}</p>
              </div>
            )) : <p className="text-sm text-slate-400">{t.noRecentValidations}</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default ValidateQrTicketPage;
