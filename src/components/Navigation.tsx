import React from 'react';
import {
  HomeIcon,
  CalendarIcon,
  CalendarDaysIcon,
  SettingsIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
} from './Icons';

export type ActiveTab = 'home' | 'timetable' | 'calendar' | 'admin-calendar' | 'settings';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  userEmail?: string | null;
  section?: string;
  isAdmin?: boolean;
  isPrimaryAdmin?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  section = 'CSE-15',
  isAdmin = false,
  isPrimaryAdmin = false,
}) => {
  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="bottom-nav-bar" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onTabChange('home')}
          aria-label="Go to Home"
        >
          <HomeIcon size={20} />
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${activeTab === 'timetable' ? 'active' : ''}`}
          onClick={() => onTabChange('timetable')}
          aria-label="Go to Weekly Timetable"
        >
          <CalendarIcon size={20} />
          <span>Timetable</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => onTabChange('calendar')}
          aria-label="Go to Academic Calendar"
        >
          <CalendarDaysIcon size={20} />
          <span>Calendar</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            className={`bottom-nav-item ${activeTab === 'admin-calendar' ? 'active' : ''}`}
            onClick={() => onTabChange('admin-calendar')}
            aria-label="Go to Admin Calendar"
          >
            <ShieldCheckIcon size={20} />
            <span>Admin</span>
          </button>
        )}

        <button
          type="button"
          className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
          aria-label="Go to Settings"
        >
          <SettingsIcon size={20} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <aside className="desktop-sidebar" aria-label="Desktop Sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon">
            <GraduationCapIcon size={22} />
          </div>
          <div>
            <div className="sidebar-brand-text">ClassMate</div>
            <div className="sidebar-brand-sub">
              {section} • Sem 3
            </div>
          </div>
        </div>

        <ul className="sidebar-nav-list">
          <li>
            <button
              type="button"
              className={`sidebar-nav-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => onTabChange('home')}
            >
              <HomeIcon size={18} />
              <span>Home Dashboard</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-nav-btn ${activeTab === 'timetable' ? 'active' : ''}`}
              onClick={() => onTabChange('timetable')}
            >
              <CalendarIcon size={18} />
              <span>Weekly Timetable</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-nav-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => onTabChange('calendar')}
            >
              <CalendarDaysIcon size={18} />
              <span>Academic Calendar</span>
            </button>
          </li>

          {isAdmin && (
            <li>
              <button
                type="button"
                className={`sidebar-nav-btn admin-nav-btn ${activeTab === 'admin-calendar' ? 'active' : ''}`}
                onClick={() => onTabChange('admin-calendar')}
              >
                <ShieldCheckIcon size={18} />
                <span>Admin Calendar</span>
                <span className={`sidebar-role-badge ${isPrimaryAdmin ? 'primary' : 'admin'}`}>
                  {isPrimaryAdmin ? 'Primary' : 'Admin'}
                </span>
              </button>
            </li>
          )}

          <li>
            <button
              type="button"
              className={`sidebar-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => onTabChange('settings')}
            >
              <SettingsIcon size={18} />
              <span>Profile & Settings</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-footer-card">
          <div className="sidebar-footer-title">
            {section} Timetable
          </div>
          <div className="sidebar-footer-desc">B.Tech Computer Science</div>
          <div className="sidebar-footer-sync">
            <span className="sync-dot live" />
            <span>Cloud Synced</span>
          </div>
        </div>
      </aside>
    </>
  );
};
