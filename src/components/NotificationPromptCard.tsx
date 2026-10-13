import React, { useState } from "react";
import {
  isNotificationSupported,
  requestNotificationPermission,
} from "../services/browserNotificationDelivery";
import {
  isWebPushSupported,
  subscribeToWebPush,
  savePushSubscriptionToSupabase,
  registerServiceWorker,
} from "../services/pushSubscriptionService";
import { BellIcon } from "./Icons";

interface NotificationPromptCardProps {
  userId: string;
  onDismiss: () => void;
}

/**
 * ClassMate onboarding notification-permission prompt.
 * Shown ONLY once per new user, after profile is successfully saved.
 * Does NOT re-appear on future logins.
 * Reuses existing browserNotificationDelivery + pushSubscriptionService.
 */
export const NotificationPromptCard: React.FC<NotificationPromptCardProps> = ({
  userId,
  onDismiss,
}) => {
  const [isWorking, setIsWorking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAllow = async () => {
    setIsWorking(true);
    setFeedback(null);

    try {
      // CASE 4: Unsupported browser
      if (!isNotificationSupported()) {
        onDismiss();
        return;
      }

      // Step A+B: Request browser permission (triggered from explicit user click)
      const permission = await requestNotificationPermission();

      if (permission === "granted") {
        // Step C: Register SW (safe to call multiple times)
        if (isWebPushSupported()) {
          await registerServiceWorker();

          // Create Web Push subscription using the existing service
          const result = await subscribeToWebPush();

          if (result.success && result.subscription) {
            // Save subscription to Supabase push_subscriptions table
            const saveResult = await savePushSubscriptionToSupabase(userId, result.subscription);
            if (!saveResult.success) {
              // CASE 5: Save failed -- non-blocking, continue to dashboard
              console.warn("ClassMate: Push subscription save failed (non-blocking):", saveResult.message);
            }
          } else {
            // CASE 5: Push subscribe failed -- non-blocking
            console.warn("ClassMate: Push subscription creation failed (non-blocking):", result.message);
          }
        }

        // Continue to dashboard regardless of push subscription outcome
        onDismiss();
      } else if (permission === "denied") {
        // CASE 2: Denied -- do not repeat, proceed to dashboard
        onDismiss();
      } else {
        // CASE 3: Default -- user dismissed the browser dialog without deciding
        setFeedback("You can enable notifications later from Settings.");
        setIsWorking(false);
      }
    } catch (err) {
      // CASE 5: Any unexpected error -- non-blocking, continue to dashboard
      console.warn("ClassMate: Notification setup error (non-blocking):", err);
      onDismiss();
    }
  };

  const handleMaybeLater = () => {
    // CASE 6: Maybe later -- no permission request, no subscription created
    onDismiss();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-prompt-title"
    >
      <div className="notif-prompt-card">
        <div className="notif-prompt-icon-wrap">
          <div className="notif-prompt-icon-badge">
            <BellIcon size={26} />
          </div>
        </div>

        <div className="notif-prompt-body">
          <h2 id="notif-prompt-title" className="notif-prompt-title">
            Stay updated with your classes
          </h2>
          <p className="notif-prompt-desc">
            Get a reminder before your upcoming classes so you are always on time.
          </p>

          {feedback && (
            <div className="notif-prompt-feedback">
              {feedback}
            </div>
          )}
        </div>

        <div className="notif-prompt-actions">
          <button
            id="btn-onboarding-allow-notifications"
            type="button"
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={handleAllow}
            disabled={isWorking}
          >
            <BellIcon size={15} />
            <span>{isWorking ? "Setting up..." : "Allow Notifications"}</span>
          </button>

          <button
            id="btn-onboarding-maybe-later"
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", marginTop: "0.6rem" }}
            onClick={handleMaybeLater}
            disabled={isWorking}
          >
            Maybe later
          </button>
        </div>

        <p className="notif-prompt-hint">
          You can always enable notifications later from <strong>Settings</strong>.
        </p>
      </div>
    </div>
  );
};