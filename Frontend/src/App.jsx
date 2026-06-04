import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppInitializer from './shared/components/AppInitializer';
import { HomePage } from './features/home';
import {
  LoginPage,
  RegisterPage,
  RegisterVerifyOtpPage,
  ProtectedRoute,
  PublicRoute,
  AdminRoute,
} from './features/auth';
import { ProfilePage } from './features/profile';
import {
  PromotionManagementPage,
  PromotionStatisticsPage,
} from './features/admin/promotions';

function App() {
  return (
    <Router>
      <AppInitializer>
        <Routes>
          {/* Home Page */}
          <Route path="/" element={<HomePage />} />

          {/* Auth Routes */}
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

          {/* Backward compatibility - old paths */}
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

          {/* Route Feature */}
          {/* <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} /> */}

          {/* Ticket Feature */}
          {/* <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} /> */}

          {/* Tracking Feature */}
          {/* <Route path="/track" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} /> */}

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
        </Routes>
      </AppInitializer>
    </Router>
  );
}

export default App;
