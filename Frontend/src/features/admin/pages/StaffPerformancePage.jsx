import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../shared/components/navigation/Header.jsx';
import { HOME_BUS_HERO_IMAGE } from '../../../shared/constants/images.js';
import useTheme from '../../../shared/hooks/useTheme.js';
import adminService from '../services/adminService.js';

const staffMetricCards = [
  { key: 'staffCount', label: 'Tổng nhân sự', icon: 'badge', accent: 'text-emerald-300' },
  { key: 'totalCompletedTrips', label: 'Chuyến hoàn thành', icon: 'local_shipping', accent: 'text-cyan-300' },
  { key: 'totalIncidents', label: 'Sự cố', icon: 'warning', accent: 'text-rose-300' },
  { key: 'averageRating', label: 'Điểm TB /5', icon: 'star', accent: 'text-lime-300' },
  { key: 'delayRate', label: 'Tỷ lệ trễ', icon: 'schedule', accent: 'text-amber-300' },
  { key: 'productivity', label: 'Điểm hiệu suất TB', icon: 'bolt', accent: 'text-emerald-300' },
];

const roleLabels = {
  ALL: 'Tất cả nhân sự',
  DRIVER: 'Tài xế',
  CONDUCTOR: 'Phụ xe',
  BUS_ASSISTANT: 'Phụ xe',
};

const lightMetricAccent = [
  'from-cyan-50 via-white to-cyan-100/70',
  'from-sky-50 via-white to-sky-100/70',
  'from-rose-50 via-white to-slate-100',
  'from-lime-50 via-white to-emerald-100/70',
  'from-amber-50 via-white to-orange-100/70',
  'from-teal-50 via-white to-cyan-100/70',
];

const rolePillTone = {
  DRIVER: 'bg-cyan-400/12 text-cyan-300',
  CONDUCTOR: 'bg-violet-400/12 text-violet-300',
  BUS_ASSISTANT: 'bg-fuchsia-400/12 text-fuchsia-300',
};

const rolePillToneLight = {
  DRIVER: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100',
  CONDUCTOR: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
  BUS_ASSISTANT: 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-100',
};

const formatRelativeTime = (value) => {
  if (!value) {
    return 'Chưa có hoạt động gần đây';
  }

  const diffHours = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60)));
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
};

const formatCompactValue = (value) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return String(value);
};

const formatRating = (score) => `${(Math.max(0, Math.min(score || 0, 100)) / 20).toFixed(1)}`;

const getOperationalStatus = (member) => {
  if (member.status === 'LOCKED') {
    return { label: 'Ngừng ca', tone: 'text-rose-300' };
  }

  if ((member.staffMetrics?.incidents || 0) > 0) {
    return { label: 'Tạm nghỉ', tone: 'text-amber-300' };
  }

  return { label: 'Đang làm việc', tone: 'text-emerald-300' };
};

const PerformanceTile = ({ label, value, tone = 'text-white', isDarkMode }) => (
  <div className={`rounded-2xl border p-4 ${isDarkMode ? 'border-white/6 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
  </div>
);

const StaffPerformancePage = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [staffPerformance, setStaffPerformance] = useState({
    summary: {
      staffCount: 0,
      totalCompletedTrips: 0,
      totalIncidents: 0,
      averageOnTimeRate: 0,
    },
    staffMembers: [],
  });
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const shellClassName = isDarkMode ? 'bg-[#071516] text-slate-100' : 'bg-[#f6fbfb] text-slate-900';
  const ambientBackgroundClassName = isDarkMode
    ? 'bg-[radial-gradient(circle_at_12%_14%,rgba(74,222,128,0.16),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.12),transparent_20%),radial-gradient(circle_at_68%_72%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#071516_0%,#0b1b1d_38%,#102427_100%)]'
    : 'bg-[radial-gradient(circle_at_12%_14%,rgba(45,212,191,0.10),transparent_18%),radial-gradient(circle_at_84%_18%,rgba(125,211,252,0.12),transparent_18%),linear-gradient(180deg,#fbffff_0%,#f5fbfb_44%,#eef7f8_100%)]';
  const gridOverlayClassName = isDarkMode
    ? 'opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)]'
    : 'opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)]';
  const topGlowClassName = isDarkMode
    ? 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_62%)]'
    : 'bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.08),transparent_40%)]';
  const pageTitleClassName = isDarkMode ? 'text-emerald-300' : 'text-slate-950';
  const bodyCopyClassName = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const backButtonClassName = isDarkMode
    ? 'border-white/10 bg-white/[0.04] text-white'
    : 'border-slate-200 bg-white text-slate-700 shadow-sm';
  const metricCardClassName = isDarkMode
    ? 'border-white/8 bg-[linear-gradient(180deg,rgba(17,31,34,0.92),rgba(13,24,27,0.86))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
    : 'border-slate-200/90 shadow-[0_14px_30px_rgba(148,163,184,0.14)]';
  const metricLabelClassName = isDarkMode ? 'text-slate-500' : 'text-slate-500';
  const metricValueClassName = isDarkMode ? 'text-white' : 'text-slate-900';
  const metricIconWrapClassName = isDarkMode ? 'bg-white/[0.04]' : 'bg-[#f2fbfb] ring-1 ring-slate-100';
  const panelClassName = isDarkMode
    ? 'border-white/8 bg-[#111d20]/85 shadow-[0_20px_60px_rgba(0,0,0,0.18)]'
    : 'border-slate-200/80 bg-white/98 shadow-[0_18px_36px_rgba(148,163,184,0.16)]';
  const innerPanelClassName = isDarkMode ? 'border-white/6 bg-[#0d1719]' : 'border-slate-200 bg-[#fffdfa]';
  const tilePanelClassName = isDarkMode ? 'border-white/8 bg-[#15292b]' : 'border-slate-200 bg-slate-50';
  const inputClassName = isDarkMode
    ? 'border-white/8 bg-white/[0.04] text-white placeholder:text-slate-500'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400';
  const titleClassName = isDarkMode ? 'text-white' : 'text-slate-900';
  const subtitleClassName = isDarkMode ? 'text-slate-500' : 'text-slate-500';
  const tableHeaderClassName = isDarkMode
    ? 'border-white/6 text-slate-500'
    : 'border-slate-200/80 bg-slate-50 text-slate-500';
  const rowSelectedClassName = isDarkMode ? 'bg-emerald-400/10' : 'bg-[linear-gradient(90deg,rgba(236,254,255,0.95),rgba(248,250,252,1))]';
  const rowIdleClassName = isDarkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-cyan-50/50';
  const textPrimaryClassName = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondaryClassName = isDarkMode ? 'text-slate-500' : 'text-slate-500';
  const textMutedClassName = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const chartSurfaceClassName = isDarkMode ? 'border-white/6 bg-[#0d1719]' : 'border-slate-200 bg-white';

  const filteredStaffMembers = useMemo(() => {
    const searchValue = staffSearch.trim().toLowerCase();

    return staffPerformance.staffMembers.filter((member) => {
      const matchesRole = staffRoleFilter === 'ALL'
        || member.role === staffRoleFilter
        || (staffRoleFilter === 'CONDUCTOR' && member.role === 'BUS_ASSISTANT');
      if (!matchesRole) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const haystack = [member.fullName, member.email, member.phone, member.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchValue);
    });
  }, [staffPerformance.staffMembers, staffRoleFilter, staffSearch]);

  const selectedMember = useMemo(() => {
    return filteredStaffMembers.find((member) => member._id === selectedMemberId)
      || staffPerformance.staffMembers.find((member) => member._id === selectedMemberId)
      || filteredStaffMembers[0]
      || staffPerformance.staffMembers[0]
      || null;
  }, [filteredStaffMembers, selectedMemberId, staffPerformance.staffMembers]);

  const analyticsSummary = useMemo(() => {
    const staffCount = staffPerformance.summary.staffCount || 0;
    const totalCompletedTrips = staffPerformance.summary.totalCompletedTrips || 0;
    const totalIncidents = staffPerformance.summary.totalIncidents || 0;
    const averageOnTimeRate = staffPerformance.summary.averageOnTimeRate || 0;
    const staffWithScoredPerformance = staffPerformance.staffMembers.filter(
      (member) => (member.staffMetrics?.performanceScore || 0) > 0
    );
    const productivityScore = staffWithScoredPerformance.length > 0
      ? Math.round(
        staffWithScoredPerformance.reduce(
          (sum, member) => sum + (member.staffMetrics?.performanceScore || 0),
          0
        ) / staffWithScoredPerformance.length
      )
      : 0;
    const hasTripData = totalCompletedTrips > 0;
    const hasScoredPerformance = staffWithScoredPerformance.length > 0;

    return {
      staffCount,
      totalCompletedTrips,
      totalIncidents,
      hasTripData,
      hasScoredPerformance,
      averageRating: hasScoredPerformance ? (productivityScore / 20).toFixed(1) : 'N/A',
      averageOnTimeRate,
      delayRate: hasTripData ? `${Math.max(0, 100 - averageOnTimeRate).toFixed(1)}%` : 'N/A',
      productivity: hasScoredPerformance ? `${productivityScore}%` : 'N/A',
    };
  }, [staffPerformance]);

  const incidentBreakdown = useMemo(() => {
    const membersWithIncidents = staffPerformance.staffMembers.filter(
      (member) => (member.staffMetrics?.incidents || 0) > 0
    ).length;

    return {
      membersWithIncidents,
      incidentFreeMembers: Math.max(staffPerformance.summary.staffCount - membersWithIncidents, 0),
      incidentRate: staffPerformance.summary.staffCount > 0
        ? Math.round((membersWithIncidents / staffPerformance.summary.staffCount) * 100)
        : 0,
    };
  }, [staffPerformance]);

  const efficiencyBars = useMemo(() => {
    const candidates = [...staffPerformance.staffMembers]
      .sort((a, b) => (b.staffMetrics?.completedTrips || 0) - (a.staffMetrics?.completedTrips || 0))
      .slice(0, 6);
    const maxTrips = Math.max(...candidates.map((member) => member.staffMetrics?.completedTrips || 0), 1);

    return candidates.map((member) => ({
      id: member._id,
      label: member.fullName || member.email || 'Nhân sự',
      trips: member.staffMetrics?.completedTrips || 0,
      height: Math.max(28, Math.round(((member.staffMetrics?.completedTrips || 0) / maxTrips) * 86)),
    }));
  }, [staffPerformance.staffMembers]);

  const hasMeaningfulEfficiencyData = useMemo(() => {
    return efficiencyBars.some((bar) => bar.height > 28);
  }, [efficiencyBars]);

  const topPerformers = useMemo(() => {
    return [...staffPerformance.staffMembers]
      .filter((member) => (member.staffMetrics?.performanceScore || 0) > 0)
      .sort((a, b) => (b.staffMetrics?.performanceScore || 0) - (a.staffMetrics?.performanceScore || 0))
      .slice(0, 3);
  }, [staffPerformance.staffMembers]);

  const recentActivity = useMemo(() => {
    return (selectedMember?.activityReports || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);
  }, [selectedMember]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await adminService.getStaffPerformance();
        if (ignore) {
          return;
        }

        const nextState = {
          summary: response.summary || {
            staffCount: 0,
            totalCompletedTrips: 0,
            totalIncidents: 0,
            averageOnTimeRate: 0,
          },
          staffMembers: response.staffMembers || [],
        };

        setStaffPerformance(nextState);
        setSelectedMemberId((current) => current || nextState.staffMembers[0]?._id || '');
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || 'Không thể tải hiệu suất nhân sự vận hành');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, []);

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
      <Header />

      <main className="relative mx-auto max-w-[1380px] px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className={`text-4xl font-black tracking-tight ${pageTitleClassName}`}>Phân tích hiệu suất nhân sự vận hành</h1>
              <p className={`mt-2 max-w-3xl text-sm ${bodyCopyClassName}`}>
                Quản trị viên có thể xem thống kê hiệu suất tài xế, phụ xe, số chuyến hoàn thành, sự cố và trạng thái vận hành hiện tại.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className={`inline-flex h-12 items-center justify-center rounded-2xl border px-5 text-sm font-semibold ${backButtonClassName}`}
            >
              <span className="material-symbols-outlined mr-2 text-lg">manage_accounts</span>
              Quay lại tài khoản người dùng
            </button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {staffMetricCards.map((card, index) => (
            <div
              key={card.key}
              className={`rounded-[22px] border p-4 ${
                isDarkMode ? metricCardClassName : `bg-gradient-to-br ${lightMetricAccent[index]} ${metricCardClassName}`
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-[10px] uppercase tracking-[0.24em] ${metricLabelClassName}`}>{card.label}</p>
                  <p className={`mt-3 text-3xl font-black ${metricValueClassName}`}>
                    {card.key === 'staffCount' && analyticsSummary.staffCount}
                    {card.key === 'totalCompletedTrips' && formatCompactValue(analyticsSummary.totalCompletedTrips)}
                    {card.key === 'totalIncidents' && analyticsSummary.totalIncidents}
                    {card.key === 'averageRating' && (analyticsSummary.averageRating === 'N/A' ? 'N/A' : `${analyticsSummary.averageRating}/5`)}
                    {card.key === 'delayRate' && analyticsSummary.delayRate}
                    {card.key === 'productivity' && analyticsSummary.productivity}
                  </p>
                </div>
                <span className={`material-symbols-outlined rounded-xl p-2 text-lg ${card.accent} ${metricIconWrapClassName}`}>
                  {card.icon}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,2fr)_360px]">
          <section className={`rounded-[26px] border p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur ${panelClassName}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-emerald-300' : 'text-cyan-700'}`}>Danh sách nhân sự vận hành</p>
                <p className={`mt-1 text-xs ${subtitleClassName}`}>Theo dõi tài xế, phụ xe, sự cố và trạng thái vận hành hiện tại.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                <label className="relative">
                  <span className={`material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${subtitleClassName}`}>
                    search
                  </span>
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(event) => setStaffSearch(event.target.value)}
                    placeholder="Tìm tên hoặc email..."
                    className={`h-10 w-full rounded-2xl border pl-11 pr-4 text-sm ${inputClassName}`}
                  />
                </label>
                <select
                  value={staffRoleFilter}
                  onChange={(event) => setStaffRoleFilter(event.target.value)}
                  className={`h-10 rounded-2xl border px-4 text-sm ${inputClassName}`}
                >
                  <option value="ALL" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>{roleLabels.ALL}</option>
                  <option value="DRIVER" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>{roleLabels.DRIVER}</option>
                  <option value="CONDUCTOR" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>{roleLabels.CONDUCTOR}</option>
                </select>
              </div>
            </div>

            <div className={`mt-4 overflow-hidden rounded-[24px] border ${innerPanelClassName}`}>
              <div className={`grid grid-cols-[minmax(180px,1.7fr)_0.9fr_0.6fr_0.6fr_0.8fr_0.8fr_0.8fr] gap-3 border-b px-4 py-4 text-[10px] font-bold uppercase tracking-[0.24em] ${tableHeaderClassName}`}>
                <span>Nhân sự</span>
                <span>Vai trò</span>
                <span>Chuyến</span>
                <span>Điểm /5</span>
                <span>Sự cố</span>
                <span>Trạng thái</span>
                <span>Hoạt động gần nhất</span>
              </div>

              <div className="divide-y divide-white/6">
                {isLoading ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">Đang tải phân tích nhân sự vận hành...</div>
                ) : error ? (
                  <div className="px-4 py-12 text-center text-sm text-rose-300">{error}</div>
                ) : filteredStaffMembers.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">Không có nhân sự phù hợp với bộ lọc hiện tại.</div>
                ) : (
                  filteredStaffMembers.map((member) => {
                    const operationalStatus = getOperationalStatus(member);

                    return (
                      <button
                        key={member._id}
                        type="button"
                        onClick={() => setSelectedMemberId(member._id)}
                        className={`grid w-full grid-cols-[minmax(180px,1.7fr)_0.9fr_0.6fr_0.6fr_0.8fr_0.8fr_0.8fr] gap-3 px-4 py-4 text-left transition ${
                          selectedMember?._id === member._id ? rowSelectedClassName : rowIdleClassName
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-cyan-400 text-xs font-black text-slate-950">
                            {(member.fullName || member.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-semibold ${textPrimaryClassName}`}>{member.fullName || 'Nhân sự chưa rõ'}</p>
                            <p className={`truncate text-[11px] ${textSecondaryClassName}`}>{member.email || member.phone || 'Chưa có thông tin liên hệ'}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isDarkMode
                              ? (rolePillTone[member.role] || 'bg-white/8 text-slate-200')
                              : (rolePillToneLight[member.role] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200')
                          }`}>
                            {roleLabels[member.role] || member.role}
                          </span>
                        </div>
                        <div className={`flex items-center text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {member.staffMetrics?.completedTrips || 0}
                        </div>
                        <div className={`flex items-center text-sm font-semibold ${isDarkMode ? 'text-emerald-300' : 'text-cyan-700'}`}>
                          {formatRating(member.staffMetrics?.performanceScore)}
                        </div>
                        <div className={`flex items-center text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          {member.staffMetrics?.incidents || 0}
                        </div>
                        <div className={`flex items-center text-sm font-semibold ${operationalStatus.tone}`}>
                          {operationalStatus.label}
                        </div>
                        <div className={`flex items-center text-sm ${textMutedClassName}`}>
                          {formatRelativeTime(member.staffMetrics?.lastActivityAt || member.lastLoginAt)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className={`rounded-[26px] border p-4 ${panelClassName}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-bold ${titleClassName}`}>Số chuyến theo nhân sự vận hành</p>
                  <p className={`mt-1 text-xs ${subtitleClassName}`}>So sánh số chuyến đã hoàn thành. Cột cao hơn nghĩa là làm nhiều chuyến hơn.</p>
                </div>
                <span className={`material-symbols-outlined ${isDarkMode ? 'text-emerald-300' : 'text-cyan-600'}`}>trending_up</span>
              </div>

              <div className={`mt-5 rounded-[22px] border px-4 py-4 ${chartSurfaceClassName}`}>
                {efficiencyBars.length === 0 ? (
                  <div className={`flex h-32 items-center justify-center text-sm ${textMutedClassName}`}>
                    Chưa có dữ liệu chuyến hoàn thành.
                  </div>
                ) : hasMeaningfulEfficiencyData ? (
                  <div className="flex h-40 items-end justify-between gap-3 pt-2">
                    {efficiencyBars.map((bar) => (
                      <div key={bar.id} className="flex flex-1 flex-col items-center justify-end gap-2">
                        <span className={`text-xs font-bold ${textPrimaryClassName}`}>{bar.trips}</span>
                        <div
                          className={`w-full rounded-t-2xl ${
                            isDarkMode
                              ? 'bg-gradient-to-t from-emerald-400/60 to-emerald-300'
                              : 'bg-gradient-to-t from-cyan-500 to-emerald-300'
                          }`}
                          style={{ height: `${bar.height}px` }}
                          title={`${bar.label}: ${bar.trips} chuyến`}
                        />
                        <span className={`max-w-[72px] truncate text-center text-[10px] ${textSecondaryClassName}`} title={bar.label}>{bar.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-32 flex-col justify-center">
                    <div className="flex items-end gap-3">
                      {efficiencyBars.map((bar) => (
                        <div key={bar.id} className="flex flex-1 flex-col items-center gap-2">
                          <div className={`h-3 w-full rounded-full ${
                            isDarkMode
                              ? 'bg-gradient-to-r from-emerald-400/60 to-emerald-300'
                              : 'bg-gradient-to-r from-cyan-500 to-emerald-300'
                          }`} />
                          <span className={`max-w-[72px] truncate text-center text-[10px] ${textSecondaryClassName}`} title={bar.label}>{bar.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className={`mt-4 text-xs ${textMutedClassName}`}>
                      Chưa ghi nhận chuyến hoàn thành. Biểu đồ sẽ hiển thị rõ hơn khi có dữ liệu thực tế.
                    </p>
                  </div>
                )}
              </div>
              <p className={`mt-3 text-xs ${isDarkMode ? 'text-emerald-300' : 'text-cyan-700'}`}>
                {analyticsSummary.hasTripData
                  ? `Tỷ lệ đúng giờ trung bình hiện tại là ${analyticsSummary.averageOnTimeRate.toFixed(1)}%.`
                  : 'Chưa có chuyến hoàn thành. Thông tin sẽ xuất hiện sau khi ghi nhận vận hành.'}
              </p>
            </section>

            <section className={`rounded-[26px] border p-4 ${panelClassName}`}>
              <p className={`text-sm font-bold ${titleClassName}`}>Phân tích sự cố</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[conic-gradient(#fda4af_0deg,var(--incident-cutoff),#6ee7b7_var(--incident-cutoff),360deg)]" style={{ '--incident-cutoff': `${incidentBreakdown.incidentRate * 3.6}deg` }}>
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full text-sm font-black ${isDarkMode ? 'bg-[#0d1719] text-white' : 'bg-white text-slate-900 ring-1 ring-slate-200'}`}>
                    {incidentBreakdown.membersWithIncidents}
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className={`flex items-center gap-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    Không có sự cố: {incidentBreakdown.incidentFreeMembers}
                  </div>
                  <div className={`flex items-center gap-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                    Có sự cố: {incidentBreakdown.membersWithIncidents}
                  </div>
                </div>
              </div>
            </section>

            <section className={`rounded-[26px] border p-4 ${panelClassName}`}>
              <p className={`text-sm font-bold ${titleClassName}`}>Nhân sự nổi bật</p>
              <div className="mt-4 space-y-3">
                {topPerformers.length > 0 ? topPerformers.map((member, index) => (
                  <div key={member._id} className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${isDarkMode ? 'border-white/6 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${textSecondaryClassName}`}>#{index + 1}</span>
                      <div>
                    <p className={`text-sm font-semibold ${textPrimaryClassName}`}>{member.fullName || 'Nhân sự chưa rõ'}</p>
                        <p className={`text-xs ${textSecondaryClassName}`}>{roleLabels[member.role] || member.role}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${isDarkMode ? 'text-emerald-300' : 'text-cyan-700'}`}>
                      {member.staffMetrics?.performanceScore || 0}
                    </span>
                  </div>
                )) : (
                  <div className={`rounded-2xl border px-4 py-4 text-sm ${textMutedClassName} ${isDarkMode ? 'border-white/6 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                    Chưa có điểm hiệu suất để so sánh. Danh sách nổi bật sẽ xuất hiện sau khi ghi nhận chỉ số.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={`rounded-[26px] border p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur ${panelClassName}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-bold ${titleClassName}`}>Chi tiết nhân sự đã chọn</p>
                <p className={`mt-1 text-xs ${subtitleClassName}`}>Chỉ số chi tiết và trạng thái báo cáo hiện tại.</p>
              </div>
              <span className={`material-symbols-outlined rounded-lg p-2 ${isDarkMode ? 'bg-white/6 text-cyan-300' : 'bg-cyan-50 text-cyan-600'}`}>insights</span>
            </div>

            {!selectedMember ? (
              <div className={`mt-4 rounded-[22px] border px-4 py-10 text-center text-sm ${textMutedClassName} ${tilePanelClassName}`}>
                Chọn một nhân sự vận hành để xem hiệu suất.
              </div>
            ) : (
              <div className={`mt-4 rounded-[22px] border p-4 ${tilePanelClassName}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-cyan-400 text-sm font-black text-slate-950">
                    {(selectedMember.fullName || selectedMember.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${textPrimaryClassName}`}>{selectedMember.fullName || 'Nhân sự chưa rõ'}</p>
                    <p className={`truncate text-xs ${isDarkMode ? 'text-emerald-300' : 'text-cyan-700'}`}>{roleLabels[selectedMember.role] || selectedMember.role}</p>
                    <p className={`truncate text-[11px] ${textSecondaryClassName}`}>{selectedMember.email || selectedMember.phone || 'Chưa có thông tin liên hệ'}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <PerformanceTile label="Chuyến hoàn thành" value={selectedMember.staffMetrics?.completedTrips ?? 0} tone={isDarkMode ? 'text-emerald-300' : 'text-cyan-700'} isDarkMode={isDarkMode} />
                  <PerformanceTile label="Sự cố" value={selectedMember.staffMetrics?.incidents ?? 0} tone={isDarkMode ? 'text-rose-300' : 'text-rose-600'} isDarkMode={isDarkMode} />
                  <PerformanceTile label="Tỷ lệ đúng giờ" value={`${selectedMember.staffMetrics?.onTimeRate ?? 0}%`} tone={isDarkMode ? 'text-cyan-300' : 'text-cyan-700'} isDarkMode={isDarkMode} />
                  <PerformanceTile label="Điểm hiệu suất" value={`${selectedMember.staffMetrics?.performanceScore ?? 0}%`} tone={isDarkMode ? 'text-white' : 'text-slate-900'} isDarkMode={isDarkMode} />
                </div>
              </div>
            )}

            <div className="mt-5">
              <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${textSecondaryClassName}`}>Báo cáo hoạt động gần đây</p>
              <div className="mt-3 space-y-3">
                {recentActivity.length > 0 ? recentActivity.map((report, index) => (
                  <div key={`${report.type}-${index}`} className={`rounded-2xl border p-3 ${isDarkMode ? 'border-white/6 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
                    <p className={`text-xs font-semibold ${textPrimaryClassName}`}>{report.message}</p>
                    <p className={`mt-2 text-[11px] uppercase tracking-[0.18em] ${textSecondaryClassName}`}>{report.type}</p>
                    <p className={`mt-1 text-[11px] ${textSecondaryClassName}`}>{formatRelativeTime(report.createdAt)}</p>
                  </div>
                )) : (
                  <div className={`rounded-2xl border p-4 text-sm ${textMutedClassName} ${isDarkMode ? 'border-white/6 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
                    Chưa có báo cáo hoạt động nào cho nhân sự này.
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className={`rounded-[26px] border p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur ${panelClassName}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-bold ${titleClassName}`}>Phân công và vận hành</p>
                <p className={`mt-1 text-xs ${subtitleClassName}`}>Dữ liệu được tổng hợp từ lịch chuyến và báo cáo hiện có.</p>
              </div>
              <span className={`material-symbols-outlined rounded-lg p-2 ${isDarkMode ? 'bg-white/6 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>assignment</span>
            </div>

            {!selectedMember ? (
              <div className={`mt-4 rounded-[22px] border px-4 py-10 text-center text-sm ${textMutedClassName} ${tilePanelClassName}`}>
                Chọn một nhân sự vận hành để xem phân công và hiệu suất.
              </div>
            ) : (
              <div className={`mt-4 rounded-[22px] border p-4 ${tilePanelClassName}`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PerformanceTile label="Chuyến đang phân công" value={selectedMember.staffMetrics?.assignedTrips ?? 0} tone={isDarkMode ? 'text-cyan-300' : 'text-cyan-700'} isDarkMode={isDarkMode} />
                  <PerformanceTile label="Chuyến trễ" value={selectedMember.staffMetrics?.delayedTrips ?? 0} tone={isDarkMode ? 'text-amber-300' : 'text-amber-600'} isDarkMode={isDarkMode} />
                </div>

                <div className="mt-4">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${textSecondaryClassName}`}>Tuyến được phân công</p>
                  <div className="mt-3 space-y-3">
                    {selectedMember.assignedRoutes?.length ? selectedMember.assignedRoutes.map((route) => (
                      <div key={`${route.routeId}-${route.routeCode}`} className={`rounded-2xl border p-4 ${isDarkMode ? 'border-white/6 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
                        <p className={`text-sm font-bold ${textPrimaryClassName}`}>{route.routeCode || 'Tuyến chưa có mã'}</p>
                        <p className={`mt-1 text-xs ${textSecondaryClassName}`}>{route.routeName || 'Chưa có tên tuyến'}</p>
                      </div>
                    )) : (
                      <div className={`rounded-2xl border p-4 text-sm ${textMutedClassName} ${isDarkMode ? 'border-white/6 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
                        Chưa có lịch chuyến đang phân công cho nhân sự này.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
};

export default StaffPerformancePage;


