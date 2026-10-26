import React, { useState, useEffect, useMemo } from 'react';
import type { ClassItem, DayOfWeek, UserSettings, SpecializationOption, GroupOption } from './types/timetable';
import { isSectionAvailable, isClassForUser, isProfileComplete } from './types/timetable';
import { OFFICIAL_TIMETABLE_DATA } from './data/timetable';
import { timetableStorage } from './services/timetableStorage';
import { settingsStorage } from './services/settingsStorage';
import { analyzeDaySchedule } from './utils/timeUtils';
import { Header } from './components/Header';
import { NextClassCard } from './components/NextClassCard';
import { TodaySchedule } from './components/TodaySchedule';
import { WeeklyTimetable } from './components/WeeklyTimetable';
import { Settings } from './components/Settings';
import { Navigation, type ActiveTab } from './components/Navigation';
import { ClassModal } from './components/ClassModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { NotificationPromptCard } from './components/NotificationPromptCard';
import { ComingSoonView } from './components/ComingSoonView';
import { OfficialCalendar } from './components/OfficialCalendar';
import { AdminCalendar } from './components/AdminCalendar';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { useCreatorAuth } from './hooks/useCreatorAuth';
import { calendarService } from './services/calendarService';
import type { OfficialEvent, ClassSuspension } from './types/calendar';
import {
  getDateStringIST,
  evaluateClassCancellation,
  doesScopeApply,
} from './types/calendar';
import { AuthCallbackScreen } from './components/AuthCallbackScreen';
import { isAuthCallbackUrl } from './utils/authCallback';
import { PlusIcon, ClockIcon, GraduationCapIcon, AlertTriangleIcon, CalendarDaysIcon } from './components/Icons';
import './services/browserNotificationDelivery';
import './styles/index.css';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { isAdmin, isPrimaryAdmin } = useCreatorAuth(user?.id, user?.email);

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  // Callback flow handler state (email confirmation, token exchange, error processing)
  const [isHandlingCallback, setIsHandlingCallback] = useState<boolean>(() => isAuthCallbackUrl());
  // Session-only flag: true only in the session where onboarding just completed.
  // Existing users (onboardingCompleted=true on load) never see this prompt.
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>(() => timetableStorage.getClasses());
  const [settings, setSettings] = useState<UserSettings>(() => settingsStorage.getSettings(user?.id));
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  const isProfileLoading = Boolean(user && syncedUserId !== user.id);

  // Today's events and suspensions for cancellation & banner integration
  const [todayEvents, setTodayEvents] = useState<OfficialEvent[]>([]);
  const [todaySuspensions, setTodaySuspensions] = useState<ClassSuspension[]>([]);

  // Real clock state
  const [realTime, setRealTime] = useState<Date>(new Date());

  // Optional simulated time for testing/demoing different timetable states
  const [simulatedTimeOffset, setSimulatedTimeOffset] = useState<string>('live');

  // Modal states
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [classModalDefaultDay, setClassModalDefaultDay] = useState<DayOfWeek>('Monday');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);

  // Cloud synchronization with Supabase when authenticated
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const currentUserId = user.id;

    // Concurrently synchronize timetable and profile from Supabase
    Promise.all([
      timetableStorage.syncFromSupabase(currentUserId).catch((err) => {
        console.warn('Timetable sync error:', err);
        return timetableStorage.getClasses();
      }),
      settingsStorage.syncFromSupabase(currentUserId).catch((err) => {
        console.warn('Settings sync error:', err);
        return settingsStorage.getSettings(currentUserId);
      }),
    ]).then(([cloudClasses, cloudSettings]) => {
      if (!isMounted) return;
      if (cloudClasses) {
        setClasses(cloudClasses);
      }
      if (cloudSettings) {
        setSettings(cloudSettings);
      }
      setSyncedUserId(currentUserId);
    }).catch(() => {
      if (isMounted) {
        setSyncedUserId(currentUserId);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setRealTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Effective time (either real time or simulated test scenario)
  const effectiveTime = useMemo(() => {
    if (simulatedTimeOffset === 'live') {
      return realTime;
    }

    const [simDay, simTime] = simulatedTimeOffset.split('|');
    const [simH, simM] = simTime.split(':').map(Number);

    const d = new Date();
    const dayMap: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const targetDayNum = dayMap[simDay] ?? 1;
    const currentDayNum = d.getDay();
    const diff = targetDayNum - currentDayNum;
    d.setDate(d.getDate() + diff);
    d.setHours(simH, simM, 0, 0);
    return d;
  }, [realTime, simulatedTimeOffset]);

  // Today's date string in IST (Asia/Kolkata)
  const todayDateStr = useMemo(() => getDateStringIST(effectiveTime), [effectiveTime]);

  // Fetch today's official events and suspensions
  useEffect(() => {
    if (!user) return;
    calendarService
      .fetchOfficialEvents(todayDateStr, todayDateStr)
      .then(setTodayEvents)
      .catch((err) => console.warn('Failed to load today events:', err));

    calendarService
      .fetchClassSuspensions(todayDateStr, todayDateStr)
      .then(setTodaySuspensions)
      .catch((err) => console.warn('Failed to load today suspensions:', err));
  }, [user, todayDateStr]);

  // User scope for event/suspension filtering
  const userScope = useMemo(
    () => ({
      section: settings.section,
      specializationOption: settings.specializationOption,
      groupOption: settings.groupOption,
    }),
    [settings.section, settings.specializationOption, settings.groupOption]
  );

  // Filtered classes personalized to user's Section, DV/Cloud, and Group
  const userFilteredClasses = useMemo(() => {
    return classes.filter((c) => isClassForUser(c, settings));
  }, [classes, settings]);

  // Full day schedule analysis (includes all scheduled timetable classes)
  const scheduleAnalysis = useMemo(() => {
    return analyzeDaySchedule(userFilteredClasses, effectiveTime);
  }, [userFilteredClasses, effectiveTime]);

  // Cancellations map for today's classes
  const cancellationsMap = useMemo(() => {
    const map: Record<string, { isCancelled: boolean; reason?: string }> = {};
    for (const c of userFilteredClasses) {
      const res = evaluateClassCancellation(
        c,
        todayDateStr,
        todayEvents,
        todaySuspensions,
        userScope
      );
      if (res.isCancelled) {
        map[c.id] = { isCancelled: true, reason: res.reason };
      }
    }
    return map;
  }, [userFilteredClasses, todayDateStr, todayEvents, todaySuspensions, userScope]);

  // Active (non-cancelled) classes for today used to evaluate upcoming classes
  const nonCancelledUserClasses = useMemo(() => {
    return userFilteredClasses.filter((c) => !cancellationsMap[c.id]?.isCancelled);
  }, [userFilteredClasses, cancellationsMap]);

  // NextClassCard schedule analysis based exclusively on non-cancelled classes
  const activeScheduleAnalysis = useMemo(() => {
    return analyzeDaySchedule(nonCancelledUserClasses, effectiveTime);
  }, [nonCancelledUserClasses, effectiveTime]);

  // Active notice (holiday or suspension) for prominent dashboard banner
  const activeNotice = useMemo(() => {
    // Check suspension first
    const activeSusp = todaySuspensions.find(
      (s) => s.published && doesScopeApply(s, {} as ClassItem, userScope)
    );
    if (activeSusp) {
      let detail = activeSusp.description || undefined;
      if (activeSusp.suspensionType === 'after_cutoff' && activeSusp.cutoffTime) {
        detail = `Classes starting from ${activeSusp.cutoffTime} onwards are cancelled. ${detail || ''}`.trim();
      } else if (activeSusp.suspensionType === 'period' && activeSusp.cutoffTime && activeSusp.periodEndTime) {
        detail = `Classes between ${activeSusp.cutoffTime} and ${activeSusp.periodEndTime} are suspended. ${detail || ''}`.trim();
      }
      return {
        title: activeSusp.title,
        type: 'suspension' as const,
        detail,
      };
    }

    // Check holiday
    const holiday = todayEvents.find(
      (e) =>
        e.eventType === 'holiday' &&
        e.cancelsClasses &&
        doesScopeApply(e, {} as ClassItem, userScope)
    );
    if (holiday) {
      return {
        title: holiday.title,
        type: 'holiday' as const,
        detail: holiday.description || 'All regular classes are suspended today.',
      };
    }

    return null;
  }, [todaySuspensions, todayEvents, userScope]);

  // 0. Dedicated Auth Callback Screen (Email confirmation redirect, PKCE, or error)
  if (isHandlingCallback) {
    return (
      <AuthCallbackScreen
        onContinue={() => setIsHandlingCallback(false)}
        onGoToSignIn={() => setIsHandlingCallback(false)}
      />
    );
  }

  // 1. Loading splash while verifying auth session or loading Supabase profile
  if (isLoading || (user && isProfileLoading)) {
    return (
      <div className="app-loading-screen">
        <div className="loading-content">
          <div className="loading-badge">
            <GraduationCapIcon size={32} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '1rem' }}>ClassMate</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {isLoading ? 'Checking security session...' : 'Loading profile & timetable...'}
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Show Login / Sign Up screen (No Guest access)
  if (!user) {
    return <AuthScreen />;
  }

  // 3. Authenticated but onboarding incomplete or profile incomplete: Show Onboarding
  if (!settings.onboardingCompleted || !isProfileComplete(settings)) {
    const handleCompleteOnboarding = async (selections: {
      section: string;
      specializationOption: SpecializationOption;
      groupOption: GroupOption;
    }) => {
      const updated: UserSettings = {
        ...settings,
        section: selections.section,
        specializationOption: selections.specializationOption,
        groupOption: selections.groupOption,
        onboardingCompleted: true,
      };
      // Save profile first — notification prompt only appears after this succeeds
      setSettings(updated);
      await settingsStorage.saveSettingsAsync(updated, user.id, user.email);
      // Show notification permission prompt (session-only, never repeats on future logins)
      setShowNotificationPrompt(true);
    };

    return (
      <OnboardingScreen
        initialSettings={settings}
        onSaveAndComplete={handleCompleteOnboarding}
      />
    );
  }

  // 3b. Onboarding just completed in this session — show notification prompt
  if (showNotificationPrompt) {
    return (
      <NotificationPromptCard
        userId={user.id}
        onDismiss={() => setShowNotificationPrompt(false)}
      />
    );
  }

  // 4. Main ClassMate Dashboard
  const handleOpenAddClass = (defaultDay?: DayOfWeek) => {
    setEditingClass(null);
    setClassModalDefaultDay(defaultDay || (scheduleAnalysis.dayName as DayOfWeek) || 'Monday');
    setIsClassModalOpen(true);
  };

  const handleOpenEditClass = (item: ClassItem) => {
    setEditingClass(item);
    setIsClassModalOpen(true);
  };

  const handleSaveClass = (classData: Omit<ClassItem, 'id'> | ClassItem) => {
    if ('id' in classData && classData.id) {
      timetableStorage.updateClass(classData as ClassItem, user.id);
      setClasses(timetableStorage.getClasses());
    } else {
      timetableStorage.addClass(classData as Omit<ClassItem, 'id'>, user.id);
      setClasses(timetableStorage.getClasses());
    }
  };

  const handleOpenDeleteClass = (item: ClassItem) => {
    setDeletingClass(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingClass) {
      timetableStorage.deleteClass(deletingClass.id, user.id);
      setClasses(timetableStorage.getClasses());
      setIsDeleteModalOpen(false);
      setDeletingClass(null);
    }
  };

  const handleUpdateSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    await settingsStorage.saveSettingsAsync(newSettings, user.id, user.email);
  };

  const handleResetTimetable = () => {
    const defaultClasses = timetableStorage.resetToOfficial();
    setClasses(defaultClasses);
  };

  const handleSwitchToAvailableSection = () => {
    // Find the first section with data to switch to
    const available = OFFICIAL_TIMETABLE_DATA.map((c) => c.section).find(Boolean);
    if (available) {
      handleUpdateSettings({
        ...settings,
        section: available,
      });
    }
  };

  return (
    <div className="app-container">
      {/* Navigation (Sidebar on Desktop, Bottom Bar on Mobile) */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userEmail={user.email}
        section={settings.section}
        isAdmin={isAdmin}
        isPrimaryAdmin={isPrimaryAdmin}
      />

      {/* Main App Content */}
      <main className="main-content">
        {/* Top Header */}
        <Header
          currentTime={effectiveTime}
          settings={settings}
          userEmail={user.email}
        />

        {/* Time Simulator / Live Mode Bar */}
        <div className="time-simulator-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ClockIcon size={14} />
            <span>Time Mode:</span>
          </div>
          <div className="simulator-controls">
            <select
              aria-label="Time Simulation Selector"
              className="simulator-select"
              value={simulatedTimeOffset}
              onChange={(e) => setSimulatedTimeOffset(e.target.value)}
            >
              <option value="live">🟢 Live Clock (Real time)</option>
            </select>
          </div>
        </div>

        {/* Home Tab */}
        {activeTab === 'home' && (
          <div>
            {!isSectionAvailable(settings.section, OFFICIAL_TIMETABLE_DATA) ? (
              <ComingSoonView
                section={settings.section}
                onSwitchToAvailableSection={handleSwitchToAvailableSection}
              />
            ) : (
              <>
                {/* Active Holiday or Suspension Banner on Dashboard */}
                {activeNotice && (
                  <div
                    className={`dashboard-notice-banner ${activeNotice.type === 'holiday' ? 'banner-holiday' : 'banner-suspension'}`}
                  >
                    <div className="banner-icon-col">
                      {activeNotice.type === 'holiday' ? (
                        <CalendarDaysIcon size={22} />
                      ) : (
                        <AlertTriangleIcon size={22} />
                      )}
                    </div>
                    <div className="banner-content-col">
                      <div className="banner-title">
                        {activeNotice.type === 'holiday' ? 'Official Holiday' : 'Class Suspension Notice'}:{' '}
                        {activeNotice.title}
                      </div>
                      {activeNotice.detail && (
                        <div className="banner-detail">{activeNotice.detail}</div>
                      )}
                    </div>
                  </div>
                )}

                <NextClassCard
                  currentClass={activeScheduleAnalysis.currentClass}
                  nextClass={activeScheduleAnalysis.nextClass}
                  hasClassesToday={activeScheduleAnalysis.hasClassesToday}
                  allCompleted={activeScheduleAnalysis.allCompleted}
                  dayName={activeScheduleAnalysis.dayName}
                  notice={activeNotice}
                />

                <TodaySchedule
                  classes={scheduleAnalysis.dayClasses}
                  dayName={scheduleAnalysis.dayName}
                  onEditClass={handleOpenEditClass}
                  onDeleteClass={handleOpenDeleteClass}
                  cancellationsMap={cancellationsMap}
                />
              </>
            )}
          </div>
        )}

        {/* Weekly Timetable Tab */}
        {activeTab === 'timetable' && (
          <WeeklyTimetable
            allClasses={classes}
            userClasses={userFilteredClasses}
            settings={settings}
            onAddClass={handleOpenAddClass}
            onEditClass={handleOpenEditClass}
            onDeleteClass={handleOpenDeleteClass}
            onSwitchToCSE15={handleSwitchToAvailableSection}
          />
        )}

        {/* Student Academic Calendar Tab */}
        {activeTab === 'calendar' && (
          <OfficialCalendar effectiveTime={effectiveTime} />
        )}

        {/* Dedicated Admin Calendar Tab (Administrators only) */}
        {activeTab === 'admin-calendar' && isAdmin && (
          <AdminCalendar
            userId={user.id}
            userEmail={user.email}
            isPrimaryAdmin={isPrimaryAdmin}
            effectiveTime={effectiveTime}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetTimetable={handleResetTimetable}
            classes={classes}
            currentTime={effectiveTime}
          />
        )}

        {/* Floating Action Button (FAB) for Quick Add Class (Weekly Timetable tab only) */}
        {activeTab === 'timetable' && isSectionAvailable(settings.section, OFFICIAL_TIMETABLE_DATA) && (
          <button
            type="button"
            className="fab-btn"
            onClick={() => handleOpenAddClass()}
            title="Add New Class"
            aria-label="Add New Class"
          >
            <PlusIcon size={24} />
          </button>
        )}
      </main>

      {/* Add / Edit Class Modal */}
      <ClassModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        onSave={handleSaveClass}
        initialData={editingClass}
        defaultDay={classModalDefaultDay}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        classItem={deletingClass}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
