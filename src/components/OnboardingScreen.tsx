import React, { useState } from 'react';
import type { SpecializationOption, GroupOption, UserSettings } from '../types/timetable';
import { ALL_SECTIONS, isSectionAvailable } from '../types/timetable';
import { OFFICIAL_TIMETABLE_DATA } from '../data/timetable';
import { GraduationCapIcon, CheckCircleIcon, ClockIcon } from './Icons';

interface OnboardingScreenProps {
  initialSettings: UserSettings;
  onSaveAndComplete: (selections: {
    section: string;
    specializationOption: SpecializationOption;
    groupOption: GroupOption;
  }) => Promise<void> | void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  initialSettings,
  onSaveAndComplete,
}) => {
  const [section, setSection] = useState<string>(initialSettings.section || ALL_SECTIONS[4]);
  const [specializationOption, setSpecializationOption] = useState<SpecializationOption>(
    initialSettings.specializationOption || 'DV Batch 1'
  );
  const [groupOption, setGroupOption] = useState<GroupOption>(
    initialSettings.groupOption || 'Group 1'
  );
  const [isSaving, setIsSaving] = useState(false);

  const isCurrentSectionAvailable = isSectionAvailable(section, OFFICIAL_TIMETABLE_DATA);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveAndComplete({
        section,
        specializationOption,
        groupOption,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="onboarding-screen-container">
      <div className="onboarding-card">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-logo-badge">
            <GraduationCapIcon size={28} />
          </div>
          <h1 className="onboarding-title">Welcome to ClassMate 👋</h1>
          <p className="onboarding-subtitle">
            Configure your section and groups to customize your daily schedule
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="onboarding-form">
          {/* Section Selection */}
          <div className="form-group">
            <label className="form-label" htmlFor="sectionSelect">
              Select Your Section
            </label>
            <select
              id="sectionSelect"
              className="form-select"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              required
            >
              {ALL_SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec} {isSectionAvailable(sec, OFFICIAL_TIMETABLE_DATA) ? '(Available Now)' : '(Coming Soon)'}
                </option>
              ))}
            </select>
            <div className={`onboarding-hint ${isCurrentSectionAvailable ? 'available' : 'coming-soon'}`}>
              {isCurrentSectionAvailable ? (
                <>
                  <CheckCircleIcon size={14} />
                  <span>{section} timetable is live with all lectures, labs &amp; workshops.</span>
                </>
              ) : (
                <>
                  <ClockIcon size={14} />
                  <span>Section {section} timetable is Coming Soon. Dashboard will reflect this state without mock data.</span>
                </>
              )}
            </div>
          </div>

          {/* DV / Cloud Selection */}
          <div className="form-group">
            <label className="form-label" htmlFor="specializationSelect">
              DV / Cloud Option
            </label>
            <select
              id="specializationSelect"
              className="form-select"
              value={specializationOption}
              onChange={(e) => setSpecializationOption(e.target.value as SpecializationOption)}
              required
            >
              <option value="DV Batch 1">DV Batch 1 (Data Visualisation Batch 1)</option>
              <option value="DV Batch 2">DV Batch 2 (Data Visualisation Batch 2)</option>
              <option value="Cloud">Cloud (Fundamentals of Cloud Computing - FCC)</option>
            </select>
            <div className="onboarding-field-desc">
              Controls your specialization workshop & lecture periods.
            </div>
          </div>

          {/* Group Selection */}
          <div className="form-group">
            <label className="form-label" htmlFor="groupSelect">
              Select Group
            </label>
            <select
              id="groupSelect"
              className="form-select"
              value={groupOption}
              onChange={(e) => setGroupOption(e.target.value as GroupOption)}
              required
            >
              <option value="Group 1">Group 1 (G1 Labs)</option>
              <option value="Group 2">Group 2 (G2 Labs)</option>
            </select>
            <div className="onboarding-field-desc">
              Determines your specific practical & lab sessions (OS Lab, OOPS Lab, ADS Lab).
            </div>
          </div>

          {/* Submit Action */}
          <div style={{ marginTop: '1.75rem' }}>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ width: '100%', padding: '0.85rem' }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving Preferences...' : 'Save & Enter Dashboard →'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            ℹ️ You can change your Section, DV/Cloud, and Group anytime from <strong>Profile & Settings</strong>.
          </div>
        </form>
      </div>
    </div>
  );
};
