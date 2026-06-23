import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppInitializer from './shared/components/AppInitializer';
import { HomePage } from './features/home';
import { AdminPriorityVerificationPage, PriorityProfilePage } from './features/priorityProfile';
import {
  AdminCustomerSupportPage,
  AdminLostItemCasesPage,
  LostItemCaseStatusPage,
  ReportLostItemPage,
  SubmitFeedbackPage,
} from './features/customerSupport';
import { SearchRoutesPage } from './features/routes';
import { ETicketPage, MyTicketsPage } from './features/tickets';
import { TravelHistoryPage } from './features/travelHistory';
import {
  AdminCommandLayout,
  AdminActiveTripsPage,
  AdminDelayedTripsPage,
  DashboardAdminPage,
  RouteControlPage,
  StaffPerformancePage,
  SystemNotificationsPage,
  UserAccountsPage,
} from './features/admin';
import { ScheduleOperationsPage } from './features/scheduleOperations';
import {
  LoginPage,
  RegisterPage,
  RegisterVerifyOtpPage,
  ForcePasswordChangePage,
  ProtectedRoute,
  OperationsRoute,
  PublicRoute,
  AdminRoute,
  BusAssistantRoute,
} from './features/auth';
import { ProfilePage } from './features/profile';
import {
  AssignedTripsPage,
  BusAssistantShell,
  CreateWalkInTicketPage,
  IncidentReportPage,
  OperationNotificationsPage,
  RevenueSummaryPage,
  ShiftRevenuePage,
  ShiftSchedulePage,
  ValidateQrTicketPage,
} from './features/busAssistant';
import {
  PromotionManagementPage,
  PromotionStatisticsPage,
} from './features/admin/promotions';
import { RevenueReportsPage } from './features/admin/revenue';
import { CongestedRoutesPage, FeedbackAnalyticsPage, RouteEfficiencyPage } from './features/admin/analytics';
import { IncidentReportsPage } from './features/admin/incidents';
import { VehicleIssuesPage } from './features/admin/vehicleIssues';
import { MaintenanceApprovalPage } from './features/admin/maintenanceApproval';
import { SystemMonitoringPage } from './features/admin/systemMonitoring';
import { FareOperationsPage } from './features/admin/fareOperations';
import { WalkInTicketMonitoringPage } from './features/admin/walkInTickets';
import { PassengerCompliancePage } from './features/admin/passengerCompliance';
import NotFoundPage from './shared/components/common/NotFoundPage.jsx';
import I18nBoundary from './shared/components/I18nBoundary.jsx';

function App() {
  return (
    <Router>
      <I18nBoundary>
        <AppInitializer>
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route
            path="/auth/login"
            element={(
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            )}
          />
          <Route
            path="/auth/register"
            element={(
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            )}
          />
          <Route
            path="/auth/verify-otp"
            element={(
              <PublicRoute>
                <RegisterVerifyOtpPage />
              </PublicRoute>
            )}
          />
          <Route
            path="/auth/force-change-password"
            element={(
              <ProtectedRoute allowFirstLogin>
                <ForcePasswordChangePage />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/login"
            element={(
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            )}
          />
          <Route
            path="/register"
            element={(
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            )}
          />

          <Route path="/search" element={<SearchRoutesPage />} />
          <Route
            path="/priority-profile"
            element={(
              <ProtectedRoute>
                <PriorityProfilePage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/my-tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} />
          <Route path="/tickets/:ticketId" element={<ProtectedRoute><ETicketPage /></ProtectedRoute>} />
          <Route path="/travel-history" element={<ProtectedRoute><TravelHistoryPage /></ProtectedRoute>} />
          <Route path="/submit-feedback" element={<ProtectedRoute><SubmitFeedbackPage /></ProtectedRoute>} />
          <Route path="/report-lost-item" element={<ProtectedRoute><ReportLostItemPage /></ProtectedRoute>} />
          <Route path="/lost-item-cases" element={<ProtectedRoute><LostItemCaseStatusPage /></ProtectedRoute>} />

          {/* Ticket Feature */}
          {/* <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} /> */}

          {/* Tracking Feature */}
          {/* <Route path="/track" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} /> */}

          {/* Unified Admin Command Center */}
          <Route
            path="/admin"
            element={(
              <AdminRoute>
                <AdminCommandLayout />
              </AdminRoute>
            )}
          >
            <Route index element={<DashboardAdminPage embedded />} />
            <Route path="dashboard" element={<DashboardAdminPage embedded />} />
            <Route path="fleet/active-trips" element={<AdminActiveTripsPage />} />
            <Route path="fleet/delayed-trips" element={<AdminDelayedTripsPage />} />
            <Route path="fleet/locations" element={<DashboardAdminPage embedded />} />
            <Route path="routes" element={<RouteControlPage />} />
            <Route path="users" element={<UserAccountsPage />} />
            <Route path="staff-performance" element={<StaffPerformancePage />} />
            <Route path="priority-verification" element={<AdminPriorityVerificationPage />} />
            <Route path="customer-support" element={<AdminCustomerSupportPage />} />
            <Route path="system-notifications" element={<SystemNotificationsPage />} />
            <Route path="promotions" element={<PromotionManagementPage />} />
            <Route path="promotions/statistics" element={<PromotionStatisticsPage />} />
            <Route path="revenue" element={<RevenueReportsPage />} />
            <Route path="fare-operations" element={<FareOperationsPage />} />
            <Route path="walkin-tickets" element={<WalkInTicketMonitoringPage />} />
            <Route path="passenger-compliance" element={<PassengerCompliancePage />} />
            <Route path="analytics/route-efficiency" element={<RouteEfficiencyPage />} />
            <Route path="analytics/congested-routes" element={<CongestedRoutesPage />} />
            <Route path="analytics/feedback" element={<FeedbackAnalyticsPage />} />
            <Route path="incidents" element={<IncidentReportsPage />} />
            <Route path="vehicle-issues" element={<VehicleIssuesPage />} />
            <Route path="maintenance-approval" element={<MaintenanceApprovalPage />} />
            <Route path="system-monitoring" element={<SystemMonitoringPage />} />
            <Route path="system-monitoring/suspicious" element={<SystemMonitoringPage />} />
          </Route>

          <Route
            path="/admin/priority-verification"
            element={(
              <AdminRoute>
                <AdminPriorityVerificationPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/customer-support"
            element={(
              <AdminRoute>
                <AdminCustomerSupportPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/lost-items"
            element={(
              <AdminRoute>
                <AdminLostItemCasesPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/routes"
            element={(
              <AdminRoute>
                <RouteControlPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/users"
            element={(
              <AdminRoute>
                <UserAccountsPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/promotions"
            element={(
              <AdminRoute>
                <PromotionManagementPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/promotions/statistics"
            element={(
              <AdminRoute>
                <PromotionStatisticsPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/revenue"
            element={(
              <AdminRoute>
                <RevenueReportsPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/analytics/route-efficiency"
            element={(
              <AdminRoute>
                <RouteEfficiencyPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/incidents"
            element={(
              <AdminRoute>
                <IncidentReportsPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/system-monitoring"
            element={(
              <AdminRoute>
                <SystemMonitoringPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/system-monitoring/suspicious"
            element={(
              <AdminRoute>
                <SystemMonitoringPage />
              </AdminRoute>
            )}
          />

          <Route
            path="/operations/schedule"
            element={(
              <OperationsRoute>
                <ScheduleOperationsPage />
              </OperationsRoute>
            )}
          />
          <Route
            path="/bus-assistant"
            element={(
              <BusAssistantRoute>
                <BusAssistantShell />
              </BusAssistantRoute>
            )}
          >
            <Route index element={<AssignedTripsPage />} />
            <Route path="assigned-trips" element={<AssignedTripsPage />} />
            <Route path="shift-schedule" element={<ShiftSchedulePage />} />
            <Route path="operation-notifications" element={<OperationNotificationsPage />} />
            <Route path="validate-ticket" element={<ValidateQrTicketPage />} />
            <Route path="walkin-ticket" element={<CreateWalkInTicketPage />} />
            <Route path="incident-reports" element={<IncidentReportPage />} />
            <Route path="shift-revenue" element={<ShiftRevenuePage />} />
            <Route path="revenue-summary" element={<RevenueSummaryPage />} />
          </Route>
          <Route
            path="/admin/staff-performance"
            element={
              <AdminRoute>
                <StaffPerformancePage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </AppInitializer>
      </I18nBoundary>
    </Router>
  );
}

export default App;
