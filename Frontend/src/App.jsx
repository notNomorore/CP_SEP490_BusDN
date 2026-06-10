import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppInitializer from './shared/components/AppInitializer';
import { HomePage } from './features/home';
import { AdminPriorityVerificationPage, PriorityProfilePage } from './features/priorityProfile';
import { AdminCustomerSupportPage } from './features/customerSupport';
import { SearchRoutesPage } from './features/routes';
import { RouteControlPage, UserAccountsPage } from './features/admin';
import { ScheduleOperationsPage } from './features/scheduleOperations';
import {
  LoginPage,
  RegisterPage,
  RegisterVerifyOtpPage,
  ProtectedRoute,
  OperationsRoute,
  PublicRoute,
  AdminRoute,
} from './features/auth';
import { ProfilePage } from './features/profile';
import {
  PromotionManagementPage,
  PromotionStatisticsPage,
} from './features/admin/promotions';
import { RevenueReportsPage } from './features/admin/revenue';
import { RouteEfficiencyPage } from './features/admin/analytics';
import { IncidentReportsPage } from './features/admin/incidents';
import { SystemMonitoringPage } from './features/admin/systemMonitoring';

function App() {
  return (
    <Router>
      <AppInitializer>
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route
            path="/auth/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/auth/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          <Route
            path="/auth/verify-otp"
            element={
              <PublicRoute>
                <RegisterVerifyOtpPage />
              </PublicRoute>
            }
          />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchRoutesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/priority-profile"
            element={
              <ProtectedRoute>
                <PriorityProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/priority-verification"
            element={
              <AdminRoute>
                <AdminPriorityVerificationPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/customer-support"
            element={
              <AdminRoute>
                <AdminCustomerSupportPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/routes"
            element={
              <AdminRoute>
                <RouteControlPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserAccountsPage />
              </AdminRoute>
            }/>
          // {/* Ticket Feature */}
          // {/* <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          // <Route path="/tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} /> */}

          // {/* Tracking Feature */}
          // {/* <Route path="/track" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} /> */}

          <Route
            path="/profile"
            element={(
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            )}
          />

          {/* Admin Feature */}
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
            element={<AdminRoute><SystemMonitoringPage /></AdminRoute>}
          />
          <Route
            path="/admin/system-monitoring/suspicious"
            element={<AdminRoute><SystemMonitoringPage /></AdminRoute>}
          />

          {/* Driver and Bus Assistant Feature */}
          <Route
            path="/operations/schedule"
            element={(
              <OperationsRoute>
                <ScheduleOperationsPage />
              </OperationsRoute>
            )}
          />
        </Routes>
      </AppInitializer>
    </Router>
  );
}

export default App;
