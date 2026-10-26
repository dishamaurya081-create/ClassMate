import type {
  ClassRow,
  ProfileRow,
  OfficialEventRow,
  ClassSuspensionRow,
} from "./types.ts";

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

export function isDateInRange(
  dateStr: string,
  startDate: string,
  endDate?: string | null
): boolean {
  if (!dateStr || !startDate) return false;
  const end = endDate && endDate.trim() ? endDate.trim() : startDate;
  return dateStr >= startDate && dateStr <= end;
}

export function doesScopeApply(
  target: {
    affected_section?: string | null;
    affected_batch?: string | null;
    affected_group?: string | null;
  },
  cls: ClassRow,
  profile: ProfileRow
): boolean {
  // 1. Check Section Scope
  if (target.affected_section && target.affected_section.trim()) {
    const sec = target.affected_section.trim();
    if (cls.section !== sec || profile.section !== sec) return false;
  }

  // 2. Check Batch Scope
  if (target.affected_batch && target.affected_batch.trim()) {
    const batch = target.affected_batch.trim();
    if (cls.batch && cls.batch !== batch) {
      const isBatchMatch =
        (batch === "DV Batch 1" && cls.batch === "Batch-1") ||
        (batch === "DV Batch 2" && cls.batch === "Batch-2") ||
        (batch === "Cloud" && cls.batch === "FCC") ||
        (batch === "Group 1" && cls.batch === "G1") ||
        (batch === "Group 2" && cls.batch === "G2") ||
        cls.batch === batch;
      if (!isBatchMatch) return false;
    }
    if (
      profile.specialization_option &&
      profile.specialization_option !== batch &&
      (batch === "DV Batch 1" || batch === "DV Batch 2" || batch === "Cloud")
    ) {
      return false;
    }
  }

  // 3. Check Group Scope
  if (target.affected_group && target.affected_group.trim()) {
    const grp = target.affected_group.trim();
    if (cls.batch === "G1" && grp !== "Group 1") return false;
    if (cls.batch === "G2" && grp !== "Group 2") return false;
    if (profile.student_group && profile.student_group !== grp) return false;
  }

  return true;
}

/**
 * Determines whether a given class on todayDate is cancelled by active published events or suspensions.
 */
export function isClassCancelled(
  cls: ClassRow,
  todayDate: string,
  profile: ProfileRow,
  events: OfficialEventRow[],
  suspensions: ClassSuspensionRow[]
): { isCancelled: boolean; reason?: string } {
  // 1. Check class suspensions
  for (const s of suspensions) {
    if (!s.published) continue;
    if (!isDateInRange(todayDate, s.start_date, s.end_date)) continue;
    if (!doesScopeApply(s, cls, profile)) continue;

    const classStart = timeToMinutes(cls.start_time);
    const classEnd = timeToMinutes(cls.end_time);

    if (s.suspension_type === "full_day") {
      return { isCancelled: true, reason: s.title };
    }

    if (s.suspension_type === "after_cutoff" && s.cutoff_time) {
      const cutoff = timeToMinutes(s.cutoff_time);
      if (classStart >= cutoff) {
        return { isCancelled: true, reason: `${s.title} (Cutoff: ${s.cutoff_time})` };
      }
    }

    if (s.suspension_type === "period" && s.cutoff_time && s.period_end_time) {
      const pStart = timeToMinutes(s.cutoff_time);
      const pEnd = timeToMinutes(s.period_end_time);
      if (classStart < pEnd && classEnd > pStart) {
        return { isCancelled: true, reason: `${s.title} (Period: ${s.cutoff_time}-${s.period_end_time})` };
      }
    }
  }

  // 2. Check official events (holidays, exams, training)
  for (const e of events) {
    if (!e.published || !e.cancels_classes) continue;
    if (!isDateInRange(todayDate, e.start_date, e.end_date)) continue;
    if (!doesScopeApply(e, cls, profile)) continue;

    if (e.start_time && e.end_time) {
      const classStart = timeToMinutes(cls.start_time);
      const classEnd = timeToMinutes(cls.end_time);
      const eventStart = timeToMinutes(e.start_time);
      const eventEnd = timeToMinutes(e.end_time);
      if (classStart < eventEnd && classEnd > eventStart) {
        return { isCancelled: true, reason: e.title };
      }
    } else {
      // Full day event
      return { isCancelled: true, reason: e.title };
    }
  }

  return { isCancelled: false };
}
