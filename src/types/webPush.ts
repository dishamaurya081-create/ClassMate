/**
 * ClassMate Phase 3C — Web Push TypeScript Types
 *
 * These types describe push subscription data exchanged between
 * the browser PushSubscription API and the Supabase push_subscriptions table.
 * No VAPID private key data is ever placed here.
 */

/**
 * Serialisable representation of a browser PushSubscription,
 * safe to store in Supabase and transmit to a trusted push sender.
 */
export interface SerializedPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * A record as stored in the Supabase push_subscriptions table.
 */
export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  subscription_json: SerializedPushSubscription;
  created_at: string;
  updated_at: string;
}

/**
 * Result type for push subscription operations.
 */
export interface PushSubscriptionResult {
  success: boolean;
  message: string;
  subscription?: SerializedPushSubscription | null;
}

/**
 * Possible push subscription states for UI rendering.
 */
export type PushSubscriptionStatus =
  | 'unsupported'      // Browser does not support Web Push
  | 'permission_denied' // Notification permission blocked
  | 'permission_required' // Permission not yet granted
  | 'not_subscribed'   // Permission granted but not yet subscribed
  | 'subscribed'       // Actively subscribed
  | 'error';           // Subscription or registration failed
