import React, { useState, useEffect } from 'react';
import type { OfficialEvent, EventType } from '../types/calendar';
import { EVENT_TYPE_LABELS, getDateStringIST } from '../types/calendar';
import { ALL_SECTIONS } from '../types/timetable';
import { XIcon, AlertCircleIcon, CalendarDaysIcon } from './Icons';
import { timeToMinutes } from '../utils/timeUtils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Omit<OfficialEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: OfficialEvent | null;
  defaultDate?: string;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultDate,
}) => {
  const isEditing = Boolean(initialData);

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('holiday');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [cancelsClasses, setCancelsClasses] = useState(true);
  const [published, setPublished] = useState(true);
  const [affectedSection, setAffectedSection] = useState('');
  const [affectedBatch, setAffectedBatch] = useState('');
  const [affectedGroup, setAffectedGroup] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setTitle(initialData.title);
      setEventType(initialData.eventType);
      setStartDate(initialData.startDate);
      setEndDate(initialData.endDate || '');
      setStartTime(initialData.startTime || '');
      setEndTime(initialData.endTime || '');
      setLocation(initialData.location || '');
      setDescription(initialData.description || '');
      setCancelsClasses(initialData.cancelsClasses);
      setPublished(initialData.published);
      setAffectedSection(initialData.affectedSection || '');
      setAffectedBatch(initialData.affectedBatch || '');
      setAffectedGroup(initialData.affectedGroup || '');
    } else {
      const today = defaultDate || getDateStringIST();
      setTitle('');
      setEventType('holiday');
      setStartDate(today);
      setEndDate('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setDescription('');
      setCancelsClasses(true); // default true for holidays
      setPublished(true);
      setAffectedSection('');
      setAffectedBatch('');
      setAffectedGroup('');
    }
    setErrors({});
  }, [initialData, defaultDate, isOpen]);

  // When switching event type to holiday, default cancelsClasses to true; for others default false
  const handleTypeChange = (newType: EventType) => {
    setEventType(newType);
    if (!isEditing) {
      if (newType === 'holiday') {
        setCancelsClasses(true);
      } else {
        setCancelsClasses(false);
      }
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = 'Event title is required.';
    }

    if (!startDate) {
      errs.startDate = 'Start date is required.';
    }

    if (endDate && endDate < startDate) {
      errs.endDate = 'End date cannot be earlier than start date.';
    }

    if (startTime && !endTime) {
      errs.endTime = 'End time is required when start time is specified.';
    }

    if (!startTime && endTime) {
      errs.startTime = 'Start time is required when end time is specified.';
    }

    if (startTime && endTime) {
      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        errs.endTime = 'End time must be after start time.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        eventType,
        startDate,
        endDate: endDate ? endDate : null,
        startTime: startTime ? startTime : null,
        endTime: endTime ? endTime : null,
        location: location.trim() ? location.trim() : null,
        description: description.trim() ? description.trim() : null,
        cancelsClasses,
        published,
        affectedSection: affectedSection ? affectedSection : null,
        affectedBatch: affectedBatch ? affectedBatch : null,
        affectedGroup: affectedGroup ? affectedGroup : null,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save event.';
      setErrors((prev) => ({ ...prev, form: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
    >
      <div className="modal-dialog" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CalendarDaysIcon size={20} />
            <h3 id="event-modal-title" className="modal-title">
              {isEditing ? 'Edit Official Event' : 'Add Official Event'}
            </h3>
          </div>
          <button
            type="button"
            className="btn-icon-action"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <XIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {errors.form && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-rose-light)',
                  border: '1px solid var(--accent-rose-border)',
                  color: 'var(--text-rose)',
                  fontSize: '0.88rem',
                }}
              >
                <AlertCircleIcon size={16} />
                <span>{errors.form}</span>
              </div>
            )}

            {/* Title */}
            <div className="form-group">
              <label htmlFor="event-title" className="form-label">
                Event Title *
              </label>
              <input
                id="event-title"
                type="text"
                className={`form-input ${errors.title ? 'error' : ''}`}
                placeholder="e.g. Diwali Holiday, Operating Systems Training"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              {errors.title && <span className="form-error">{errors.title}</span>}
            </div>

            {/* Event Type */}
            <div className="form-group">
              <label htmlFor="event-type" className="form-label">
                Event Type *
              </label>
              <select
                id="event-type"
                className="form-select"
                value={eventType}
                onChange={(e) => handleTypeChange(e.target.value as EventType)}
              >
                {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((typeKey) => (
                  <option key={typeKey} value={typeKey}>
                    {EVENT_TYPE_LABELS[typeKey]}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range: Start Date & End Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="form-group">
                <label htmlFor="event-start-date" className="form-label">
                  Start Date *
                </label>
                <input
                  id="event-start-date"
                  type="date"
                  className={`form-input ${errors.startDate ? 'error' : ''}`}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                {errors.startDate && <span className="form-error">{errors.startDate}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="event-end-date" className="form-label">
                  End Date <span style={{ opacity: 0.6 }}>(optional)</span>
                </label>
                <input
                  id="event-end-date"
                  type="date"
                  className={`form-input ${errors.endDate ? 'error' : ''}`}
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {errors.endDate && <span className="form-error">{errors.endDate}</span>}
              </div>
            </div>

            {/* Time Range: Start Time & End Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="form-group">
                <label htmlFor="event-start-time" className="form-label">
                  Start Time <span style={{ opacity: 0.6 }}>(optional)</span>
                </label>
                <input
                  id="event-start-time"
                  type="time"
                  className={`form-input ${errors.startTime ? 'error' : ''}`}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                {errors.startTime && <span className="form-error">{errors.startTime}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="event-end-time" className="form-label">
                  End Time <span style={{ opacity: 0.6 }}>(optional)</span>
                </label>
                <input
                  id="event-end-time"
                  type="time"
                  className={`form-input ${errors.endTime ? 'error' : ''}`}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                {errors.endTime && <span className="form-error">{errors.endTime}</span>}
              </div>
            </div>

            {/* Location */}
            <div className="form-group">
              <label htmlFor="event-location" className="form-label">
                Location <span style={{ opacity: 0.6 }}>(optional)</span>
              </label>
              <input
                id="event-location"
                type="text"
                className="form-input"
                placeholder="e.g. Auditorium, Lab 204, Online"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="event-description" className="form-label">
                Description / Notes <span style={{ opacity: 0.6 }}>(optional)</span>
              </label>
              <textarea
                id="event-description"
                className="form-input"
                rows={2}
                placeholder="Details or guidelines for students..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Scope (Section, Batch, Group) */}
            <div
              style={{
                background: 'var(--bg-card-subtle)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Event Scope (Leave empty for All Students)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                <div>
                  <label htmlFor="event-section" className="form-label" style={{ fontSize: '0.78rem' }}>
                    Section
                  </label>
                  <select
                    id="event-section"
                    className="form-select"
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                    value={affectedSection}
                    onChange={(e) => setAffectedSection(e.target.value)}
                  >
                    <option value="">All Sections</option>
                    {ALL_SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="event-batch" className="form-label" style={{ fontSize: '0.78rem' }}>
                    DV / Specialization
                  </label>
                  <select
                    id="event-batch"
                    className="form-select"
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                    value={affectedBatch}
                    onChange={(e) => setAffectedBatch(e.target.value)}
                  >
                    <option value="">All Batches</option>
                    <option value="DV Batch 1">DV Batch 1</option>
                    <option value="DV Batch 2">DV Batch 2</option>
                    <option value="Cloud">Cloud</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="event-group" className="form-label" style={{ fontSize: '0.78rem' }}>
                    Lab Group
                  </label>
                  <select
                    id="event-group"
                    className="form-select"
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                    value={affectedGroup}
                    onChange={(e) => setAffectedGroup(e.target.value)}
                  >
                    <option value="">All Groups</option>
                    <option value="Group 1">Group 1</option>
                    <option value="Group 2">Group 2</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Cancels Regular Classes Checkbox */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                background: cancelsClasses ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card-subtle)',
                border: cancelsClasses ? '1px solid var(--accent-rose-border)' : '1px solid var(--border-color)',
                marginBottom: '1rem',
              }}
            >
              <input
                id="event-cancels-classes"
                type="checkbox"
                checked={cancelsClasses}
                onChange={(e) => setCancelsClasses(e.target.checked)}
                style={{ marginTop: '0.2rem', cursor: 'pointer' }}
              />
              <label htmlFor="event-cancels-classes" style={{ cursor: 'pointer' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: cancelsClasses ? 'var(--text-rose)' : 'var(--text-primary)' }}>
                  Cancels or replaces regular classes
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  {cancelsClasses
                    ? 'Regular timetable classes during this event date/time will be marked as cancelled and reminder notifications will be suppressed.'
                    : 'Regular timetable classes will proceed as normal alongside this event.'}
                </div>
              </label>
            </div>

            {/* Published / Draft Checkbox */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
              }}
            >
              <input
                id="event-published"
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="event-published" style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                {published ? 'Published (Visible to students)' : 'Draft (Visible only to creator)'}
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Event' : 'Publish Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
