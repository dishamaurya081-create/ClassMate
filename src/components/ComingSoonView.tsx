import React from 'react';
import { ClockIcon, CalendarIcon, RotateCcwIcon } from './Icons';
import { getAvailableSectionsFromData } from '../data/timetable';

interface ComingSoonViewProps {
  section: string;
  onSwitchToAvailableSection?: () => void;
}

export const ComingSoonView: React.FC<ComingSoonViewProps> = ({
  section,
  onSwitchToAvailableSection,
}) => {
  return (
    <div className="coming-soon-container">
      <div className="coming-soon-card">
        <div className="coming-soon-icon-badge">
          <ClockIcon size={36} />
        </div>

        <h2 className="coming-soon-title">
          Section {section} Schedule Coming Soon
        </h2>

        <p className="coming-soon-desc">
          The verified academic schedule for <strong>{section}</strong> is currently being prepared and verified. To ensure strict academic accuracy, ClassMate does not generate mock or placeholder classes.
        </p>

        <div className="coming-soon-info-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            <CalendarIcon size={16} />
            <span>Available Right Now:</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {(() => {
              const available = getAvailableSectionsFromData();
              if (available.length === 0) return 'No sections are available yet. Check back soon.';
              return (
                <>
                  <strong>{available.join(', ')}</strong> {available.length === 1 ? 'has' : 'have'} complete, live schedules with all lectures, labs &amp; workshops.
                </>
              );
            })()}
          </p>
        </div>

        {onSwitchToAvailableSection && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSwitchToAvailableSection}
            style={{ marginTop: '1.25rem' }}
          >
            <RotateCcwIcon size={16} />
            <span>Switch to Available Section</span>
          </button>
        )}
      </div>
    </div>
  );
};
