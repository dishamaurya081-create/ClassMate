import type { ClassItem } from './timetable';

export type NotificationTriggerReason =
  | 'class_upcoming'
  | 'disabled'
  | 'no_classes_today'
  | 'all_classes_completed'
  | 'class_in_progress_no_upcoming'
  | 'outside_lead_window';

export interface PreparedNotification {
  id: string; // Unique deduplication key (e.g. `notif-${classId}-${dateStr}-${leadMinutes}m`)
  classId: string;
  subject: string;
  teacher: string;
  room: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  notificationTime: Date; // Calculated trigger timestamp
  leadMinutes: number; // 5, 10, 15, or 30
  title: string; // e.g. "ClassMate — Upcoming Class"
  body: string;  // e.g. "OOPS starts in 10 minutes. Mr. Dhaneshwar Kumar • Room 204"
  scheduledForFormatted: string; // e.g. "10:25 AM"
  status: 'pending' | 'sent' | 'suppressed';
}

export interface NotificationEvaluationResult {
  shouldNotify: boolean;
  reason: NotificationTriggerReason;
  notification: PreparedNotification | null;
  message: string;
  currentClass: ClassItem | null;
  nextClass: ClassItem | null;
  evaluatedAt: Date;
}

export interface NotificationDeliveryHandler {
  send(notification: PreparedNotification): Promise<boolean>;
}

export type BrowserNotificationPermissionState = NotificationPermission | 'unsupported';
