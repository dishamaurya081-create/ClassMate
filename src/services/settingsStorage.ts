import type { UserSettings } from '../types/timetable';
import { isProfileComplete } from '../types/timetable';
import { supabaseProfileService } from './supabaseProfileService';

export const LEGACY_SETTINGS_KEY = 'classmate_user_settings_cse15';

export function getUserSettingsKey(userId?: string | null): string {
  if (userId && userId.trim()) {
    return `classmate_user_settings_${userId.trim()}`;
  }
  return LEGACY_SETTINGS_KEY;
}

export const DEFAULT_SETTINGS: UserSettings = {
  studentName: 'Student',
  college: 'ABES Engineering College',
  branch: 'CSE',
  semester: 3,
  section: 'CSE-15',
  specializationOption: 'DV Batch 1',
  groupOption: 'Group 1',
  onboardingCompleted: false,
  remindersEnabled: true,
  remindMinutesBefore: 10,
};

export const settingsStorage = {
  getSettings(userId?: string | null): UserSettings {
    const key = getUserSettingsKey(userId);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }

      // If no user-specific key exists, do not inherit another user's completed onboarding
      if (userId && userId.trim()) {
        return { ...DEFAULT_SETTINGS, onboardingCompleted: false };
      }

      // Fallback for unauthenticated/legacy default
      const legacyStored = localStorage.getItem(LEGACY_SETTINGS_KEY);
      if (legacyStored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(legacyStored) };
      }

      return { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.error('Failed to read settings from localStorage', e);
      return { ...DEFAULT_SETTINGS, onboardingCompleted: false };
    }
  },

  saveSettings(settings: UserSettings, userId?: string | null, email?: string): void {
    const key = getUserSettingsKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }

    if (userId) {
      supabaseProfileService.updateProfile(userId, settings, email).catch((err) => {
        console.warn('Background Supabase profile update failed:', err);
      });
    }
  },

  async saveSettingsAsync(settings: UserSettings, userId?: string | null, email?: string): Promise<boolean> {
    const key = getUserSettingsKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }

    if (!userId) {
      return true;
    }

    return await supabaseProfileService.updateProfile(userId, settings, email);
  },

  async syncFromSupabase(userId: string): Promise<UserSettings> {
    if (!userId) {
      return this.getSettings();
    }

    try {
      const cloudSettings = await supabaseProfileService.getProfile(userId);
      if (cloudSettings) {
        // Enforce that profile is genuinely complete
        const complete = isProfileComplete(cloudSettings);
        const resolvedSettings: UserSettings = {
          ...cloudSettings,
          onboardingCompleted: complete,
        };

        const key = getUserSettingsKey(userId);
        try {
          localStorage.setItem(key, JSON.stringify(resolvedSettings));
        } catch {
          // ignore
        }

        return resolvedSettings;
      }
    } catch (err) {
      console.warn('Supabase syncFromSupabase settings error:', err);
    }

    // If cloud profile not found or could not be loaded, check user-scoped local cache
    const local = this.getSettings(userId);
    return local;
  },
};
