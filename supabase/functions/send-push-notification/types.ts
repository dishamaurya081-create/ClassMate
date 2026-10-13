/**
 * ClassMate Phase 3D — Shared types for the send-push-notification Edge Function
 *
 * These mirror the relevant parts of src/types/webPush.ts but are self-contained
 * within the Deno Edge Function — no import from the frontend src/ tree.
 */

/** Serialised push subscription as stored in public.push_subscriptions */
export interface SerializedPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** Row from public.push_subscriptions */
export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  subscription_json: SerializedPushSubscription;
  created_at: string;
  updated_at: string;
}

/** Row from public.profiles (only the fields we need) */
export interface ProfileRow {
  id: string;
  section: string;
  specialization_option: string;
  student_group: string;
  reminders_enabled: boolean;
  remind_minutes_before: number;
}

/** Row from public.classes (only the fields we need) */
export interface ClassRow {
  id: string;
  section: string;
  day: string;
  subject: string;
  course_code: string;
  teacher: string;
  room: string;
  start_time: string;
  end_time: string;
  batch: string | null;
  type: string;
  is_official: boolean;
}

/** Result of processing one user's notifications */
export interface UserProcessingResult {
  userId: string;
  notificationsSent: number;
  notificationsSkipped: number;
  errors: string[];
}

/** Row from public.notification_deliveries */
export interface NotificationDeliveryRow {
  id: string;
  user_id: string;
  class_id: string;
  class_date: string;
  lead_minutes: number;
  status: "pending" | "sent" | "failed";
  claimed_at: string;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

