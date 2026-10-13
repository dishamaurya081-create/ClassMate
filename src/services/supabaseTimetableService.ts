import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { ClassItem, DayOfWeek, ClassType } from '../types/timetable';

export interface DatabaseClassRow {
  id: string;
  user_id?: string | null;
  section: string;
  day: string;
  subject: string;
  course_code: string;
  teacher: string;
  room: string;
  start_time: string;
  end_time: string;
  batch?: string | null;
  type: string;
  notes?: string | null;
  is_official?: boolean;
}

export function rowToClassItem(row: DatabaseClassRow): ClassItem {
  return {
    id: row.id,
    section: row.section,
    day: row.day as DayOfWeek,
    subject: row.subject,
    courseCode: row.course_code,
    teacher: row.teacher,
    room: row.room,
    startTime: row.start_time,
    endTime: row.end_time,
    batch: row.batch || undefined,
    type: (row.type as ClassType) || 'lecture',
    notes: row.notes || undefined,
  };
}

export function classItemToRow(item: ClassItem, userId?: string | null, isOfficial = false): DatabaseClassRow {
  return {
    id: item.id,
    user_id: userId || null,
    section: item.section || 'CSE-15',
    day: item.day,
    subject: item.subject,
    course_code: item.courseCode,
    teacher: item.teacher,
    room: item.room,
    start_time: item.startTime,
    end_time: item.endTime,
    batch: item.batch || null,
    type: item.type,
    notes: item.notes || null,
    is_official: isOfficial,
  };
}

export const supabaseTimetableService = {
  /**
   * Fetches official classes + user custom classes from Supabase.
   */
  async getClasses(userId?: string): Promise<ClassItem[] | null> {
    if (!isSupabaseConfigured) return null;

    try {
      let query = supabase.from('classes').select('*');

      if (userId) {
        // Fetch official classes OR classes created by the current user
        query = query.or(`is_official.eq.true,user_id.eq.${userId}`);
      } else {
        // Guest mode: fetch only official classes
        query = query.eq('is_official', true);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Error fetching classes from Supabase:', error.message);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const mapped = (data as DatabaseClassRow[]).map(rowToClassItem);
      return mapped;
    } catch (err) {
      console.warn('Supabase getClasses exception:', err);
      return null;
    }
  },

  /**
   * Inserts or updates a class entry in Supabase for the current user.
   */
  async upsertClass(item: ClassItem, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !userId) return false;

    try {
      const row = classItemToRow(item, userId, false);
      const { error } = await supabase.from('classes').upsert(row);

      if (error) {
        console.warn('Error upserting class to Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Supabase upsertClass exception:', err);
      return false;
    }
  },

  /**
   * Deletes a user class entry from Supabase.
   */
  async deleteClass(id: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !userId) return false;

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.warn('Error deleting class from Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Supabase deleteClass exception:', err);
      return false;
    }
  },
};
