import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, ScanLine, VideoOff } from 'lucide-react';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import useTheme from '../../../shared/hooks/useTheme.js';
import { getBusAssistantText, translateBusAssistantError } from '../busAssistantI18n.js';
import busAssistantService from '../services/busAssistantService.js';
import { Alert, Field, Panel, inputClass } from './shared.jsx';

const ValidateQrTicketPage = () => {
  const { language } = useLanguage();
  const { isDarkMode } = useTheme();
  const t = getBusAssistantText(language);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const [form, setForm] = useState({ qrCode: '', tripId: '', vehicleId: '' });
  const [recent, setRecent] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const readQrFromSource = useCallback(async (source) => {
    if (!('BarcodeDetector' in window)) {
      throw new Error(t.cameraUnsupported);
    }

    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(source);
    return codes[0]?.rawValue || '';
  }, [t.cameraUnsupported]);

  const handleDetectedQr = useCallback((qrCode) => {
    setForm((current) => ({ ...current, qrCode }));
    setCameraMessage(t.qrDetected);
    setError('');
    stopCamera();
  }, [stopCamera, t.qrDetected]);

  const startCamera = async () => {
    setError('');
    setCameraMessage('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t.cameraUnsupported);
      return;
    }

    setCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!('BarcodeDetector' in window)) {
        return;
      }

      scanTimerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        try {
          const qrCode = await readQrFromSource(video);
          if (qrCode) handleDetectedQr(qrCode);
        } catch {
          window.clearInterval(scanTimerRef.current);
          scanTimerRef.current = null;
          setError(t.cameraUnsupported);
        }
      }, 700);
    } catch {
      setError(t.cameraPermissionDenied);
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
      const bitmap = await createImageBitmap(file);
      const qrCode = await readQrFromSource(bitmap);
      bitmap.close?.();

      if (!qrCode) {
        setError(t.noQrInImage);
        return;
      }

      setForm((current) => ({ ...current, qrCode }));
      setCameraMessage(t.qrDetected);
    } catch (err) {
      setError(err.message || t.noQrInImage);
    } finally {
      event.target.value = '';
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await busAssistantService.validateETicket(form);
      setResult(data);
      setRecent((items) => [data, ...items].slice(0, 6));
    } catch (err) {
      setError(translateBusAssistantError(err, language, 'Invalid QR code'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel title={t.validateQrTicket}>
        <form onSubmit={submit} className="space-y-4">
          <div className={isDarkMode
            ? 'relative min-h-[240px] overflow-hidden rounded border border-dashed border-emerald-300/40 bg-emerald-300/5 text-center'
            : 'relative min-h-[240px] overflow-hidden rounded border border-dashed border-emerald-300 bg-emerald-50/70 text-center'}
          >
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="h-[240px] w-full object-cover"
                  muted
                  playsInline
                  aria-label={t.cameraScannerArea}
                />
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute right-3 top-3 inline-flex items-center gap-2 rounded bg-slate-950/80 px-3 py-2 text-sm font-semibold text-white"
                >
                  <VideoOff size={16} />
                  {t.stopCamera}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="grid min-h-[240px] w-full place-items-center text-center"
                disabled={cameraLoading}
              >
                <span>
                  <Camera className={isDarkMode ? 'mx-auto text-emerald-300' : 'mx-auto text-emerald-500'} size={44} />
                  <span className={isDarkMode ? 'mt-3 block text-sm font-medium text-slate-200' : 'mt-3 block text-sm font-semibold text-slate-700'}>{t.cameraScannerArea}</span>
                  <span className="mt-2 inline-flex rounded bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950">
                    {cameraLoading ? t.cameraStarting : t.startCamera}
                  </span>
                </span>
              </button>
            )}
          </div>
          {cameraMessage ? <Alert type="success">{cameraMessage}</Alert> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t.qrCode}>
              <input className={inputClass} value={form.qrCode} onChange={update('qrCode')} />
            </Field>
            <Field label={t.uploadQrImage}>
              <label className={isDarkMode
                ? 'flex cursor-pointer items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200'
                : 'flex cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-emerald-400'}
              >
                <ImageUp size={16} />
                <span>{t.chooseFile}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleQrImageUpload} />
              </label>
            </Field>
            <Field label={t.tripId}>
              <input className={inputClass} value={form.tripId} onChange={update('tripId')} />
            </Field>
            <Field label={t.vehicleId}>
              <input className={inputClass} value={form.vehicleId} onChange={update('vehicleId')} />
            </Field>
          </div>
          {error ? <Alert type="error">{error}</Alert> : null}
          <button className="inline-flex items-center gap-2 rounded bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" disabled={loading}>
            <ScanLine size={16} />
            {loading ? t.validating : t.validateTicket}
          </button>
        </form>
      </Panel>

      <div className="space-y-5">
        <Panel title={t.validationResult}>
          {result ? (
            <div className="space-y-3 text-sm">
              <Alert type="success">{result.message}</Alert>
              <div className="grid grid-cols-2 gap-3">
                <p><span className="text-slate-400">{t.status}:</span> {result.validationStatus}</p>
                <p><span className="text-slate-400">{t.ticket}:</span> {result.ticketInfo?.ticketCode || result.ticketInfo?._id}</p>
                <p><span className="text-slate-400">{t.passenger}:</span> {result.passengerInfo?.fullName || 'N/A'}</p>
                <p><span className="text-slate-400">{t.route}:</span> {result.routeInfo?.name || 'N/A'}</p>
              </div>
            </div>
          ) : <p className="text-sm text-slate-400">{t.noValidationYet}</p>}
        </Panel>
        <Panel title={t.recentValidations}>
          <div className="space-y-2">
            {recent.length ? recent.map((item, index) => (
              <div key={`${item.ticketInfo?._id}-${index}`} className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <p className="font-medium">{item.ticketInfo?.ticketCode || item.ticketInfo?._id}</p>
                <p className="text-slate-400">{item.passengerInfo?.fullName || t.passengerFallback} - {item.validationStatus}</p>
              </div>
            )) : <p className="text-sm text-slate-400">{t.noRecentValidations}</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default ValidateQrTicketPage;
