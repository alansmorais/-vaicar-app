import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.js';
import { AuthProvider } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';

import { HomePage } from './pages/HomePage.js';
import { PassengerDashboardPage } from './pages/passenger/PassengerDashboardPage.js';
import { PassengerLoginPage } from './pages/passenger/PassengerLoginPage.js';
import { PassengerRegisterPage } from './pages/passenger/PassengerRegisterPage.js';
import { PassengerDownloadPage } from './pages/passenger/PassengerDownloadPage.js';

import { DriverDashboardPage } from './pages/driver/DriverDashboardPage.js';
import { DriverLoginPage } from './pages/driver/DriverLoginPage.js';
import { DriverRegisterPage } from './pages/driver/DriverRegisterPage.js';
import { DriverDownloadPage } from './pages/driver/DriverDownloadPage.js';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.js';
import { AdminLoginPage } from './pages/admin/AdminLoginPage.js';

import { TermsPage } from './pages/TermsPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { BusinessPartnershipsPage } from './pages/BusinessPartnershipsPage.js';
import { PassengerInfoPage } from './pages/PassengerInfoPage.js';
import { DriverRequirementsPage } from './pages/DriverRequirementsPage.js';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 transition-colors duration-200">
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
              <Route path="/download/passenger" element={<PassengerDownloadPage />} />
              <Route path="/baixar/passageiro" element={<PassengerDownloadPage />} />
              <Route path="/como-funciona/passageiro" element={<PassengerInfoPage />} />
              <Route path="/passageiro/info" element={<PassengerInfoPage />} />
              <Route path="/como-funciona" element={<PassengerInfoPage />} />

              {/* Driver & Couriers */}
              <Route path="/driver" element={<DriverDashboardPage />} />
              <Route path="/driver/login" element={<DriverLoginPage />} />
              <Route path="/driver/register" element={<DriverRegisterPage />} />
              <Route path="/download/driver" element={<DriverDownloadPage />} />
              <Route path="/download" element={<Navigate to="/download/passenger" replace />} />
              <Route path="/baixar/motorista" element={<DriverDownloadPage />} />
              <Route path="/baixar" element={<Navigate to="/download/passenger" replace />} />
              <Route path="/como-funciona/motorista" element={<DriverRequirementsPage />} />
              <Route path="/motorista/requisitos" element={<DriverRequirementsPage />} />

              {/* Local Business Partnerships */}
              <Route path="/parcerias" element={<BusinessPartnershipsPage />} />
              <Route path="/empresas" element={<BusinessPartnershipsPage />} />
              <Route path="/comercio" element={<BusinessPartnershipsPage />} />

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
    </ThemeProvider>
  );
};

export default App;
