import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';

import { HomePage } from './pages/HomePage.js';
import { PassengerDashboardPage } from './pages/passenger/PassengerDashboardPage.js';
import { PassengerLoginPage } from './pages/passenger/PassengerLoginPage.js';
import { PassengerRegisterPage } from './pages/passenger/PassengerRegisterPage.js';

import { DriverDashboardPage } from './pages/driver/DriverDashboardPage.js';
import { DriverLoginPage } from './pages/driver/DriverLoginPage.js';
import { DriverRegisterPage } from './pages/driver/DriverRegisterPage.js';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.js';
import { AdminLoginPage } from './pages/admin/AdminLoginPage.js';

import { TermsPage } from './pages/TermsPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { LoginPage } from './pages/LoginPage.js';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
          <Navbar />
          <div className="flex-1">
            <Routes>
              {/* Home */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/entrar" element={<LoginPage />} />

              {/* Passenger */}
              <Route path="/passenger" element={<PassengerDashboardPage />} />
              <Route path="/passenger/login" element={<PassengerLoginPage />} />
              <Route path="/passenger/register" element={<PassengerRegisterPage />} />

              {/* Driver */}
              <Route path="/driver" element={<DriverDashboardPage />} />
              <Route path="/driver/login" element={<DriverLoginPage />} />
              <Route path="/driver/register" element={<DriverRegisterPage />} />

              {/* Admin */}
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* Legal & Compliance */}
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/termos" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/privacidade" element={<PrivacyPage />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
