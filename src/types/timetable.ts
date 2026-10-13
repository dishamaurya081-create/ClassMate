export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type ClassType = 'lecture' | 'lab' | 'workshop' | 'skill' | 'other';

export interface ClassItem {
  id: string;
  section: string;
  day: DayOfWeek;
  subject: string;
  courseCode: string;
  teacher: string;
  room: string;
  startTime: string; // "HH:mm" (24h format, e.g. "08:50", "13:10")
  endTime: string;   // "HH:mm" (24h format, e.g. "09:40", "14:50")
  batch?: string;    // e.g. "G1", "G2", "Batch-1", "Batch-2", "FCC" or undefined for whole class
  type: ClassType;
  notes?: string;
}

export type ClassStatus = 'completed' | 'current' | 'upcoming';

export interface ClassItemWithStatus extends ClassItem {
  status: ClassStatus;
  statusLabel: string;
  timeRemaining?: string; // e.g. "Starts in 25 min", "Ends in 40 min"
  isCurrent: boolean;
}

export type SpecializationOption = 'DV Batch 1' | 'DV Batch 2' | 'Cloud';
export type GroupOption = 'Group 1' | 'Group 2';

export const ALL_SECTIONS = [
  'CSE-11',
  'CSE-12',
  'CSE-13',
  'CSE-14',
  'CSE-15',
  'CSE-16',
  'CSE-17',
  'CSE-18',
  'CSE-19',
  'CSE-20',
] as const;

export type SectionType = typeof ALL_SECTIONS[number];

/**
 * @deprecated Use `isSectionAvailable(section, classes)` instead.
 * Kept temporarily for backward compatibility.
 */
export const ACTIVE_SECTION = 'CSE-15';

/**
 * Returns all sections that have at least one class entry in the provided data.
 * This replaces the hardcoded ACTIVE_SECTION pattern.
 */
export function getAvailableSections(classes: ClassItem[]): string[] {
  const found = new Set<string>();
  for (const c of classes) {
    if (c.section) found.add(c.section);
  }
  // Return sorted to maintain consistent ordering
  return [...found].sort();
}

/**
 * Checks whether a given section has data available in the timetable.
 */
export function isSectionAvailable(section: string, classes: ClassItem[]): boolean {
  return classes.some((c) => c.section === section);
}

export interface UserSettings {
  studentName: string;
  college: string;
  branch: string;
  semester: number;
  section: string;
  specializationOption: SpecializationOption;
  groupOption: GroupOption;
  onboardingCompleted: boolean;
  remindersEnabled: boolean;
  remindMinutesBefore: number;
}

/**
 * Determines whether a given timetable entry applies to the user based on
 * section, lab group (G1 / G2), and specialization (DV Batch 1 / DV Batch 2 / Cloud).
 */
export function isClassForUser(
  item: ClassItem,
  settings: {
    section: string;
    specializationOption?: SpecializationOption;
    groupOption?: GroupOption;
  }
): boolean {
  // Must match the section
  if (item.section !== settings.section) {
    return false;
  }

  // If no batch is set, it's a common class for all students in the section
  if (!item.batch) {
    return true;
  }

  // Lab Groups: G1 = Group 1, G2 = Group 2
  if (item.batch === 'G1') {
    return settings.groupOption === 'Group 1';
  }
  if (item.batch === 'G2') {
    return settings.groupOption === 'Group 2';
  }

  // Value Added / Specialization:
  // Batch-1 = DV Batch 1, Batch-2 = DV Batch 2, FCC = Cloud
  if (item.batch === 'Batch-1') {
    return settings.specializationOption === 'DV Batch 1';
  }
  if (item.batch === 'Batch-2') {
    return settings.specializationOption === 'DV Batch 2';
  }
  if (item.batch === 'FCC') {
    return settings.specializationOption === 'Cloud';
  }

  return true;
}

/**
 * Checks whether the user settings are complete and onboarding was finalized.
 */
export function isProfileComplete(settings: UserSettings | null | undefined): boolean {
  if (!settings) return false;
  if (!settings.onboardingCompleted) return false;
  if (!settings.section || typeof settings.section !== 'string' || settings.section.trim() === '') return false;
  if (!settings.specializationOption) return false;
  if (!settings.groupOption) return false;
  return true;
}
