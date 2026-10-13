import type { ClassItem } from '../types/timetable';
import { OFFICIAL_TIMETABLE_DATA } from '../data/timetable';
import { supabaseTimetableService } from './supabaseTimetableService';

const STORAGE_KEY = 'classmate_timetable_all_sections';
const LEGACY_STORAGE_KEY = 'classmate_timetable_cse15';

/**
 * Enhanced Timetable Storage Service for ClassMate Phase 2.
 * Integrates Supabase cloud synchronization while maintaining offline resilience
 * and synchronous localStorage caching across all supported college sections.
 */
export const timetableStorage = {
  /**
   * Synchronously retrieves current classes from localStorage, falling back
   * to the official multi-section schedule.
   */
  getClasses(): ClassItem[] {
    try {
      let stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Check for legacy storage and migrate if present
        const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyStored) {
          try {
            const legacyClasses = JSON.parse(legacyStored) as ClassItem[];
            const legacySections = new Set(legacyClasses.map((c) => c.section).filter(Boolean));
            // Keep any customized classes from legacy storage, plus official classes for missing sections
            const missingFromLegacy = OFFICIAL_TIMETABLE_DATA.filter((c) => !legacySections.has(c.section));
            const merged = [...legacyClasses, ...missingFromLegacy];
            this.saveClasses(merged);
            return merged;
          } catch {
            // fall through to default
          }
        }
        this.saveClasses(OFFICIAL_TIMETABLE_DATA);
        return [...OFFICIAL_TIMETABLE_DATA];
      }

      const parsed = JSON.parse(stored) as ClassItem[];
      // If official data contains sections not yet present in cached storage, merge them in
      const cachedSections = new Set(parsed.map((c) => c.section).filter(Boolean));
      const officialSections = new Set(OFFICIAL_TIMETABLE_DATA.map((c) => c.section).filter(Boolean));
      const missingSections = [...officialSections].filter((sec) => !cachedSections.has(sec));
      if (missingSections.length > 0) {
        const missingClasses = OFFICIAL_TIMETABLE_DATA.filter((c) => missingSections.includes(c.section));
        const updated = [...parsed, ...missingClasses];
        this.saveClasses(updated);
        return updated;
      }

      return parsed;
    } catch (e) {
      console.error('Failed to read timetable from localStorage', e);
      return [...OFFICIAL_TIMETABLE_DATA];
    }
  },

  /**
   * Saves classes to local storage cache.
   */
  saveClasses(classes: ClassItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
    } catch (e) {
      console.error('Failed to save timetable to localStorage', e);
    }
  },

  /**
   * Adds a class locally and pushes to Supabase if authenticated.
   */
  addClass(newClass: Omit<ClassItem, 'id'>, userId?: string | null): ClassItem {
    const classes = this.getClasses();
    const id = 'class_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const item: ClassItem = {
      ...newClass,
      id,
    };
    classes.push(item);
    this.saveClasses(classes);

    if (userId) {
      supabaseTimetableService.upsertClass(item, userId).catch((err) => {
        console.warn('Background Supabase addClass sync failed:', err);
      });
    }

    return item;
  },

  /**
   * Updates an existing class locally and pushes to Supabase if authenticated.
   */
  updateClass(updatedClass: ClassItem, userId?: string | null): void {
    const classes = this.getClasses();
    const index = classes.findIndex((c) => c.id === updatedClass.id);
    if (index !== -1) {
      classes[index] = { ...updatedClass };
      this.saveClasses(classes);

      if (userId) {
        supabaseTimetableService.upsertClass(updatedClass, userId).catch((err) => {
          console.warn('Background Supabase updateClass sync failed:', err);
        });
      }
    }
  },

  /**
   * Deletes a class locally and removes from Supabase if authenticated.
   */
  deleteClass(id: string, userId?: string | null): void {
    const classes = this.getClasses();
    const filtered = classes.filter((c) => c.id !== id);
    this.saveClasses(filtered);

    if (userId) {
      supabaseTimetableService.deleteClass(id, userId).catch((err) => {
        console.warn('Background Supabase deleteClass sync failed:', err);
      });
    }
  },

  /**
   * Resets local storage to the official multi-section timetable.
   */
  resetToOfficial(): ClassItem[] {
    this.saveClasses(OFFICIAL_TIMETABLE_DATA);
    return [...OFFICIAL_TIMETABLE_DATA];
  },

  /**
   * Asynchronously fetches classes from Supabase and updates local storage.
   * If Supabase is unreachable or empty, retains local cache seamlessly.
   */
  async syncFromSupabase(userId?: string | null): Promise<ClassItem[]> {
    try {
      const cloudClasses = await supabaseTimetableService.getClasses(userId || undefined);
      if (cloudClasses && cloudClasses.length > 0) {
        this.saveClasses(cloudClasses);
        return cloudClasses;
      }
    } catch (err) {
      console.warn('Supabase syncFromSupabase error, using cached timetable:', err);
    }
    return this.getClasses();
  },
};
