import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { OfficialEvent, ClassSuspension, EventType } from '../types/calendar';
import {
  getDateStringIST,
  isDateInRange,
  EVENT_TYPE_LABELS,
} from '../types/calendar';
import { calendarService } from '../services/calendarService';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  AlertTriangleIcon,
  MapPinIcon,
  ClockIcon,
  AlertCircleIcon,
} from './Icons';

interface OfficialCalendarProps {
  effectiveTime: Date;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const OfficialCalendar: React.FC<OfficialCalendarProps> = ({ effectiveTime }) => {
  // Calendar View Month/Year
  const [viewDate, setViewDate] = useState<Date>(() => new Date(effectiveTime));
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getDateStringIST(effectiveTime));

  // Events & Suspensions state (student only sees published)
  const [events, setEvents] = useState<OfficialEvent[]>([]);
  const [suspensions, setSuspensions] = useState<ClassSuspension[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter tabs for upcoming events list
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'holiday' | 'suspension' | 'academic'>('all');

  // Fetch published events for current month (with ±1 month padding)
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

      // Filter only published items for students
      setEvents(evts.filter((e) => e.published));
      setSuspensions(susps.filter((s) => s.published));
    } catch (err: unknown) {
      console.warn('Failed to load student calendar data:', err);
      setFetchError('Could not load official calendar events. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [viewDate]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

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
    const firstDayWeekday = (firstDay.getDay() + 6) % 7; // Mon=0, Sun=6

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

    // 1. Previous month leading days
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

    // 2. Current month days
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

    // 3. Next month trailing days
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
      {/* Student Calendar Header Card */}
      <div className="calendar-header-card">
        <div className="calendar-header-info">
          <div className="calendar-header-title-row">
            <div className="calendar-title-icon-wrapper">
              <CalendarDaysIcon size={24} />
            </div>
            <div>
              <h2 className="calendar-page-title">Official Academic Calendar</h2>
              <p className="calendar-page-subtitle">
                Official college holidays, training announcements, events, and class suspension notices
              </p>
            </div>
          </div>
        </div>
      </div>

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
              const hasCancel = cell.hasHoliday || cell.suspensions.length > 0;

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

                  {/* Event indicators on cell */}
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
          </div>

          <div className="details-content">
            {selectedDayData.events.length === 0 && selectedDayData.suspensions.length === 0 ? (
              <div className="details-empty-state">
                <div className="empty-icon-box">
                  <CalendarDaysIcon size={32} />
                </div>
                <h4>No Official Events</h4>
                <p>Regular classes follow the standard semester timetable on this day.</p>
              </div>
            ) : (
              <div className="details-items-list">
                {/* Suspensions on selected date */}
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
                              ? `Classes from ${s.cutoffTime} onwards are cancelled`
                              : `Classes from ${s.cutoffTime} to ${s.periodEndTime} cancelled`}
                          </span>
                        </div>
                      )}
                      {(s.affectedSection || s.affectedBatch || s.affectedGroup) && (
                        <div className="item-scope-tag">
                          Scope: {[s.affectedSection, s.affectedBatch, s.affectedGroup].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Events on selected date */}
                {selectedDayData.events.map((e) => (
                  <div
                    key={e.id}
                    className={`details-item-card ${e.eventType === 'holiday' ? 'item-holiday' : 'item-academic'}`}
                  >
                    <div className="item-card-top">
                      <div className={`item-badge ${getEventBadgeClass(e.eventType)}`}>
                        <span>{EVENT_TYPE_LABELS[e.eventType]}</span>
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
                        <div className="item-cancel-badge">
                          Regular Classes Suspended
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Events / Announcements Section */}
      <div className="calendar-upcoming-card">
        <div className="upcoming-header-row">
          <div>
            <h3 className="upcoming-title">Upcoming Academic Events & Holidays</h3>
            <p className="upcoming-subtitle">Scheduled official notices for upcoming dates</p>
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
    </div>
  );
};
