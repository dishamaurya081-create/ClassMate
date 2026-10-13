/**
 * ClassMate Phase 3C — Push Subscription Service
 *
 * Responsibilities:
 *  - Register/retrieve the service worker
 *  - Check Web Push support
 *  - Subscribe the current browser/device (requires granted Notification permission)
 *  - Serialize the PushSubscription to a safe JSON object
 *  - Save / retrieve / delete the subscription via Supabase (push_subscriptions table)
 *
 * Security rules:
 *  - VAPID private key is NEVER used here (frontend only uses the public key)
 *  - Supabase RLS enforces user-isolation; we do not pass another user ID
 *  - The service role key is never present in this file
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { isValidUuid } from './supabaseProfileService';
import type {
  SerializedPushSubscription,
  PushSubscriptionRecord,
  PushSubscriptionResult,
  PushSubscriptionStatus,
} from '../types/webPush';

// ---------------------------------------------------------------------------
// VAPID public key — safe to expose in frontend code.
// Loaded from VITE_VAPID_PUBLIC_KEY env var.
// The private key is NEVER here; it lives in server-side secrets only.
// ---------------------------------------------------------------------------
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

const SW_PATH = '/sw.js';

// ---------------------------------------------------------------------------
// Support checks
// ---------------------------------------------------------------------------

/**
 * Returns true if the browser supports service workers and Web Push API.
 */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Returns true if a VAPID public key has been configured.
 */
export function isVapidConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Service Worker Registration
// ---------------------------------------------------------------------------

/**
 * Registers the ClassMate service worker at /sw.js.
 * Safe to call multiple times — returns the existing registration if already active.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('ClassMate: Service worker registration failed:', err);
    return null;
  }
}

/**
 * Retrieves the existing service worker registration, if any.
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    return registration ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Subscription serialization
// ---------------------------------------------------------------------------

/**
 * Converts a browser PushSubscription to a plain serialisable object.
 * Returns null if the subscription does not contain the required keys.
 */
export function serializePushSubscription(
  subscription: PushSubscription
): SerializedPushSubscription | null {
  try {
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys || !json.keys['p256dh'] || !json.keys['auth']) {
      return null;
    }
    return {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys['p256dh'],
        auth: json.keys['auth'],
      },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Subscribe / Unsubscribe (browser-side)
// ---------------------------------------------------------------------------

/**
 * Subscribes the current browser to Web Push using the configured VAPID public key.
 * Requires:
 *  - Notification permission = 'granted'
 *  - A registered service worker
 *  - VAPID_PUBLIC_KEY configured
 *
 * Does NOT automatically request Notification permission.
 */
export async function subscribeToWebPush(): Promise<PushSubscriptionResult> {
  if (!isWebPushSupported()) {
    return { success: false, message: 'Web Push is not supported on this browser.', subscription: null };
  }

  if (Notification.permission !== 'granted') {
    return {
      success: false,
      message: 'Browser notification permission is required before subscribing to push notifications.',
      subscription: null,
    };
  }

  if (!isVapidConfigured()) {
    return {
      success: false,
      message: 'Push notifications are not yet configured (VAPID key missing). Please check back later.',
      subscription: null,
    };
  }

  let registration = await getServiceWorkerRegistration();
  if (!registration) {
    registration = await registerServiceWorker();
  }
  if (!registration) {
    return { success: false, message: 'Service worker could not be registered.', subscription: null };
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Pass the VAPID public key as a string — browsers accept base64url strings directly.
      applicationServerKey: VAPID_PUBLIC_KEY,
    });

    const serialized = serializePushSubscription(subscription);
    if (!serialized) {
      return { success: false, message: 'Failed to read push subscription keys.', subscription: null };
    }

    return { success: true, message: 'Push subscription created successfully.', subscription: serialized };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn('ClassMate: Push subscription failed:', err);
    return { success: false, message: `Subscription failed: ${msg}`, subscription: null };
  }
}

/**
 * Unsubscribes the current browser from Web Push.
 */
export async function unsubscribeFromWebPush(): Promise<{ success: boolean; message: string }> {
  if (!isWebPushSupported()) {
    return { success: false, message: 'Web Push not supported.' };
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { success: true, message: 'No active service worker registration found.' };
  }

  try {
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return { success: true, message: 'No active push subscription found.' };
    }
    await subscription.unsubscribe();
    return { success: true, message: 'Unsubscribed from push notifications.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Unsubscribe failed: ${msg}` };
  }
}

/**
 * Returns the current active PushSubscription (serialized), or null if none.
 */
export async function getCurrentPushSubscription(): Promise<SerializedPushSubscription | null> {
  if (!isWebPushSupported()) return null;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  try {
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return null;
    return serializePushSubscription(sub);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Supabase — Push Subscription CRUD
// ---------------------------------------------------------------------------

/**
 * Saves or updates the user's push subscription in Supabase.
 * Uses upsert on (user_id, endpoint) via the unique constraint.
 * RLS ensures the user can only write their own row.
 */
export async function savePushSubscriptionToSupabase(
  userId: string,
  subscription: SerializedPushSubscription
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, message: 'Supabase is not configured.' };
  }
  if (!userId || !isValidUuid(userId)) {
    return { success: false, message: 'Invalid user ID.' };
  }

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          subscription_json: subscription,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      );

    if (error) {
      console.warn('ClassMate: savePushSubscription error:', error.message);
      return { success: false, message: `Could not save subscription: ${error.message}` };
    }

    return { success: true, message: 'Push subscription saved to Supabase.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Supabase error: ${msg}` };
  }
}

/**
 * Retrieves the most recent push subscription for the authenticated user.
 */
export async function getPushSubscriptionFromSupabase(
  userId: string
): Promise<PushSubscriptionRecord | null> {
  if (!isSupabaseConfigured || !userId || !isValidUuid(userId)) return null;

  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('ClassMate: getPushSubscription error:', error.message);
      return null;
    }

    return data as PushSubscriptionRecord | null;
  } catch {
    return null;
  }
}

/**
 * Deletes all push subscriptions for the user from Supabase.
 * Called when the user explicitly disables push notifications.
 */
export async function deletePushSubscriptionFromSupabase(
  userId: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, message: 'Supabase is not configured.' };
  }
  if (!userId || !isValidUuid(userId)) {
    return { success: false, message: 'Invalid user ID.' };
  }

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.warn('ClassMate: deletePushSubscription error:', error.message);
      return { success: false, message: `Could not delete subscription: ${error.message}` };
    }

    return { success: true, message: 'Push subscription removed from Supabase.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Supabase error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Status helper
// ---------------------------------------------------------------------------

/**
 * Determines the current push subscription status for UI rendering.
 * Does NOT make any network calls (reads browser state only).
 */
export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  if (!isWebPushSupported()) return 'unsupported';

  const permission = Notification.permission;
  if (permission === 'denied') return 'permission_denied';
  if (permission === 'default') return 'permission_required';

  const sub = await getCurrentPushSubscription();
  return sub ? 'subscribed' : 'not_subscribed';
}

