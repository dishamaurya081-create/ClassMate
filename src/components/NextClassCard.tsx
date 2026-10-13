import React from 'react';
import type { ClassItemWithStatus } from '../types/timetable';

import { ClockIcon, MapPinIcon, UserIcon, SparklesIcon, CalendarIcon } from './Icons';
import { formatTimeRange } from '../utils/timeUtils';

interface NextClassCardProps {
  currentClass: ClassItemWithStatus | null;
  nextClass: ClassItemWithStatus | null;
  hasClassesToday: boolean;
  allCompleted: boolean;
  dayName: string;
}

export const NextClassCard: React.FC<NextClassCardProps> = ({
  currentClass,
  nextClass,
  hasClassesToday,
  allCompleted,
  dayName,
}) => {
  // Case 1: Weekend or day with no classes scheduled
  if (!hasClassesToday) {
    return (
      <section className="next-class-container" aria-label="Current and Next Class Status">
        <div className="hero-card is-empty">
          <div className="empty-state-icon">🏖️</div>
          <h2 className="hero-subject-name" style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>
            No classes scheduled for {dayName}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Enjoy your weekend and recharge for the upcoming week!
          </p>
        </div>
      </section>
    );
  }

  // Case 2: All classes for today are finished
  if (allCompleted) {
    return (
      <section className="next-class-container" aria-label="Current and Next Class Status">
        <div className="hero-card is-empty" style={{ borderTop: '4px solid var(--accent-emerald)' }}>
          <div className="empty-state-icon">🎉</div>
          <h2 className="hero-subject-name" style={{ fontSize: '1.3rem', marginBottom: '0.35rem' }}>
            No more classes today 🎉
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            You have completed all scheduled classes for {dayName}. Great job!
          </p>
        </div>
      </section>
    );
  }

  // Determine which class to feature: current class takes precedence, then next class
  const activeClass = currentClass || nextClass;

  if (!activeClass) {
    return (
      <section className="next-class-container" aria-label="Current and Next Class Status">
        <div className="hero-card is-empty">
          <div className="empty-state-icon">🎉</div>
          <h2 className="hero-subject-name" style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>
            No more classes today 🎉
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            All classes for {dayName} have concluded.
          </p>
        </div>
      </section>
    );
  }

  const isCurrent = !!currentClass;

  return (
    <section className="next-class-container" aria-label="Current and Next Class Status">
      <div className={`hero-card ${isCurrent ? 'is-current' : 'is-upcoming'}`}>
        <div className="hero-status-bar">
          <div className={`status-badge ${isCurrent ? 'current' : 'upcoming'}`}>
            <SparklesIcon size={14} />
            <span>{isCurrent ? 'CURRENT CLASS' : 'NEXT CLASS'}</span>
          </div>
          <div className="countdown-pill">
            {activeClass.timeRemaining}
          </div>
        </div>

        <div className="hero-card-body">
          <div className="subject-code-row">
            <span className="course-code-badge">{activeClass.courseCode}</span>
            <span className={`type-badge ${activeClass.type}`}>{activeClass.type}</span>
            {activeClass.batch && <span className="batch-tag">{activeClass.batch}</span>}
          </div>

          <h2 className="hero-subject-name">{activeClass.subject}</h2>

          <div className="hero-meta-grid">
            <div className="hero-meta-item">
              <div className="meta-icon-box">
                <ClockIcon size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>TIME</div>
                <strong>{formatTimeRange(activeClass.startTime, activeClass.endTime)}</strong>
              </div>
            </div>

            <div className="hero-meta-item">
              <div className="meta-icon-box">
                <MapPinIcon size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>ROOM / LAB</div>
                <strong>{activeClass.room}</strong>
              </div>
            </div>

            <div className="hero-meta-item">
              <div className="meta-icon-box">
                <UserIcon size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>FACULTY</div>
                <strong>{activeClass.teacher}</strong>
              </div>
            </div>

            <div className="hero-meta-item">
              <div className="meta-icon-box">
                <CalendarIcon size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>DAY & SECTION</div>
                <strong>{activeClass.day} • {activeClass.section}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
