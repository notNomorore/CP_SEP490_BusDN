import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  ReceiptText,
  RefreshCcw,
  Ticket,
  WalletCards,
} from 'lucide-react';
import AdminPromotionShell from '../../promotions/components/AdminPromotionShell.jsx';
import revenueReportService from '../services/revenueReportService.js';

const fieldClassName =
  'w-full rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-on-tertiary-container focus:ring-2 focus:ring-on-tertiary-container/20';

const money = (value) => `${Number(value || 0).toLocaleString()} VND`;
const today = new Date();

const defaultFilters = {
  startDate: format(subDays(today, 30), 'yyyy-MM-dd'),
  endDate: format(today, 'yyyy-MM-dd'),
  routeId: '',
  paymentMethod: '',
  ticketType: '',
  groupBy: 'day',
};

const MetricCard = ({ label, value, detail, icon: Icon }) => (
  <div className="rounded-[24px] border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-outline">{label}</p>
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
        No report data found for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        const width = `${Math.max((value / max) * 100, 5)}%`;

        return (
          <div key={`${item[labelKey]}-${value}`} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 truncate font-semibold text-on-surface">
                {item[labelKey] || 'N/A'}
              </span>
              <span className="shrink-0 text-on-surface-variant">{valueFormatter(value)}</span>
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

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const RevenueReportsPage = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [report, setReport] = useState(null);
  const [ticketSales, setTicketSales] = useState(null);
  const [peakHour, setPeakHour] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState('');

  const loadReports = useCallback(async () => {
    if (!filters.startDate || !filters.endDate) {
      return;
    }

    setIsLoading(true);

    try {
      const [reportResponse, ticketResponse, peakResponse] = await Promise.all([
        revenueReportService.getRevenueReport(filters),
        revenueReportService.getTicketSalesStatistics(filters),
        revenueReportService.getPeakHourDemand(filters),
      ]);

      setReport(reportResponse.data);
      setTicketSales(ticketResponse.data);
      setPeakHour(peakResponse.data);
    } catch (error) {
      toast.error(error.message || 'Report generation failed');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleExport = async (formatValue) => {
    setExportingFormat(formatValue);

    try {
      const blob = await revenueReportService.exportReport({
        ...filters,
        format: formatValue,
      });
      downloadBlob(blob, `busdn-financial-report.${formatValue === 'pdf' ? 'pdf' : 'xls'}`);
      toast.success('Financial report exported');
    } catch (error) {
      toast.error(error.message || 'Export failed');
    } finally {
      setExportingFormat('');
    }
  };

  const revenuePerDay = useMemo(() => {
    const rows = report?.revenueByDate || [];
    if (!rows.length) {
      return 0;
    }

    return rows.reduce((total, item) => total + Number(item.revenue || 0), 0) / rows.length;
  }, [report]);

  return (
    <AdminPromotionShell
      title="Revenue Reports"
      subtitle="Monitor ticket revenue, payment mix, route ranking, and operating-hour demand using aggregated data only."
      action={(
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadReports}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-white px-5 py-3 text-sm font-bold text-primary hover:bg-surface-container-low"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={exportingFormat === 'pdf'}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportingFormat === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={exportingFormat === 'excel'}
            className="inline-flex items-center gap-2 rounded-full bg-on-tertiary-container px-5 py-3 text-sm font-bold text-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportingFormat === 'excel' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Export Excel
          </button>
        </div>
      )}
    >
      <section className="rounded-[28px] border border-outline-variant/35 bg-white/80 p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[150px_150px_1fr_180px_160px_140px]">
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
            value={filters.paymentMethod}
            onChange={(event) => updateFilter('paymentMethod', event.target.value)}
            className={fieldClassName}
          >
            <option value="">All payment methods</option>
            <option value="E_WALLET">E-wallet</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="WALLET">Wallet</option>
          </select>
          <select
            value={filters.ticketType}
            onChange={(event) => updateFilter('ticketType', event.target.value)}
            className={fieldClassName}
          >
            <option value="">All ticket types</option>
            <option value="E_TICKET">E-ticket</option>
            <option value="WALK_IN">Walk-in</option>
            <option value="MONTHLY_PASS">Monthly pass</option>
          </select>
          <select
            value={filters.groupBy}
            onChange={(event) => updateFilter('groupBy', event.target.value)}
            className={fieldClassName}
          >
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
            <option value="route">By route</option>
            <option value="paymentMethod">By payment</option>
          </select>
        </div>
      </section>

      {isLoading ? (
        <div className="mt-8 flex items-center justify-center rounded-[28px] bg-white/80 px-5 py-16 text-primary">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Loading revenue report...
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Total Revenue"
              value={money(report?.totalRevenue)}
              detail={`${report?.revenueGrowthRate ?? 0}% growth in selected range`}
              icon={WalletCards}
            />
            <MetricCard
              label="Tickets Sold"
              value={report?.totalTicketsSold ?? 0}
              detail={`${report?.totalTransactions ?? 0} completed transactions`}
              icon={Ticket}
            />
            <MetricCard
              label="Average Ticket"
              value={money(report?.averageTicketPrice)}
              detail="Net revenue divided by tickets"
              icon={ReceiptText}
            />
            <MetricCard
              label="Revenue per Day"
              value={money(revenuePerDay)}
              detail="Average across visible periods"
              icon={CalendarDays}
            />
            <MetricCard
              label="Refunds"
              value={money(report?.totalRefunds)}
              detail="Refunded transactions excluded from net revenue"
              icon={BarChart3}
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <DataPanel title="Revenue over time">
              <BarList
                items={report?.revenueByDate || []}
                labelKey="date"
                valueKey="revenue"
                valueFormatter={money}
              />
            </DataPanel>

            <DataPanel title="Revenue by payment method">
              <BarList
                items={report?.revenueByPaymentMethod || []}
                labelKey="paymentMethod"
                valueKey="revenue"
                valueFormatter={money}
              />
            </DataPanel>

            <DataPanel title="Ticket sales statistics">
              <BarList
                items={ticketSales?.ticketSalesByType || []}
                labelKey="ticketType"
                valueKey="ticketsSold"
                valueFormatter={(value) => `${value} tickets`}
              />
            </DataPanel>

            <DataPanel title="Peak hour demand">
              <BarList
                items={peakHour?.peakHours || []}
                labelKey="hour"
                valueKey="passengerCount"
                valueFormatter={(value) => `${value} passengers`}
              />
            </DataPanel>
          </section>

          <section className="mt-6 rounded-[28px] border border-outline-variant/35 bg-white/85 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-primary">Revenue by route</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-outline-variant/30 text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-outline">
                  <tr>
                    <th className="py-3 pr-4">Route</th>
                    <th className="py-3 pr-4">Revenue</th>
                    <th className="py-3 pr-4">Tickets</th>
                    <th className="py-3 pr-4">Transactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {(report?.revenueByRoute || []).length ? (
                    report.revenueByRoute.map((route) => (
                      <tr key={route.route}>
                        <td className="py-3 pr-4 font-bold text-primary">{route.route}</td>
                        <td className="py-3 pr-4 text-on-surface">{money(route.revenue)}</td>
                        <td className="py-3 pr-4 text-on-surface-variant">{route.ticketsSold}</td>
                        <td className="py-3 pr-4 text-on-surface-variant">{route.transactions}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-on-surface-variant">
                        No route revenue found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AdminPromotionShell>
  );
};

export default RevenueReportsPage;
