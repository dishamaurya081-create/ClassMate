import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { UserSettings, SpecializationOption, GroupOption } from '../types/timetable';

export interface ProfileRecord {
  id: string;
  email?: string;
  student_name: string;
  college: string;
  branch: string;
  semester: number;
  section: string;
  specialization_option: string;
  student_group: string;
  onboarding_completed: boolean;
  reminders_enabled: boolean;
  remind_minutes_before: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

export const supabaseProfileService = {
  async getProfile(userId: string): Promise<UserSettings | null> {
    if (!isSupabaseConfigured || !userId) return null;
    if (!isValidUuid(userId)) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching Supabase profile:', error.message);
        return null;
      }

      if (!data) return null;

      const onboardingCompleted = Boolean(data.onboarding_completed);

      return {
        studentName: data.student_name || 'Student',
        college: data.college || 'ABES Engineering College',
        branch: data.branch || 'CSE',
        semester: data.semester ?? 3,
        section: data.section || 'CSE-15',
        specializationOption: (data.specialization_option as SpecializationOption) || 'DV Batch 1',
        groupOption: (data.student_group as GroupOption) || 'Group 1',
        onboardingCompleted,
        remindersEnabled: data.reminders_enabled ?? true,
        remindMinutesBefore: data.remind_minutes_before ?? 10,
      };
    } catch (err) {
      console.warn('Supabase getProfile exception:', err);
      return null;
    }
  },

  async updateProfile(userId: string, settings: UserSettings, email?: string): Promise<boolean> {
    if (!isSupabaseConfigured || !userId) return false;
    if (!isValidUuid(userId)) {
      return true;
    }

    try {
      const payload: Record<string, unknown> = {
        id: userId,
        student_name: settings.studentName,
        college: settings.college,
        branch: settings.branch,
        semester: settings.semester,
        section: settings.section,
        specialization_option: settings.specializationOption,
        student_group: settings.groupOption,
        onboarding_completed: settings.onboardingCompleted,
        reminders_enabled: settings.remindersEnabled,
        remind_minutes_before: settings.remindMinutesBefore,
        updated_at: new Date().toISOString(),
      };

      if (email) {
        payload.email = email;
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Error updating Supabase profile:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.warn('Supabase updateProfile exception:', err);
      return false;
    }
  },
};
