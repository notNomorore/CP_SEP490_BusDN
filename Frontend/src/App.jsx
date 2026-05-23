import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppInitializer from './shared/components/AppInitializer';
import { HomePage } from './features/home';
import { LoginPage, RegisterPage, ProtectedRoute, PublicRoute, AdminRoute } from './features/auth';
import { SearchRoutesPage } from './features/routes';

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
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchRoutesPage />
              </ProtectedRoute>
            }
          />

          {/* Ticket Feature */}
          {/* <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} /> */}

          {/* Tracking Feature */}
          {/* <Route path="/track" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} /> */}

          {/* Profile Feature */}
          {/* <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} /> */}

          {/* Admin Feature */}
          {/* <Route path="/admin/*" element={<AdminRoute><AdminLayout /></AdminRoute>} /> */}
        </Routes>
      </AppInitializer>
    </Router>
  );
}

export default App;
