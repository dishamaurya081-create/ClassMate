import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  OfficialEvent,
  ClassSuspension,
  EventType,
  AdminUserRecord,
} from '../types/calendar';
import {
  getDateStringIST,
  isDateInRange,
  EVENT_TYPE_LABELS,
  PRIMARY_ADMIN_EMAIL,
} from '../types/calendar';
import { calendarService } from '../services/calendarService';
import { EventModal } from './EventModal';
import { SuspensionModal } from './SuspensionModal';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  AlertTriangleIcon,
  CalendarDaysIcon,
  TrashIcon,
  EditIcon,
  MapPinIcon,
  ClockIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  XIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from './Icons';

interface AdminCalendarProps {
  userId: string;
  userEmail?: string | null;
  isPrimaryAdmin: boolean;
  effectiveTime: Date;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const AdminCalendar: React.FC<AdminCalendarProps> = ({
  userId,
  userEmail,
  isPrimaryAdmin,
  effectiveTime,
}) => {
  // Navigation inside Admin Calendar: 'calendar' or 'access' (primary admin only)
  const [adminTab, setAdminTab] = useState<'calendar' | 'access'>('calendar');

  // Calendar View Month/Year
  const [viewDate, setViewDate] = useState<Date>(() => new Date(effectiveTime));
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getDateStringIST(effectiveTime));

  // Events & Suspensions state (Admin sees all, including drafts)
  const [events, setEvents] = useState<OfficialEvent[]>([]);
  const [suspensions, setSuspensions] = useState<ClassSuspension[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter tabs for upcoming events list
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'holiday' | 'suspension' | 'academic'>('all');

  // Modals state for events/suspensions
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OfficialEvent | null>(null);

  const [isSuspensionModalOpen, setIsSuspensionModalOpen] = useState(false);
  const [editingSuspension, setEditingSuspension] = useState<ClassSuspension | null>(null);

  // Delete confirmation for events/suspensions
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'event' | 'suspension';
    id: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin Access management state (Primary admin only)
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [grantEmailInput, setGrantEmailInput] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [isGranting, setIsGranting] = useState(false);

  // Revoke admin modal state
  const [adminToRevoke, setAdminToRevoke] = useState<AdminUserRecord | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = useCallback((text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // Fetch events & suspensions
  const loadCalendarData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 2).padStart(2, '0')}-28`;

      const [evts, susps] = await Promise.all([
        calendarService.fetchOfficialEvents(startDate, endDate),
        calendarService.fetchClassSuspensions(startDate, endDate),
      ]);

      setEvents(evts);
      setSuspensions(susps);
    } catch (err: unknown) {
      console.warn('Failed to load admin calendar data:', err);
      setFetchError('Could not load official calendar records from database.');
    } finally {
      setIsLoading(false);
    }
  }, [viewDate]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Fetch admin users list when opening Admin Access tab
  const loadAdminUsers = useCallback(async () => {
    if (!isPrimaryAdmin) return;
    setIsLoadingAdmins(true);
    try {
      const users = await calendarService.fetchAdminUsers();
      setAdminUsers(users);
    } catch (err) {
      console.warn('Failed to load admin users:', err);
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [isPrimaryAdmin]);

  useEffect(() => {
    if (adminTab === 'access' && isPrimaryAdmin) {
      loadAdminUsers();
    }
  }, [adminTab, isPrimaryAdmin, loadAdminUsers]);

  // Month navigation
  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    const today = new Date(effectiveTime);
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateStr(getDateStringIST(today));
  };

  // Calendar Month Grid Calculation
  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const firstDayWeekday = (firstDay.getDay() + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    interface CalendarCell {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      events: OfficialEvent[];
      suspensions: ClassSuspension[];
      hasHoliday: boolean;
      hasSuspension: boolean;
    }

    const todayStr = getDateStringIST(effectiveTime);
    const cells: CalendarCell[] = [];

    // Leading days
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dStr = getDateStringIST(prevDate);
      const dayEvents = events.filter((e) => isDateInRange(dStr, e.startDate, e.endDate));
      const daySuspensions = suspensions.filter((s) => isDateInRange(dStr, s.startDate, s.endDate));
      cells.push({
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
        events: dayEvents,
        suspensions: daySuspensions,
        hasHoliday: dayEvents.some((e) => e.eventType === 'holiday' && e.cancelsClasses),
        hasSuspension: daySuspensions.length > 0,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const currDate = new Date(year, month, day);
      const dStr = getDateStringIST(currDate);
      const dayEvents = events.filter((e) => isDateInRange(dStr, e.startDate, e.endDate));
      const daySuspensions = suspensions.filter((s) => isDateInRange(dStr, s.startDate, s.endDate));
      cells.push({
        dateStr: dStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
        events: dayEvents,
        suspensions: daySuspensions,
        hasHoliday: dayEvents.some((e) => e.eventType === 'holiday' && e.cancelsClasses),
        hasSuspension: daySuspensions.length > 0,
      });
    }

    // Trailing days
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dStr = getDateStringIST(nextDate);
      const dayEvents = events.filter((e) => isDateInRange(dStr, e.startDate, e.endDate));
      const daySuspensions = suspensions.filter((s) => isDateInRange(dStr, s.startDate, s.endDate));
      cells.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
        events: dayEvents,
        suspensions: daySuspensions,
        hasHoliday: dayEvents.some((e) => e.eventType === 'holiday' && e.cancelsClasses),
        hasSuspension: daySuspensions.length > 0,
      });
    }

    return cells;
  }, [viewDate, selectedDateStr, effectiveTime, events, suspensions]);

  // Selected date details
  const selectedDayData = useMemo(() => {
    const dayEvents = events.filter((e) => isDateInRange(selectedDateStr, e.startDate, e.endDate));
    const daySuspensions = suspensions.filter((s) => isDateInRange(selectedDateStr, s.startDate, s.endDate));

    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      formattedDate,
      events: dayEvents,
      suspensions: daySuspensions,
      isToday: selectedDateStr === getDateStringIST(effectiveTime),
    };
  }, [selectedDateStr, events, suspensions, effectiveTime]);

  // Upcoming items list
  const upcomingItems = useMemo(() => {
    const todayStr = getDateStringIST(effectiveTime);

    const futureEvents = events
      .filter((e) => (e.endDate || e.startDate) >= todayStr)
      .map((e) => ({
        kind: 'event' as const,
        id: e.id,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        eventType: e.eventType,
        cancelsClasses: e.cancelsClasses,
        location: e.location,
        description: e.description,
        published: e.published,
        data: e,
      }));

    const futureSuspensions = suspensions
      .filter((s) => (s.endDate || s.startDate) >= todayStr)
      .map((s) => ({
        kind: 'suspension' as const,
        id: s.id,
        title: s.title,
        startDate: s.startDate,
        endDate: s.endDate,
        suspensionType: s.suspensionType,
        cutoffTime: s.cutoffTime,
        periodEndTime: s.periodEndTime,
        description: s.description,
        published: s.published,
        data: s,
      }));

    const all = [...futureEvents, ...futureSuspensions].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    );

    if (upcomingFilter === 'holiday') {
      return all.filter((item) => item.kind === 'event' && item.eventType === 'holiday');
    }
    if (upcomingFilter === 'suspension') {
      return all.filter((item) => item.kind === 'suspension');
    }
    if (upcomingFilter === 'academic') {
      return all.filter((item) => item.kind === 'event' && item.eventType !== 'holiday');
    }

    return all;
  }, [events, suspensions, effectiveTime, upcomingFilter]);

  // Event & Suspension CRUD
  const handleSaveEvent = async (eventData: Omit<OfficialEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingEvent) {
      await calendarService.updateOfficialEvent(editingEvent.id, eventData);
      showToast('Official event updated successfully.');
    } else {
      await calendarService.createOfficialEvent(eventData, userId);
      showToast('Official event published successfully.');
    }
    await loadCalendarData();
  };

  const handleSaveSuspension = async (
    suspensionData: Omit<ClassSuspension, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (editingSuspension) {
      await calendarService.updateClassSuspension(editingSuspension.id, suspensionData);
      showToast('Class suspension updated successfully.');
    } else {
      await calendarService.createClassSuspension(suspensionData, userId);
      showToast('Class suspension notice posted successfully.');
    }
    await loadCalendarData();
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'event') {
        await calendarService.deleteOfficialEvent(itemToDelete.id);
        showToast(`Event "${itemToDelete.title}" deleted.`);
      } else {
        await calendarService.deleteClassSuspension(itemToDelete.id);
        showToast(`Suspension notice "${itemToDelete.title}" removed.`);
      }
      setItemToDelete(null);
      await loadCalendarData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed.';
      showToast(msg, true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Primary Admin: Grant Admin Access
  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);
    const cleanEmail = grantEmailInput.trim().toLowerCase();

    if (!cleanEmail) {
      setGrantError('Please enter a Gmail address.');
      return;
    }

    if (!cleanEmail.includes('@')) {
      setGrantError('Please enter a valid email address.');
      return;
    }

    if (cleanEmail === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      setGrantError(`${PRIMARY_ADMIN_EMAIL} is already the primary administrator.`);
      return;
    }

    setIsGranting(true);
    try {
      const res = await calendarService.grantAdminAccess(cleanEmail);
      showToast(res.message);
      setGrantEmailInput('');
      await loadAdminUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to grant admin access.';
      setGrantError(msg);
    } finally {
      setIsGranting(false);
    }
  };

  // Primary Admin: Revoke Admin Access
  const handleRevokeConfirm = async () => {
    if (!adminToRevoke) return;
    setIsRevoking(true);
    try {
      const res = await calendarService.revokeAdminAccess(adminToRevoke.userId);
      showToast(res.message);
      setAdminToRevoke(null);
      await loadAdminUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke administrator.';
      showToast(msg, true);
    } finally {
      setIsRevoking(false);
    }
  };

  const getEventBadgeClass = (type: EventType) => {
    switch (type) {
      case 'holiday':
        return 'cal-badge-holiday';
      case 'training':
        return 'cal-badge-training';
      case 'college_event':
        return 'cal-badge-college';
      case 'exam':
        return 'cal-badge-exam';
      case 'workshop':
        return 'cal-badge-workshop';
      case 'announcement':
        return 'cal-badge-announcement';
      default:
        return 'cal-badge-other';
    }
  };

  return (
    <div className="calendar-page-container">
      {/* Toast message */}
      {toastMessage && (
        <div
          className={`calendar-toast ${toastMessage.isError ? 'calendar-toast-error' : 'calendar-toast-success'}`}
          role="status"
        >
          {toastMessage.isError ? <AlertCircleIcon size={18} /> : <CheckCircleIcon size={18} />}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss message"
          >
            <XIcon size={14} />
          </button>
        </div>
      )}

      {/* Admin Calendar Header Card */}
      <div className="calendar-header-card admin-header-card">
        <div className="calendar-header-info">
          <div className="calendar-header-title-row">
            <div className="calendar-title-icon-wrapper admin-shield-icon">
              <ShieldCheckIcon size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 className="calendar-page-title">Admin Calendar</h2>
                <span className={`admin-role-badge ${isPrimaryAdmin ? 'primary' : 'standard'}`}>
                  {isPrimaryAdmin ? 'Primary Administrator' : 'Administrator'}
                </span>
              </div>
              <p className="calendar-page-subtitle">
                Logged in as <strong>{userEmail || 'Admin'}</strong> &bull; Official management portal for college holidays, training sessions, events, and class suspensions
              </p>
            </div>
          </div>
        </div>

        {/* Creator / Admin Action Buttons (Calendar Tab) */}
        {adminTab === 'calendar' && (
          <div className="calendar-creator-actions">
            <button
              type="button"
              className="btn-calendar-add"
              onClick={() => {
                setEditingEvent(null);
                setIsEventModalOpen(true);
              }}
            >
              <PlusIcon size={16} />
              <span>Add Event</span>
            </button>
            <button
              type="button"
              className="btn-calendar-suspend"
              onClick={() => {
                setEditingSuspension(null);
                setIsSuspensionModalOpen(true);
              }}
            >
              <AlertTriangleIcon size={16} />
              <span>Suspend Classes</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Admin Navigation Tabs: Calendar & Events vs Admin Access */}
      {isPrimaryAdmin && (
        <div className="admin-subnav-bar">
          <button
            type="button"
            className={`admin-subnav-tab ${adminTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setAdminTab('calendar')}
          >
            <CalendarDaysIcon size={16} />
            <span>Calendar & Events</span>
          </button>
          <button
            type="button"
            className={`admin-subnav-tab ${adminTab === 'access' ? 'active' : ''}`}
            onClick={() => setAdminTab('access')}
          >
            <UserPlusIcon size={16} />
            <span>Admin Access</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 1: CALENDAR & EVENTS MANAGEMENT
          ───────────────────────────────────────────────────────────────── */}
      {adminTab === 'calendar' && (
        <>
          {fetchError && (
            <div className="calendar-error-banner">
              <AlertCircleIcon size={18} />
              <span>{fetchError}</span>
              <button type="button" className="btn-retry-link" onClick={loadCalendarData}>
                Retry
              </button>
            </div>
          )}

          {/* Calendar Navigation & Month Bar */}
          <div className="calendar-controls-bar">
            <div className="calendar-month-selector">
              <button
                type="button"
                className="cal-nav-btn"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
              >
                <ChevronLeftIcon size={18} />
              </button>

              <span className="cal-month-heading">
                {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {isLoading && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 500 }}>
                    (loading...)
                  </span>
                )}
              </span>

              <button
                type="button"
                className="cal-nav-btn"
                onClick={handleNextMonth}
                aria-label="Next Month"
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>

            <button
              type="button"
              className="cal-today-btn"
              onClick={handleGoToToday}
            >
              Today
            </button>
          </div>

          {/* Main Two-Column Layout */}
          <div className="calendar-main-grid">
            {/* Left Column: Monthly Calendar Grid */}
            <div className="calendar-grid-card">
              <div className="calendar-weekdays-row">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="calendar-weekday-header">
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-days-grid" role="grid" aria-label="Monthly Days Grid">
                {calendarGrid.map((cell) => {
                  const totalItems = cell.events.length + cell.suspensions.length;
                  const hasCancel =
                    cell.hasHoliday || cell.suspensions.some((s) => s.published);

                  return (
                    <button
                      type="button"
                      key={cell.dateStr}
                      className={`calendar-cell ${!cell.isCurrentMonth ? 'calendar-cell-outside' : ''} ${cell.isToday ? 'calendar-cell-today' : ''} ${cell.isSelected ? 'calendar-cell-selected' : ''} ${hasCancel ? 'calendar-cell-cancelled' : ''}`}
                      onClick={() => setSelectedDateStr(cell.dateStr)}
                      aria-label={`${cell.dateStr}, ${totalItems} events`}
                    >
                      <div className="calendar-cell-top">
                        <span className={`cell-day-num ${cell.isToday ? 'cell-day-num-today' : ''}`}>
                          {cell.dayNumber}
                        </span>

                        {cell.hasHoliday && (
                          <span className="cell-mini-pill pill-holiday" title="Holiday">
                            Off
                          </span>
                        )}

                        {cell.hasSuspension && !cell.hasHoliday && (
                          <span className="cell-mini-pill pill-suspended" title="Classes Suspended">
                            Susp
                          </span>
                        )}
                      </div>

                      {/* Event indicators */}
                      <div className="calendar-cell-indicators">
                        {cell.events.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={`cell-event-label ${getEventBadgeClass(ev.eventType)}`}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        ))}

                        {cell.suspensions.slice(0, 1).map((su) => (
                          <div
                            key={su.id}
                            className="cell-event-label cal-badge-suspension"
                            title={su.title}
                          >
                            {su.cutoffTime ? `Susp > ${su.cutoffTime}` : 'Classes Suspended'}
                          </div>
                        ))}

                        {totalItems > 2 && (
                          <div className="cell-more-badge">+{totalItems - 2} more</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Date Details Panel */}
            <div className="calendar-details-card">
              <div className="details-header">
                <div>
                  <div className="details-header-tag">
                    {selectedDayData.isToday ? 'TODAY' : 'SELECTED DATE'}
                  </div>
                  <h3 className="details-date-title">{selectedDayData.formattedDate}</h3>
                </div>
                <div className="details-quick-actions">
                  <button
                    type="button"
                    className="btn-quick-add"
                    title="Add Event on this date"
                    onClick={() => {
                      setEditingEvent(null);
                      setIsEventModalOpen(true);
                    }}
                  >
                    <PlusIcon size={14} /> Event
                  </button>
                </div>
              </div>

              <div className="details-content">
                {selectedDayData.events.length === 0 && selectedDayData.suspensions.length === 0 ? (
                  <div className="details-empty-state">
                    <div className="empty-icon-box">
                      <CalendarDaysIcon size={32} />
                    </div>
                    <h4>No Scheduled Events</h4>
                    <p>Regular classes follow standard timetable. Click Add Event or Suspend Classes above.</p>
                  </div>
                ) : (
                  <div className="details-items-list">
                    {/* Suspensions */}
                    {selectedDayData.suspensions.map((s) => (
                      <div key={s.id} className="details-item-card item-suspension">
                        <div className="item-card-top">
                          <div className="item-badge cal-badge-suspension">
                            <AlertTriangleIcon size={14} />
                            <span>
                              {s.suspensionType === 'full_day'
                                ? 'Full-Day Suspension'
                                : s.suspensionType === 'after_cutoff'
                                ? `Suspended After ${s.cutoffTime}`
                                : `Suspended ${s.cutoffTime}–${s.periodEndTime}`}
                            </span>
                          </div>

                          <div className="item-card-actions">
                            <button
                              type="button"
                              className="btn-item-action edit"
                              onClick={() => {
                                setEditingSuspension(s);
                                setIsSuspensionModalOpen(true);
                              }}
                              title="Edit Suspension"
                              aria-label="Edit Suspension"
                            >
                              <EditIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-item-action delete"
                              onClick={() =>
                                setItemToDelete({
                                  type: 'suspension',
                                  id: s.id,
                                  title: s.title,
                                })
                              }
                              title="Delete Suspension"
                              aria-label="Delete Suspension"
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </div>

                        <h4 className="item-title">{s.title}</h4>

                        {s.description && (
                          <p className="item-description">{s.description}</p>
                        )}

                        <div className="item-meta-row">
                          {s.cutoffTime && (
                            <div className="item-meta">
                              <ClockIcon size={14} />
                              <span>
                                {s.suspensionType === 'after_cutoff'
                                  ? `Classes from ${s.cutoffTime} onwards cancelled`
                                  : `Period: ${s.cutoffTime}–${s.periodEndTime}`}
                              </span>
                            </div>
                          )}
                          {(s.affectedSection || s.affectedBatch || s.affectedGroup) && (
                            <div className="item-scope-tag">
                              Scope: {[s.affectedSection, s.affectedBatch, s.affectedGroup].filter(Boolean).join(' • ')}
                            </div>
                          )}
                          {!s.published && (
                            <div className="item-draft-badge">Draft (Unpublished)</div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Events */}
                    {selectedDayData.events.map((e) => (
                      <div
                        key={e.id}
                        className={`details-item-card ${e.eventType === 'holiday' ? 'item-holiday' : 'item-academic'}`}
                      >
                        <div className="item-card-top">
                          <div className={`item-badge ${getEventBadgeClass(e.eventType)}`}>
                            <span>{EVENT_TYPE_LABELS[e.eventType]}</span>
                          </div>

                          <div className="item-card-actions">
                            <button
                              type="button"
                              className="btn-item-action edit"
                              onClick={() => {
                                setEditingEvent(e);
                                setIsEventModalOpen(true);
                              }}
                              title="Edit Event"
                              aria-label="Edit Event"
                            >
                              <EditIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-item-action delete"
                              onClick={() =>
                                setItemToDelete({
                                  type: 'event',
                                  id: e.id,
                                  title: e.title,
                                })
                              }
                              title="Delete Event"
                              aria-label="Delete Event"
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </div>

                        <h4 className="item-title">{e.title}</h4>

                        {e.description && (
                          <p className="item-description">{e.description}</p>
                        )}

                        <div className="item-meta-row">
                          {e.startTime && (
                            <div className="item-meta">
                              <ClockIcon size={14} />
                              <span>{e.endTime ? `${e.startTime} – ${e.endTime}` : e.startTime}</span>
                            </div>
                          )}

                          {e.location && (
                            <div className="item-meta">
                              <MapPinIcon size={14} />
                              <span>{e.location}</span>
                            </div>
                          )}

                          {e.cancelsClasses && (
                            <div className="item-cancel-badge">Regular Classes Suspended</div>
                          )}

                          {!e.published && (
                            <div className="item-draft-badge">Draft (Unpublished)</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming Events List */}
          <div className="calendar-upcoming-card">
            <div className="upcoming-header-row">
              <div>
                <h3 className="upcoming-title">Upcoming Academic Events & Notices</h3>
                <p className="upcoming-subtitle">All scheduled holidays, suspensions, exams, and training</p>
              </div>

              <div className="upcoming-filter-tabs">
                <button
                  type="button"
                  className={`filter-tab ${upcomingFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setUpcomingFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`filter-tab ${upcomingFilter === 'holiday' ? 'active' : ''}`}
                  onClick={() => setUpcomingFilter('holiday')}
                >
                  Holidays
                </button>
                <button
                  type="button"
                  className={`filter-tab ${upcomingFilter === 'suspension' ? 'active' : ''}`}
                  onClick={() => setUpcomingFilter('suspension')}
                >
                  Suspensions
                </button>
                <button
                  type="button"
                  className={`filter-tab ${upcomingFilter === 'academic' ? 'active' : ''}`}
                  onClick={() => setUpcomingFilter('academic')}
                >
                  Academic
                </button>
              </div>
            </div>

            {upcomingItems.length === 0 ? (
              <div className="upcoming-empty">
                <p>No upcoming notices in this category.</p>
              </div>
            ) : (
              <div className="upcoming-list-grid">
                {upcomingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`upcoming-card ${item.kind === 'suspension' ? 'card-border-amber' : item.eventType === 'holiday' ? 'card-border-rose' : 'card-border-primary'}`}
                    onClick={() => setSelectedDateStr(item.startDate)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="upcoming-card-top">
                      <span className="upcoming-date-badge">
                        {item.startDate}
                        {item.endDate && item.endDate !== item.startDate ? ` → ${item.endDate}` : ''}
                      </span>
                      <span
                        className={`item-badge ${item.kind === 'suspension' ? 'cal-badge-suspension' : getEventBadgeClass(item.eventType)}`}
                      >
                        {item.kind === 'suspension' ? 'Suspension' : EVENT_TYPE_LABELS[item.eventType]}
                      </span>
                    </div>

                    <div className="upcoming-card-title">{item.title}</div>

                    {item.kind === 'suspension' && item.cutoffTime && (
                      <div className="upcoming-card-sub">
                        {item.suspensionType === 'after_cutoff'
                          ? `Classes after ${item.cutoffTime} suspended`
                          : `Suspension period: ${item.cutoffTime}–${item.periodEndTime}`}
                      </div>
                    )}

                    {item.kind === 'event' && item.location && (
                      <div className="upcoming-card-sub">
                        <MapPinIcon size={12} />
                        <span>{item.location}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 2: ADMIN ACCESS MANAGEMENT (Primary Administrator Only)
          ───────────────────────────────────────────────────────────────── */}
      {adminTab === 'access' && isPrimaryAdmin && (
        <div className="admin-access-container">
          {/* Information Banner */}
          <div className="admin-access-info-card">
            <div className="info-icon-wrapper">
              <ShieldCheckIcon size={22} />
            </div>
            <div>
              <h3 className="info-card-title">Primary Administrator Control Panel</h3>
              <p className="info-card-desc">
                Only your account (<strong>{PRIMARY_ADMIN_EMAIL}</strong>) is authorized to grant or revoke administrator privileges.
                Additional administrators can manage calendar events and class suspensions, but cannot add or revoke other administrators.
              </p>
            </div>
          </div>

          {/* Grant Admin Access Form */}
          <div className="admin-grant-card">
            <h3 className="card-section-title">Grant Administrator Access</h3>
            <p className="card-section-subtitle">
              Enter the Gmail address of an existing registered ClassMate student account to grant administrative privileges.
            </p>

            <form onSubmit={handleGrantAdmin} className="admin-grant-form">
              <div className="grant-input-group">
                <input
                  type="email"
                  className={`form-input grant-email-input ${grantError ? 'error' : ''}`}
                  placeholder="student@gmail.com"
                  value={grantEmailInput}
                  onChange={(e) => {
                    setGrantEmailInput(e.target.value);
                    if (grantError) setGrantError(null);
                  }}
                  disabled={isGranting}
                />
                <button
                  type="submit"
                  className="btn-primary grant-btn"
                  disabled={isGranting || !grantEmailInput.trim()}
                >
                  <UserPlusIcon size={16} />
                  <span>{isGranting ? 'Checking & Granting...' : 'Grant Admin Access'}</span>
                </button>
              </div>

              {grantError && (
                <div className="grant-error-message">
                  <AlertCircleIcon size={16} />
                  <span>{grantError}</span>
                </div>
              )}
            </form>
          </div>

          {/* Authorized Administrators List */}
          <div className="admin-list-card">
            <div className="admin-list-header">
              <div>
                <h3 className="card-section-title">Authorized Administrators</h3>
                <p className="card-section-subtitle">Current accounts with calendar and class suspension management permissions</p>
              </div>
              <button
                type="button"
                className="btn-refresh-list"
                onClick={loadAdminUsers}
                disabled={isLoadingAdmins}
              >
                {isLoadingAdmins ? 'Refreshing...' : 'Refresh List'}
              </button>
            </div>

            {isLoadingAdmins ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading administrator accounts...
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Gmail Address</th>
                      <th>Role</th>
                      <th>Access Status</th>
                      <th>Granted Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((admin) => {
                      const isRootPrimary =
                        admin.role === 'primary_admin' ||
                        admin.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();

                      return (
                        <tr key={admin.id}>
                          <td>
                            <div className="admin-email-col">
                              <span className="admin-email-text">{admin.email}</span>
                              {isRootPrimary && (
                                <span className="root-indicator">(Initial Primary)</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${isRootPrimary ? 'primary-role' : 'admin-role'}`}>
                              {isRootPrimary ? 'Primary Admin' : 'Admin'}
                            </span>
                          </td>
                          <td>
                            <span className="status-pill-active">Active</span>
                          </td>
                          <td>
                            <span className="granted-date-text">
                              {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'Initial Setup'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isRootPrimary ? (
                              <span className="protected-action-text">Root Owner</span>
                            ) : (
                              <button
                                type="button"
                                className="btn-revoke-admin"
                                onClick={() => setAdminToRevoke(admin)}
                                title={`Revoke access for ${admin.email}`}
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Event/Suspension Confirmation Modal */}
      {itemToDelete && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-rose)' }}>
                <AlertCircleIcon size={20} />
                <h3 id="delete-confirm-title" className="modal-title" style={{ color: 'var(--accent-rose)' }}>
                  Delete {itemToDelete.type === 'event' ? 'Official Event' : 'Suspension Notice'}?
                </h3>
              </div>
              <button
                type="button"
                className="btn-icon-action"
                onClick={() => setItemToDelete(null)}
                aria-label="Close"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '0.75rem' }}>
                Are you sure you want to permanently delete this {itemToDelete.type}?
              </p>
              <div
                style={{
                  background: 'var(--bg-card-subtle)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {itemToDelete.title}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                Once removed, standard timetable scheduling and class reminders will immediately be restored for all affected students.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Administrator Access Confirmation Modal */}
      {adminToRevoke && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-confirm-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-rose)' }}>
                <AlertCircleIcon size={20} />
                <h3 id="revoke-confirm-title" className="modal-title" style={{ color: 'var(--accent-rose)' }}>
                  Revoke Administrator Access?
                </h3>
              </div>
              <button
                type="button"
                className="btn-icon-action"
                onClick={() => setAdminToRevoke(null)}
                aria-label="Close"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '0.75rem' }}>
                Are you sure you want to revoke administrator access for this account?
              </p>
              <div
                style={{
                  background: 'var(--bg-card-subtle)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {adminToRevoke.email}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.45 }}>
                • The account will immediately lose access to the Admin Calendar.<br />
                • They will return to standard student permissions.<br />
                • Their existing student timetable and profile will remain completely safe and untouched.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAdminToRevoke(null)}
                disabled={isRevoking}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleRevokeConfirm}
                disabled={isRevoking}
              >
                {isRevoking ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event and Suspension Management Modals */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        initialData={editingEvent}
        defaultDate={selectedDateStr}
      />

      <SuspensionModal
        isOpen={isSuspensionModalOpen}
        onClose={() => setIsSuspensionModalOpen(false)}
        onSave={handleSaveSuspension}
        initialData={editingSuspension}
        defaultDate={selectedDateStr}
      />
    </div>
  );
};
