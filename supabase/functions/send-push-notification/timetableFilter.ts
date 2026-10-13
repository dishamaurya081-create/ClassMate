/**
 * ClassMate Phase 3D — Server-side Timetable Filtering
 *
 * This module reproduces the EXACT same filtering logic as:
 *   src/types/timetable.ts -> isClassForUser()
 *
 * It must remain semantically identical to the frontend version.
 * If the frontend filtering rules change, this file MUST be updated to match.
 *
 * Batch values and their meanings (from the frontend):
 *   undefined/null   -> common class for all students in the section
 *   "G1"             -> Lab Group 1  (student_group = "Group 1")
 *   "G2"             -> Lab Group 2  (student_group = "Group 2")
 *   "Batch-1"        -> DV Batch 1   (specialization_option = "DV Batch 1")
 *   "Batch-2"        -> DV Batch 2   (specialization_option = "DV Batch 2")
 *   "FCC"            -> Cloud        (specialization_option = "Cloud")
 *
 * Profile fields used (from public.profiles):
 *   section                -> matches class.section
 *   specialization_option  -> "DV Batch 1" | "DV Batch 2" | "Cloud"
 *   student_group          -> "Group 1" | "Group 2"
 */

export interface ClassRow {
  id: string;
  section: string;
  day: string;
  subject: string;
  course_code: string;
  teacher: string;
  room: string;
  start_time: string;   // "HH:mm"
  end_time: string;     // "HH:mm"
  batch: string | null; // "G1" | "G2" | "Batch-1" | "Batch-2" | "FCC" | null
  type: string;
}

export interface ProfileFilter {
  section: string;
  specialization_option: string;  // "DV Batch 1" | "DV Batch 2" | "Cloud"
  student_group: string;          // "Group 1" | "Group 2"
}

/**
 * Returns true if a given class row applies to a student with the given profile.
 *
 * Mirrors: isClassForUser() in src/types/timetable.ts
 */
export function isClassForUser(cls: ClassRow, profile: ProfileFilter): boolean {
  // Must belong to the student's section
  if (cls.section !== profile.section) return false;

  // No batch = common class for all students in the section
  if (!cls.batch) return true;

  // Lab Group filtering
  if (cls.batch === "G1") return profile.student_group === "Group 1";
  if (cls.batch === "G2") return profile.student_group === "Group 2";

  // Specialization / Value-Added course filtering
  if (cls.batch === "Batch-1") return profile.specialization_option === "DV Batch 1";
  if (cls.batch === "Batch-2") return profile.specialization_option === "DV Batch 2";
  if (cls.batch === "FCC")     return profile.specialization_option === "Cloud";

  // Unknown batch value — treat as common class (safe default, same as frontend)
  return true;
}

/**
 * Filters an array of class rows to only those applicable to the given student profile.
 */
export function filterClassesForUser(classes: ClassRow[], profile: ProfileFilter): ClassRow[] {
  return classes.filter((cls) => isClassForUser(cls, profile));
}
