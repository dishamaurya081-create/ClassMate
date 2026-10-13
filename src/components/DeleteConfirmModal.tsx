import React from 'react';
import type { ClassItem } from '../types/timetable';

import { TrashIcon, XIcon, AlertCircleIcon } from './Icons';
import { formatTimeRange } from '../utils/timeUtils';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  classItem: ClassItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  classItem,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !classItem) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
      <div className="modal-dialog" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-rose)' }}>
            <AlertCircleIcon size={20} />
            <h3 id="delete-modal-title" className="modal-title" style={{ color: 'var(--accent-rose)' }}>
              Delete Class?
            </h3>
          </div>
          <button type="button" className="btn-icon-action" onClick={onClose} aria-label="Close dialog">
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Are you sure you want to delete this class from your timetable?
          </p>

          <div
            style={{
              background: 'var(--bg-card-subtle)',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {classItem.subject}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {classItem.courseCode} • {classItem.day}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {formatTimeRange(classItem.startTime, classItem.endTime)} • {classItem.room}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            <TrashIcon size={15} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
