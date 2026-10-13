import React, { useState } from 'react';
import type { ClassItem, DayOfWeek, UserSettings } from '../types/timetable';
import { isSectionAvailable } from '../types/timetable';
import { DAYS_LIST, OFFICIAL_TIMETABLE_DATA } from '../data/timetable';
import { ClockIcon, MapPinIcon, UserIcon, EditIcon, TrashIcon, PlusIcon, CalendarIcon, FilterIcon } from './Icons';
import { formatTimeRange, timeToMinutes } from '../utils/timeUtils';
import { ComingSoonView } from './ComingSoonView';

interface WeeklyTimetableProps {
  allClasses: ClassItem[];
  userClasses: ClassItem[];
  settings: UserSettings;
  onAddClass: (defaultDay?: DayOfWeek) => void;
  onEditClass: (item: ClassItem) => void;
  onDeleteClass: (item: ClassItem) => void;
  onSwitchToCSE15?: () => void;
}

export const WeeklyTimetable: React.FC<WeeklyTimetableProps> = ({
  allClasses,
  userClasses,
  settings,
  onAddClass,
  onEditClass,
  onDeleteClass,
  onSwitchToCSE15,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [viewScope, setViewScope] = useState<'mySchedule' | 'allSection'>('mySchedule');
  const [mobileView, setMobileView] = useState<'day' | 'matrix'>('day');

  // If user selected a Coming Soon section, show Coming Soon state
  if (!isSectionAvailable(settings.section, OFFICIAL_TIMETABLE_DATA)) {
    return (
      <div className="timetable-container">
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <CalendarIcon size={20} />
              <span>{settings.section} Weekly Timetable</span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Academic Schedule Configuration
            </p>
          </div>
        </div>
        <ComingSoonView section={settings.section} onSwitchToAvailableSection={onSwitchToCSE15} />
      </div>
    );
  }

  // Active classes depending on view scope
  const displayedClasses = viewScope === 'mySchedule' ? userClasses : allClasses;

  const currentDayClasses = displayedClasses
    .filter((c) => c.day === selectedDay)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  // Weekdays to render in the matrix (Monday-Friday plus Saturday/Sunday if custom classes exist)
  const matrixDays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (displayedClasses.some((c) => c.day === 'Saturday')) {
    matrixDays.push('Saturday');
  }
  if (displayedClasses.some((c) => c.day === 'Sunday')) {
    matrixDays.push('Sunday');
  }

  // Helper to find classes in a period for the desktop grid
  const getClassesForPeriod = (day: DayOfWeek, periodIndex: number) => {
    const periodTimes = [
      { start: '08:50', end: '09:40' },
      { start: '09:40', end: '10:30' },
      { start: '10:40', end: '11:30' },
      { start: '11:30', end: '12:20' },
      { start: '13:10', end: '14:00' },
      { start: '14:00', end: '14:50' },
      { start: '14:50', end: '15:40' },
      { start: '15:40', end: '16:30' },
    ];
    const p = periodTimes[periodIndex];
    if (!p) return [];

    const pStart = timeToMinutes(p.start);
    const pEnd = timeToMinutes(p.end);

    return displayedClasses.filter((c) => {
      if (c.day !== day) return false;
      const cStart = timeToMinutes(c.startTime);
      const cEnd = timeToMinutes(c.endTime);
      return Math.max(pStart, cStart) < Math.min(pEnd, cEnd);
    });
  };

  return (
    <div className="timetable-container">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">
            <CalendarIcon size={20} />
            <span>{settings.section} Weekly Timetable</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Semester 3 • Track: <strong>{settings.specializationOption}</strong> • Group: <strong>{settings.groupOption}</strong>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onAddClass(selectedDay)}
        >
          <PlusIcon size={16} />
          <span>Add Class</span>
        </button>
      </div>

      {/* Scope Switcher: My Personalized Schedule vs Full Section Master */}
      <div className="timetable-scope-bar">
        <div className="scope-pill-group">
          <button
            type="button"
            className={`scope-pill-btn ${viewScope === 'mySchedule' ? 'active' : ''}`}
            onClick={() => setViewScope('mySchedule')}
          >
            <FilterIcon size={14} />
            <span>My Schedule ({userClasses.length} classes)</span>
          </button>
          <button
            type="button"
            className={`scope-pill-btn ${viewScope === 'allSection' ? 'active' : ''}`}
            onClick={() => setViewScope('allSection')}
          >
            <CalendarIcon size={14} />
            <span>All {settings.section} Batches ({allClasses.length})</span>
          </button>
        </div>
      </div>

      {/* Mobile View Switcher (Day Schedule vs Weekly Matrix) */}
      <div className="mobile-view-switcher" role="tablist" aria-label="Timetable View Mode">
        <div className="switcher-pill-group">
          <button
            type="button"
            role="tab"
            id="view-tab-day"
            aria-selected={mobileView === 'day'}
            aria-controls="panel-day-schedule"
            className={`switcher-pill-btn ${mobileView === 'day' ? 'active' : ''}`}
            onClick={() => setMobileView('day')}
          >
            <ClockIcon size={14} />
            <span>Day Schedule</span>
          </button>
          <button
            type="button"
            role="tab"
            id="view-tab-matrix"
            aria-selected={mobileView === 'matrix'}
            aria-controls="panel-weekly-matrix"
            className={`switcher-pill-btn ${mobileView === 'matrix' ? 'active' : ''}`}
            onClick={() => setMobileView('matrix')}
          >
            <CalendarIcon size={14} />
            <span>Weekly Matrix</span>
          </button>
        </div>
      </div>

      {/* Day Schedule Panel (Day Selector Tabs & Chronological Cards) */}
      <div
        id="panel-day-schedule"
        role="tabpanel"
        aria-labelledby="view-tab-day"
        className={`timetable-day-view ${mobileView !== 'day' ? 'mobile-hidden' : ''}`}
      >
        {/* Mobile & Tablet Day Selector Tabs */}
        <div className="day-selector-tabs" role="tablist" aria-label="Timetable Days">
          {(DAYS_LIST as readonly DayOfWeek[]).map((day) => {
            const count = displayedClasses.filter((c) => c.day === day).length;
            const isActive = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`day-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <span>{day.substring(0, 3)}</span>
                {count > 0 && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      opacity: isActive ? 0.9 : 0.7,
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-card-subtle)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '999px',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day Class Cards */}
        <div className="mobile-day-schedule">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {selectedDay} Schedule
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {currentDayClasses.length} {currentDayClasses.length === 1 ? 'class' : 'classes'}
            </span>
          </div>

          {currentDayClasses.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon">🏖️</div>
              <h3 className="empty-state-title">No Classes Scheduled for {selectedDay}</h3>
              <p className="empty-state-desc">
                {selectedDay === 'Saturday' || selectedDay === 'Sunday'
                  ? 'Weekend! Enjoy your time off or study at your own pace.'
                  : 'No classes match your current group and specialization track for this day.'}
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onAddClass(selectedDay)}
              >
                <PlusIcon size={14} />
                <span>Add class for {selectedDay}</span>
              </button>
            </div>
          ) : (
            <div className="classes-list">
              {currentDayClasses.map((item) => (
                <article key={item.id} className="class-card" data-class-id={item.id}>
                  <div className="class-card-header">
                    <div className="card-time-row">
                      <ClockIcon size={14} />
                      <span>{formatTimeRange(item.startTime, item.endTime)}</span>
                    </div>
                    <span className={`type-badge ${item.type}`}>{item.type}</span>
                  </div>

                  <div className="class-card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="course-code-badge">{item.courseCode}</span>
                      {item.batch && <span className="batch-tag">{item.batch}</span>}
                    </div>

                    <h4 className="card-subject-name">{item.subject}</h4>

                    <div className="card-info-row">
                      <div className="card-info-item">
                        <UserIcon size={14} />
                        <span>{item.teacher}</span>
                      </div>
                      <div className="card-info-item">
                        <MapPinIcon size={14} />
                        <span>{item.room}</span>
                      </div>
                    </div>
                  </div>

                  <div className="class-card-actions">
                    <button
                      type="button"
                      className="btn-icon-action"
                      onClick={() => onEditClass(item)}
                      title="Edit class"
                      aria-label={`Edit ${item.subject}`}
                    >
                      <EditIcon size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-action delete"
                      onClick={() => onDeleteClass(item)}
                      title="Delete class"
                      aria-label={`Delete ${item.subject}`}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly Master Matrix View */}
      <div
        id="panel-weekly-matrix"
        role="tabpanel"
        aria-labelledby="view-tab-matrix"
        className={`timetable-matrix-view desktop-grid-view ${mobileView !== 'matrix' ? 'mobile-hidden' : ''}`}
      >
        <div className="matrix-header">
          <h3 className="matrix-title">
            {viewScope === 'mySchedule' ? 'Your Weekly Class Matrix' : `Full Section Master Matrix (${settings.section})`}
          </h3>
          <span className="matrix-scroll-hint" aria-hidden="true">
            ⇄ Scroll horizontally
          </span>
        </div>

        <div className="matrix-table-container">
          <table className="timetable-table">
            <thead>
              <tr>
                <th className="sticky-day-header">Day</th>
                <th>P1<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>08:50-09:40</span></th>
                <th>P2<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>09:40-10:30</span></th>
                <th>P3<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>10:40-11:30</span></th>
                <th>P4<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>11:30-12:20</span></th>
                <th>Lunch<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>12:20-01:10</span></th>
                <th>P5<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>01:10-02:00</span></th>
                <th>P6<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>02:00-02:50</span></th>
                <th>P7<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>02:50-03:40</span></th>
                <th>P8<br /><span style={{ fontWeight: 400, opacity: 0.8 }}>03:40-04:30</span></th>
              </tr>
            </thead>
            <tbody>
              {matrixDays.map((day) => (
                <tr key={day}>
                  <td className="day-col">{day.substring(0, 3)}</td>
                  {[0, 1, 2, 3].map((pIdx) => {
                    const items = getClassesForPeriod(day, pIdx);
                    return (
                      <td key={pIdx}>
                        {items.map((it) => (
                          <div key={it.id} className={`table-cell-class ${it.type}`}>
                            <div className="table-class-code">{it.courseCode}</div>
                            <div className="table-class-sub" title={it.subject}>{it.subject}</div>
                            <div className="table-class-meta">
                              {it.room} {it.batch && `(${it.batch})`}
                            </div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                  <td className="lunch-col">LUNCH</td>
                  {[4, 5, 6, 7].map((pIdx) => {
                    const items = getClassesForPeriod(day, pIdx);
                    return (
                      <td key={pIdx}>
                        {items.map((it) => (
                          <div key={it.id} className={`table-cell-class ${it.type}`}>
                            <div className="table-class-code">{it.courseCode}</div>
                            <div className="table-class-sub" title={it.subject}>{it.subject}</div>
                            <div className="table-class-meta">
                              {it.room} {it.batch && `(${it.batch})`}
                            </div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
