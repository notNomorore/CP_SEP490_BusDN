import React from 'react';

const DEFAULT_BACKEND_URL = 'http://localhost:3000';

const getBackendBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL?.trim();
  if (envApiUrl) {
    return envApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }

  const storedApiBaseUrl = localStorage.getItem('apiBaseUrl');
  if (storedApiBaseUrl) {
    return storedApiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }

  return DEFAULT_BACKEND_URL;
};

export const resolveFileUrl = (url) => {
  if (!url) return '#';
  if (/^(https?:|blob:|data:)/i.test(url)) return url;

  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  return `${getBackendBaseUrl()}${normalizedUrl}`;
};

export const getFileDisplayName = (file = {}) => (
  file.name
  || file.originalName
  || file.filename
  || file.fileName
  || 'Xem file'
);

export const isImageFile = (file = {}) => {
  const name = getFileDisplayName(file);
  const url = file.url || '';
  return file.mimeType?.startsWith('image/')
    || file.type?.startsWith('image/')
    || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(name)
    || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(url);
};

export const isPdfFile = (file = {}) => {
  const name = getFileDisplayName(file);
  const url = file.url || '';
  return file.mimeType === 'application/pdf'
    || file.type === 'application/pdf'
    || /\.pdf$/i.test(name)
    || /\.pdf$/i.test(url);
};

const FileViewerModal = ({ file, title = 'Xem trước file', onClose }) => {
  if (!file) return null;

  const fileUrl = resolveFileUrl(file.url);
  const fileName = getFileDisplayName(file);
  const isImage = isImageFile(file);
  const isPdf = isPdfFile(file);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 text-white">
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-4 bg-black/70 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold md:text-base">{fileName}</p>
          <p className="text-xs text-white/60">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Mở tab mới
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Đóng xem trước"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      <div className="flex h-full items-center justify-center px-4 pb-6 pt-20">
        {isImage && (
          <img
            src={fileUrl}
            alt={fileName}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {isPdf && !isImage && (
          <iframe
            title={fileName}
            src={fileUrl}
            className="h-full w-full max-w-6xl rounded-2xl border border-white/10 bg-white"
          />
        )}

        {!isImage && !isPdf && (
          <div className="rounded-3xl bg-white p-8 text-center text-on-surface">
            <span className="material-symbols-outlined text-5xl text-primary">draft</span>
            <h3 className="mt-4 text-xl font-headline font-black text-primary">
              Không thể xem trước file này
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Bạn vẫn có thể mở file ở tab mới để kiểm tra.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileViewerModal;
