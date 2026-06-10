import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  Download,
  LoaderCircle,
  MapPinned,
  RefreshCcw,
  TicketPercent,
  WalletCards,
} from 'lucide-react';
import AdminPromotionShell from '../components/AdminPromotionShell.jsx';
import promotionAdminService from '../services/promotionAdminService.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const money = (value) => `${Number(value || 0).toLocaleString()} VND`;

const percent = (value) => {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  return `${value}%`;
};

const MetricCard = ({ label, value, icon: Icon, detail }) => (
  <div className="rounded-[24px] border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">{label}</p>
      <div className="rounded-full bg-primary-fixed p-2 text-on-primary-fixed">
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <p className="mt-4 text-2xl font-headline font-extrabold text-primary">{value}</p>
    <p className="mt-2 text-sm text-on-surface-variant">{detail}</p>
  </div>
);

const BarList = ({ items, labelKey, valueKey, valueFormatter = (value) => value }) => {
  const max = useMemo(
    () => Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1),
    [items, valueKey]
  );

  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-8 text-center text-sm text-on-surface-variant">
        No usage data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        const width = `${Math.max((value / max) * 100, 6)}%`;

        return (
          <div key={`${item[labelKey]}-${value}`} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold text-on-surface">{item[labelKey] || 'N/A'}</span>
              <span className="text-on-surface-variant">{valueFormatter(value)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-on-tertiary-container" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DataPanel = ({ title, children }) => (
  <section className="rounded-[28px] border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
    <h2 className="text-lg font-bold text-primary">{title}</h2>
    <div className="mt-5">{children}</div>
  </section>
);

const PromotionStatisticsPage = () => {
  const [statistics, setStatistics] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [filters, setFilters] = useState({
    promotionId: '',
    startDate: '',
    endDate: '',
    routeId: '',
    status: 'APPLIED',
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [statisticsResponse, promotionResponse] = await Promise.all([
        filters.promotionId
          ? promotionAdminService.getPromotionStatistics(filters.promotionId, filters)
          : promotionAdminService.getOverviewStatistics(filters),
        promotionAdminService.getPromotions({ limit: 100 }),
      ]);

      setStatistics(statisticsResponse.data);
      setPromotions(promotionResponse.data || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load promotion statistics');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(statistics || {}, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'promotion-statistics.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const topPromotions = statistics?.topPromotionsByUsage || [];
  const usageByDate = statistics?.usageByDate || [];
  const usageByRoute = statistics?.usageByRoute || [];
  const usageByPaymentMethod = statistics?.usageByPaymentMethod || [];

  return (
    <AdminPromotionShell
      title="Promotion Statistics"
      subtitle="Review redemption volume, discounts, route impact, and payment method usage without exposing passenger data."
      action={(
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-white px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!statistics}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      )}
    >
      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_160px_150px]">
          <select
            value={filters.promotionId}
            onChange={(event) => updateFilter('promotionId', event.target.value)}
            className={fieldClassName}
          >
            <option value="">All promotions</option>
            {promotions.map((promotion) => (
              <option key={promotion._id} value={promotion._id}>
                {promotion.code} - {promotion.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => updateFilter('startDate', event.target.value)}
            className={fieldClassName}
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => updateFilter('endDate', event.target.value)}
            className={fieldClassName}
          />
          <input
            value={filters.routeId}
            onChange={(event) => updateFilter('routeId', event.target.value)}
            className={fieldClassName}
            placeholder="Route ObjectId"
          />
          <select
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className={fieldClassName}
          >
            <option value="">All usage status</option>
            <option value="APPLIED">Applied</option>
            <option value="REVERSED">Reversed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </section>

      {isLoading ? (
        <div className="mt-8 flex items-center justify-center rounded-[28px] bg-white/80 px-5 py-16 text-primary">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Loading statistics...
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Total promotions"
              value={statistics?.totalPromotions ?? (statistics?.promotion ? 1 : 0)}
              icon={TicketPercent}
              detail={`${statistics?.activePromotions ?? 0} active campaigns`}
            />
            <MetricCard
              label="Total redemptions"
              value={statistics?.totalRedemptions ?? 0}
              icon={CalendarDays}
              detail="Applied usage records"
            />
            <MetricCard
              label="Discount given"
              value={money(statistics?.totalDiscountGiven)}
              icon={WalletCards}
              detail="Total passenger savings"
            />
            <MetricCard
              label="Revenue impact"
              value={money(statistics?.revenueImpact)}
              icon={MapPinned}
              detail="Original amount minus final amount"
            />
            <MetricCard
              label="Redemption rate"
              value={percent(statistics?.redemptionRate)}
              icon={TicketPercent}
              detail="Based on configured usage limits"
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <DataPanel title="Usage over time">
              <BarList
                items={usageByDate}
                labelKey="date"
                valueKey="redemptions"
                valueFormatter={(value) => `${value} redemptions`}
              />
            </DataPanel>

            <DataPanel title="Usage by route">
              <BarList
                items={usageByRoute}
                labelKey="routeLabel"
                valueKey="redemptions"
                valueFormatter={(value) => `${value} redemptions`}
              />
            </DataPanel>

            <DataPanel title="Usage by payment method">
              <BarList
                items={usageByPaymentMethod}
                labelKey="paymentMethod"
                valueKey="redemptions"
                valueFormatter={(value) => `${value} redemptions`}
              />
            </DataPanel>

            <DataPanel title="Top promotions by usage">
              {topPromotions.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.14em] text-outline">
                      <tr>
                        <th className="py-3 pr-4">Code</th>
                        <th className="py-3 pr-4">Name</th>
                        <th className="py-3 pr-4">Usage</th>
                        <th className="py-3 pr-4">Discount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {topPromotions.map((promotion) => (
                        <tr key={promotion.promotionId}>
                          <td className="py-3 pr-4 font-bold text-primary">
                            {promotion.code || 'N/A'}
                          </td>
                          <td className="py-3 pr-4 text-on-surface">{promotion.name || 'N/A'}</td>
                          <td className="py-3 pr-4 text-on-surface-variant">
                            {promotion.usedCount}
                          </td>
                          <td className="py-3 pr-4 text-on-surface-variant">
                            {money(promotion.totalDiscountGiven)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-outline-variant bg-surface-container-low px-5 py-8 text-center text-sm text-on-surface-variant">
                  No top promotion data available for this filter.
                </div>
              )}
            </DataPanel>
          </section>
        </>
      )}
    </AdminPromotionShell>
  );
};

export default PromotionStatisticsPage;
