import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
} from 'react-leaflet';
import useAuthStore from '../../auth/stores/authStore.js';
import useLanguage from '../../../shared/hooks/useLanguage.js';
import RouteWorkflowPage from './routes/RouteWorkflowPage.jsx';
import UserAccountsPage from './UserAccountsPage.jsx';
import { RouteEfficiencyPage } from '../analytics';
import { FareOperationsPage } from '../fareOperations';
import { RevenueReportsPage } from '../revenue';
import { IncidentReportsPage } from '../incidents';
import { AdminPriorityVerificationPage } from '../../priorityProfile';
import { AdminCustomerSupportPage } from '../../customerSupport';
import { SystemMonitoringPage } from '../systemMonitoring';
import { PromotionManagementPage, PromotionStatisticsPage } from '../promotions';
import AdminFleetLocationPage from '../fleetMonitoring/pages/AdminFleetLocationPage.jsx';

const translations = {
  en: {
    commandTitle: 'BusDN Command',
    commandSubtitle: 'Regional Operations Center',
    commandCenter: 'Single-page Admin Command Center',
    searchPlaceholder: 'Search fleet, routes...',
    emergencyAlert: 'Emergency Alert',
    logout: 'Logout',
    switchLanguage: 'Switch to Vietnamese',
    fleet: 'Fleet Operations',
    routes: 'Route Management',
    scheduling: 'Scheduling',
    analytics: 'Analytics',
    farePromotions: 'Fare & Promotions',
    revenue: 'Revenue',
    incidents: 'Incidents',
    users: 'User Management',
    priority: 'Priority Verification',
    support: 'Customer Support',
    monitoring: 'System Monitoring',
    activeBuses: 'Active Buses',
    activeTrips: 'Active Trips',
    delayedTrips: 'Delayed Trips',
    fleetDescription: 'Real-time command surface for fleet movement, route health, and dispatch alerts.',
    liveFleetMap: 'Live Fleet Map',
    vehicleIssues: 'Vehicle Issues',
    maintenance: 'Maintenance',
    searchVehicle: 'Search Vehicle',
    routeFilter: 'Route Filter',
    vehicleFilter: 'Vehicle Filter',
    statusFilter: 'Status Filter',
    liveFleetStatus: 'Live Fleet Status',
    visible: 'visible',
    incidentAlerts: 'Incident Alerts',
    recentNotifications: 'Recent Notifications',
  },
  vi: {
    commandTitle: 'Điều hành BusDN',
    commandSubtitle: 'Trung tâm vận hành khu vực',
    commandCenter: 'Trung tâm điều hành quản trị một trang',
    searchPlaceholder: 'Tìm xe, tuyến...',
    emergencyAlert: 'Cảnh báo khẩn cấp',
    logout: 'Đăng xuất',
    switchLanguage: 'Chuyển sang tiếng Anh',
    fleet: 'Vận hành đội xe',
    routes: 'Quản lý tuyến',
    scheduling: 'Lịch vận hành',
    analytics: 'Phân tích',
    farePromotions: 'Giá vé & khuyến mãi',
    revenue: 'Doanh thu',
    incidents: 'Sự cố',
    users: 'Quản lý người dùng',
    priority: 'Xác minh ưu tiên',
    support: 'Hỗ trợ khách hàng',
    monitoring: 'Giám sát hệ thống',
    activeBuses: 'Xe đang hoạt động',
    activeTrips: 'Chuyến đang chạy',
    delayedTrips: 'Chuyến trễ',
    fleetDescription: 'Bảng điều hành thời gian thực cho đội xe, sức khỏe tuyến và cảnh báo điều phối.',
    liveFleetMap: 'Bản đồ đội xe',
    vehicleIssues: 'Vấn đề xe',
    maintenance: 'Bảo trì',
    searchVehicle: 'Tìm xe',
    routeFilter: 'Lọc tuyến',
    vehicleFilter: 'Lọc xe',
    statusFilter: 'Lọc trạng thái',
    liveFleetStatus: 'Trạng thái đội xe',
    visible: 'đang hiển thị',
    incidentAlerts: 'Cảnh báo sự cố',
    recentNotifications: 'Thông báo gần đây',
  },
};

const adminModules = [
  { id: 'fleet', labelKey: 'fleet', icon: 'directions_bus' },
  { id: 'routes', labelKey: 'routes', icon: 'map' },
  { id: 'scheduling', labelKey: 'scheduling', icon: 'calendar_month' },
  { id: 'analytics', labelKey: 'analytics', icon: 'monitoring' },
  { id: 'farePromotions', labelKey: 'farePromotions', icon: 'payments' },
  { id: 'revenue', labelKey: 'revenue', icon: 'confirmation_number' },
  { id: 'incidents', labelKey: 'incidents', icon: 'warning' },
  { id: 'users', labelKey: 'users', icon: 'person' },
  { id: 'priority', labelKey: 'priority', icon: 'verified_user' },
  { id: 'support', labelKey: 'support', icon: 'support_agent' },
  { id: 'monitoring', labelKey: 'monitoring', icon: 'admin_panel_settings' },
];

// Legacy dashboard-only fleet mock data is intentionally empty. The fleet module
// now renders AdminFleetLocationPage, which owns the live API/socket data flow.
const kpis = [];
const buses = [];
const routeOverlays = [];
const activeTrips = [];
const recentNotifications = [];
const incidentAlerts = [];

const revenueCards = [
  { label: 'Total Revenue', value: '1.24B VND', icon: 'payments' },
  { label: 'Ticket Sales', value: '684M VND', icon: 'confirmation_number' },
  { label: 'Monthly Pass', value: '421M VND', icon: 'calendar_month' },
  { label: 'Walk-in Tickets', value: '135M VND', icon: 'storefront' },
];

const users = [
  { name: 'Nguyen Van A', role: 'DRIVER', status: 'ACTIVE', lastLogin: '2 hours ago' },
  { name: 'Le Thi B', role: 'BUS_ASSISTANT', status: 'ACTIVE', lastLogin: '5 hours ago' },
  { name: 'Tran Van C', role: 'PASSENGER', status: 'LOCKED', lastLogin: '2 days ago' },
];

const requests = [
  { name: 'Hoang Minh', type: 'Student', document: 'Uploaded', status: 'Pending' },
  { name: 'Mai Lan', type: 'Senior', document: 'Needs review', status: 'Pending' },
  { name: 'Do Quang', type: 'Disability', document: 'Verified', status: 'Pending' },
];

const supportCases = [
  { id: 'CS-1042', type: 'Complaint', title: 'Late arrival on R05', status: 'Open' },
  { id: 'CS-1043', type: 'Lost and Found', title: 'Backpack left on B-702', status: 'Assigned' },
  { id: 'CS-1044', type: 'Feedback', title: 'Monthly pass QR scan issue', status: 'Reviewing' },
];

const DA_NANG_CENTER = [16.0544, 108.2022];

const busMarkerIcon = (status) => {
  const color = status === 'DELAYED' ? '#b45309' : status === 'BOARDING' ? '#426656' : '#2ba471';

  return L.divIcon({
    className: '',
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
    html: `<div style="width:36px;height:36px;border-radius:9999px;border:4px solid #fff;background:${color};color:#fff;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px">directions_bus</span></div>`,
  });
};

const StatusBadge = ({ value }) => {
  const isDanger = ['DELAYED', 'HIGH', 'LOCKED', 'Open'].includes(value);
  const isWarning = ['MEDIUM', 'Pending', 'Assigned', 'Reviewing', 'BOARDING'].includes(value);

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
        isDanger
          ? 'bg-error-container text-on-error-container'
          : isWarning
            ? 'bg-secondary-container text-secondary'
            : 'bg-on-tertiary-container/10 text-on-tertiary-container'
      }`}
    >
      {value}
    </span>
  );
};

const MetricCard = ({ item, t = (key) => key }) => (
  <div className={`flex h-32 flex-col justify-between rounded-3xl border p-6 shadow-sm ${
    item.danger
      ? 'border-error/10 bg-error-container'
      : 'border-outline-variant/10 bg-surface-container-lowest'
  }`}>
    <div className="flex items-start justify-between">
      <span className={`text-sm font-semibold ${item.danger ? 'text-on-error-container' : 'text-on-surface-variant'}`}>
        {item.labelKey ? t(item.labelKey) : item.label}
      </span>
      <span className={`material-symbols-outlined rounded-xl p-2 ${item.tone}`}>
        {item.icon}
      </span>
    </div>
    <div className={`text-3xl font-headline font-extrabold ${item.danger ? 'text-on-error-container' : 'text-primary'}`}>
      {item.value}
    </div>
  </div>
);

const PanelTitle = ({ title, description, action }) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-headline font-black text-primary">{title}</h2>
      <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
    </div>
    {action}
  </div>
);

const ModuleSubTabs = ({ tabs, activeTab, setActiveTab, t = (key) => key }) => (
  <div className="flex flex-wrap gap-2 rounded-[24px] border border-outline-variant/40 bg-white/75 p-2 shadow-sm">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => setActiveTab(tab.id)}
        className={`rounded-[18px] px-4 py-2 text-sm font-bold transition ${
          activeTab === tab.id
            ? 'bg-primary text-on-primary'
            : 'text-primary hover:bg-surface-container-low'
        }`}
      >
        {tab.labelKey ? t(tab.labelKey) : tab.label}
      </button>
    ))}
  </div>
);

const SelectFilter = ({ label, children, value, onChange }) => (
  <label className="block">
    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
      {label}
    </span>
    <select
      value={value}
      onChange={onChange}
      className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container"
    >
      {children}
    </select>
  </label>
);

const FleetMap = ({ filteredBuses }) => (
  <div className="h-[620px] overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
    <MapContainer
      center={DA_NANG_CENTER}
      className="h-full w-full"
      scrollWheelZoom
      zoom={13}
      zoomControl={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {routeOverlays.map((route) => (
        <Polyline
          key={route.route}
          pathOptions={{ color: route.color, opacity: 0.8, weight: 5 }}
          positions={route.points}
        />
      ))}
      {filteredBuses.map((bus) => (
        <Marker
          key={bus.id}
          icon={busMarkerIcon(bus.status)}
          position={bus.position}
          title={`${bus.id} ${bus.route}`}
        >
          <Popup>
            <div className="min-w-56 space-y-3">
              <div>
                <p className="text-base font-black text-primary">Vehicle {bus.id}</p>
                <p className="text-xs font-bold text-on-tertiary-container">
                  {bus.route} - {bus.status}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <span><strong>Driver:</strong><br />{bus.driver}</span>
                <span><strong>Speed:</strong><br />{bus.speed}</span>
                <span><strong>Current:</strong><br />{bus.currentStop}</span>
                <span><strong>Next:</strong><br />{bus.nextStop}</span>
                <span><strong>Occupancy:</strong><br />{bus.occupancy}</span>
                <span><strong>Last GPS:</strong><br />{bus.lastGps}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      <ZoomControl position="bottomright" />
    </MapContainer>
  </div>
);

// Retained temporarily for safe rollback while the live fleet workspace settles.
// eslint-disable-next-line no-unused-vars
const FleetOperationsPanel = ({ t }) => {
  const [activeFleetTab, setActiveFleetTab] = useState('map');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchVehicle, setSearchVehicle] = useState('');

  const filteredBuses = useMemo(() => buses.filter((bus) => {
    const matchesRoute = routeFilter === 'ALL' || bus.route === routeFilter;
    const matchesVehicle = vehicleFilter === 'ALL' || bus.id === vehicleFilter;
    const matchesStatus = statusFilter === 'ALL' || bus.status === statusFilter;
    const matchesSearch = !searchVehicle.trim()
      || bus.id.toLowerCase().includes(searchVehicle.trim().toLowerCase())
      || bus.driver.toLowerCase().includes(searchVehicle.trim().toLowerCase());

    return matchesRoute && matchesVehicle && matchesStatus && matchesSearch;
  }), [routeFilter, vehicleFilter, statusFilter, searchVehicle]);

  return (
    <div className="space-y-8">
      <PanelTitle
        title={t('fleet')}
        description={t('fleetDescription')}
      />
      <ModuleSubTabs
        activeTab={activeFleetTab}
        setActiveTab={setActiveFleetTab}
        t={t}
        tabs={[
          { id: 'map', labelKey: 'liveFleetMap' },
          { id: 'activeTrips', labelKey: 'activeTrips' },
          { id: 'delayedTrips', labelKey: 'delayedTrips' },
          { id: 'vehicleIssues', labelKey: 'vehicleIssues' },
          { id: 'maintenance', labelKey: 'maintenance' },
        ]}
      />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => <MetricCard key={item.labelKey} item={item} t={t} />)}
      </section>

      <section className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {t('searchVehicle')}
            </span>
            <input
              value={searchVehicle}
              onChange={(event) => setSearchVehicle(event.target.value)}
              className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container"
              placeholder="B-702 or driver"
              type="text"
            />
          </label>
          <SelectFilter
            label={t('routeFilter')}
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
          >
            {['ALL', 'R01', 'R02', 'R03', 'R05'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </SelectFilter>
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {t('vehicleFilter')}
            </span>
            <select
              value={vehicleFilter}
              onChange={(event) => setVehicleFilter(event.target.value)}
              className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container"
            >
              <option value="ALL">ALL</option>
              {buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.id}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {t('statusFilter')}
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container"
            >
              {['ALL', 'ON-TIME', 'DELAYED', 'BOARDING'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FleetMap filteredBuses={filteredBuses} />

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-headline font-bold text-primary">{t('liveFleetStatus')}</h3>
              <span className="text-xs font-bold text-on-tertiary-container">{filteredBuses.length} {t('visible')}</span>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {filteredBuses.map((bus) => (
                <div key={`${bus.id}-status`} className="flex items-center justify-between rounded-2xl bg-surface-container-low/70 p-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined rounded-full bg-on-tertiary-container/10 p-2 text-sm text-on-tertiary-container">
                      directions_bus
                    </span>
                    <div>
                      <p className="text-xs font-bold text-primary">{bus.id} ({bus.route})</p>
                      <p className="text-[10px] text-on-surface-variant">{bus.status} - {bus.currentStop}</p>
                    </div>
                  </div>
                  <StatusBadge value={bus.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-headline font-bold text-primary">{t('incidentAlerts')}</h3>
              <span className="rounded-full bg-error px-2 py-0.5 text-[10px] font-bold text-on-error">2 ACTIVE</span>
            </div>
            <div className="space-y-3">
              {incidentAlerts.map((incident) => (
                <div key={incident.title} className="rounded-2xl border-l-4 border-error bg-error-container/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-primary">{incident.title}</p>
                      <p className="mt-1 text-[10px] text-on-surface-variant">{incident.note}</p>
                    </div>
                    <StatusBadge value={incident.severity} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
            <h3 className="mb-5 font-headline font-bold text-primary">{t('recentNotifications')}</h3>
            <div className="space-y-3">
              {recentNotifications.map((item) => (
                <div key={item.title} className="flex gap-3 rounded-2xl bg-surface-container-low/60 p-3">
                  <span className="material-symbols-outlined text-lg text-secondary">{item.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-primary">{item.title}</p>
                    <p className="text-[10px] text-on-surface-variant">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {activeFleetTab === 'activeTrips' ? (
        <ActiveTripsTable />
      ) : activeFleetTab === 'delayedTrips' ? (
        <DataTable
          title="Delayed Trips"
          columns={['Route', 'Vehicle', 'Driver', 'Delay', 'Action']}
          rows={activeTrips.filter((trip) => trip.status === 'DELAYED').map((trip) => [
            trip.route,
            trip.bus,
            trip.driver,
            trip.delay,
            'Dispatch Support',
          ])}
        />
      ) : activeFleetTab === 'vehicleIssues' ? (
        <DataTable
          title="Vehicle Issues"
          columns={['Vehicle', 'Issue', 'Severity', 'Status', 'Action']}
          rows={[
            ['B-415', 'Low average speed on R05', 'MEDIUM', 'Open', 'Assign Task'],
            ['B-119', 'Boarding delay', 'LOW', 'Monitoring', 'View Details'],
          ]}
        />
      ) : activeFleetTab === 'maintenance' ? (
        <DataTable
          title="Maintenance"
          columns={['Vehicle', 'Inspection', 'Due', 'Status', 'Action']}
          rows={[
            ['B-702', 'Routine safety check', 'Today', 'Pending', 'Schedule'],
            ['B-228', 'Brake inspection', 'Tomorrow', 'Active', 'Review'],
          ]}
        />
      ) : (
        <ActiveTripsTable />
      )}
    </div>
  );
};

const ActiveTripsTable = () => (
  <section className="overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
    <div className="flex flex-col gap-4 border-b border-outline-variant/10 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-lg font-headline font-bold text-primary">Active Trips</h3>
        <p className="text-xs text-on-surface-variant">Live monitoring of currently active routes</p>
      </div>
      <div className="flex gap-3">
        <button className="rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-primary hover:bg-surface-container-high">
          Export Logs
        </button>
        <button className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:shadow-lg">
          Trip Management
        </button>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-surface-container-low/50">
            {['Route', 'Vehicle', 'Driver', 'Status', 'ETA', 'Delay', ''].map((heading) => (
              <th key={heading} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {activeTrips.map((trip) => (
            <tr key={`${trip.route}-${trip.bus}`} className="group hover:bg-surface-container-low/30">
              <td className="px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-xs font-bold text-primary-fixed">
                    {trip.route}
                  </div>
                  <span className="text-xs font-bold text-primary">{trip.name}</span>
                </div>
              </td>
              <td className="px-6 py-5 text-xs font-medium text-on-surface-variant">{trip.bus}</td>
              <td className="px-6 py-5 text-xs font-semibold text-primary">{trip.driver}</td>
              <td className="px-6 py-5"><StatusBadge value={trip.status} /></td>
              <td className="px-6 py-5 text-xs font-bold text-primary">{trip.eta}</td>
              <td className={`px-6 py-5 text-xs font-bold ${trip.delay.startsWith('+') ? 'text-secondary' : 'text-on-surface-variant'}`}>
                {trip.delay}
              </td>
              <td className="px-6 py-5">
                <button className="p-2 text-on-surface-variant opacity-0 hover:text-primary group-hover:opacity-100">
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const RouteManagementPanel = () => (
  <GenericTablePanel
    title="Route Management"
    description="Create, review, and publish route definitions without leaving the command center."
    actionLabel="Create Route"
    columns={['Route', 'Origin', 'Destination', 'Stops', 'Status', 'Action']}
    rows={[
      ['R01', 'Main Station', 'My Khe', '18 stops', 'Published', 'Review'],
      ['R03', 'Downtown Loop', 'Airport Gate', '12 stops', 'Draft', 'Continue'],
      ['R05', 'West Sector', 'Riverfront', '21 stops', 'Reviewing', 'Open'],
    ]}
  />
);

const SchedulingPanel = () => (
  <GenericTablePanel
    title="Scheduling"
    description="Monitor shift assignments, vehicle readiness, and dispatch coverage."
    actionLabel="Assign Shift"
    columns={['Shift', 'Vehicle', 'Driver', 'Assistant', 'Window', 'Status']}
    rows={[
      ['Morning A', 'B-702', 'Nguyen Van A', 'Le Thi B', '06:00 - 12:00', 'Confirmed'],
      ['Afternoon B', 'B-415', 'Tran Van C', 'Pham Thi D', '12:00 - 18:00', 'Needs Driver'],
      ['Evening C', 'B-228', 'Vo Minh E', 'Dang Hoa F', '18:00 - 23:00', 'Ready'],
    ]}
  />
);

const AnalyticsPanel = () => (
  <ScopedAnalyticsPanel />
);

const ScopedAnalyticsPanel = () => {
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('routeEfficiency');

  return (
    <div className="space-y-6">
      <ModuleSubTabs
        activeTab={activeAnalyticsTab}
        setActiveTab={setActiveAnalyticsTab}
        tabs={[
          { id: 'routeEfficiency', label: 'Route Efficiency' },
          { id: 'delayStatistics', label: 'Delay Statistics' },
          { id: 'congestedRoutes', label: 'Congested Routes' },
          { id: 'serviceReliability', label: 'Service Reliability' },
          { id: 'peakHourDemand', label: 'Peak Hour Demand' },
        ]}
      />
      <RouteEfficiencyPage />
    </div>
  );
};

const AnalyticsPlaceholderPanel = () => (
  <div className="space-y-6">
    <PanelTitle
      title="Analytics"
      description="Route efficiency, fleet utilization, delay risk, and operating performance."
      action={<button className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary">Refresh Metrics</button>}
    />
    <section className="grid gap-4 md:grid-cols-4">
      {['Date Range', 'Route', 'Vehicle Type', 'Metric'].map((label) => (
        <SelectFilter key={label} label={label}>
          <option>All</option>
          <option>Last 7 days</option>
          <option>R01</option>
        </SelectFilter>
      ))}
    </section>
    <section className="grid gap-6 md:grid-cols-4">
      {[
        { label: 'On-time Rate', value: '91.4%', icon: 'schedule' },
        { label: 'Avg. Occupancy', value: '63%', icon: 'groups' },
        { label: 'Route Efficiency', value: '87/100', icon: 'speed' },
        { label: 'Delay Risk', value: 'Medium', icon: 'warning' },
      ].map((item) => <MetricCard key={item.label} item={{ ...item, tone: 'text-on-tertiary-container bg-on-tertiary-container/10' }} />)}
    </section>
    <section className="grid gap-6 xl:grid-cols-2">
      <ChartPlaceholder title="Route Efficiency Trend" icon="show_chart" />
      <ChartPlaceholder title="Delay Heatmap" icon="analytics" />
      <ChartPlaceholder title="Fleet Utilization" icon="bar_chart" />
      <ChartPlaceholder title="Passenger Load by Hour" icon="stacked_line_chart" />
    </section>
  </div>
);

const RevenuePanel = () => (
  <ScopedRevenuePanel />
);

const ScopedRevenuePanel = () => {
  const [activeRevenueTab, setActiveRevenueTab] = useState('overview');

  return (
    <div className="space-y-6">
      <ModuleSubTabs
        activeTab={activeRevenueTab}
        setActiveTab={setActiveRevenueTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'ticketSales', label: 'Ticket Sales' },
          { id: 'monthlyPass', label: 'Monthly Pass Revenue' },
          { id: 'walkIn', label: 'Walk-in Ticket Revenue' },
          { id: 'refunds', label: 'Refunds' },
          { id: 'exports', label: 'Export Reports' },
        ]}
      />
      <RevenueReportsPage />
    </div>
  );
};

const FarePromotionsPanel = () => {
  const [section, setSection] = useState('fareMatrix');

  return (
    <div className="space-y-6">
      <PanelTitle
        title="Fare & Promotions"
        description="Manage fare matrix, monthly pass pricing, priority discounts, and promotion campaigns."
      />
      <ModuleSubTabs
        activeTab={section}
        setActiveTab={setSection}
        tabs={[
          { id: 'fareMatrix', label: 'Fare Matrix' },
          { id: 'monthlyPassPricing', label: 'Monthly Pass Pricing' },
          { id: 'priorityDiscounts', label: 'Priority Discounts' },
          { id: 'promotions', label: 'Promotions' },
          { id: 'promotionStatistics', label: 'Promotion Statistics' },
        ]}
      />
      {section === 'promotions' ? (
        <PromotionManagementPage />
      ) : section === 'promotionStatistics' ? (
        <PromotionStatisticsPage />
      ) : (
        <FareOperationsPage />
      )}
    </div>
  );
};

const IncidentsPanel = () => {
  const [activeIncidentTab, setActiveIncidentTab] = useState('all');

  return (
    <div className="space-y-6">
      <ModuleSubTabs
        activeTab={activeIncidentTab}
        setActiveTab={setActiveIncidentTab}
        tabs={[
          { id: 'all', label: 'All Incidents' },
          { id: 'traffic', label: 'Traffic Congestion' },
          { id: 'accidents', label: 'Accidents' },
          { id: 'breakdowns', label: 'Vehicle Breakdowns' },
          { id: 'conflicts', label: 'Passenger Conflicts' },
          { id: 'resolved', label: 'Resolved Cases' },
        ]}
      />
      <IncidentReportsPage />
    </div>
  );
};

const UserManagementPanel = () => (
  <div className="space-y-6">
    <PanelTitle
      title="User Management"
      description="Manage user and staff accounts, role access, lock status, and staff creation."
      action={<button className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary">Create Staff Account</button>}
    />
    <section className="grid gap-4 md:grid-cols-3">
      <SelectFilter label="Role"><option>All Roles</option><option>Driver</option><option>Passenger</option></SelectFilter>
      <SelectFilter label="Status"><option>All Status</option><option>Active</option><option>Locked</option></SelectFilter>
      <label>
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Search</span>
        <input className="h-11 w-full rounded-xl border-outline-variant/60 bg-white text-sm text-primary focus:ring-on-tertiary-container" placeholder="Name, email, phone" />
      </label>
    </section>
    <DataTable columns={['Name', 'Role', 'Status', 'Last Login', 'Actions']} rows={users.map((user) => [
      user.name,
      user.role,
      user.status,
      user.lastLogin,
      user.status === 'LOCKED' ? 'Unlock' : 'Lock / Edit',
    ])} />
  </div>
);

const PriorityVerificationPanel = () => (
  <GenericTablePanel
    title="Priority Verification"
    description="Approve or reject pending priority profile requests and uploaded document evidence."
    actionLabel="Refresh Queue"
    columns={['Passenger', 'Request Type', 'Document', 'Status', 'Actions']}
    rows={requests.map((request) => [
      request.name,
      request.type,
      request.document,
      request.status,
      'Approve / Reject',
    ])}
  />
);

const CustomerSupportPanel = () => (
  <GenericTablePanel
    title="Customer Support"
    description="Handle complaints, passenger feedback, and lost-and-found cases."
    actionLabel="Assign Case"
    columns={['Case ID', 'Type', 'Title', 'Status', 'Actions']}
    rows={supportCases.map((item) => [item.id, item.type, item.title, item.status, 'Open / Resolve'])}
  />
);

const SystemMonitoringPanel = () => (
  <div className="space-y-6">
    <PanelTitle
      title="System Monitoring"
      description="Audit logs, suspicious activity, notification operations, and service health."
      action={<button className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary">Run Health Check</button>}
    />
    <section className="grid gap-6 md:grid-cols-4">
      {[
        { label: 'API Health', value: '99.9%', icon: 'monitor_heart' },
        { label: 'Audit Logs', value: '1,284', icon: 'receipt_long' },
        { label: 'Suspicious Events', value: '7', icon: 'policy', danger: true },
        { label: 'Notifications Sent', value: '18.2K', icon: 'notifications' },
      ].map((item) => <MetricCard key={item.label} item={{ ...item, tone: item.danger ? 'text-on-error-container bg-error/10' : 'text-on-tertiary-container bg-on-tertiary-container/10' }} />)}
    </section>
    <section className="grid gap-6 xl:grid-cols-2">
      <DataTable
        title="Suspicious Activity"
        columns={['Time', 'User', 'Event', 'Risk']}
        rows={[
          ['09:42', 'admin@busdn.vn', 'Bulk export attempt', 'Medium'],
          ['10:15', 'driver-22', 'Repeated login failures', 'High'],
          ['10:41', 'api-service', 'Rate limit warning', 'Low'],
        ]}
      />
      <DataTable
        title="Audit Logs"
        columns={['Time', 'Actor', 'Action', 'Module']}
        rows={[
          ['11:05', 'Admin', 'Updated fare matrix', 'Fare'],
          ['11:12', 'Operator', 'Assigned incident', 'Incidents'],
          ['11:22', 'Admin', 'Approved priority profile', 'Priority'],
        ]}
      />
    </section>
  </div>
);

const ChartPlaceholder = ({ title, icon }) => (
  <div className="min-h-80 rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <h3 className="font-headline font-bold text-primary">{title}</h3>
      <span className="material-symbols-outlined rounded-xl bg-on-tertiary-container/10 p-2 text-on-tertiary-container">
        {icon}
      </span>
    </div>
    <div className="mt-6 flex h-56 items-end gap-3 rounded-2xl bg-surface-container-low p-5">
      {[42, 68, 55, 82, 61, 76, 89, 72].map((height, index) => (
        <div key={`${title}-${height}-${index}`} className="flex flex-1 items-end">
          <div className="w-full rounded-t-xl bg-on-tertiary-container/70" style={{ height: `${height}%` }} />
        </div>
      ))}
    </div>
  </div>
);

const DataTable = ({ title, columns, rows }) => (
  <section className="overflow-hidden rounded-[2rem] border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
    {title ? (
      <div className="border-b border-outline-variant/10 p-5">
        <h3 className="font-headline font-bold text-primary">{title}</h3>
      </div>
    ) : null}
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-surface-container-low/50">
            {columns.map((column) => (
              <th key={column} className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="hover:bg-surface-container-low/35">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${columns[cellIndex]}`} className="px-5 py-4 text-sm text-primary">
                  {['HIGH', 'MEDIUM', 'LOW', 'Active', 'ACTIVE', 'LOCKED', 'Open', 'Pending', 'Resolved', 'Published', 'Draft', 'Reviewing'].includes(cell)
                    ? <StatusBadge value={cell} />
                    : cellIndex === row.length - 1
                      ? <button className="text-xs font-bold text-on-tertiary-container hover:underline">{cell}</button>
                      : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const GenericTablePanel = ({ title, description, actionLabel, columns, rows, compact = false }) => (
  <div className={compact ? 'space-y-5' : 'space-y-6'}>
    <PanelTitle
      title={title}
      description={description}
      action={actionLabel ? (
        <button className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary">
          {actionLabel}
        </button>
      ) : null}
    />
    <DataTable columns={columns} rows={rows} />
  </div>
);

const panels = {
  fleet: AdminFleetLocationPage,
  routes: RouteWorkflowPage,
  scheduling: RouteWorkflowPage,
  analytics: AnalyticsPanel,
  farePromotions: FarePromotionsPanel,
  revenue: RevenuePanel,
  incidents: IncidentsPanel,
  users: UserAccountsPage,
  priority: AdminPriorityVerificationPage,
  support: AdminCustomerSupportPage,
  monitoring: SystemMonitoringPage,
};

const AdminSidebar = ({ activeModule, setActiveModule, t }) => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <aside className="flex h-screen w-[264px] shrink-0 flex-col overflow-hidden bg-primary-container px-3 py-4 text-primary-fixed-dim shadow-2xl shadow-primary/15">
      <div className="mb-5 px-3">
        <button
          type="button"
          onClick={() => setActiveModule('fleet')}
          className="text-left"
        >
          <h1 className="text-lg font-headline font-extrabold text-primary-fixed">
            {t('commandTitle')}
          </h1>
          <p className="text-xs font-medium text-on-primary-container">
            {t('commandSubtitle')}
          </p>
        </button>
      </div>

      <nav className="admin-command-sidebar-nav flex min-h-0 flex-1 flex-col gap-1 overflow-visible">
        {adminModules.map((item) => {
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              title={t(item.labelKey)}
              className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold leading-none transition-all ${
                isActive
                  ? 'bg-on-tertiary-container text-on-primary shadow-lg shadow-black/10'
                  : 'text-primary-fixed-dim hover:bg-on-primary-fixed-variant/20'
              }`}
            >
              <span className="material-symbols-outlined shrink-0 text-[20px]">{item.icon}</span>
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 px-1 pt-3">
        <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-error px-3 text-sm font-bold text-on-error">
          <span className="material-symbols-outlined text-lg">emergency</span>
          <span>{t('emergencyAlert')}</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary-fixed/15 px-3 text-sm font-bold text-primary-fixed hover:bg-on-primary-fixed-variant/20"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
};

const DashboardAdminPage = ({ embedded = false }) => {
  const [activeModule, setActiveModule] = useState('fleet');
  const { language, toggleLanguage } = useLanguage();
  const { user } = useAuthStore();
  const displayName = user?.fullName?.trim() || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();
  const ActivePanel = panels[activeModule] || AdminFleetLocationPage;
  const t = (key) => translations[language]?.[key] || translations.en[key] || key;
  const activeLabelKey = adminModules.find((item) => item.id === activeModule)?.labelKey || 'fleet';

  if (embedded) {
    return <AdminFleetLocationPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      <AdminSidebar activeModule={activeModule} setActiveModule={setActiveModule} t={t} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="z-40 flex h-20 shrink-0 items-center justify-between bg-surface/90 px-8 shadow-[0_20px_40px_rgba(0,26,15,0.06)] backdrop-blur-md">
          <div>
            <h2 className="text-xl font-headline font-black text-primary">
              {t(activeLabelKey)}
            </h2>
            <p className="text-xs font-medium text-on-surface-variant">
              {t('commandCenter')}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <label className="relative hidden lg:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                search
              </span>
              <input
                className="w-72 rounded-full border-0 bg-surface-container-low py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-on-tertiary-container"
                placeholder={t('searchPlaceholder')}
                type="text"
              />
            </label>
            <button className="relative rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
            </button>
            <button className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button
              type="button"
              onClick={toggleLanguage}
              title={t('switchLanguage')}
              aria-label={t('switchLanguage')}
              className="inline-flex h-10 min-w-14 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-low px-3 text-sm font-black text-primary shadow-sm hover:bg-surface-container"
            >
              {language === 'en' ? 'EN' : 'VN'}
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface-container-highest bg-secondary-container text-sm font-black text-secondary">
              {initial}
            </div>
          </div>
        </header>

        <div className="admin-command-panel min-h-0 flex-1 overflow-y-auto p-8">
          <ActivePanel language={language} t={t} />
        </div>
      </main>
      <style>{`
        .admin-command-panel > div {
          min-height: auto;
        }

        .admin-command-panel header.fixed,
        .admin-command-panel .admin-global-module-tabs,
        .admin-command-panel footer {
          display: none !important;
        }

        .admin-command-panel .pt-24 {
          padding-top: 0 !important;
        }

        .admin-command-panel .min-h-screen {
          min-height: auto !important;
        }

        @media (max-height: 720px) {
          .admin-command-sidebar-nav {
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardAdminPage;
