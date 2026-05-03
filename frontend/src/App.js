import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Availability from './pages/Availability';
import CheckIn from './pages/CheckIn';
import Accounting from './pages/Accounting';
import PublicBooking from './pages/PublicBooking';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/book" element={<PublicBooking />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <Bookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/availability"
            element={
              <ProtectedRoute>
                <Availability />
              </ProtectedRoute>
            }
          />
          <Route
            path="/check-in"
            element={
              <ProtectedRoute>
                <CheckIn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <ProtectedRoute>
                <Accounting />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/book" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
