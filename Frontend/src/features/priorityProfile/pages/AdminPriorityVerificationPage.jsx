import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import priorityProfileService, {
  DOCUMENT_TYPES,
  PROFILE_TYPES,
} from '../services/priorityProfileService.js';

const STATUS_FILTERS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'ALL', label: 'Tất cả' },
];

const STATUS_BADGE = {
  PENDING: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-error-container text-on-error-container',
  EXPIRED: 'bg-surface-container-high text-on-surface-variant',
  NONE: 'bg-surface-container text-on-surface-variant',
};

const formatDate = (value) => {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
};

const formatPriorityValidity = (status, expiryDate) => {
  if (status !== 'APPROVED') {
    return 'Chưa có hiệu lực';
  }

  return expiryDate ? formatDate(expiryDate) : 'Không thời hạn';
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const formatFileSize = (size) => {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.errors && typeof error.errors === 'object') {
    return Object.values(error.errors).join(' ');
  }
  return error.message || 'Không thể xử lý yêu cầu.';
};

const getDocumentUrl = (url) => {
  if (!url) return '#';
  if (url.startsWith('http')) return url;

  const apiBaseUrl = localStorage.getItem('apiBaseUrl') || 'http://localhost:3000/api';
  const backendBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
  return `${backendBaseUrl}${url}`;
};

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

const AdminPriorityVerificationPage = () => {
  const [status, setStatus] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedStatus = selectedRequest?.profile?.status || 'NONE';
  const selectedDocuments = selectedRequest?.profile?.documents || [];
  const hasDocuments = selectedDocuments.length > 0;
  const isProcessedRequest = ['APPROVED', 'REJECTED', 'EXPIRED'].includes(selectedStatus);

  const selectedProfileType = useMemo(() => (
    PROFILE_TYPES.find((type) => type.value === selectedRequest?.profile?.profileType)?.label || 'Chưa có'
  ), [selectedRequest?.profile?.profileType]);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await priorityProfileService.listAdminRequests({ status });
      setRequests(response.data || []);

      if (response.data?.length) {
        setSelectedRequest((current) => current || response.data[0]);
      } else {
        setSelectedRequest(null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const loadDetail = async (requestId) => {
    setIsDetailLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await priorityProfileService.getAdminRequestDetail(requestId);
      const profileType = response.data?.profile?.profileType;
      const hasExpiryDate = Boolean(response.data?.profile?.expiryDate);
      const shouldDefaultNoExpiry = !hasExpiryDate
        && (
          response.data?.profile?.status === 'APPROVED'
          || ['SENIOR', 'DISABLED'].includes(profileType)
        );

      setSelectedRequest(response.data);
      setRejectionReason(response.data?.profile?.rejectionReason || '');
      setExpiryDate(response.data?.profile?.expiryDate?.slice(0, 10) || '');
      setNoExpiry(shouldDefaultNoExpiry);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleVerify = async (nextStatus) => {
    if (!selectedRequest?.requestId) return;

    setIsVerifying(true);
    setError('');
    setMessage('');

    try {
      const response = await priorityProfileService.verifyAdminRequest(selectedRequest.requestId, {
        status: nextStatus,
        rejectionReason,
        noExpiry: nextStatus === 'APPROVED' ? noExpiry : undefined,
        expiryDate: nextStatus === 'APPROVED' && !noExpiry ? expiryDate || undefined : undefined,
      });

      setSelectedRequest(response.data);
      setMessage(nextStatus === 'APPROVED'
        ? 'Hồ sơ ưu tiên đã được duyệt.'
        : 'Hồ sơ ưu tiên đã bị từ chối.');
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-24">
        <section className="bg-primary text-surface-bright">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-tertiary-fixed">
              Admin Verification
            </span>
            <h1 className="mt-4 text-4xl font-headline font-black md:text-5xl">
              Duyệt hồ sơ ưu tiên
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-surface-variant/85">
              Xem yêu cầu do hành khách gửi, kiểm tra giấy tờ xác minh và cập nhật trạng thái phê duyệt.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-headline font-black text-primary">
                  Yêu cầu hồ sơ
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Danh sách passenger đã gửi hồ sơ ưu tiên.
                </p>
              </div>
              <button
                type="button"
                onClick={loadRequests}
                className="rounded-full border border-outline-variant/60 p-3 text-primary hover:bg-surface-container"
                aria-label="Làm mới danh sách"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setSelectedRequest(null);
              }}
              className="mb-5 w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>

            {error && (
              <div className="mb-4 rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                Đang tải danh sách...
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                Không có yêu cầu phù hợp.
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => {
                  const requestStatus = request.profile?.status || 'NONE';
                  const isSelected = selectedRequest?.requestId === request.requestId;

                  return (
                    <button
                      key={request.requestId || request.userId}
                      type="button"
                      onClick={() => loadDetail(request.requestId)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-primary bg-primary-fixed/40'
                          : 'border-outline-variant/30 bg-white hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-on-surface">
                            {request.profile?.fullName}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Gửi lúc {formatDateTime(request.profile?.submittedAt)}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[requestStatus]}`}>
                          {requestStatus}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
            <div className="mb-6">
              <h2 className="text-2xl font-headline font-black text-primary">
                Xác minh giấy tờ
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Kiểm tra thông tin hồ sơ và tài liệu upload trước khi duyệt hoặc từ chối.
              </p>
            </div>

            {message && (
              <div className="mb-4 rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/10 px-4 py-3 text-sm text-on-tertiary-fixed-variant">
                {message}
              </div>
            )}

            {isDetailLoading ? (
              <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                Đang tải chi tiết...
              </div>
            ) : !selectedRequest ? (
              <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                Chọn một yêu cầu để xem chi tiết.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-headline font-black text-primary">
                      {selectedRequest.profile?.fullName}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {selectedProfileType}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${STATUS_BADGE[selectedStatus]}`}>
                    {selectedStatus}
                  </span>
                </div>

                <dl className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="CCCD/CMND" value={selectedRequest.profile?.identityNumber || 'Chưa có'} />
                  <InfoRow label="Ngày sinh" value={formatDate(selectedRequest.profile?.dateOfBirth)} />
                  <InfoRow label="Mã giấy xác nhận" value={selectedRequest.profile?.cardNumber || 'Chưa có'} />
                  <InfoRow label="Đơn vị cấp" value={selectedRequest.profile?.issuingAuthority || 'Chưa có'} />
                  <InfoRow label="Ngày gửi" value={formatDateTime(selectedRequest.profile?.submittedAt)} />
                  <InfoRow label="Ngày duyệt" value={formatDateTime(selectedRequest.profile?.reviewedAt)} />
                  <InfoRow label="Hiệu lực ưu tiên" value={formatPriorityValidity(selectedStatus, selectedRequest.profile?.expiryDate)} />
                </dl>

                <div className="rounded-2xl bg-surface-container-low p-4">
                  <p className="text-sm font-bold text-on-surface">Lý do đăng ký</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    {selectedRequest.profile?.reason || 'Chưa có'}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-headline font-black text-primary">
                    Tài liệu xác minh
                  </h3>

                  {!hasDocuments ? (
                    <p className="mt-3 rounded-2xl bg-surface-container p-4 text-sm text-on-surface-variant">
                      Passenger chưa upload tài liệu. Không thể duyệt hồ sơ này.
                    </p>
                  ) : (
                    <ul className="mt-3 grid gap-3">
                      {selectedDocuments.map((document) => (
                        <li
                          key={document._id || document.fileName}
                          className="rounded-2xl border border-outline-variant/30 bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-on-surface">
                                {document.originalName}
                              </p>
                              <p className="mt-1 text-xs text-on-surface-variant">
                                {DOCUMENT_TYPES.find((type) => type.value === document.type)?.label || document.type}
                                {' '}• {formatFileSize(document.size)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setViewerFile({
                                name: document.originalName,
                                url: getDocumentUrl(document.url),
                                mimeType: document.mimeType,
                              })}
                              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary-container"
                            >
                              <span className="material-symbols-outlined text-base">visibility</span>
                              Xem file
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {isProcessedRequest ? (
                  <div className="rounded-3xl border border-on-tertiary-container/20 bg-on-tertiary-container/10 p-5 text-on-tertiary-fixed-variant">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined mt-0.5">lock</span>
                      <div>
                        <h3 className="text-lg font-headline font-black">
                          Hồ sơ này đã có kết quả xử lý
                        </h3>
                        <p className="mt-2 text-sm leading-6">
                          Admin chỉ có thể xem lại hồ sơ đã được chấp thuận, từ chối hoặc hết hạn. Hệ thống không cho thay đổi lại trạng thái để tránh ghi nhận sai kết quả xét duyệt của hành khách.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-5">
                    <h3 className="text-lg font-headline font-black text-primary">
                      Cập nhật trạng thái phê duyệt
                    </h3>

                    <div className="mt-4 grid gap-4">
                      <div className="rounded-2xl border border-outline-variant/40 bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-on-surface">Thời hạn hiệu lực</p>
                            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                              Chọn không thời hạn cho nhóm ưu tiên dài hạn; nhập ngày hết hạn cho quyền ưu tiên theo giấy tờ.
                            </p>
                          </div>
                          <label className="flex shrink-0 items-center gap-3 rounded-full bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface">
                            <input
                              type="checkbox"
                              checked={noExpiry}
                              onChange={(event) => {
                                setNoExpiry(event.target.checked);
                                if (event.target.checked) {
                                  setExpiryDate('');
                                }
                              }}
                              className="h-4 w-4 rounded border-outline-variant text-on-tertiary-container focus:ring-on-tertiary-container"
                            />
                            Không thời hạn
                          </label>
                        </div>

                        <label className="mt-4 block max-w-sm space-y-2">
                          <span className="text-sm font-semibold text-on-surface">Ngày hết hạn ưu tiên</span>
                        <input
                          type="date"
                          value={expiryDate}
                          min={getTodayInputValue()}
                          onChange={(event) => setExpiryDate(event.target.value)}
                          disabled={noExpiry}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                        />
                        </label>
                      </div>

                      <label className="block space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-on-surface">Lý do từ chối</span>
                        <textarea
                          rows={3}
                          value={rejectionReason}
                          onChange={(event) => setRejectionReason(event.target.value)}
                          className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                          placeholder="Bắt buộc nhập nếu từ chối hồ sơ."
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 md:flex-row">
                      <button
                        type="button"
                        onClick={() => handleVerify('APPROVED')}
                        disabled={isVerifying || !hasDocuments || (!noExpiry && !expiryDate)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-green-700 px-6 py-4 font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined">verified</span>
                        Duyệt hồ sơ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerify('REJECTED')}
                        disabled={isVerifying || !hasDocuments || !rejectionReason.trim()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-error px-6 py-4 font-bold text-on-error hover:bg-on-error-container disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined">cancel</span>
                        Từ chối
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </main>

      <Footer />

      {viewerFile && (
        <FileViewerModal
          file={viewerFile}
          onClose={() => setViewerFile(null)}
        />
      )}
    </div>
  );
};

const FileViewerModal = ({ file, onClose }) => {
  const isImage = file.mimeType?.startsWith('image/')
    || /\.(jpg|jpeg|png|webp)$/i.test(file.name || file.url);
  const isPdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name || file.url);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 text-white">
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-4 bg-black/70 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold md:text-base">{file.name}</p>
          <p className="text-xs text-white/60">Xem trước giấy tờ xác minh</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={file.url}
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
            src={file.url}
            alt={file.name}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {isPdf && !isImage && (
          <iframe
            title={file.name}
            src={file.url}
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

const InfoRow = ({ label, value }) => (
  <div className="rounded-2xl bg-surface-container-low px-4 py-3">
    <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
      {label}
    </dt>
    <dd className="mt-1 font-bold text-on-surface">{value}</dd>
  </div>
);

export default AdminPriorityVerificationPage;
