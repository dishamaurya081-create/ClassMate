/**
 * ClassMate Phase 3D — Background Push Notification Scheduler
 * Supabase Edge Function: send-push-notification
 *
 * ── INVOCATION ──────────────────────────────────────────────────────────────
 *   Called by a trusted scheduler (pg_cron, GitHub Actions, Render cron, etc.)
 *   every 5 minutes during class hours.
 *
 *   Example (production scheduler):
 *     curl -X POST https://<project>.supabase.co/functions/v1/send-push-notification \
 *       -H "X-Scheduler-Token: <SCHEDULER_SECRET>"
 *
 * ── WHAT IT DOES ────────────────────────────────────────────────────────────
 *   1. Authenticates the caller via X-Scheduler-Token header.
 *   2. Reads current IST time and today's day name.
 *   3. Queries all profiles with reminders_enabled = true.
 *   4. Queries today's class schedule from public.classes (official timetable).
 *   5. For each profile:
 *      a. Applies student-specific filtering (section, DV batch, group).
 *      b. Finds the next class whose notification window is currently due.
 *      c. Checks notification_deliveries to skip already-sent notifications.
 *      d. Fetches the student's push subscription from push_subscriptions.
 *      e. Encrypts and sends the Web Push notification (RFC 8291).
 *      f. Logs the delivery to notification_deliveries (idempotent insert).
 *      g. On expired subscription (410/404): deletes the subscription row.
 *   6. Returns a JSON summary of what was processed.
 *
 * ── SECURITY ─────────────────────────────────────────────────────────────────
 *   • SCHEDULER_SECRET — a high-entropy shared secret known only to the
 *     scheduler process and stored as a Supabase Edge Function secret.
 *     ALL requests must present this value in the X-Scheduler-Token header.
 *     Requests without a valid token are rejected with HTTP 401.
 *   • SUPABASE_SERVICE_ROLE_KEY — used only after authentication succeeds.
 *     Never exposed to React, Vite, the browser, or Git.
 *   • VAPID_PRIVATE_KEY — stored as a Supabase secret, never logged.
 *
 * ── REQUIRED SUPABASE SECRETS ────────────────────────────────────────────────
 *   SCHEDULER_SECRET   - Shared secret for scheduler ↔ Edge Function auth
 *   VAPID_PUBLIC_KEY   - VAPID public key (base64url)
 *   VAPID_PRIVATE_KEY  - VAPID private key (base64url) *** KEEP SECRET ***
 *   VAPID_SUBJECT      - mailto:you@example.com or https://your-domain.com
 *
 * ── TIMEZONE ─────────────────────────────────────────────────────────────────
 *   All class times are IST (UTC+5:30). See notificationTiming.ts.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCurrentISTMinutes,
  getTodayDayNameIST,
  getTodayDateStringIST,
  isNotificationDue,
} from "./notificationTiming.ts";
import { filterClassesForUser } from "./timetableFilter.ts";
import { sendWebPush } from "./webPushSender.ts";
import { isClassCancelled } from "./cancellationEvaluator.ts";
import type {
  ProfileRow,
  ClassRow,
  PushSubscriptionRow,
  UserProcessingResult,
  NotificationDeliveryRow,
  OfficialEventRow,
  ClassSuspensionRow,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Deno.serve — Edge Function entry point
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // ── Method guard ────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── CORRECTION 2: Scheduler authentication ──────────────────────────────
  //
  //  The scheduler presents a high-entropy shared secret in the
  //  X-Scheduler-Token header.  This secret is stored ONLY in:
  //    • The Supabase Edge Function secrets vault (SCHEDULER_SECRET)
  //    • The scheduler process environment (never in frontend code or Git)
  //
  //  We use a constant-time comparison to prevent timing attacks.
  //
  const schedulerSecret = Deno.env.get("SCHEDULER_SECRET") ?? "";
  const providedToken   = req.headers.get("x-scheduler-token") ?? "";

  if (!schedulerSecret) {
    // Edge Function is misconfigured — fail closed, never open.
    console.error("[send-push-notification] SCHEDULER_SECRET is not configured.");
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: missing SCHEDULER_SECRET" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Constant-time comparison using crypto.subtle to resist timing attacks
  const encoder = new TextEncoder();
  const secretBytes  = encoder.encode(schedulerSecret);
  const tokenBytes   = encoder.encode(providedToken);

  // HMAC both sides against a fixed key to normalise length before comparing
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const [expectedSig, providedSig] = await Promise.all([
    crypto.subtle.sign("HMAC", hmacKey, secretBytes),
    crypto.subtle.sign("HMAC", hmacKey, tokenBytes),
  ]);

  const expectedArr  = new Uint8Array(expectedSig);
  const providedArr  = new Uint8Array(providedSig);
  let tokenMismatch  = expectedArr.length !== providedArr.length;
  for (let i = 0; i < expectedArr.length; i++) {
    if (expectedArr[i] !== providedArr[i]) tokenMismatch = true;
  }

  if (tokenMismatch) {
    console.warn("[send-push-notification] Rejected — invalid scheduler token.");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Load remaining secrets (only after auth succeeds) ───────────────────
  const supabaseUrl     = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const vapidPublicKey  = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidSubject    = Deno.env.get("VAPID_SUBJECT") ?? "";

  const missingSecrets: string[] = [];
  if (!supabaseUrl)      missingSecrets.push("SUPABASE_URL");
  if (!serviceRoleKey)   missingSecrets.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!vapidPublicKey)   missingSecrets.push("VAPID_PUBLIC_KEY");
  if (!vapidPrivateKey)  missingSecrets.push("VAPID_PRIVATE_KEY");
  if (!vapidSubject)     missingSecrets.push("VAPID_SUBJECT");

  if (missingSecrets.length > 0) {
    console.error("[send-push-notification] Missing secrets:", missingSecrets.join(", "));
    return new Response(
      JSON.stringify({ error: "Missing required environment secrets", missing: missingSecrets }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // ---------------------------------------------------------------------------
  // Supabase admin client (service role — bypasses RLS)
  // ---------------------------------------------------------------------------
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ---------------------------------------------------------------------------
  // Compute current IST context
  // ---------------------------------------------------------------------------
  const todayDay       = getTodayDayNameIST();      // e.g. "Monday"
  const todayDate      = getTodayDateStringIST();   // e.g. "2026-09-23"
  const currentMinutes = getCurrentISTMinutes();    // e.g. 630 (10:30 IST)

  console.log(
    `[send-push-notification] Running at IST ${Math.floor(currentMinutes/60)}:${String(currentMinutes%60).padStart(2,"0")} on ${todayDay} ${todayDate}`
  );

  // ---------------------------------------------------------------------------
  // 1. Fetch all profiles with reminders enabled
  // ---------------------------------------------------------------------------
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, section, specialization_option, student_group, reminders_enabled, remind_minutes_before")
    .eq("reminders_enabled", true);

  if (profilesError) {
    console.error("[send-push-notification] Failed to fetch profiles:", profilesError.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch profiles", detail: profilesError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!profiles || profiles.length === 0) {
    console.log("[send-push-notification] No profiles with reminders enabled.");
    return new Response(
      JSON.stringify({ processed: 0, message: "No profiles with reminders enabled." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Fetch today's official classes (all sections, all batches)
  //    We fetch all classes for today and filter per-student below.
  // ---------------------------------------------------------------------------
  const { data: allClasses, error: classesError } = await supabase
    .from("classes")
    .select("id, section, day, subject, course_code, teacher, room, start_time, end_time, batch, type, is_official")
    .eq("day", todayDay)
    .eq("is_official", true);

  if (classesError) {
    console.error("[send-push-notification] Failed to fetch classes:", classesError.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch classes", detail: classesError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const todayClasses = (allClasses ?? []) as ClassRow[];

  if (todayClasses.length === 0) {
    console.log(`[send-push-notification] No official classes on ${todayDay}.`);
    return new Response(
      JSON.stringify({ processed: 0, message: `No official classes on ${todayDay}.` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---------------------------------------------------------------------------
  // 2b. Fetch today's active published official events & class suspensions
  // ---------------------------------------------------------------------------
  const [eventsResult, suspensionsResult] = await Promise.all([
    supabase
      .from("official_events")
      .select("id, title, event_type, start_date, end_date, start_time, end_time, cancels_classes, published, affected_section, affected_batch, affected_group")
      .eq("published", true)
      .lte("start_date", todayDate)
      .or(`end_date.gte.${todayDate},and(end_date.is.null,start_date.gte.${todayDate})`),
    supabase
      .from("class_suspensions")
      .select("id, title, start_date, end_date, suspension_type, cutoff_time, period_end_time, published, affected_section, affected_batch, affected_group")
      .eq("published", true)
      .lte("start_date", todayDate)
      .or(`end_date.gte.${todayDate},and(end_date.is.null,start_date.gte.${todayDate})`),
  ]);

  const activeEvents = (eventsResult.data ?? []) as OfficialEventRow[];
  const activeSuspensions = (suspensionsResult.data ?? []) as ClassSuspensionRow[];

  // ---------------------------------------------------------------------------
  // 3. Process each student profile
  // ---------------------------------------------------------------------------
  const results: UserProcessingResult[] = [];
  let totalSent = 0;
  let totalSkipped = 0;

  for (const profile of (profiles as ProfileRow[])) {
    const result: UserProcessingResult = {
      userId: profile.id,
      notificationsSent: 0,
      notificationsSkipped: 0,
      errors: [],
    };

    try {
      // a. Filter classes for this student (section + DV batch + group)
      const baseStudentClasses = filterClassesForUser(todayClasses, {
        section: profile.section,
        specialization_option: profile.specialization_option,
        student_group: profile.student_group,
      });

      // Filter out any classes cancelled by an official holiday, cutoff suspension, or event
      const studentClasses = baseStudentClasses.filter((cls) => {
        const cancellation = isClassCancelled(
          cls,
          todayDate,
          profile,
          activeEvents,
          activeSuspensions
        );
        if (cancellation.isCancelled) {
          console.log(
            `[send-push-notification] Suppressed reminder for ${cls.subject} (${cls.start_time}) for user ${profile.id} — Cancelled by ${cancellation.reason}`
          );
          return false;
        }
        return true;
      });

      if (studentClasses.length === 0) {
        result.notificationsSkipped++;
        results.push(result);
        continue;
      }

      // Sort by start time ascending
      studentClasses.sort((a, b) => {
        const aMin = parseInt(a.start_time.replace(":", ""), 10);
        const bMin = parseInt(b.start_time.replace(":", ""), 10);
        return aMin - bMin;
      });

      const leadMinutes = profile.remind_minutes_before || 10;

      // b. Evaluate classes currently due for this student
      let studentProcessed = false;

      for (const dueClass of studentClasses) {
        if (!isNotificationDue(dueClass.start_time, leadMinutes, currentMinutes)) {
          continue;
        }

        studentProcessed = true;
        let activeClaimId: string | null = null;

        try {
          // c. Atomic claim-before-send
          //    Insert a 'pending' delivery record BEFORE dispatching any push.
          //    The unique constraint (user_id, class_id, class_date, lead_minutes)
          //    guarantees that only ONE concurrent invocation acquires the claim.
          const { data: newClaim, error: insertError } = await supabase
            .from("notification_deliveries")
            .insert({
              user_id: profile.id,
              class_id: dueClass.id,
              class_date: todayDate,
              lead_minutes: leadMinutes,
              status: "pending",
              claimed_at: new Date().toISOString(),
            })
            .select("id")
            .maybeSingle();

          if (newClaim) {
            activeClaimId = newClaim.id;
          } else if (insertError) {
            const isConflict = (insertError as { code?: string }).code?.includes("23505");
            if (!isConflict) {
              result.errors.push(`Claim insert failed: ${insertError.message}`);
              continue;
            }

            // A record already exists: inspect its state
            const { data: existingRecord, error: fetchError } = await supabase
              .from("notification_deliveries")
              .select("id, status, claimed_at")
              .eq("user_id", profile.id)
              .eq("class_id", dueClass.id)
              .eq("class_date", todayDate)
              .eq("lead_minutes", leadMinutes)
              .maybeSingle();

            if (fetchError || !existingRecord) {
              result.errors.push(`Failed to read existing delivery: ${fetchError?.message ?? "Not found"}`);
              continue;
            }

            const record = existingRecord as unknown as NotificationDeliveryRow;

            // If already sent, this class is complete — skip it
            if (record.status === "sent") {
              result.notificationsSkipped++;
              continue;
            }

            // Check if existing pending claim is stale (crashed/hung invocation > 2 minutes)
            const STALE_CLAIM_MS = 2 * 60 * 1000;
            const claimedAtMs = new Date(record.claimed_at).getTime();
            const isStale = (Date.now() - claimedAtMs) > STALE_CLAIM_MS;

            if (record.status === "pending" && !isStale) {
              // Another invocation is actively sending this right now
              result.notificationsSkipped++;
              continue;
            }

            // At this point, the row is either a stale pending claim (process died)
            // or a failed attempt from a prior cycle that can now be retried.
            // Atomically take over the claim using optimistic concurrency guard:
            const staleCutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
            let reclaimQuery = supabase
              .from("notification_deliveries")
              .update({
                status: "pending",
                claimed_at: new Date().toISOString(),
                error: null,
              })
              .eq("id", record.id)
              .eq("status", record.status);

            if (record.status === "pending") {
              // For pending claims, ensure claimed_at is still stale (prevents another concurrent worker from overwriting)
              reclaimQuery = reclaimQuery.lte("claimed_at", staleCutoff);
            }

            const { data: reclaimedRecord, error: reclaimError } = await reclaimQuery
              .select("id")
              .maybeSingle();

            if (reclaimError || !reclaimedRecord) {
              // Another concurrent worker reclaimed it or status transitioned
              result.notificationsSkipped++;
              continue;
            }

            activeClaimId = reclaimedRecord.id;
          }

          if (!activeClaimId) {
            result.notificationsSkipped++;
            continue;
          }

          // d. Fetch student's push subscriptions
          const { data: subscriptions, error: subError } = await supabase
            .from("push_subscriptions")
            .select("id, user_id, endpoint, subscription_json")
            .eq("user_id", profile.id);

          if (subError) {
            result.errors.push(`Subscription fetch failed: ${subError.message}`);
            await supabase
              .from("notification_deliveries")
              .update({ status: "failed", error: `Subscription fetch failed: ${subError.message}` })
              .eq("id", activeClaimId);
            continue;
          }

          if (!subscriptions || subscriptions.length === 0) {
            result.notificationsSkipped++;
            await supabase
              .from("notification_deliveries")
              .update({ status: "failed", error: "No active push subscriptions for user" })
              .eq("id", activeClaimId);
            continue;
          }

          // e. Build notification payload
          const subject       = dueClass.subject;
          const teacher       = dueClass.teacher?.trim() ?? "";
          const room          = dueClass.room?.trim() ?? "";
          const roomFormatted = /^(room|lab)\b/i.test(room) ? room : room ? `Room ${room}` : "";
          const detailParts   = [teacher, roomFormatted].filter(Boolean);
          const detailSuffix  = detailParts.length > 0 ? ` ${detailParts.join(" • ")}` : "";

          const payload = {
            title: "ClassMate — Upcoming Class",
            body: `${subject} starts in ${leadMinutes} minutes.${detailSuffix}`,
            url: "/",
          };

          // f. Send to all subscribed devices for this student
          let sentToAnyDevice = false;
          const sendErrors: string[] = [];

          for (const sub of (subscriptions as PushSubscriptionRow[])) {
            if (!sub.subscription_json?.endpoint || !sub.subscription_json?.keys) {
              result.errors.push(`Invalid subscription JSON for sub ${sub.id}`);
              sendErrors.push(`Invalid subscription JSON for sub ${sub.id}`);
              continue;
            }

            const pushResult = await sendWebPush(
              sub.subscription_json,
              payload,
              vapidPublicKey,
              vapidPrivateKey,
              vapidSubject
            );

            if (pushResult.status === "sent") {
              sentToAnyDevice = true;
              console.log(`[send-push-notification] Sent to user ${profile.id.slice(0,8)}... class=${dueClass.id}`);
            } else if (pushResult.status === "expired") {
              // Remove expired subscription
              console.log(`[send-push-notification] Removing expired subscription ${sub.id}`);
              const { error: deleteError } = await supabase
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
              if (deleteError) {
                result.errors.push(`Failed to delete expired sub: ${deleteError.message}`);
              }
            } else {
              result.errors.push(`Push send error: ${pushResult.message}`);
              sendErrors.push(pushResult.message);
            }
          }

          // g. Finalize delivery status based on send results
          if (sentToAnyDevice) {
            const { error: updateError } = await supabase
              .from("notification_deliveries")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                error: null,
              })
              .eq("id", activeClaimId);

            if (updateError) {
              result.errors.push(`Failed to mark delivery as sent: ${updateError.message}`);
            } else {
              result.notificationsSent++;
              totalSent++;
            }
          } else {
            // All devices failed
            const failureReason = sendErrors.join("; ") || "All push deliveries failed";
            await supabase
              .from("notification_deliveries")
              .update({
                status: "failed",
                error: failureReason.slice(0, 500),
              })
              .eq("id", activeClaimId);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Unexpected error: ${msg}`);
          console.error(`[send-push-notification] Error processing user ${profile.id.slice(0,8)}...:`, msg);
          if (activeClaimId) {
            try {
              await supabase
                .from("notification_deliveries")
                .update({ status: "failed", error: `Unexpected error: ${msg}`.slice(0, 500) })
                .eq("id", activeClaimId);
            } catch {
              // Ignore failure to update error state on crashed invocation
            }
          }
        }
      }

      if (!studentProcessed) {
        result.notificationsSkipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Profile processing error: ${msg}`);
      console.error(`[send-push-notification] Error processing user ${profile.id.slice(0,8)}...:`, msg);
    }

    results.push(result);
  }

  totalSkipped = results.reduce((s, r) => s + r.notificationsSkipped, 0);
  const errorCount = results.reduce((s, r) => s + r.errors.length, 0);

  console.log(`[send-push-notification] Done. sent=${totalSent} skipped=${totalSkipped} errors=${errorCount}`);

  return new Response(
    JSON.stringify({
      processed: profiles.length,
      sent: totalSent,
      skipped: totalSkipped,
      errors: errorCount,
      day: todayDay,
      date: todayDate,
      istTime: `${Math.floor(currentMinutes/60)}:${String(currentMinutes%60).padStart(2,"0")}`,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
