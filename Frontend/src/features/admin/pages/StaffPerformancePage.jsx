import React, { useCallback, useEffect, useState } from 'react';
import toast from '../../../shared/utils/toast.js';
import adminService from '../services/adminService.js';

const emptySummary = {
  staffCount: 0,
  totalCompletedTrips: 0,
  totalIncidents: 0,
  averageOnTimeRate: 0,
};

const StaffPerformancePage = () => {
  const [summary, setSummary] = useState(emptySummary);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminService.getStaffPerformance();
      setSummary(response.summary || emptySummary);
      setStaffMembers(response.staffMembers || []);
    } catch (error) {
      toast.error(error.message || 'Không thể tải hiệu suất nhân viên');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = [
    ['Nhân sự vận hành', summary.staffCount, 'badge'],
    ['Chuyến hoàn thành', summary.totalCompletedTrips, 'directions_bus'],
    ['Sự cố ghi nhận', summary.totalIncidents, 'warning'],
    ['Tỷ lệ đúng giờ', `${summary.averageOnTimeRate || 0}%`, 'schedule'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary">Hiệu suất nhân viên</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Theo dõi tài xế và phụ xe qua số chuyến, sự cố, tỷ lệ đúng giờ và điểm hiệu suất.
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
          <span className="material-symbols-outlined text-lg">refresh</span>
          Làm mới
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, icon]) => (
          <div key={label} className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-outline">{label}</p>
              <span className="material-symbols-outlined rounded-xl bg-secondary-container p-2 text-secondary">{icon}</span>
            </div>
            <p className="mt-4 text-3xl font-black text-primary">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-outline-variant/35 bg-white shadow-sm">
        <div className="border-b border-outline-variant/30 px-5 py-4">
          <h2 className="text-lg font-bold text-primary">Bảng hiệu suất vận hành</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] divide-y divide-outline-variant/30 text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-[0.1em] text-outline">
              <tr>
                {['Nhân viên', 'Vai trò', 'Chuyến hoàn thành', 'Sự cố', 'Đúng giờ', 'Điểm hiệu suất', 'Hoạt động cuối'].map((heading) => (
                  <th key={heading} className="px-5 py-4">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-on-surface-variant">Đang tải dữ liệu...</td></tr>
              ) : staffMembers.length ? staffMembers.map((member) => (
                <tr key={member._id} className="hover:bg-surface-container-low/70">
                  <td className="px-5 py-4">
                    <p className="font-bold text-primary">{member.fullName || 'Chưa cập nhật'}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{member.email || member.phoneNumber}</p>
                  </td>
                  <td className="px-5 py-4">{member.role}</td>
                  <td className="px-5 py-4">{member.staffMetrics?.completedTrips || 0}</td>
                  <td className="px-5 py-4">{member.staffMetrics?.incidents || 0}</td>
                  <td className="px-5 py-4">{member.staffMetrics?.onTimeRate || 0}%</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-secondary">
                      {member.staffMetrics?.performanceScore || 0}/100
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {member.staffMetrics?.lastActivityAt
                      ? new Date(member.staffMetrics.lastActivityAt).toLocaleString('vi-VN')
                      : 'Chưa có'}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-on-surface-variant">Chưa có dữ liệu nhân viên vận hành.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default StaffPerformancePage;
