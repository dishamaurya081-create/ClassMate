import type { ClassItem, ClassItemWithStatus, DayOfWeek } from '../types/timetable';


export const DAY_NAMES: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Converts "HH:mm" to minutes from midnight (e.g. "08:50" -> 530)
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Formats "HH:mm" (24h) to 12h format with AM/PM (e.g. "08:50" -> "8:50 AM", "13:10" -> "1:10 PM")
 */
export function formatTime12h(timeStr: string): string {
  const [hoursStr, minsStr] = timeStr.split(':');
  let h = parseInt(hoursStr, 10);
  const m = minsStr.padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Formats time range "08:50" and "09:40" into "8:50 AM – 9:40 AM"
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
}

/**
 * Formats today's full readable date (e.g. "Thursday, September 17, 2026")
 */
export function getFormattedDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Returns dynamic greeting based on hour of the day
 */
export function getGreeting(name: string, date: Date = new Date()): string {
  const hour = date.getHours();
  let timeOfDay = 'morning';
  if (hour >= 12 && hour < 17) {
    timeOfDay = 'afternoon';
  } else if (hour >= 17 || hour < 4) {
    timeOfDay = 'evening';
  }
  return `Good ${timeOfDay}, ${name}`;
}

/**
 * Computes status for a class given the reference time (in minutes from midnight)
 */
export function getClassStatus(
  item: ClassItem,
  currentMinutes: number
): { status: 'completed' | 'current' | 'upcoming'; statusLabel: string; timeRemaining: string; isCurrent: boolean } {
  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);

  if (currentMinutes >= end) {
    return {
      status: 'completed',
      statusLabel: '✓ Completed',
      timeRemaining: 'Finished',
      isCurrent: false,
    };
  }

  if (currentMinutes >= start && currentMinutes < end) {
    const minsLeft = end - currentMinutes;
    return {
      status: 'current',
      statusLabel: '● Current Class',
      timeRemaining: minsLeft === 1 ? 'Ends in 1 min' : `In progress (${minsLeft} min left)`,
      isCurrent: true,
    };
  }

  // Upcoming
  const minsUntil = start - currentMinutes;
  let timeRemaining = `Starts in ${minsUntil} min`;
  if (minsUntil <= 1) {
    timeRemaining = 'Starting now';
  } else if (minsUntil >= 60) {
    const hrs = Math.floor(minsUntil / 60);
    const remMins = minsUntil % 60;
    timeRemaining = remMins > 0 ? `Starts in ${hrs}h ${remMins}m` : `Starts in ${hrs}h`;
  }

  return {
    status: 'upcoming',
    statusLabel: '→ Upcoming',
    timeRemaining,
    isCurrent: false,
  };
}

/**
 * Given classes for a day, calculates the current class and next upcoming class.
 */
export function analyzeDaySchedule(classes: ClassItem[], referenceDate: Date = new Date()) {
  const dayName = DAY_NAMES[referenceDate.getDay()];
  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  // Filter classes for the day and sort by start time
  const dayClasses = classes
    .filter((c) => c.day === dayName)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const enrichedClasses: ClassItemWithStatus[] = dayClasses.map((item) => {
    const statusData = getClassStatus(item, currentMinutes);
    return {
      ...item,
      ...statusData,
    };
  });

  // Find currently active class (if any)
  const currentClass = enrichedClasses.find((c) => c.isCurrent) || null;

  // Find next upcoming class (start time > currentMinutes)
  const nextClass = enrichedClasses.find((c) => c.status === 'upcoming') || null;

  // Check if all classes for today are completed
  const hasClassesToday = enrichedClasses.length > 0;
  const allCompleted = hasClassesToday && enrichedClasses.every((c) => c.status === 'completed');

  return {
    dayName,
    currentMinutes,
    dayClasses: enrichedClasses,
    currentClass,
    nextClass,
    hasClassesToday,
    allCompleted,
  };
}
