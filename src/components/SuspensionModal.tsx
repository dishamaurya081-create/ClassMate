import React, { useState, useEffect } from 'react';
import type { ClassSuspension, SuspensionType } from '../types/calendar';
import { getDateStringIST } from '../types/calendar';
import { ALL_SECTIONS } from '../types/timetable';
import { XIcon, AlertTriangleIcon, AlertCircleIcon } from './Icons';
import { timeToMinutes } from '../utils/timeUtils';

interface SuspensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (suspensionData: Omit<ClassSuspension, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  initialData?: ClassSuspension | null;
  defaultDate?: string;
}

export const SuspensionModal: React.FC<SuspensionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultDate,
}) => {
  const isEditing = Boolean(initialData);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [suspensionType, setSuspensionType] = useState<SuspensionType>('after_cutoff');
  const [cutoffTime, setCutoffTime] = useState('14:50');
  const [periodEndTime, setPeriodEndTime] = useState('17:00');
  const [description, setDescription] = useState('');
  const [affectedSection, setAffectedSection] = useState('');
  const [affectedBatch, setAffectedBatch] = useState('');
  const [affectedGroup, setAffectedGroup] = useState('');
  const [published, setPublished] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setTitle(initialData.title);
      setStartDate(initialData.startDate);
      setEndDate(initialData.endDate || '');
      setSuspensionType(initialData.suspensionType);
      setCutoffTime(initialData.cutoffTime || '14:50');
      setPeriodEndTime(initialData.periodEndTime || '17:00');
      setDescription(initialData.description || '');
      setAffectedSection(initialData.affectedSection || '');
      setAffectedBatch(initialData.affectedBatch || '');
      setAffectedGroup(initialData.affectedGroup || '');
      setPublished(initialData.published);
    } else {
      const today = defaultDate || getDateStringIST();
      setTitle('Classes Suspended After 2:50 PM');
      setStartDate(today);
      setEndDate('');
      setSuspensionType('after_cutoff');
      setCutoffTime('14:50');
      setPeriodEndTime('17:00');
      setDescription('');
      setAffectedSection('');
      setAffectedBatch('');
      setAffectedGroup('');
      setPublished(true);
    }
    setErrors({});
  }, [initialData, defaultDate, isOpen]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = 'Suspension title/reason is required.';
    }

    if (!startDate) {
      errs.startDate = 'Start date is required.';
    }

    if (endDate && endDate < startDate) {
      errs.endDate = 'End date cannot be earlier than start date.';
    }

    if (suspensionType === 'after_cutoff') {
      if (!cutoffTime) {
        errs.cutoffTime = 'Cutoff time is required for cutoff suspension.';
      }
    }

    if (suspensionType === 'period') {
      if (!cutoffTime) {
        errs.cutoffTime = 'Start cutoff time is required.';
      }
      if (!periodEndTime) {
        errs.periodEndTime = 'Period end time is required.';
      }
      if (cutoffTime && periodEndTime) {
        if (timeToMinutes(periodEndTime) <= timeToMinutes(cutoffTime)) {
          errs.periodEndTime = 'Period end time must be after cutoff start time.';
        }
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
        startDate,
        endDate: endDate ? endDate : null,
        suspensionType,
        cutoffTime: suspensionType === 'full_day' ? null : cutoffTime,
        periodEndTime: suspensionType === 'period' ? periodEndTime : null,
        description: description.trim() ? description.trim() : null,
        affectedSection: affectedSection ? affectedSection : null,
        affectedBatch: affectedBatch ? affectedBatch : null,
        affectedGroup: affectedGroup ? affectedGroup : null,
        published,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save suspension.';
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
      aria-labelledby="suspension-modal-title"
    >
      <div className="modal-dialog" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-amber)' }}>
            <AlertTriangleIcon size={20} />
            <h3 id="suspension-modal-title" className="modal-title" style={{ color: 'var(--accent-amber)' }}>
              {isEditing ? 'Edit Class Suspension' : 'Add Class Suspension Notice'}
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

            {/* Title / Reason */}
            <div className="form-group">
              <label htmlFor="suspension-title" className="form-label">
                Suspension Notice Title / Reason *
              </label>
              <input
                id="suspension-title"
                type="text"
                className={`form-input ${errors.title ? 'error' : ''}`}
                placeholder="e.g. Classes Suspended After 2:50 PM, All Classes Cancelled Today"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              {errors.title && <span className="form-error">{errors.title}</span>}
            </div>

            {/* Suspension Type Selector */}
            <div className="form-group">
              <label htmlFor="suspension-type" className="form-label">
                Suspension Type *
              </label>
              <select
                id="suspension-type"
                className="form-select"
                value={suspensionType}
                onChange={(e) => setSuspensionType(e.target.value as SuspensionType)}
              >
                <option value="after_cutoff">Suspension after a cutoff time (e.g. after 2:50 PM)</option>
                <option value="full_day">Full-day suspension (All classes cancelled)</option>
                <option value="period">Suspension during a specific period (start & end time)</option>
              </select>
            </div>

            {/* Date Range: Start Date & End Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="form-group">
                <label htmlFor="suspension-start-date" className="form-label">
                  Date *
                </label>
                <input
                  id="suspension-start-date"
                  type="date"
                  className={`form-input ${errors.startDate ? 'error' : ''}`}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                {errors.startDate && <span className="form-error">{errors.startDate}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="suspension-end-date" className="form-label">
                  End Date <span style={{ opacity: 0.6 }}>(multi-day optional)</span>
                </label>
                <input
                  id="suspension-end-date"
                  type="date"
                  className={`form-input ${errors.endDate ? 'error' : ''}`}
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {errors.endDate && <span className="form-error">{errors.endDate}</span>}
              </div>
            </div>

            {/* Cutoff Time & Period End Controls */}
            {suspensionType === 'after_cutoff' && (
              <div
                style={{
                  background: 'var(--bg-card-subtle)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div className="form-group" style={{ marginBottom: '0.4rem' }}>
                  <label htmlFor="suspension-cutoff" className="form-label">
                    Cutoff Time (24h) *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input
                      id="suspension-cutoff"
                      type="time"
                      className={`form-input ${errors.cutoffTime ? 'error' : ''}`}
                      value={cutoffTime}
                      onChange={(e) => setCutoffTime(e.target.value)}
                      style={{ maxWidth: '160px' }}
                    />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Classes starting at or after this time are cancelled.
                    </span>
                  </div>
                  {errors.cutoffTime && <span className="form-error">{errors.cutoffTime}</span>}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Rule: If cutoff is 14:50 (2:50 PM), a class starting exactly at 14:50 is cancelled. Classes starting at 14:49 or earlier remain unaffected.
                </div>
              </div>
            )}

            {suspensionType === 'period' && (
              <div
                style={{
                  background: 'var(--bg-card-subtle)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="period-start" className="form-label">
                      Period Start *
                    </label>
                    <input
                      id="period-start"
                      type="time"
                      className={`form-input ${errors.cutoffTime ? 'error' : ''}`}
                      value={cutoffTime}
                      onChange={(e) => setCutoffTime(e.target.value)}
                    />
                    {errors.cutoffTime && <span className="form-error">{errors.cutoffTime}</span>}
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="period-end" className="form-label">
                      Period End *
                    </label>
                    <input
                      id="period-end"
                      type="time"
                      className={`form-input ${errors.periodEndTime ? 'error' : ''}`}
                      value={periodEndTime}
                      onChange={(e) => setPeriodEndTime(e.target.value)}
                    />
                    {errors.periodEndTime && <span className="form-error">{errors.periodEndTime}</span>}
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Rule: Regular classes whose time overlaps this period will be cancelled. Earlier and later classes proceed normally.
                </div>
              </div>
            )}

            {suspensionType === 'full_day' && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  border: '1px solid var(--accent-rose-border)',
                }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-rose)' }}>
                  All scheduled classes on this date will be cancelled.
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Underlying timetable records remain safe in the database and will restore automatically if this suspension is removed.
                </div>
              </div>
            )}

            {/* Description */}
            <div className="form-group">
              <label htmlFor="suspension-description" className="form-label">
                Official Notice / Details <span style={{ opacity: 0.6 }}>(optional)</span>
              </label>
              <textarea
                id="suspension-description"
                className="form-input"
                rows={2}
                placeholder="Notice issued by HOD / Academic Coordinator..."
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
                Suspension Scope (Leave empty for All Students)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                <div>
                  <label htmlFor="suspension-section" className="form-label" style={{ fontSize: '0.78rem' }}>
                    Section
                  </label>
                  <select
                    id="suspension-section"
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
                  <label htmlFor="suspension-batch" className="form-label" style={{ fontSize: '0.78rem' }}>
                    DV / Specialization
                  </label>
                  <select
                    id="suspension-batch"
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
                  <label htmlFor="suspension-group" className="form-label" style={{ fontSize: '0.78rem' }}>
                    Lab Group
                  </label>
                  <select
                    id="suspension-group"
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
                id="suspension-published"
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="suspension-published" style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                {published ? 'Published (Effective immediately for students)' : 'Draft (Not yet active)'}
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
              style={{ background: 'var(--accent-amber)', borderColor: 'var(--accent-amber)' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Suspension' : 'Post Suspension Notice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
