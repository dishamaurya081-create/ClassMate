import React, { useMemo, useState } from 'react';
import type { UserSettings, SpecializationOption, GroupOption, ClassItem } from '../types/timetable';
import type { BrowserNotificationPermissionState } from '../types/notification';
import { ALL_SECTIONS, isSectionAvailable } from '../types/timetable';
import { OFFICIAL_TIMETABLE_DATA } from '../data/timetable';
import { notificationService } from '../services/notificationService';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from '../services/browserNotificationDelivery';
import {
  isWebPushSupported,
  isVapidConfigured,
  registerServiceWorker,
  getPushSubscriptionStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  savePushSubscriptionToSupabase,
  deletePushSubscriptionFromSupabase,
} from '../services/pushSubscriptionService';
import type { PushSubscriptionStatus } from '../types/webPush';
import { useAuth } from '../context/useAuth';
import {
  UserIcon,
  BellIcon,
  RotateCcwIcon,
  GraduationCapIcon,
  LogOutIcon,
  ClockIcon,
} from './Icons';

interface SettingsProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => Promise<void> | void;
  onResetTimetable: () => void;
  classes?: ClassItem[];
  currentTime?: Date;
}

// Small helper: renders the coloured pill that shows browser permission status
const PermissionStatusPill: React.FC<{ permission: BrowserNotificationPermissionState }> = ({
  permission,
}) => {
  if (!isNotificationSupported() || permission === 'unsupported') {
    return <span className="status-pill">⚫ Not Supported</span>;
  }
  if (permission === 'granted') {
    return <span className="status-pill active">🟢 Allowed</span>;
  }
  if (permission === 'denied') {
    return <span className="status-pill danger">🔴 Blocked</span>;
  }
  return <span className="status-pill warning">🟡 Not Requested</span>;
};

// Small helper: renders the coloured pill that shows push subscription status
const PushStatusPill: React.FC<{ status: PushSubscriptionStatus }> = ({ status }) => {
  switch (status) {
    case 'subscribed':
      return <span className="status-pill active">🟢 Push On</span>;
    case 'not_subscribed':
      return <span className="status-pill idle">⚪ Not Enabled</span>;
    case 'permission_denied':
      return <span className="status-pill danger">🔴 Blocked</span>;
    case 'permission_required':
      return <span className="status-pill warning">🟡 Permission Needed</span>;
    case 'unsupported':
      return <span className="status-pill">⚫ Not Supported</span>;
    case 'error':
      return <span className="status-pill danger">🔴 Error</span>;
  }
};

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onResetTimetable,
  classes = [],
  currentTime,
}) => {
  const { user, signOut } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);



  // Browser notification permission state
  const [permissionState, setPermissionState] = useState<BrowserNotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Push subscription state — initial value determined synchronously so no setState in effect
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus>(() =>
    !isWebPushSupported() ? 'unsupported' : 'not_subscribed'
  );
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // On mount: eagerly register SW and asynchronously read current push subscription status
  React.useEffect(() => {
    if (!isWebPushSupported()) return;
    // Register SW eagerly so it is ready when the user subscribes
    registerServiceWorker().catch(() => {/* silent */});
    getPushSubscriptionStatus().then(setPushStatus).catch(() => setPushStatus('error'));
  }, []);

  const notifEvaluation = useMemo(() => {
    if (!classes || classes.length === 0) return null;
    return notificationService.evaluateNextNotification(classes, settings, currentTime || new Date());
  }, [classes, settings, currentTime]);

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const result = await requestNotificationPermission();
      setPermissionState(result);
      // Re-read push status after permission changes
      const ps = await getPushSubscriptionStatus();
      setPushStatus(ps);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // --- Push subscription handlers ---

  const handleEnablePush = async () => {
    if (!user) return;
    setIsPushLoading(true);
    setPushFeedback(null);
    try {
      const result = await subscribeToWebPush();
      if (result.success && result.subscription) {
        const saveResult = await savePushSubscriptionToSupabase(user.id, result.subscription);
        if (saveResult.success) {
          setPushStatus('subscribed');
          setPushFeedback({ type: 'success', message: 'Push notifications enabled on this device.' });
        } else {
          setPushStatus('not_subscribed');
          setPushFeedback({ type: 'warning', message: saveResult.message });
        }
      } else {
        setPushFeedback({ type: 'warning', message: result.message });
        const ps = await getPushSubscriptionStatus();
        setPushStatus(ps);
      }
    } catch {
      setPushFeedback({ type: 'error', message: 'An unexpected error occurred while enabling push.' });
      setPushStatus('error');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    if (!user) return;
    setIsPushLoading(true);
    setPushFeedback(null);
    try {
      await unsubscribeFromWebPush();
      await deletePushSubscriptionFromSupabase(user.id);
      setPushStatus('not_subscribed');
      setPushFeedback({ type: 'success', message: 'Push notifications disabled on this device.' });
    } catch {
      setPushFeedback({ type: 'error', message: 'Could not fully disable push notifications.' });
    } finally {
      setIsPushLoading(false);
    }
  };


  const applySettingChange = async (newSettings: UserSettings, message?: string) => {
    setIsSaving(true);
    try {
      await onUpdateSettings(newSettings);
      if (message) {
        setSaveNotice(message);
        setTimeout(() => setSaveNotice(null), 2500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleReminders = () => {
    applySettingChange(
      {
        ...settings,
        remindersEnabled: !settings.remindersEnabled,
      },
      'Notification preferences synced'
    );
  };

  const handleReminderTimeSelect = (minutes: number) => {
    applySettingChange(
      {
        ...settings,
        remindMinutesBefore: minutes,
      },
      `Remind time set to ${minutes}m & synced`
    );
  };

  const handleSectionChange = (section: string) => {
    applySettingChange(
      {
        ...settings,
        section,
      },
      `Section updated to ${section}`
    );
  };

  const handleSpecializationChange = (specializationOption: SpecializationOption) => {
    applySettingChange(
      {
        ...settings,
        specializationOption,
      },
      `Specialization updated to ${specializationOption}`
    );
  };

  const handleGroupChange = (groupOption: GroupOption) => {
    applySettingChange(
      {
        ...settings,
        groupOption,
      },
      `Lab group updated to ${groupOption}`
    );
  };

  return (
    <div className="settings-container">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">
            <UserIcon size={20} />
            <span>Profile & Settings</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            ClassMate student preferences & account settings
          </p>
        </div>
      </div>

      {/* Student Account Card */}
      <div className="settings-card">
        <h3 className="settings-card-title">
          <UserIcon size={18} />
          <span>Account</span>
        </h3>

        <div>
          <div className="info-rows-list">
            <div className="info-row">
              <span className="info-label">Account Email</span>
              <span className="info-value font-mono">{user?.email || 'Authenticated'}</span>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => signOut()}
            >
              <LogOutIcon size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>



      {/* Student Profile & Class Configuration Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 className="settings-card-title" style={{ margin: 0 }}>
            <GraduationCapIcon size={18} />
            <span>Class & Group Configuration</span>
          </h3>
          {isSaving && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Saving to Supabase...
            </span>
          )}
          {saveNotice && !isSaving && (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
              ✓ {saveNotice}
            </span>
          )}
        </div>

        <div className="info-rows-list">
          {/* Section Selector */}
          <div className="info-row-form">
            <label className="info-label" htmlFor="settingsSectionSelect">
              Current Section
            </label>
            <select
              id="settingsSectionSelect"
              className="form-select select-inline"
              value={settings.section}
              onChange={(e) => handleSectionChange(e.target.value)}
            >
              {ALL_SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec} {isSectionAvailable(sec, OFFICIAL_TIMETABLE_DATA) ? '(Available)' : '(Coming Soon)'}
                </option>
              ))}
            </select>
          </div>

          {!isSectionAvailable(settings.section, OFFICIAL_TIMETABLE_DATA) && (
            <div className="info-banner warning">
              <ClockIcon size={14} />
              <span>Section {settings.section} timetable is Coming Soon. Dashboard shows a clean placeholder.</span>
            </div>
          )}

          {/* DV / Cloud Selector */}
          <div className="info-row-form">
            <label className="info-label" htmlFor="settingsDvSelect">
              DV / Cloud Option
            </label>
            <select
              id="settingsDvSelect"
              className="form-select select-inline"
              value={settings.specializationOption}
              onChange={(e) => handleSpecializationChange(e.target.value as SpecializationOption)}
            >
              <option value="DV Batch 1">DV Batch 1</option>
              <option value="DV Batch 2">DV Batch 2</option>
              <option value="Cloud">Cloud (FCC)</option>
            </select>
          </div>

          {/* Group Selector */}
          <div className="info-row-form">
            <label className="info-label" htmlFor="settingsGroupSelect">
              Lab Group
            </label>
            <select
              id="settingsGroupSelect"
              className="form-select select-inline"
              value={settings.groupOption}
              onChange={(e) => handleGroupChange(e.target.value as GroupOption)}
            >
              <option value="Group 1">Group 1 (G1)</option>
              <option value="Group 2">Group 2 (G2)</option>
            </select>
          </div>

          <div className="info-row">
            <span className="info-label">Student Name</span>
            <span className="info-value">{settings.studentName}</span>
          </div>
          <div className="info-row">
            <span className="info-label">College</span>
            <span className="info-value">{settings.college}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Branch</span>
            <span className="info-value">{settings.branch}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Semester</span>
            <span className="info-value">Semester {settings.semester}</span>
          </div>
        </div>
      </div>

      {/* Notification Settings Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 className="settings-card-title" style={{ margin: 0 }}>
            <BellIcon size={18} />
            <span>Notification Settings</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`status-pill ${settings.remindersEnabled ? 'active' : ''}`}>
              {settings.remindersEnabled ? '🟢 Notifications: On' : '⚪ Notifications: Off'}
            </span>
          </div>
        </div>

        <div className="setting-toggle-row">
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Class Reminders
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {settings.remindersEnabled
                ? 'Alerts are enabled for upcoming lectures and labs'
                : 'Alerts are disabled'}
            </div>
          </div>
          <label className="toggle-switch" aria-label="Toggle Class Reminders">
            <input
              type="checkbox"
              checked={settings.remindersEnabled}
              onChange={toggleReminders}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {settings.remindersEnabled && (
          <div className="reminder-select-group">
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Notify me before class:
            </div>
            <div className="reminder-pills-row">
              {[5, 10, 15, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`pill-option-btn ${settings.remindMinutesBefore === mins ? 'active' : ''}`}
                  onClick={() => handleReminderTimeSelect(mins)}
                >
                  Notify me: {mins} minutes before
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Notification Preview */}
        {settings.remindersEnabled ? (
          notifEvaluation?.notification ? (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem',
                background: 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.35rem',
                  fontSize: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Next Class Notification Preview
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Trigger at {notifEvaluation.notification.scheduledForFormatted}
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                {notifEvaluation.notification.title}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                "{notifEvaluation.notification.body}"
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              ℹ️ {notifEvaluation?.message || 'Schedule loaded. Alerts will be prepared dynamically.'}
            </div>
          )
        ) : (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'var(--bg-card-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            🔕 Notifications are currently turned off. Enable class reminders above to receive timely alerts before your lectures and labs.
          </div>
        )}

        <div style={{ marginTop: '0.75rem', padding: '0.25rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          ℹ️ <em>Notification preferences persist across sessions and sync with your Supabase profile.</em>
        </div>

        {/* ── Browser / Device Notification Permission ── */}
        <div className="notif-permission-panel">
          <div className="notif-permission-header">
            <div className="notif-permission-header-left">
              <span className="notif-permission-label">Allow Notifications</span>
              <span className="notif-permission-sub">
                Browser / device permission required to display alerts
              </span>
            </div>
            <PermissionStatusPill permission={permissionState} />
          </div>

          {/* State-specific guidance */}
          {permissionState === 'unsupported' && (
            <div className="notif-permission-notice notif-notice-muted">
              🚫 The Notification API is not supported on this browser or device. Try a supported
              browser (Chrome, Edge, Firefox, Safari 16.4+) on desktop or Android.
            </div>
          )}

          {permissionState === 'denied' && (
            <div className="notif-permission-notice notif-notice-error">
              🔕 Notifications are blocked. To enable them, open your browser's site settings
              for this page and change Notifications to <strong>"Allow"</strong>, then reload the
              app.
            </div>
          )}

          {permissionState === 'default' && (
            <div className="notif-permission-notice notif-notice-info">
              🔔 Grant browser notification permission so ClassMate can display class reminders on
              your device.
            </div>
          )}

          {permissionState === 'granted' && (
            <div className="notif-permission-notice notif-notice-success">
              ✅ Browser notifications are allowed. ClassMate can display class reminders on this
              device.
            </div>
          )}

          {/* Action button — request permission or already granted */}
          {permissionState === 'default' && (
            <button
              id="btn-allow-notifications"
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: '0.75rem' }}
              onClick={handleRequestPermission}
              disabled={isRequestingPermission}
            >
              <BellIcon size={14} />
              <span>{isRequestingPermission ? 'Requesting…' : 'Allow Notifications'}</span>
            </button>
          )}
        </div>

        {/* ── Background Push Notifications ── */}
        <div className="notif-permission-panel">
          <div className="notif-permission-header">
            <div className="notif-permission-header-left">
              <span className="notif-permission-label">Enable Push Notifications</span>
              <span className="notif-permission-sub">
                Receive class reminders even when ClassMate is not open
              </span>
            </div>
            <PushStatusPill status={pushStatus} />
          </div>

          {/* State-specific guidance */}
          {pushStatus === 'unsupported' && (
            <div className="notif-permission-notice notif-notice-muted">
              🚫 Background push notifications are not supported on this browser. Try Chrome,
              Edge, or Firefox on desktop or Android.
            </div>
          )}

          {pushStatus === 'permission_denied' && (
            <div className="notif-permission-notice notif-notice-error">
              🔕 Notification permission is blocked. Enable notifications in browser site settings
              first, then come back to enable push.
            </div>
          )}

          {pushStatus === 'permission_required' && (
            <div className="notif-permission-notice notif-notice-info">
              🔔 Browser notification permission is required first. Grant permission above, then
              enable push notifications here.
            </div>
          )}

          {pushStatus === 'not_subscribed' && !isVapidConfigured() && (
            <div className="notif-permission-notice notif-notice-muted">
              ⚙️ Push notifications are coming soon. The server configuration is not yet complete.
            </div>
          )}

          {pushStatus === 'not_subscribed' && isVapidConfigured() && (
            <div className="notif-permission-notice notif-notice-info">
              📲 Push is ready to enable. Press the button below to subscribe this device.
            </div>
          )}

          {pushStatus === 'subscribed' && (
            <div className="notif-permission-notice notif-notice-success">
              ✅ This device is subscribed to background push. Class reminders will be delivered
              even when ClassMate is closed.
            </div>
          )}

          {pushStatus === 'error' && (
            <div className="notif-permission-notice notif-notice-error">
              ⚠️ An error occurred with the push subscription. Try disabling and re-enabling push.
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {(pushStatus === 'not_subscribed') && isVapidConfigured() && (
              <button
                id="btn-enable-push"
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleEnablePush}
                disabled={isPushLoading}
              >
                <BellIcon size={14} />
                <span>{isPushLoading ? 'Enabling…' : 'Enable Push Notifications'}</span>
              </button>
            )}

            {pushStatus === 'subscribed' && (
              <button
                id="btn-disable-push"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDisablePush}
                disabled={isPushLoading}
              >
                <span>{isPushLoading ? 'Disabling…' : 'Disable Push on This Device'}</span>
              </button>
            )}
          </div>

          {pushFeedback && (
            <div
              className={`notif-test-feedback ${
                pushFeedback.type === 'success'
                  ? 'notif-notice-success'
                  : pushFeedback.type === 'error'
                  ? 'notif-notice-error'
                  : 'notif-notice-info'
              }`}
            >
              {pushFeedback.message}
            </div>
          )}
        </div>

      </div>

      {/* Data Management & Timetable Reset Card */}
      <div className="settings-card">
        <h3 className="settings-card-title">
          <RotateCcwIcon size={18} />
          <span>Timetable Data Management</span>
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Your schedule changes are saved automatically. You can restore the original official schedule anytime.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (window.confirm(`Reset timetable to the official ${settings.section} schedule? Any custom classes you added will be replaced.`)) {
              onResetTimetable();
            }
          }}
        >
          <RotateCcwIcon size={15} />
          <span>Reset to Official {settings.section} Timetable</span>
        </button>
      </div>

      {/* Creator / About Card */}
      <div className="creator-card">
        <div className="creator-header">
          <div className="creator-title">
            <span>Disha Maurya</span>
          </div>
        </div>
        <p className="creator-message">
          <em>Built to make college timetables simpler, clearer, and less stressful.</em>
        </p>
        <div className="creator-footer">
          <span>ClassMate · Your College Timetable</span>
          <span>Your schedule, made simpler</span>
        </div>
      </div>
    </div>
  );
};
