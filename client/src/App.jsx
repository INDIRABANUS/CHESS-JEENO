import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminTournamentsPage from './pages/AdminTournamentsPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import TournamentsPage from './pages/TournamentsPage';
import CreateTournamentPage from './pages/CreateTournamentPage';
import TournamentDetailsPage from './pages/TournamentDetailsPage';
import TeamCompetitionsPage from './pages/TeamCompetitionsPage';
import CreateTeamCompetitionPage from './pages/CreateTeamCompetitionPage';
import TeamCompetitionDetailsPage from './pages/TeamCompetitionDetailsPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import HelpPage from './pages/HelpPage';
import FAQPage from './pages/FAQPage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="admin" element={<AdminDashboardPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/tournaments" element={<AdminTournamentsPage />} />
              <Route path="admin/analytics" element={<AdminAnalyticsPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="tournaments" element={<TournamentsPage />} />
              <Route path="tournaments/create" element={<CreateTournamentPage />} />
              <Route path="tournaments/:id" element={<TournamentDetailsPage />} />
              <Route path="team-competitions" element={<TeamCompetitionsPage />} />
              <Route path="team-competitions/create" element={<CreateTeamCompetitionPage />} />
              <Route path="team-competitions/:id" element={<TeamCompetitionDetailsPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="faq" element={<FAQPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
