/**
 * OWNED BY THE PEOPLE BUILD. Routes under /{company}/account/* (SYS-NAVPAT-06; no scope on these
 * pages, ST-N10): the user's personal settings, and for Admins the Account settings group.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { EntitlementsPage } from './EntitlementsPage';
import { NotificationSettingsPage } from './NotificationSettingsPage';
import { PreferencesPage } from './PreferencesPage';
import { ProfilePage } from './ProfilePage';
import './account.css';

export function AccountSection() {
  return (
    <Routes>
      <Route index element={<Navigate to="profile" replace />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="preferences" element={<PreferencesPage />} />
      <Route path="notification-settings" element={<NotificationSettingsPage />} />
      <Route path="entitlements" element={<EntitlementsPage />} />
      <Route path="*" element={<Navigate to="profile" replace />} />
    </Routes>
  );
}
