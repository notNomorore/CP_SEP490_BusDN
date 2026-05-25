import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../../../shared/components/navigation/Header.jsx';
import Footer from '../../../shared/components/common/Footer.jsx';
import priorityProfileService, {
  DOCUMENT_TYPES,
  PROFILE_TYPES,
} from '../services/priorityProfileService.js';
import useAuthStore from '../../auth/stores/authStore.js';

const STATUS_META = {
  NONE: {
    label: 'Chưa đăng ký',
    className: 'bg-surface-container text-on-surface-variant',
    icon: 'assignment',
  },
  PENDING: {
    label: 'Đang chờ duyệt',
    className: 'bg-amber-100 text-amber-900',
    icon: 'hourglass_top',
  },
  APPROVED: {
    label: 'Đã phê duyệt',
    className: 'bg-green-100 text-green-800',
    icon: 'verified',
  },
  REJECTED: {
    label: 'Bị từ chối',
    className: 'bg-error-container text-on-error-container',
    icon: 'cancel',
  },
  EXPIRED: {
    label: 'Hết hạn',
    className: 'bg-surface-container-high text-on-surface-variant',
    icon: 'event_busy',
  },
};

const initialForm = {
  profileType: 'STUDENT',
  fullName: '',
  dateOfBirth: '',
  identityNumber: '',
  cardNumber: '',
  issuingAuthority: '',
  reason: '',
};

const createDocumentRow = (documentType = 'IDENTITY_FRONT') => ({
  id: `${Date.now()}-${Math.random()}`,
  documentType,
  files: [],
});

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

const isApprovedPriorityActive = (status, expiryDate) => {
  if (status !== 'APPROVED') {
    return false;
  }

  if (!expiryDate) {
    return true;
  }

  const endOfExpiryDate = new Date(expiryDate);
  endOfExpiryDate.setHours(23, 59, 59, 999);
  return endOfExpiryDate >= new Date();
};

const getDocumentUrl = (url) => {
  if (!url) return '#';
  if (url.startsWith('http')) return url;

  const apiBaseUrl = localStorage.getItem('apiBaseUrl') || 'http://localhost:3000/api';
  const backendBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
  return `${backendBaseUrl}${url}`;
};

const formatFileSize = (size) => {
  if (!size) return '0 KB';

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

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

const PriorityProfilePage = () => {
  const { user } = useAuthStore();
  const [profileData, setProfileData] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [documentRows, setDocumentRows] = useState([
    createDocumentRow('IDENTITY_FRONT'),
  ]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [viewerFile, setViewerFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const status = profileData?.profile?.status || 'NONE';
  const statusMeta = STATUS_META[status] || STATUS_META.NONE;
  const documents = profileData?.profile?.documents || [];
  const hasActiveApprovedProfile = isApprovedPriorityActive(
    status,
    profileData?.profile?.expiryDate
  );

  const canUploadDocuments = useMemo(() => (
    ['PENDING', 'REJECTED'].includes(status)
    && documentRows.some((row) => row.files.length > 0)
  ), [documentRows, status]);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await priorityProfileService.getStatus();
      const nextProfile = response.data;
      setProfileData(nextProfile);

      if (nextProfile?.profile?.status && nextProfile.profile.status !== 'NONE') {
        setForm({
          profileType: nextProfile.profile.profileType || 'STUDENT',
          fullName: nextProfile.profile.fullName || '',
          dateOfBirth: nextProfile.profile.dateOfBirth
            ? nextProfile.profile.dateOfBirth.slice(0, 10)
            : '',
          identityNumber: nextProfile.profile.identityNumber || '',
          cardNumber: nextProfile.profile.cardNumber || '',
          issuingAuthority: nextProfile.profile.issuingAuthority || '',
          reason: nextProfile.profile.reason || '',
        });
      } else if (user?.fullName) {
        setForm((current) => ({
          ...current,
          fullName: user.fullName,
        }));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [user?.fullName]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const previews = documentRows.flatMap((row) => (
      row.files.map((file) => ({
        rowId: row.id,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }))
    ));

    setFilePreviews(previews);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [documentRows]);

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    if (hasActiveApprovedProfile) {
      setError('');
      setMessage('Hồ sơ ưu tiên của bạn đang còn hiệu lực. Bạn chỉ cần nộp hồ sơ mới sau khi quyền ưu tiên hết hạn.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await priorityProfileService.register(form);
      setProfileData(response.data);
      setMessage('Hồ sơ ưu tiên đã được gửi và đang chờ xác minh.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentTypeChange = (rowId, nextDocumentType) => {
    setDocumentRows((currentRows) => currentRows.map((row) => (
      row.id === rowId ? { ...row, documentType: nextDocumentType } : row
    )));
  };

  const handleFileChange = (rowId, event) => {
    const selectedFiles = Array.from(event.target.files || []);
    setDocumentRows((currentRows) => currentRows.map((row) => (
      row.id === rowId ? { ...row, files: selectedFiles.slice(0, 5) } : row
    )));
  };

  const addDocumentRow = () => {
    setDocumentRows((currentRows) => [
      ...currentRows,
      createDocumentRow('OTHER'),
    ]);
  };

  const removeDocumentRow = (rowId) => {
    setDocumentRows((currentRows) => (
      currentRows.length === 1
        ? currentRows
        : currentRows.filter((row) => row.id !== rowId)
    ));
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setIsUploading(true);
    setError('');
    setMessage('');

    try {
      const rowsWithFiles = documentRows.filter((row) => row.files.length > 0);
      let latestResponse = null;

      for (const row of rowsWithFiles) {
        latestResponse = await priorityProfileService.uploadDocuments({
          documentType: row.documentType,
          files: row.files,
        });
      }

      if (latestResponse) {
        setProfileData(latestResponse.data);
      }

      setDocumentRows([
        createDocumentRow('IDENTITY_FRONT'),
      ]);
      setMessage('Tài liệu xác minh đã được tải lên thành công.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-24">
        <section className="border-b border-outline-variant/30 bg-primary text-surface-bright">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <span className="inline-flex rounded-full bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-tertiary-fixed">
                  Priority Profile
                </span>
                <div>
                  <h1 className="text-4xl font-headline font-black md:text-5xl">
                    Hồ sơ ưu tiên hành khách
                  </h1>
                  <p className="mt-3 text-lg leading-8 text-surface-variant/85">
                    Đăng ký hỗ trợ ưu tiên hoặc giảm giá, tải lên giấy tờ xác minh và theo dõi trạng thái phê duyệt trong cùng một nơi.
                  </p>
                </div>
              </div>

              <div className={`inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-bold ${statusMeta.className}`}>
                <span className="material-symbols-outlined">{statusMeta.icon}</span>
                {statusMeta.label}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            {(message || error) && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  error
                    ? 'border-error/20 bg-error-container text-on-error-container'
                    : 'border-on-tertiary-container/20 bg-on-tertiary-container/10 text-on-tertiary-fixed-variant'
                }`}
              >
                {error || message}
              </div>
            )}

            <form
              onSubmit={handleRegister}
              className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-headline font-black text-primary">
                    1. Đăng ký hồ sơ ưu tiên
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    Thông tin này được dùng để nhân viên xác minh quyền ưu tiên hoặc giảm giá của hành khách.
                  </p>
                </div>
                <span className="hidden rounded-full bg-primary-fixed px-4 py-1 text-sm font-bold text-on-primary-fixed md:inline-flex">
                  Passenger
                </span>
              </div>

              {hasActiveApprovedProfile && (
                <div className="mb-5 rounded-2xl border border-on-tertiary-container/20 bg-on-tertiary-container/10 px-4 py-3 text-sm leading-6 text-on-tertiary-fixed-variant">
                  Hồ sơ ưu tiên của bạn đã được duyệt và đang còn hiệu lực đến{' '}
                  <span className="font-bold">
                    {profileData?.profile?.expiryDate
                      ? formatDate(profileData.profile.expiryDate)
                      : 'không thời hạn'}
                  </span>
                  . Bạn không cần đăng ký lại trong thời gian này.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Nhóm ưu tiên</span>
                  <select
                    value={form.profileType}
                    onChange={(event) => handleChange('profileType', event.target.value)}
                    className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                  >
                    {PROFILE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Họ và tên</span>
                  <input
                    value={form.fullName}
                    onChange={(event) => handleChange('fullName', event.target.value)}
                    className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                    placeholder="Nguyễn Văn A"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Ngày sinh</span>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) => handleChange('dateOfBirth', event.target.value)}
                    className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Số CCCD/CMND</span>
                  <input
                    value={form.identityNumber}
                    onChange={(event) => handleChange('identityNumber', event.target.value)}
                    className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                    placeholder="012345678901"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Mã số trên giấy tờ ưu tiên</span>
                  <input
                    value={form.cardNumber}
                    onChange={(event) => handleChange('cardNumber', event.target.value)}
                    className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                    placeholder="VD: mã thẻ sinh viên, số giấy xác nhận..."
                  />
                  <p className="text-xs leading-5 text-on-surface-variant">
                    Có thể bỏ trống nếu giấy tờ của bạn không có mã số riêng.
                  </p>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Nơi cấp giấy tờ ưu tiên</span>
                  <input
                    value={form.issuingAuthority}
                    onChange={(event) => handleChange('issuingAuthority', event.target.value)}
                    className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                    placeholder="VD: Trường FPT, UBND phường, bệnh viện..."
                  />
                  <p className="text-xs leading-5 text-on-surface-variant">
                    Nhập cơ quan/trường học/bệnh viện cấp hoặc xác nhận giấy tờ này.
                  </p>
                </label>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-semibold text-on-surface">Lý do đăng ký ưu tiên</span>
                <textarea
                  value={form.reason}
                  onChange={(event) => handleChange('reason', event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                  placeholder="Mô tả ngắn gọn quyền ưu tiên hoặc chính sách giảm giá cần áp dụng."
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting || hasActiveApprovedProfile}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-bold text-on-primary shadow-lg shadow-primary/15 hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              >
                <span className="material-symbols-outlined">send</span>
                {isSubmitting
                  ? 'Đang gửi...'
                  : hasActiveApprovedProfile
                    ? 'Hồ sơ đang còn hiệu lực'
                    : 'Gửi hồ sơ xác minh'}
              </button>
            </form>

            <form
              onSubmit={handleUpload}
              className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-headline font-black text-primary">
                  2. Tải lên giấy tờ xác minh
                </h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Có thể tải nhiều nhóm giấy tờ như CCCD mặt trước, CCCD mặt sau và giấy chứng minh ưu tiên. Mỗi nhóm nhận JPG, PNG, WEBP hoặc PDF, tối đa 5 file.
                </p>
              </div>

              <div className="space-y-4">
                {documentRows.map((row, index) => {
                  const rowPreviews = filePreviews.filter((file) => file.rowId === row.id);

                  return (
                    <div
                      key={row.id}
                      className="rounded-3xl border border-outline-variant/40 bg-surface-container-low p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-on-surface">
                            Nhóm tài liệu {index + 1}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            Chọn đúng loại giấy tờ trước khi tải file.
                          </p>
                        </div>
                        {documentRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDocumentRow(row.id)}
                            className="rounded-full border border-outline-variant/60 px-3 py-2 text-xs font-bold text-error hover:bg-error-container"
                          >
                            Xóa
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
                        <label className="block space-y-2">
                          <span className="text-sm font-semibold text-on-surface">Loại tài liệu</span>
                          <select
                            value={row.documentType}
                            onChange={(event) => handleDocumentTypeChange(row.id, event.target.value)}
                            className="w-full rounded-2xl border-outline-variant/70 bg-white px-4 py-3 text-on-surface focus:border-on-tertiary-container focus:ring-on-tertiary-container"
                          >
                            {DOCUMENT_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block space-y-2">
                          <span className="text-sm font-semibold text-on-surface">File xác minh</span>
                          <input
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                            onChange={(event) => handleFileChange(row.id, event)}
                            className="w-full rounded-2xl border border-dashed border-outline-variant bg-white px-4 py-3 text-sm text-on-surface file:mr-4 file:rounded-full file:border-0 file:bg-primary-fixed file:px-4 file:py-2 file:font-bold file:text-on-primary-fixed"
                          />
                        </label>
                      </div>

                      {rowPreviews.length > 0 && (
                        <div className="mt-4 rounded-2xl bg-white/80 p-3">
                          <p className="mb-2 text-sm font-bold text-on-surface">File đã chọn</p>
                          <ul className="space-y-2 text-sm text-on-surface-variant">
                            {rowPreviews.map((file) => (
                              <li
                                key={`${file.rowId}-${file.name}-${file.size}`}
                                className="flex items-center justify-between gap-4 rounded-xl bg-white px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <span className="block truncate font-semibold text-on-surface">
                                    {file.name}
                                  </span>
                                  <span className="text-xs text-on-surface-variant">
                                    {formatFileSize(file.size)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setViewerFile({
                                    name: file.name,
                                    url: file.url,
                                    mimeType: file.type,
                                  })}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-on-primary hover:bg-primary-container"
                                >
                                  <span className="material-symbols-outlined text-sm">visibility</span>
                                  Xem file
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addDocumentRow}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-outline-variant/70 px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Thêm loại giấy tờ khác
              </button>

              <button
                type="submit"
                disabled={isUploading || !canUploadDocuments}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-on-tertiary-fixed-variant px-6 py-4 text-base font-bold text-on-tertiary-fixed shadow-lg shadow-primary/10 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              >
                <span className="material-symbols-outlined">upload_file</span>
                {isUploading ? 'Đang tải lên...' : 'Tải lên tài liệu'}
              </button>
            </form>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-headline font-black text-primary">
                    3. Trạng thái phê duyệt
                  </h2>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Cập nhật mới nhất từ hệ thống xác minh.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadProfile}
                  className="rounded-full border border-outline-variant/60 p-3 text-primary hover:bg-surface-container"
                  aria-label="Làm mới trạng thái"
                >
                  <span className="material-symbols-outlined">refresh</span>
                </button>
              </div>

              {isLoading ? (
                <div className="rounded-2xl bg-surface-container p-6 text-center text-on-surface-variant">
                  Đang tải hồ sơ...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${statusMeta.className}`}>
                    <span className="material-symbols-outlined text-base">{statusMeta.icon}</span>
                    {statusMeta.label}
                  </div>

                  <dl className="grid gap-3 text-sm">
                    <InfoRow label="Nhóm ưu tiên" value={PROFILE_TYPES.find((type) => type.value === profileData?.profile?.profileType)?.label || 'Chưa có'} />
                    <InfoRow label="Người đăng ký" value={profileData?.profile?.fullName || 'Chưa có'} />
                    <InfoRow label="Ngày sinh" value={formatDate(profileData?.profile?.dateOfBirth)} />
                    <InfoRow label="Ngày gửi" value={formatDate(profileData?.profile?.submittedAt)} />
                    <InfoRow label="Ngày duyệt" value={formatDate(profileData?.profile?.reviewedAt)} />
                    <InfoRow label="Hiệu lực ưu tiên" value={formatPriorityValidity(status, profileData?.profile?.expiryDate)} />
                  </dl>

                  {profileData?.profile?.rejectionReason && (
                    <div className="rounded-2xl bg-error-container p-4 text-sm text-on-error-container">
                      {profileData.profile.rejectionReason}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-xl shadow-primary/5">
              <h3 className="text-xl font-headline font-black text-primary">
                Tài liệu đã tải lên
              </h3>

              {documents.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  Chưa có tài liệu xác minh nào.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {documents.map((document) => (
                    <li
                      key={document._id || document.fileName}
                      className="rounded-2xl border border-outline-variant/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-on-surface">
                            {document.originalName}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {DOCUMENT_TYPES.find((type) => type.value === document.type)?.label || document.type}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-on-surface-variant">
                          {formatFileSize(document.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewerFile({
                          name: document.originalName,
                          url: getDocumentUrl(document.url),
                          mimeType: document.mimeType,
                        })}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary-container"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        Xem file đã gửi
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
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
          <p className="text-xs text-white/60">Xem trước tài liệu xác minh</p>
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
  <div className="flex items-start justify-between gap-4 rounded-2xl bg-surface-container-low px-4 py-3">
    <dt className="text-on-surface-variant">{label}</dt>
    <dd className="max-w-[55%] text-right font-semibold text-on-surface">{value}</dd>
  </div>
);

export default PriorityProfilePage;
