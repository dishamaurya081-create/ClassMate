import type {
  PreparedNotification,
  NotificationDeliveryHandler,
  BrowserNotificationPermissionState,
} from '../types/notification';
import { notificationService } from './notificationService';

/**
 * Checks whether the Web Notification API is supported by the current browser/device.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Retrieves the current browser notification permission state.
 * Returns: 'default' | 'granted' | 'denied' | 'unsupported'
 */
export function getNotificationPermission(): BrowserNotificationPermissionState {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests notification permission from the user via the browser dialog.
 */
export async function requestNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Notification permission request exception:', err);
    return getNotificationPermission();
  }
}

/**
 * Safe helper to trigger a browser notification with error boundary handling.
 */
export function sendNotification(title: string, options?: NotificationOptions): boolean {
  if (!isNotificationSupported()) {
    return false;
  }

  if (getNotificationPermission() !== 'granted') {
    return false;
  }

  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch (err) {
    console.warn('Failed to display browser notification:', err);
    return false;
  }
}


/**
 * Browser implementation of NotificationDeliveryHandler.
 * Formats and presents a PreparedNotification using the Web Notification API.
 */
export class BrowserNotificationDeliveryHandler implements NotificationDeliveryHandler {
  async send(notification: PreparedNotification): Promise<boolean> {
    if (!isNotificationSupported()) {
      return false;
    }

    if (getNotificationPermission() !== 'granted') {
      return false;
    }

    try {
      const n = new Notification(notification.title, {
        body: notification.body,
        tag: notification.id,
        icon: '/favicon.ico',
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };

      return true;
    } catch (err) {
      console.warn('BrowserNotificationDeliveryHandler send error:', err);
      return false;
    }
  }
}

export const browserNotificationDelivery = new BrowserNotificationDeliveryHandler();

// Connect the delivery handler directly to notificationService
notificationService.setDeliveryHandler(browserNotificationDelivery);

/**
 * Helper to ensure the browser notification delivery handler is registered.
 */
export function initBrowserNotificationDelivery(): BrowserNotificationDeliveryHandler {
  notificationService.setDeliveryHandler(browserNotificationDelivery);
  return browserNotificationDelivery;
}
