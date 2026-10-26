import React from 'react';
import type { ClassItem, ClassItemWithStatus } from '../types/timetable';

import { ClockIcon, MapPinIcon, UserIcon, EditIcon, TrashIcon, CalendarIcon, BanIcon } from './Icons';
import { formatTimeRange } from '../utils/timeUtils';

interface TodayScheduleProps {
  classes: ClassItemWithStatus[];
  dayName: string;
  onEditClass: (item: ClassItem) => void;
  onDeleteClass: (item: ClassItem) => void;
  cancellationsMap?: Record<string, { isCancelled: boolean; reason?: string }>;
}

export const TodaySchedule: React.FC<TodayScheduleProps> = ({
  classes,
  dayName,
  onEditClass,
  onDeleteClass,
  cancellationsMap = {},
}) => {
  return (
    <section aria-labelledby="today-schedule-title">
      <div className="section-header">
        <h2 id="today-schedule-title" className="section-title">
          <CalendarIcon size={18} />
          <span>Today's Schedule ({dayName})</span>
        </h2>
        <span className="section-count">{classes.length} classes</span>
      </div>

      {classes.length === 0 ? (
        <div className="empty-state-box">
          <div className="empty-state-icon">☕</div>
          <h3 className="empty-state-title">No classes today</h3>
          <p className="empty-state-desc">
            There are no classes scheduled for {dayName}.
          </p>
        </div>
      ) : (
        <div className="classes-list">
          {classes.map((item) => {
            const cancellation = cancellationsMap[item.id];
            const isCancelled = cancellation?.isCancelled;

            let statusClass = 'status-upcoming';
            if (isCancelled) {
              statusClass = 'status-cancelled';
            } else if (item.status === 'completed') {
              statusClass = 'status-completed';
            } else if (item.status === 'current') {
              statusClass = 'status-current';
            }

            return (
              <article
                key={item.id}
                className={`class-card ${statusClass}`}
                data-class-id={item.id}
              >
                <div className="class-card-header">
                  <div className="card-time-row">
                    <ClockIcon size={14} />
                    <span>{formatTimeRange(item.startTime, item.endTime)}</span>
                  </div>
                  {isCancelled ? (
                    <span className="card-status-indicator cancelled">
                      Cancelled
                    </span>
                  ) : (
                    <span className={`card-status-indicator ${item.status}`}>
                      {item.statusLabel}
                    </span>
                  )}
                </div>

                {isCancelled && cancellation?.reason && (
                  <div className="class-cancellation-banner">
                    <BanIcon size={13} />
                    <span>{cancellation.reason}</span>
                  </div>
                )}

                <div className="class-card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="course-code-badge">{item.courseCode}</span>
                    <span className={`type-badge ${item.type}`}>{item.type}</span>
                    {item.batch && <span className="batch-tag">{item.batch}</span>}
                  </div>

                  <h3 className="card-subject-name">{item.subject}</h3>

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
            );
          })}
        </div>
      )}
    </section>
  );
};
