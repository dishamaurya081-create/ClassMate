import React, { useState, useEffect } from 'react';
import { ClockIcon, CalendarIcon, GraduationCapIcon, UserIcon, MoonIcon, SunIcon } from './Icons';
import { getFormattedDate, getGreeting } from '../utils/timeUtils';
import type { UserSettings } from '../types/timetable';
import { getStoredTheme, setStoredTheme, type Theme } from '../utils/theme';

interface HeaderProps {
  currentTime: Date;
  settings: UserSettings;
  userEmail?: string | null;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTime,
  settings,
  userEmail,
}) => {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'classmate_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setStoredTheme(nextTheme);
    setTheme(nextTheme);
  };

  const greeting = getGreeting(settings.studentName, currentTime);
  const formattedDate = getFormattedDate(currentTime);
  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand-badge">
          <GraduationCapIcon size={16} />
          <span>ClassMate</span>
        </div>

        <div className="header-top-right">
          {/* Supabase User & Cloud Sync Pill */}
          <div
            className="sync-status-badge synced"
            title={`Authenticated as ${userEmail || 'Student'} • Cloud Synced`}
          >
            <UserIcon size={13} />
            <span>{settings.studentName || (userEmail ? userEmail.split('@')[0] : 'Student')}</span>
            <span className="sync-dot live" />
          </div>

          <div className="live-clock-badge">
            <ClockIcon size={14} />
            <span>{timeString}</span>
          </div>
        </div>
      </div>

      <div className="header-title-section">
        <div className="header-title-row">
          <div className="header-greeting-block">
            <h1 className="greeting-text">{greeting} 👋</h1>
            <div className="date-text">
              <CalendarIcon size={14} />
              <span>{formattedDate}</span>
            </div>
          </div>

          <button
            type="button"
            className="header-theme-toggle"
            onClick={handleToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <MoonIcon size={18} /> : <SunIcon size={18} />}
          </button>
        </div>
      </div>

      <div className="section-chips">
        <div className="section-chip">
          <strong>Section:</strong> {settings.section}
        </div>
        <div className="section-chip">
          <strong>Track:</strong> {settings.specializationOption}
        </div>
        <div className="section-chip">
          <strong>Group:</strong> {settings.groupOption}
        </div>
        <div className="section-chip">
          <strong>Sem:</strong> {settings.semester}
        </div>
      </div>
    </header>
  );
};
