/**
 * ClassMate Phase 3D — Notification Timing Utilities
 *
 * All class times in the timetable are stored as "HH:mm" in IST (Asia/Kolkata, UTC+5:30).
 * The Edge Function runs in UTC. This module converts correctly.
 *
 * TIMEZONE DECISION:
 *   - ClassMate is for ABES Engineering College, Ghaziabad (IST, UTC+5:30).
 *   - Class start times are IST local times (e.g. "08:50" means 8:50 AM IST).
 *   - The server must compare class times against current IST time, NOT UTC.
 *   - Supabase Edge Functions run on Deno in UTC by default.
 *
 * REMINDER DUE WINDOW:
 *   A notification is considered "due" when:
 *     (notifyAtMinutes - JITTER_MINUTES) <= currentISTMinutes < classStartMinutes
 *
 *   JITTER_MINUTES = 2
 *   This tolerates a scheduler that fires slightly early.
 *   A class at 10:40 with a 10-minute reminder fires if the scheduler runs
 *   any time between 10:28 and 10:39 IST.
 *   The notification is NEVER sent after class has already started.
 */

/** IST offset from UTC in milliseconds */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Jitter tolerance in minutes (scheduler may fire slightly before exact notify time) */
const JITTER_MINUTES = 2;

/**
 * Returns the current Date object adjusted to IST.
 * The returned Date's getHours()/getMinutes() correctly reflect IST local time.
 */
export function getNowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/**
 * Returns current IST time as minutes from midnight.
 * E.g. 10:30 IST -> 630
 */
export function getCurrentISTMinutes(): number {
  const ist = getNowIST();
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/**
 * Returns today's day name in IST (e.g. "Monday").
 */
export function getTodayDayNameIST(): string {
  const ist = getNowIST();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return days[ist.getUTCDay()];
}

/**
 * Returns today's date string in YYYY-MM-DD format, in IST.
 */
export function getTodayDateStringIST(): string {
  const ist = getNowIST();
  const yyyy = ist.getUTCFullYear();
  const mm   = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converts a "HH:mm" string to minutes from midnight.
 * E.g. "08:50" -> 530, "13:10" -> 790
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Returns true if a notification for a class is currently due.
 *
 * Due means:
 *   - The current IST time is within the reminder window (leadMinutes before class start)
 *   - The class has not yet started
 *   - Tolerates up to JITTER_MINUTES early scheduler execution
 *
 * @param classStartTime - "HH:mm" in IST
 * @param leadMinutes    - e.g. 5, 10, 15, 30
 * @param currentMinutes - current IST time in minutes from midnight
 */
export function isNotificationDue(
  classStartTime: string,
  leadMinutes: number,
  currentMinutes: number
): boolean {
  const classStartMinutes = timeToMinutes(classStartTime);
  const notifyAtMinutes   = classStartMinutes - leadMinutes;

  // Must not fire after class has started
  if (currentMinutes >= classStartMinutes) return false;

  // Fire within [notifyAt - JITTER, classStart)
  return currentMinutes >= notifyAtMinutes - JITTER_MINUTES;
}

/**
 * Formats minutes-from-midnight as "HH:mm".
 */
export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
