import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  OfficialEvent,
  ClassSuspension,
  EventType,
  SuspensionType,
  AdminUserRecord,
  AdminRole,
} from '../types/calendar';
import { PRIMARY_ADMIN_EMAIL } from '../types/calendar';

interface DbEventRow {
  id: string;
  title: string;
  event_type: EventType;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  cancels_classes: boolean;
  published: boolean;
  affected_section: string | null;
  affected_batch: string | null;
  affected_group: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DbSuspensionRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  suspension_type: SuspensionType;
  cutoff_time: string | null;
  period_end_time: string | null;
  description: string | null;
  affected_section: string | null;
  affected_batch: string | null;
  affected_group: string | null;
  published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function mapDbToOfficialEvent(row: DbEventRow): OfficialEvent {
  return {
    id: row.id,
    title: row.title,
    eventType: row.event_type,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    description: row.description,
    cancelsClasses: row.cancels_classes,
    published: row.published,
    affectedSection: row.affected_section,
    affectedBatch: row.affected_batch,
    affectedGroup: row.affected_group,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbToSuspension(row: DbSuspensionRow): ClassSuspension {
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    suspensionType: row.suspension_type,
    cutoffTime: row.cutoff_time,
    periodEndTime: row.period_end_time,
    description: row.description,
    affectedSection: row.affected_section,
    affectedBatch: row.affected_batch,
    affectedGroup: row.affected_group,
    published: row.published,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const calendarService = {
  /**
   * Securely queries whether the user is Primary Administrator or Additional Administrator.
   * Backed by public.admin_users table and database functions.
   */
  async checkAdminStatus(
    userId: string,
    userEmail?: string | null
  ): Promise<{ isAdmin: boolean; isPrimaryAdmin: boolean; role: AdminRole | null }> {
    if (!isSupabaseConfigured || !userId) {
      return { isAdmin: false, isPrimaryAdmin: false, role: null };
    }

    const normalizedEmail = userEmail ? userEmail.trim().toLowerCase() : '';
    const isHardcodedPrimary = normalizedEmail === PRIMARY_ADMIN_EMAIL.toLowerCase();

    try {
      // 1. Query admin_users table for this user
      const { data: adminRow, error: adminErr } = await supabase
        .from('admin_users')
        .select('id, user_id, email, role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!adminErr && adminRow) {
        const isPrimary = adminRow.role === 'primary_admin' || isHardcodedPrimary;
        return {
          isAdmin: true,
          isPrimaryAdmin: isPrimary,
          role: (adminRow.role as AdminRole) || (isPrimary ? 'primary_admin' : 'admin'),
        };
      }

      // 2. If user is dishamaurya081@gmail.com, grant primary admin
      if (isHardcodedPrimary) {
        return {
          isAdmin: true,
          isPrimaryAdmin: true,
          role: 'primary_admin',
        };
      }

      // 3. Fallback: check profiles.is_creator for backwards compatibility
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('is_creator')
        .eq('id', userId)
        .maybeSingle();

      if (profileRow?.is_creator) {
        return {
          isAdmin: true,
          isPrimaryAdmin: false,
          role: 'admin',
        };
      }

      return { isAdmin: false, isPrimaryAdmin: false, role: null };
    } catch (err) {
      console.warn('Exception checking admin status:', err);
      if (isHardcodedPrimary) {
        return { isAdmin: true, isPrimaryAdmin: true, role: 'primary_admin' };
      }
      return { isAdmin: false, isPrimaryAdmin: false, role: null };
    }
  },

  /**
   * Compatibility alias for checking admin status
   */
  async checkCreatorStatus(userId: string): Promise<boolean> {
    const status = await this.checkAdminStatus(userId);
    return status.isAdmin;
  },

  /**
   * Fetches the list of authorized administrators (Admin Access management).
   */
  async fetchAdminUsers(): Promise<AdminUserRecord[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, user_id, email, role, granted_by, created_at, updated_at')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Error fetching admin users:', error.message);
        return [];
      }

      const list: AdminUserRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        role: row.role as AdminRole,
        grantedBy: row.granted_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      // Ensure primary admin dishamaurya081@gmail.com is listed if not already
      const hasPrimary = list.some((u) => u.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase());
      if (!hasPrimary) {
        list.unshift({
          id: 'primary-admin-root',
          userId: 'primary-root-user',
          email: PRIMARY_ADMIN_EMAIL,
          role: 'primary_admin',
          grantedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return list;
    } catch (err) {
      console.warn('Exception fetching admin users:', err);
      return [];
    }
  },

  /**
   * Grants administrator privileges to a Gmail account with an existing ClassMate account.
   * Calls secure server-side RPC grant_admin_access().
   */
  async grantAdminAccess(targetEmail: string): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    const cleanEmail = targetEmail.trim().toLowerCase();
    try {
      const { data, error } = await supabase.rpc('grant_admin_access', {
        target_email: cleanEmail,
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: data?.message || `Administrator access granted to ${cleanEmail}`,
      };
    } catch (err: any) {
      throw new Error(err.message || 'Failed to grant administrator access.');
    }
  },

  /**
   * Revokes administrator privileges from an additional administrator.
   * Calls secure server-side RPC revoke_admin_access().
   */
  async revokeAdminAccess(targetUserId: string): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    try {
      const { data, error } = await supabase.rpc('revoke_admin_access', {
        target_user_id: targetUserId,
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: data?.message || 'Administrator access revoked successfully.',
      };
    } catch (err: any) {
      throw new Error(err.message || 'Failed to revoke administrator access.');
    }
  },


  /**
   * Fetches official events. Students receive published events only (via RLS).
   * Creator receives all events including drafts.
   */
  async fetchOfficialEvents(startDate?: string, endDate?: string): Promise<OfficialEvent[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase
        .from('official_events')
        .select('*')
        .order('start_date', { ascending: true });

      if (startDate && endDate) {
        // Events that overlap the window [startDate, endDate]:
        // start_date <= endDate AND (end_date >= startDate OR (end_date IS NULL AND start_date >= startDate))
        query = query
          .lte('start_date', endDate)
          .or(`end_date.gte.${startDate},and(end_date.is.null,start_date.gte.${startDate})`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching official events:', error.message);
        return [];
      }
      return (data as DbEventRow[] || []).map(mapDbToOfficialEvent);
    } catch (err) {
      console.warn('Exception fetching official events:', err);
      return [];
    }
  },

  /**
   * Fetches class suspensions.
   */
  async fetchClassSuspensions(startDate?: string, endDate?: string): Promise<ClassSuspension[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase
        .from('class_suspensions')
        .select('*')
        .order('start_date', { ascending: true });

      if (startDate && endDate) {
        query = query
          .lte('start_date', endDate)
          .or(`end_date.gte.${startDate},and(end_date.is.null,start_date.gte.${startDate})`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching class suspensions:', error.message);
        return [];
      }
      return (data as DbSuspensionRow[] || []).map(mapDbToSuspension);
    } catch (err) {
      console.warn('Exception fetching class suspensions:', err);
      return [];
    }
  },

  /**
   * Creates an official event (Creator only).
   */
  async createOfficialEvent(
    event: Omit<OfficialEvent, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<OfficialEvent | null> {
    if (!isSupabaseConfigured || !userId) return null;
    try {
      const payload = {
        title: event.title.trim(),
        event_type: event.eventType,
        start_date: event.startDate,
        end_date: event.endDate || null,
        start_time: event.startTime || null,
        end_time: event.endTime || null,
        location: event.location?.trim() || null,
        description: event.description?.trim() || null,
        cancels_classes: event.cancelsClasses,
        published: event.published,
        affected_section: event.affectedSection || null,
        affected_batch: event.affectedBatch || null,
        affected_group: event.affectedGroup || null,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from('official_events')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Failed to create official event:', error.message);
        throw new Error(error.message);
      }
      return mapDbToOfficialEvent(data as DbEventRow);
    } catch (err) {
      console.error('Exception creating official event:', err);
      throw err;
    }
  },

  /**
   * Updates an official event (Creator only).
   */
  async updateOfficialEvent(id: string, updates: Partial<OfficialEvent>): Promise<boolean> {
    if (!isSupabaseConfigured || !id) return false;
    try {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.eventType !== undefined) payload.event_type = updates.eventType;
      if (updates.startDate !== undefined) payload.start_date = updates.startDate;
      if (updates.endDate !== undefined) payload.end_date = updates.endDate || null;
      if (updates.startTime !== undefined) payload.start_time = updates.startTime || null;
      if (updates.endTime !== undefined) payload.end_time = updates.endTime || null;
      if (updates.location !== undefined) payload.location = updates.location?.trim() || null;
      if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
      if (updates.cancelsClasses !== undefined) payload.cancels_classes = updates.cancelsClasses;
      if (updates.published !== undefined) payload.published = updates.published;
      if (updates.affectedSection !== undefined) payload.affected_section = updates.affectedSection || null;
      if (updates.affectedBatch !== undefined) payload.affected_batch = updates.affectedBatch || null;
      if (updates.affectedGroup !== undefined) payload.affected_group = updates.affectedGroup || null;

      const { error } = await supabase
        .from('official_events')
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('Failed to update official event:', error.message);
        throw new Error(error.message);
      }
      return true;
    } catch (err) {
      console.error('Exception updating official event:', err);
      throw err;
    }
  },

  /**
   * Deletes an official event (Creator only).
   */
  async deleteOfficialEvent(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !id) return false;
    try {
      const { error } = await supabase
        .from('official_events')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete official event:', error.message);
        throw new Error(error.message);
      }
      return true;
    } catch (err) {
      console.error('Exception deleting official event:', err);
      throw err;
    }
  },

  /**
   * Creates a class suspension notice (Creator only).
   */
  async createClassSuspension(
    suspension: Omit<ClassSuspension, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<ClassSuspension | null> {
    if (!isSupabaseConfigured || !userId) return null;
    try {
      const payload = {
        title: suspension.title.trim(),
        start_date: suspension.startDate,
        end_date: suspension.endDate || null,
        suspension_type: suspension.suspensionType,
        cutoff_time: suspension.cutoffTime || null,
        period_end_time: suspension.periodEndTime || null,
        description: suspension.description?.trim() || null,
        affected_section: suspension.affectedSection || null,
        affected_batch: suspension.affectedBatch || null,
        affected_group: suspension.affectedGroup || null,
        published: suspension.published,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from('class_suspensions')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Failed to create suspension:', error.message);
        throw new Error(error.message);
      }
      return mapDbToSuspension(data as DbSuspensionRow);
    } catch (err) {
      console.error('Exception creating suspension:', err);
      throw err;
    }
  },

  /**
   * Updates a class suspension (Creator only).
   */
  async updateClassSuspension(id: string, updates: Partial<ClassSuspension>): Promise<boolean> {
    if (!isSupabaseConfigured || !id) return false;
    try {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.startDate !== undefined) payload.start_date = updates.startDate;
      if (updates.endDate !== undefined) payload.end_date = updates.endDate || null;
      if (updates.suspensionType !== undefined) payload.suspension_type = updates.suspensionType;
      if (updates.cutoffTime !== undefined) payload.cutoff_time = updates.cutoffTime || null;
      if (updates.periodEndTime !== undefined) payload.period_end_time = updates.periodEndTime || null;
      if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
      if (updates.affectedSection !== undefined) payload.affected_section = updates.affectedSection || null;
      if (updates.affectedBatch !== undefined) payload.affected_batch = updates.affectedBatch || null;
      if (updates.affectedGroup !== undefined) payload.affected_group = updates.affectedGroup || null;
      if (updates.published !== undefined) payload.published = updates.published;

      const { error } = await supabase
        .from('class_suspensions')
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('Failed to update suspension:', error.message);
        throw new Error(error.message);
      }
      return true;
    } catch (err) {
      console.error('Exception updating suspension:', err);
      throw err;
    }
  },

  /**
   * Deletes a class suspension (Creator only).
   */
  async deleteClassSuspension(id: string): Promise<boolean> {
    if (!isSupabaseConfigured || !id) return false;
    try {
      const { error } = await supabase
        .from('class_suspensions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete suspension:', error.message);
        throw new Error(error.message);
      }
      return true;
    } catch (err) {
      console.error('Exception deleting suspension:', err);
      throw err;
    }
  },
};
