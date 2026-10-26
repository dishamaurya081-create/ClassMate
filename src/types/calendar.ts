import type { ClassItem } from './timetable';
import { timeToMinutes } from '../utils/timeUtils';

export type EventType =
  | 'holiday'
  | 'training'
  | 'college_event'
  | 'exam'
  | 'workshop'
  | 'announcement'
  | 'other';

export type SuspensionType = 'full_day' | 'after_cutoff' | 'period';

export interface OfficialEvent {
  id: string;
  title: string;
  eventType: EventType;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  startTime?: string | null; // HH:mm (24h)
  endTime?: string | null; // HH:mm (24h)
  location?: string | null;
  description?: string | null;
  cancelsClasses: boolean;
  published: boolean;
  affectedSection?: string | null; // null = all sections
  affectedBatch?: string | null; // null = all batches (e.g. DV Batch 1, Cloud, G1, G2)
  affectedGroup?: string | null; // null = all groups (e.g. Group 1, Group 2)
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassSuspension {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  suspensionType: SuspensionType;
  cutoffTime?: string | null; // HH:mm (24h)
  periodEndTime?: string | null; // HH:mm (24h)
  description?: string | null;
  published: boolean;
  affectedSection?: string | null;
  affectedBatch?: string | null;
  affectedGroup?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScopeOptions {
  section?: string | null;
  specializationOption?: string | null;
  groupOption?: string | null;
}

export interface CancellationResult {
  isCancelled: boolean;
  reason?: string;
  sourceType?: 'holiday' | 'suspension' | 'event';
  sourceTitle?: string;
  cutoffTime?: string | null;
}

/**
 * Returns YYYY-MM-DD in IST (Asia/Kolkata timezone).
 * This prevents any off-by-one errors when formatting dates in UTC vs local Indian Standard Time.
 */
export function getDateStringIST(d: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Checks whether a given YYYY-MM-DD string falls inside a [startDate, endDate] range.
 * Lexicographical string comparison on ISO-8601 YYYY-MM-DD is exact and timezone-free.
 */
export function isDateInRange(
  dateStr: string,
  startDate: string,
  endDate?: string | null
): boolean {
  if (!dateStr || !startDate) return false;
  const end = endDate && endDate.trim() ? endDate.trim() : startDate;
  return dateStr >= startDate && dateStr <= end;
}

/**
 * Checks if an event or suspension scope applies to a particular class and user setting.
 */
export function doesScopeApply(
  target: {
    affectedSection?: string | null;
    affectedBatch?: string | null;
    affectedGroup?: string | null;
  },
  classItem: ClassItem,
  userScope?: ScopeOptions
): boolean {
  // 1. Check Section Scope
  if (target.affectedSection && target.affectedSection.trim()) {
    const sec = target.affectedSection.trim();
    if (classItem.section !== sec) return false;
    if (userScope?.section && userScope.section !== sec) return false;
  }

  // 2. Check Batch Scope (DV Batch 1, DV Batch 2, Cloud, G1, G2, etc.)
  if (target.affectedBatch && target.affectedBatch.trim()) {
    const batch = target.affectedBatch.trim();
    // If class has a batch, it must match or user settings must match
    if (classItem.batch && classItem.batch !== batch) {
      // Map batch options
      const isBatchMatch =
        (batch === 'DV Batch 1' && classItem.batch === 'Batch-1') ||
        (batch === 'DV Batch 2' && classItem.batch === 'Batch-2') ||
        (batch === 'Cloud' && classItem.batch === 'FCC') ||
        (batch === 'Group 1' && classItem.batch === 'G1') ||
        (batch === 'Group 2' && classItem.batch === 'G2') ||
        classItem.batch === batch;
      if (!isBatchMatch) return false;
    }
    if (userScope?.specializationOption && userScope.specializationOption !== batch) {
      if (batch === 'DV Batch 1' || batch === 'DV Batch 2' || batch === 'Cloud') {
        return false;
      }
    }
  }

  // 3. Check Group Scope (Group 1, Group 2)
  if (target.affectedGroup && target.affectedGroup.trim()) {
    const grp = target.affectedGroup.trim();
    if (classItem.batch === 'G1' && grp !== 'Group 1') return false;
    if (classItem.batch === 'G2' && grp !== 'Group 2') return false;
    if (userScope?.groupOption && userScope.groupOption !== grp) return false;
  }

  return true;
}

/**
 * Determines whether a class on a specific date is cancelled by an official event.
 */
export function isClassCancelledByEvent(
  classItem: ClassItem,
  dateStr: string,
  event: OfficialEvent,
  userScope?: ScopeOptions
): boolean {
  if (!event.published || !event.cancelsClasses) return false;
  if (!isDateInRange(dateStr, event.startDate, event.endDate)) return false;
  if (!doesScopeApply(event, classItem, userScope)) return false;

  // If time range is specified for the event, check overlap
  if (event.startTime && event.endTime) {
    const classStart = timeToMinutes(classItem.startTime);
    const classEnd = timeToMinutes(classItem.endTime);
    const eventStart = timeToMinutes(event.startTime);
    const eventEnd = timeToMinutes(event.endTime);
    // Overlap: class starts before event ends, and class ends after event starts
    return classStart < eventEnd && classEnd > eventStart;
  }

  // Full day event with cancelsClasses = true (e.g. Holiday)
  return true;
}

/**
 * Determines whether a class on a specific date is cancelled by a suspension.
 */
export function isClassCancelledBySuspension(
  classItem: ClassItem,
  dateStr: string,
  suspension: ClassSuspension,
  userScope?: ScopeOptions
): boolean {
  if (!suspension.published) return false;
  if (!isDateInRange(dateStr, suspension.startDate, suspension.endDate)) return false;
  if (!doesScopeApply(suspension, classItem, userScope)) return false;

  const classStart = timeToMinutes(classItem.startTime);
  const classEnd = timeToMinutes(classItem.endTime);

  // Type A: Full day suspension
  if (suspension.suspensionType === 'full_day') {
    return true;
  }

  // Type B: Suspension after a specific cutoff time
  // Cutoff rule: classes whose scheduled start time is at or after cutoff are cancelled.
  // Example: 2:50 PM cutoff (14:50). A class starting at 14:50 is cancelled. 14:49 is not.
  if (suspension.suspensionType === 'after_cutoff') {
    if (!suspension.cutoffTime) return false;
    const cutoffMinutes = timeToMinutes(suspension.cutoffTime);
    return classStart >= cutoffMinutes;
  }

  // Type C: Suspension during a specific period [cutoffTime, periodEndTime]
  // Overlap rule: class starts before period ends and ends after period begins
  if (suspension.suspensionType === 'period') {
    if (!suspension.cutoffTime || !suspension.periodEndTime) return false;
    const periodStart = timeToMinutes(suspension.cutoffTime);
    const periodEnd = timeToMinutes(suspension.periodEndTime);
    return classStart < periodEnd && classEnd > periodStart;
  }

  return false;
}

/**
 * Evaluates whether a class is cancelled by any active published official events or suspensions.
 */
export function evaluateClassCancellation(
  classItem: ClassItem,
  dateStr: string,
  events: OfficialEvent[],
  suspensions: ClassSuspension[],
  userScope?: ScopeOptions
): CancellationResult {
  // 1. Check suspensions first (most specific operational override)
  for (const s of suspensions) {
    if (isClassCancelledBySuspension(classItem, dateStr, s, userScope)) {
      let reason = s.title;
      if (s.suspensionType === 'after_cutoff' && s.cutoffTime) {
        reason = `${s.title} (Classes suspended from ${s.cutoffTime})`;
      } else if (s.suspensionType === 'period' && s.cutoffTime && s.periodEndTime) {
        reason = `${s.title} (Suspended ${s.cutoffTime}–${s.periodEndTime})`;
      }
      return {
        isCancelled: true,
        reason,
        sourceType: 'suspension',
        sourceTitle: s.title,
        cutoffTime: s.cutoffTime,
      };
    }
  }

  // 2. Check official events (holidays, exams, training with cancelsClasses=true)
  for (const e of events) {
    if (isClassCancelledByEvent(classItem, dateStr, e, userScope)) {
      const isHoliday = e.eventType === 'holiday';
      return {
        isCancelled: true,
        reason: `${e.title}${isHoliday ? ' (Official Holiday)' : ' (Class Replaced)'}`,
        sourceType: isHoliday ? 'holiday' : 'event',
        sourceTitle: e.title,
      };
    }
  }

  return { isCancelled: false };
}

/**
 * Human-readable label for event types
 */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  holiday: 'Holiday',
  training: 'Training',
  college_event: 'College Event',
  exam: 'Exam',
  workshop: 'Workshop',
  announcement: 'Announcement',
  other: 'Other',
};

export const PRIMARY_ADMIN_EMAIL = 'dishamaurya081@gmail.com';

export type AdminRole = 'primary_admin' | 'admin';

export interface AdminUserRecord {
  id: string;
  userId: string;
  email: string;
  role: AdminRole;
  grantedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

