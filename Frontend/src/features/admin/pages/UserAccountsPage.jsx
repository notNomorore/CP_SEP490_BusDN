import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../../shared/components/navigation/Header.jsx';
import { HOME_BUS_HERO_IMAGE } from '../../../shared/constants/images.js';
import useTheme from '../../../shared/hooks/useTheme.js';
import adminService from '../services/adminService.js';

const roleOptions = ['ALL', 'ADMIN', 'PASSENGER', 'DRIVER', 'BUS_ASSISTANT'];
const createAccountRoleOptions = ['DRIVER', 'BUS_ASSISTANT'];
const statusOptions = ['ALL', 'ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING_ACTIVATION'];
const emailRegex = /^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/;
const normalizeEmailInput = (value) => value.trim().replace(/\.+$/, '');

const roleLabels = {
  ALL: 'Tất cả vai trò',
  ADMIN: 'Quản trị viên',
  PASSENGER: 'Hành khách',
  DRIVER: 'Tài xế',
  BUS_ASSISTANT: 'Phụ xe',
};

const statusLabels = {
  ALL: 'Tất cả trạng thái',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Không hoạt động',
  LOCKED: 'Bị khóa',
  PENDING_ACTIVATION: 'Chờ kích hoạt',
};

const defaultSummary = {
  totalUsers: 0,
  activeUsers: 0,
  lockedUsers: 0,
  pendingUsers: 0,
  verifiedUsers: 0,
};

const defaultFilters = {
  search: '',
  role: 'ALL',
  status: 'ALL',
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const defaultPagination = {
  page: 1,
  totalPages: 1,
  total: 0,
  limit: 10,
};

const defaultCreateAccountForm = {
  fullName: '',
  email: '',
  phone: '',
  role: 'DRIVER',
};

const lockDurations = [
  { value: '24h', label: '24 giờ' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'none', label: 'Cho đến khi mở khóa thủ công' },
];

const formatRelativeLogin = (value) => {
  if (!value) {
    return 'Chưa có hoạt động gần đây';
  }

  const diffHours = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60)));
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

const statusTone = {
  ACTIVE: 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/20',
  INACTIVE: 'bg-slate-400/15 text-slate-300 ring-1 ring-slate-300/10',
  LOCKED: 'bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/20',
  PENDING_ACTIVATION: 'bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/20',
};

const statusToneLight = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  LOCKED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  PENDING_ACTIVATION: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

const verificationTone = {
  true: 'text-emerald-300',
  false: 'text-slate-400',
};

const verificationToneLight = {
  true: 'text-cyan-600',
  false: 'text-slate-400',
};

const metricCards = [
  { key: 'totalUsers', label: 'Tổng người dùng', icon: 'groups', accent: 'from-emerald-400/25 to-emerald-400/5', note: '+12% so với tháng trước' },
  { key: 'activeUsers', label: 'Đang hoạt động', icon: 'verified', accent: 'from-teal-400/25 to-teal-400/5', note: '89% đang hoạt động' },
  { key: 'verifiedUsers', label: 'Đã xác minh', icon: 'shield_person', accent: 'from-cyan-400/25 to-cyan-400/5', note: '94% đạt yêu cầu' },
  { key: 'lockedUsers', label: 'Tài khoản bị khóa', icon: 'lock', accent: 'from-rose-400/25 to-rose-400/5', note: 'Cần kiểm tra' },
];

const QuickActionCard = ({ icon, label, value, isDarkMode }) => (
  <div className={`rounded-2xl border p-4 text-center ${
    isDarkMode ? 'border-white/6 bg-white/[0.03]' : 'border-slate-200 bg-white'
  }`}>
    <span className={`material-symbols-outlined text-lg ${isDarkMode ? 'text-emerald-300' : 'text-emerald-600'}`}>{icon}</span>
    <p className={`mt-3 text-xs uppercase tracking-[0.24em] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{label}</p>
    <p className={`mt-2 text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{value}</p>
  </div>
);

const Modal = ({
  open,
  title,
  description,
  children,
  onClose,
  actions,
  tone = 'default',
}) => {
  if (!open) {
    return null;
  }

  const toneClasses = tone === 'danger'
    ? 'border-rose-400/20 bg-[#1b1719]'
    : tone === 'success'
      ? 'border-emerald-400/20 bg-[#121d19]'
      : 'border-white/10 bg-[#162628]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-[28px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ${toneClasses}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {children ? <div className="mt-5">{children}</div> : null}

        <div className="mt-6 flex justify-end gap-3">
          {actions}
        </div>
      </div>
    </div>
  );
};

const UserAccountsPage = () => {
  const { isDarkMode } = useTheme();
  const [filters, setFilters] = useState(defaultFilters);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(defaultPagination);
  const [summary, setSummary] = useState(defaultSummary);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmittingLock, setIsSubmittingLock] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [lockReason, setLockReason] = useState('Rà soát vi phạm chính sách');
  const [lockDuration, setLockDuration] = useState('24h');
  const [confirmAction, setConfirmAction] = useState(null);
  const [resultModal, setResultModal] = useState({
    open: false,
    title: '',
    message: '',
    tone: 'default',
  });
  const [isImportingUsers, setIsImportingUsers] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importErrors, setImportErrors] = useState({});
  const [importResult, setImportResult] = useState(null);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [createAccountForm, setCreateAccountForm] = useState(defaultCreateAccountForm);
  const [createAccountErrors, setCreateAccountErrors] = useState({});
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [staffPerformance, setStaffPerformance] = useState({
    summary: {
      staffCount: 0,
      totalCompletedTrips: 0,
      totalIncidents: 0,
      averageOnTimeRate: 0,
    },
    staffMembers: [],
  });

  const shellClassName = isDarkMode ? 'bg-[#071516] text-slate-100' : 'bg-[#f6fbfb] text-slate-900';
  const headingClassName = isDarkMode ? 'text-white' : 'text-slate-950';
  const bodyCopyClassName = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const ambientBackgroundClassName = isDarkMode
    ? 'bg-[radial-gradient(circle_at_12%_14%,rgba(74,222,128,0.16),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.12),transparent_20%),radial-gradient(circle_at_68%_72%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#071516_0%,#0b1b1d_38%,#102427_100%)]'
    : 'bg-[radial-gradient(circle_at_12%_14%,rgba(45,212,191,0.10),transparent_18%),radial-gradient(circle_at_84%_18%,rgba(125,211,252,0.12),transparent_18%),linear-gradient(180deg,#fbffff_0%,#f5fbfb_44%,#eef7f8_100%)]';
  const gridOverlayClassName = isDarkMode
    ? 'opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)]'
    : 'opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)]';
  const topGlowClassName = isDarkMode
    ? 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_62%)]'
    : 'bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.08),transparent_40%)]';
  const leftGlowClassName = isDarkMode ? 'bg-emerald-400/10' : 'bg-emerald-200/20';
  const rightGlowClassName = isDarkMode ? 'bg-cyan-400/10' : 'bg-cyan-200/18';
  const metricCardClassName = isDarkMode
    ? 'border-white/8 shadow-[0_20px_60px_rgba(0,0,0,0.18)]'
    : 'border-slate-200/90 shadow-[0_14px_30px_rgba(148,163,184,0.14)]';
  const metricLabelClassName = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const metricValueClassName = isDarkMode ? 'text-white' : 'text-slate-900';
  const metricIconWrapClassName = isDarkMode ? 'bg-white/8' : 'bg-[#f2fbfb] ring-1 ring-slate-100';
  const mainPanelClassName = isDarkMode
    ? 'border-white/8 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.18)]'
    : 'border-slate-200/80 bg-white/98 shadow-[0_18px_36px_rgba(148,163,184,0.16)]';
  const tableSurfaceClassName = isDarkMode
    ? 'border-white/8 bg-[#18292c]/80'
    : 'border-slate-200/90 bg-white';
  const tableHeaderClassName = isDarkMode
    ? 'border-white/6 text-slate-500'
    : 'border-slate-200/90 bg-slate-50 text-slate-500';
  const tableDividerClassName = isDarkMode ? 'divide-white/6' : 'divide-slate-200';
  const tableRowIdleClassName = isDarkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-cyan-50/50';
  const tableRowSelectedClassName = isDarkMode ? 'bg-emerald-400/10' : 'bg-[linear-gradient(90deg,rgba(236,254,255,0.95),rgba(248,250,252,1))]';
  const inputClassName = isDarkMode
    ? 'border-white/8 bg-[#15292b] text-white placeholder:text-slate-500 focus:border-emerald-400/40 focus:bg-[#182e31]'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-400/80 focus:bg-white';
  const inputTextClassName = isDarkMode
    ? 'border-white/8 bg-white/[0.04] text-white placeholder:text-slate-500'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400';
  const sidePanelClassName = isDarkMode
    ? 'border-white/8 bg-white/[0.05] shadow-[0_20px_60px_rgba(0,0,0,0.18)]'
    : 'border-slate-200/80 bg-white/98 shadow-[0_18px_36px_rgba(148,163,184,0.16)]';
  const sideInnerCardClassName = isDarkMode
    ? 'border-white/8 bg-[#15292b]'
    : 'border-slate-200 bg-slate-50';
  const sideTitleClassName = isDarkMode ? 'text-white' : 'text-slate-900';
  const sideSubClassName = isDarkMode ? 'text-slate-500' : 'text-slate-500';
  const userNameClassName = isDarkMode ? 'text-white' : 'text-slate-900';
  const userMetaClassName = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const paginationTextClassName = isDarkMode ? 'text-slate-500' : 'text-slate-500';
  const lightMetricAccent = [
    'from-cyan-50 via-white to-cyan-100/70',
    'from-sky-50 via-white to-sky-100/70',
    'from-teal-50 via-white to-cyan-100/70',
    'from-rose-50 via-white to-slate-100',
  ];

  const selectedListUser = useMemo(
    () => users.find((user) => user._id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const selectedHealth = useMemo(() => {
    if (!selectedUser) {
      return '0%';
    }

    const score = [
      selectedUser.isVerified ? 35 : 0,
      selectedUser.status === 'ACTIVE' ? 35 : 10,
      selectedUser.lastLoginAt ? 15 : 0,
      selectedUser.preferences?.notifications ? 15 : 5,
    ].reduce((sum, part) => sum + part, 0);

    return `${Math.min(score, 100)}%`;
  }, [selectedUser]);

  const recentActivity = useMemo(() => {
    return staffPerformance.staffMembers
      .flatMap((member) => (member.activityReports || []).map((report, index) => ({
        id: `${member._id}-${index}`,
        name: member.fullName || member.email || 'Người dùng chưa rõ',
        note: report.message,
        time: formatRelativeLogin(report.createdAt),
        createdAt: report.createdAt,
      })))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);
  }, [staffPerformance.staffMembers]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadUsers = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await adminService.getUsers(filters);
        if (ignore) {
          return;
        }

        const nextUsers = response.users || [];
        const nextSelectedUserId = nextUsers.some((user) => user._id === selectedUserId)
          ? selectedUserId
          : nextUsers[0]?._id || '';

        setUsers(nextUsers);
        setPagination(response.pagination || defaultPagination);
        setSummary(response.summary || defaultSummary);
        setSelectedUserId(nextSelectedUserId);
      } catch (loadError) {
        if (!ignore) {
          setUsers([]);
          setPagination(defaultPagination);
          setSummary(defaultSummary);
          setSelectedUserId('');
          setError(loadError.message || 'Không thể tải tài khoản người dùng');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      ignore = true;
    };
  }, [filters, selectedUserId]);

  useEffect(() => {
    let ignore = false;

    const loadStaffPerformance = async () => {
      try {
        const response = await adminService.getStaffPerformance();
        if (!ignore) {
          setStaffPerformance({
            summary: response.summary || {
              staffCount: 0,
              totalCompletedTrips: 0,
              totalIncidents: 0,
              averageOnTimeRate: 0,
            },
            staffMembers: response.staffMembers || [],
          });
        }
      } catch (loadError) {
        if (!ignore) {
          setStaffPerformance({
            summary: {
              staffCount: 0,
              totalCompletedTrips: 0,
              totalIncidents: 0,
              averageOnTimeRate: 0,
            },
            staffMembers: [],
          });
        }
      }
    };

    loadStaffPerformance();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      setDetailError('');
      return;
    }

    let ignore = false;

    const loadUserDetail = async () => {
      setIsDetailLoading(true);
      setDetailError('');

      try {
        const response = await adminService.getUserDetail(selectedUserId);
        if (!ignore) {
          setSelectedUser(response.user || null);
          setDetailError('');
        }
      } catch (loadError) {
        if (!ignore) {
          setSelectedUser(selectedListUser);
          setDetailError('');
        }
      } finally {
        if (!ignore) {
          setIsDetailLoading(false);
        }
      }
    };

    loadUserDetail();

    return () => {
      ignore = true;
    };
  }, [selectedUserId, selectedListUser]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: 1,
    }));
  };

  const applyFilters = () => {
    setFilters((current) => ({ ...current, page: 1 }));
  };

  const refreshStaffPerformance = async () => {
    const response = await adminService.getStaffPerformance();
    setStaffPerformance({
      summary: response.summary || {
        staffCount: 0,
        totalCompletedTrips: 0,
        totalIncidents: 0,
        averageOnTimeRate: 0,
      },
      staffMembers: response.staffMembers || [],
    });
  };

  const refreshUsers = async () => {
    const response = await adminService.getUsers(filters);
    const nextUsers = response.users || [];

    setUsers(nextUsers);
    setPagination(response.pagination || defaultPagination);
    setSummary(response.summary || defaultSummary);

    if (!nextUsers.some((user) => user._id === selectedUserId)) {
      setSelectedUserId(nextUsers[0]?._id || '');
    }
  };

  const buildLockedUntil = () => {
    const now = Date.now();
    if (lockDuration === '24h') {
      return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    }
    if (lockDuration === '7d') {
      return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (lockDuration === '30d') {
      return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    return null;
  };

  const handleLockAccount = async () => {
    if (!selectedUser?._id) {
      return;
    }

    setIsSubmittingLock(true);
    setConfirmAction(null);

    try {
      const response = await adminService.lockUser(selectedUser._id, {
        reason: lockReason,
        lockedUntil: buildLockedUntil(),
      });

      setSelectedUser(response.user || null);
      setResultModal({
        open: true,
        title: 'Đã khóa tài khoản',
        message: response.message || 'Tài khoản người dùng đã được tạm khóa thành công.',
        tone: 'danger',
      });
      await refreshUsers();
    } catch (lockError) {
      setResultModal({
        open: true,
        title: 'Khóa thất bại',
        message: lockError.message || 'Không thể khóa tài khoản người dùng',
        tone: 'danger',
      });
    } finally {
      setIsSubmittingLock(false);
    }
  };

  const handleUnlockAccount = async () => {
    if (!selectedUser?._id) {
      return;
    }

    setIsSubmittingLock(true);
    setConfirmAction(null);

    try {
      const response = await adminService.unlockUser(selectedUser._id);
      setSelectedUser(response.user || null);
      setResultModal({
        open: true,
        title: 'Đã kích hoạt lại tài khoản',
        message: response.message || 'Tài khoản đã được kích hoạt lại và có thể truy cập hệ thống.',
        tone: 'success',
      });
      await refreshUsers();
    } catch (unlockError) {
      setResultModal({
        open: true,
        title: 'Mở khóa thất bại',
        message: unlockError.message || 'Không thể mở khóa tài khoản',
        tone: 'danger',
      });
    } finally {
      setIsSubmittingLock(false);
    }
  };

  const resetCreateAccount = () => {
    setCreateAccountForm(defaultCreateAccountForm);
    setCreateAccountErrors({});
  };

  const updateCreateAccountField = (key, value) => {
    setCreateAccountForm((current) => ({
      ...current,
      [key]: value,
    }));
    setCreateAccountErrors((current) => ({
      ...current,
      [key]: undefined,
      general: undefined,
    }));
  };

  const validateCreateAccountForm = () => {
    const errors = {};
    const normalizedEmail = normalizeEmailInput(createAccountForm.email);

    if (!createAccountForm.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ tên.';
    }

    if (!normalizedEmail) {
      errors.email = 'Vui lòng nhập email để gửi tài khoản và mật khẩu.';
    }

    if (normalizedEmail && !emailRegex.test(normalizedEmail)) {
      errors.email = 'Email không hợp lệ. Kiểm tra lại phần đuôi email, không để dấu chấm ở cuối.';
    }

    if (createAccountForm.phone.trim() && !/^(\+84|0)[0-9]{9,10}$/.test(createAccountForm.phone.trim())) {
      errors.phone = 'Số điện thoại không hợp lệ.';
    }

    setCreateAccountErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validateCreateAccountForm()) {
      return;
    }

    setIsCreatingAccount(true);
    setCreateAccountErrors({});

    try {
      const response = await adminService.createUser({
        fullName: createAccountForm.fullName.trim(),
        email: normalizeEmailInput(createAccountForm.email) || undefined,
        phone: createAccountForm.phone.trim() || undefined,
        role: createAccountForm.role,
      });

      setResultModal({
        open: true,
        title: 'Đã tạo tài khoản',
        message: response.message || 'Tài khoản và mật khẩu tạm thời đã được gửi về email đăng ký.',
        tone: 'success',
      });
      setCreateAccountOpen(false);
      resetCreateAccount();
      await refreshUsers();
      await refreshStaffPerformance();
    } catch (createError) {
      const fieldErrors = createError.errors || {};
      const detailedMessage = Object.values(fieldErrors).filter(Boolean).join(' ');
      setCreateAccountErrors({
        ...fieldErrors,
        general: detailedMessage
          ? `Thông tin chưa hợp lệ: ${detailedMessage}`
          : [createError.message, createError.mailError].filter(Boolean).join(' Chi tiết: ') || 'Không thể tạo tài khoản',
      });
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const resetImportUsers = () => {
    setImportFile(null);
    setImportErrors({});
    setImportResult(null);
  };

  const handleImportUsers = async () => {
    if (!importFile) {
      setImportErrors({ general: 'Vui lòng chọn file import.' });
      return;
    }

    setIsImportingUsers(true);
    setImportErrors({});
    setImportResult(null);

    try {
      const response = await adminService.importUsers(importFile);
      setImportResult(response);
      setResultModal({
        open: true,
        title: 'Đã import tài khoản',
        message: response.message || 'Danh sách tài khoản nhân sự đã được xử lý. Mật khẩu tạm thời được gửi qua email.',
        tone: response.failedCount > 0 ? 'default' : 'success',
      });
      await refreshUsers();
      await refreshStaffPerformance();
    } catch (importError) {
      setImportErrors({
        general: importError.message || 'Không thể import tài khoản nhân sự',
      });
    } finally {
      setIsImportingUsers(false);
    }
  };

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-500 ${shellClassName}`}>
      <div className={`pointer-events-none absolute inset-0 transition-all duration-500 ${ambientBackgroundClassName}`} />
      <div className="pointer-events-none absolute inset-0">
        <img
          src={HOME_BUS_HERO_IMAGE}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center"
          style={{ opacity: isDarkMode ? 0.55 : 0.22 }}
        />
        <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#001a0f]/55' : 'bg-white/50'}`} />
      </div>
      <div className={`pointer-events-none absolute inset-0 [background-size:72px_72px] transition-all duration-500 ${gridOverlayClassName}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-24 h-64 blur-3xl transition-all duration-500 ${topGlowClassName}`} />
      <div className={`pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full blur-3xl transition-all duration-500 ${leftGlowClassName}`} />
      <div className={`pointer-events-none absolute -right-16 bottom-24 h-80 w-80 rounded-full blur-3xl transition-all duration-500 ${rightGlowClassName}`} />
      <Header />

      <main className="relative mx-auto max-w-[1380px] px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <section className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className={`text-3xl font-black tracking-tight ${headingClassName}`}>Quản lý tài khoản người dùng</h1>
              <p className={`mt-2 max-w-3xl text-sm ${bodyCopyClassName}`}>
                Theo dõi quyền truy cập, vai trò, trạng thái tài khoản và import tài khoản nhân sự từ file.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setCreateAccountOpen(true)}
                className={`inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold text-slate-950 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-emerald-300 to-cyan-300 shadow-[0_12px_30px_rgba(74,222,128,0.24)]'
                    : 'bg-gradient-to-r from-emerald-300 to-cyan-400 shadow-[0_10px_24px_rgba(34,211,238,0.18)]'
                }`}
              >
                <span className="material-symbols-outlined mr-2 text-lg">person_add</span>
                Tạo tài khoản
              </button>
              <button
                type="button"
                onClick={() => setImportUsersOpen(true)}
                className={`inline-flex h-12 items-center justify-center rounded-2xl border px-5 text-sm font-bold ${
                  isDarkMode
                    ? 'border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.07]'
                    : 'border-slate-200 bg-white text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.14)] hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined mr-2 text-lg">upload_file</span>
                Import tài khoản nhân sự
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card, index) => (
            <div
              key={card.key}
              className={`rounded-[22px] border bg-gradient-to-br ${isDarkMode ? card.accent : lightMetricAccent[index]} p-4 backdrop-blur ${metricCardClassName}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-[11px] uppercase tracking-[0.26em] ${metricLabelClassName}`}>{card.label}</p>
                  {!isDarkMode ? <p className={`mt-2 text-[11px] font-semibold ${index === 3 ? 'text-rose-500' : 'text-emerald-500'}`}>{card.note}</p> : null}
                  <p className={`mt-2 text-3xl font-black ${metricValueClassName}`}>{summary[card.key]}</p>
                </div>
                <span className={`material-symbols-outlined rounded-xl p-2 text-emerald-300 ${metricIconWrapClassName}`}>
                  {card.icon}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className={`rounded-[26px] border p-4 backdrop-blur ${mainPanelClassName}`}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_140px_150px_150px]">
              <label className="relative">
                <span className={`material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  search
                </span>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Tìm theo tên, email hoặc số điện thoại"
                  className={`h-12 w-full rounded-2xl border pl-12 pr-4 text-sm ${inputClassName}`}
                />
              </label>

              <select
                value={filters.role}
                onChange={(event) => updateFilter('role', event.target.value)}
                className={`h-12 rounded-2xl border px-4 text-sm ${inputClassName}`}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>
                    {roleLabels[role] || role}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
                className={`h-12 rounded-2xl border px-4 text-sm ${inputClassName}`}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>
                    {statusLabels[status] || status}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={applyFilters}
                className={`h-12 rounded-2xl px-4 text-sm font-bold text-slate-950 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-emerald-400 to-green-300 shadow-[0_12px_30px_rgba(74,222,128,0.24)]'
                    : 'bg-gradient-to-r from-emerald-300 to-cyan-400 shadow-[0_10px_24px_rgba(34,211,238,0.18)]'
                }`}
              >
                Áp dụng bộ lọc
              </button>
            </div>

            <div className={`mt-4 overflow-hidden rounded-[24px] border ${tableSurfaceClassName}`}>
              <div className={`grid grid-cols-[minmax(240px,1.6fr)_0.9fr_0.9fr_0.8fr_42px] gap-3 border-b px-5 py-4 text-[11px] font-bold uppercase tracking-[0.26em] ${tableHeaderClassName}`}>
                <span>Hồ sơ người dùng</span>
                <span>Vai trò</span>
                <span>Xác minh</span>
                <span>Trạng thái</span>
                <span />
              </div>

              <div className={`divide-y ${tableDividerClassName}`}>
                {isLoading ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-400">Đang tải tài khoản người dùng...</div>
                ) : error ? (
                  <div className="px-5 py-12 text-center text-sm text-rose-300">{error}</div>
                ) : users.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-400">Không có tài khoản phù hợp với bộ lọc hiện tại.</div>
                ) : (
                  users.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => setSelectedUserId(user._id)}
                      className={`grid w-full grid-cols-[minmax(240px,1.6fr)_0.9fr_0.9fr_0.8fr_42px] gap-3 px-5 py-4 text-left transition ${
                        selectedUserId === user._id ? tableRowSelectedClassName : tableRowIdleClassName
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-cyan-400 text-sm font-black text-slate-950">
                          {(user.fullName || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${userNameClassName}`}>{user.fullName || 'Người dùng chưa rõ'}</p>
                          <p className={`truncate text-xs ${userMetaClassName}`}>{user.email || user.phone || 'Chưa có thông tin liên hệ'}</p>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isDarkMode ? 'bg-emerald-400/10 text-emerald-300' : 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100'
                        }`}>
                          {roleLabels[user.role] || user.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-base ${
                          isDarkMode ? verificationTone[String(user.isVerified)] : verificationToneLight[String(user.isVerified)]
                        }`}>
                          {user.isVerified ? 'verified' : 'schedule'}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{user.isVerified ? 'Đã xác minh' : 'Đang chờ'}</span>
                      </div>

                      <div className="flex items-center">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isDarkMode
                            ? (statusTone[user.status] || statusTone.INACTIVE)
                            : (statusToneLight[user.status] || statusToneLight.INACTIVE)
                        }`}>
                          {statusLabels[user.status] || user.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-end text-slate-500">
                        <span className="material-symbols-outlined text-lg">more_vert</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className={`flex items-center justify-between border-t px-5 py-4 text-xs ${paginationTextClassName} ${isDarkMode ? 'border-white/6' : 'border-slate-200'}`}>
                <p>
                  Hiển thị {(pagination.page - 1) * pagination.limit + (users.length ? 1 : 0)}-{(pagination.page - 1) * pagination.limit + users.length} trong {pagination.total} kết quả
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1 || isLoading}
                    onClick={() => updateFilter('page', Math.max(1, pagination.page - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-slate-300 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">chevron_left</span>
                  </button>
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-emerald-400 px-2 font-bold text-slate-950">
                    {pagination.page}
                  </span>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages || isLoading}
                    onClick={() => updateFilter('page', Math.min(pagination.totalPages, pagination.page + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-slate-300 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <section className={`rounded-[26px] border p-4 backdrop-blur ${sidePanelClassName}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-bold ${sideTitleClassName}`}>Tổng quan quản lý</p>
                  <p className={`mt-1 text-xs ${sideSubClassName}`}>Theo dõi tình trạng tài khoản theo thời gian thực.</p>
                </div>
                <span className={`material-symbols-outlined rounded-lg p-2 text-emerald-300 ${isDarkMode ? 'bg-white/6' : 'bg-emerald-50'}`}>dashboard</span>
              </div>

              <div className="mt-4">
                {isDetailLoading ? (
                  <div className={`rounded-[22px] border px-4 py-10 text-center text-sm ${sideSubClassName} ${sideInnerCardClassName}`}>
                    Đang tải chi tiết tài khoản...
                  </div>
                ) : detailError ? (
                  <div className="rounded-[22px] border border-rose-400/15 bg-rose-400/10 px-4 py-10 text-center text-sm text-rose-200">
                    {detailError}
                  </div>
                ) : !selectedUser ? (
                  <div className={`rounded-[22px] border px-4 py-10 text-center text-sm ${sideSubClassName} ${sideInnerCardClassName}`}>
                    Chọn một tài khoản để xem chi tiết.
                  </div>
                ) : (
                  <div className={`rounded-[22px] border p-4 ${sideInnerCardClassName}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-cyan-400 text-sm font-black text-slate-950">
                        {(selectedUser.fullName || selectedUser.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${sideTitleClassName}`}>{selectedUser.fullName || 'Người dùng chưa rõ'}</p>
                        <p className="truncate text-xs text-emerald-300">{roleLabels[selectedUser.role] || selectedUser.role}</p>
                        <p className={`truncate text-[11px] ${sideSubClassName}`}>{selectedUser.email || selectedUser.phone || 'Chưa có thông tin liên hệ'}</p>
                      </div>
                    </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className={`rounded-2xl p-3 ${isDarkMode ? 'bg-white/[0.03]' : 'bg-white ring-1 ring-slate-100'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.24em] ${sideSubClassName}`}>Tài khoản</p>
                        <p className={`mt-2 text-xl font-black ${sideTitleClassName}`}>{selectedUser.walletBalance ?? 0}</p>
                      </div>
                      <div className={`rounded-2xl p-3 ${isDarkMode ? 'bg-white/[0.03]' : 'bg-white ring-1 ring-slate-100'}`}>
                        <p className={`text-[10px] uppercase tracking-[0.24em] ${sideSubClassName}`}>Hiệu suất</p>
                        <p className="mt-2 text-xl font-black text-emerald-300">{selectedHealth}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Lý do khóa</span>
                        <textarea
                          value={lockReason}
                          onChange={(event) => setLockReason(event.target.value)}
                          rows="3"
                          className={`w-full rounded-2xl border px-4 py-3 text-sm ${inputTextClassName}`}
                          placeholder="Nhập lý do khóa tài khoản này"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Thời gian khóa</span>
                        <select
                          value={lockDuration}
                          onChange={(event) => setLockDuration(event.target.value)}
                          className={`h-11 w-full rounded-2xl border px-4 text-sm ${inputTextClassName}`}
                        >
                          {lockDurations.map((option) => (
                            <option key={option.value} value={option.value} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={isSubmittingLock || selectedUser.status === 'LOCKED'}
                          onClick={() => setConfirmAction('lock')}
                          className={`rounded-2xl px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${
                            isDarkMode
                              ? 'bg-gradient-to-r from-rose-400 to-orange-300'
                              : 'bg-gradient-to-r from-rose-500 to-red-400 text-white'
                          }`}
                        >
                          {isSubmittingLock ? 'Đang xử lý...' : 'Khóa tài khoản'}
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingLock || selectedUser.status !== 'LOCKED'}
                          onClick={() => setConfirmAction('unlock')}
                          className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Mở khóa tài khoản
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Hoạt động gần đây</p>
                <div className="mt-3 space-y-3">
                  {recentActivity.map((item, index) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-emerald-300' : 'bg-slate-500'}`} />
                        {index < recentActivity.length - 1 ? <span className="mt-2 h-full w-px bg-white/8" /> : null}
                      </div>
                      <div className="pb-3">
                        <p className="text-[11px] text-slate-500">{item.time}</p>
                        <p className="mt-1 text-sm font-medium text-slate-200">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className={`rounded-2xl border p-4 ${
                  isDarkMode ? 'border-emerald-400/10 bg-emerald-400/10' : 'border-emerald-100 bg-emerald-50'
                }`}>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'}`}>Cần rà soát quyền truy cập</p>
                  <p className={`mt-2 text-xs leading-5 ${isDarkMode ? 'text-emerald-100/75' : 'text-emerald-700/80'}`}>
                    {summary.pendingUsers} tài khoản đang chờ cần được xác minh thủ công.
                  </p>
                </div>
                <div className={`rounded-2xl border p-4 ${
                  isDarkMode ? 'border-rose-400/10 bg-rose-400/10' : 'border-rose-100 bg-rose-50'
                }`}>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-rose-200' : 'text-rose-700'}`}>Cảnh báo bảo mật quan trọng</p>
                  <p className={`mt-2 text-xs leading-5 ${isDarkMode ? 'text-rose-100/75' : 'text-rose-700/80'}`}>
                    {summary.lockedUsers} tài khoản bị hạn chế đang cần quản trị viên kiểm tra.
                  </p>
                </div>
              </div>
            </section>

            <section className={`rounded-[26px] border p-4 backdrop-blur ${sidePanelClassName}`}>
              <p className={`text-sm font-bold ${sideTitleClassName}`}>Điều phối nhanh</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <QuickActionCard icon="manage_accounts" label="Người dùng được phân công" value={summary.activeUsers} isDarkMode={isDarkMode} />
                <QuickActionCard icon="gpp_good" label="Bảo mật" value={summary.verifiedUsers} isDarkMode={isDarkMode} />
                <QuickActionCard icon="description" label="Báo cáo" value={pagination.total} isDarkMode={isDarkMode} />
                <QuickActionCard icon="hub" label="Điểm kết nối" value={summary.totalUsers} isDarkMode={isDarkMode} />
              </div>
            </section>

          </aside>
        </section>

      </main>

      <Modal
        open={createAccountOpen}
        tone="success"
        title="Tạo tài khoản mới"
        description="Admin tạo tài khoản cho tài xế hoặc phụ xe. Hệ thống tự sinh mật khẩu tạm thời, gửi về email đăng ký và yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên."
        onClose={() => {
          if (!isCreatingAccount) {
            setCreateAccountOpen(false);
            resetCreateAccount();
          }
        }}
        actions={(
          <>
            <button
              type="button"
              onClick={() => {
                setCreateAccountOpen(false);
                resetCreateAccount();
              }}
              disabled={isCreatingAccount}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={isCreatingAccount}
              className="rounded-2xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {isCreatingAccount ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </>
        )}
      >
        <div className="grid gap-4">
          <label className="block">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Họ tên</span>
            <input
              type="text"
              value={createAccountForm.fullName}
              onChange={(event) => updateCreateAccountField('fullName', event.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500"
              placeholder="Nguyễn Văn A"
            />
            {createAccountErrors.fullName ? <p className="mt-2 text-xs text-rose-200">{createAccountErrors.fullName}</p> : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Email</span>
              <input
                type="email"
                value={createAccountForm.email}
                onChange={(event) => updateCreateAccountField('email', event.target.value)}
                className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500"
                placeholder="user@example.com"
              />
              {createAccountErrors.email ? <p className="mt-2 text-xs text-rose-200">{createAccountErrors.email}</p> : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Số điện thoại</span>
              <input
                type="tel"
                value={createAccountForm.phone}
                onChange={(event) => updateCreateAccountField('phone', event.target.value)}
                className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500"
                placeholder="0901234567"
              />
              {createAccountErrors.phone ? <p className="mt-2 text-xs text-rose-200">{createAccountErrors.phone}</p> : null}
            </label>
          </div>

          {createAccountErrors.identifier ? (
            <div className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
              {createAccountErrors.identifier}
            </div>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Vai trò</span>
            <select
              value={createAccountForm.role}
              onChange={(event) => updateCreateAccountField('role', event.target.value)}
              className="h-11 w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 text-sm text-white"
            >
              {createAccountRoleOptions.map((role) => (
                <option key={role} value={role} style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>
                  {roleLabels[role] || role}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-xs leading-5 text-slate-300">
            Tài khoản chỉ được tạo khi hệ thống gửi thành công email chứa thông tin đăng nhập và mật khẩu tạm thời.
          </div>

          {createAccountErrors.general ? (
            <div className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
              {createAccountErrors.general}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={importUsersOpen}
        tone="success"
        title="Import tài khoản nhân sự"
        description="Import danh sách từ file CSV xuất từ Excel. Cần có cột email/sđt, fullName, role; tài khoản không có email sẽ bị bỏ qua vì không thể gửi mật khẩu."
        onClose={() => {
          if (!isImportingUsers) {
            setImportUsersOpen(false);
            resetImportUsers();
          }
        }}
        actions={(
          <>
            <button
              type="button"
              onClick={() => {
                setImportUsersOpen(false);
                resetImportUsers();
              }}
              disabled={isImportingUsers}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleImportUsers}
              disabled={isImportingUsers || !importFile}
              className="rounded-2xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {isImportingUsers ? 'Đang import...' : 'Import tài khoản'}
            </button>
          </>
        )}
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-xs leading-5 text-slate-300">
            <p className="font-semibold text-white">Mẫu cột:</p>
            <p className="mt-1 font-mono">email,phone,fullName,role</p>
            <p className="mt-1 font-mono">hoặc: email/sdt,fullName,role</p>
            <p className="mt-2">Role hợp lệ: DRIVER, CONDUCTOR. Mật khẩu tạm thời sẽ tự sinh và gửi qua email. Tài khoản vận hành bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
          </div>

          <label className="block">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">File import</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] || null);
                setImportErrors({});
                setImportResult(null);
              }}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-300 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950"
            />
          </label>

          {importErrors.general ? (
            <div className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
              {importErrors.general}
            </div>
          ) : null}

          {importResult?.failed?.length ? (
            <div className="max-h-40 overflow-y-auto rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
              {importResult.failed.map((item) => (
                <p key={`${item.rowNumber}-${item.email}`}>Dòng {item.rowNumber}: {item.reason}</p>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={confirmAction === 'lock'}
        tone="danger"
        title="Xác nhận khóa tài khoản"
        description={`Thao tác này sẽ ngăn ${selectedUser?.fullName || 'người dùng này'} truy cập hệ thống cho đến khi hết thời hạn khóa hoặc quản trị viên mở khóa.`}
        onClose={() => !isSubmittingLock && setConfirmAction(null)}
        actions={(
          <>
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={isSubmittingLock}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleLockAccount}
              disabled={isSubmittingLock}
              className="rounded-2xl bg-gradient-to-r from-rose-400 to-orange-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {isSubmittingLock ? 'Đang khóa...' : 'Xác nhận khóa'}
            </button>
          </>
        )}
      >
        <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
          <p><span className="font-semibold text-white">Lý do:</span> {lockReason || 'Chưa nhập lý do'}</p>
          <p><span className="font-semibold text-white">Thời gian:</span> {lockDurations.find((item) => item.value === lockDuration)?.label || 'Tùy chỉnh'}</p>
        </div>
      </Modal>

      <Modal
        open={confirmAction === 'unlock'}
        tone="success"
        title="Xác nhận mở khóa tài khoản"
        description={`Thao tác này sẽ kích hoạt lại ${selectedUser?.fullName || 'người dùng này'} ngay lập tức và khôi phục quyền truy cập hệ thống.`}
        onClose={() => !isSubmittingLock && setConfirmAction(null)}
        actions={(
          <>
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={isSubmittingLock}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleUnlockAccount}
              disabled={isSubmittingLock}
              className="rounded-2xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {isSubmittingLock ? 'Đang kích hoạt lại...' : 'Xác nhận kích hoạt lại'}
            </button>
          </>
        )}
      />

      <Modal
        open={resultModal.open}
        tone={resultModal.tone}
        title={resultModal.title}
        description={resultModal.message}
        onClose={() => setResultModal({ open: false, title: '', message: '', tone: 'default' })}
        actions={(
          <button
            type="button"
            onClick={() => setResultModal({ open: false, title: '', message: '', tone: 'default' })}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950"
          >
            Đồng ý
          </button>
        )}
      />
    </div>
  );
};

export default UserAccountsPage;

