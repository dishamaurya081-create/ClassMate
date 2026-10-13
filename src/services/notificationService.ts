import type { ClassItem, UserSettings } from '../types/timetable';
import { isClassForUser } from '../types/timetable';
import { analyzeDaySchedule, formatTime12h, timeToMinutes } from '../utils/timeUtils';
import type {
  PreparedNotification,
  NotificationEvaluationResult,
  NotificationDeliveryHandler,
} from '../types/notification';

const SENT_NOTIFICATIONS_STORAGE_KEY = 'classmate_sent_notifications';

class NotificationService {
  private sentIds: Set<string> = new Set();
  private deliveryHandler: NotificationDeliveryHandler | null = null;

  constructor() {
    this.loadSentHistory();
  }

  private loadSentHistory(): void {
    try {
      const stored = sessionStorage.getItem(SENT_NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        this.sentIds = new Set(ids);
      }
    } catch {
      // ignore
    }
  }

  private persistSentHistory(): void {
    try {
      sessionStorage.setItem(
        SENT_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(Array.from(this.sentIds))
      );
    } catch {
      // ignore
    }
  }

  /**
   * Sets or clears the delivery handler for future external providers (SMS, WhatsApp, Web Push).
   */
  public setDeliveryHandler(handler: NotificationDeliveryHandler | null): void {
    this.deliveryHandler = handler;
  }

  public getDeliveryHandler(): NotificationDeliveryHandler | null {
    return this.deliveryHandler;
  }

  public hasNotificationBeenSent(notificationId: string): boolean {
    return this.sentIds.has(notificationId);
  }

  public markNotificationSent(notificationId: string): void {
    this.sentIds.add(notificationId);
    this.persistSentHistory();
  }

  public clearSentHistory(): void {
    this.sentIds.clear();
    try {
      sessionStorage.removeItem(SENT_NOTIFICATIONS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  public getSentNotificationIds(): string[] {
    return Array.from(this.sentIds);
  }

  /**
   * Formats room string to avoid redundancy (e.g. "Room 204" or "KC-202").
   */
  public formatRoom(roomStr: string): string {
    if (!roomStr || !roomStr.trim()) return '';
    const trimmed = roomStr.trim();
    if (/^room\b/i.test(trimmed) || /^lab\b/i.test(trimmed)) {
      return trimmed;
    }
    return `Room ${trimmed}`;
  }

  /**
   * Generates the title and body for an upcoming class notification from actual timetable data.
   *
   * Example output:
   * Title: "ClassMate — Upcoming Class"
   * Body: "OOPS starts in 10 minutes. Mr. Dhaneshwar Kumar • Room 204"
   */
  public generateNotificationContent(
    classItem: ClassItem,
    leadMinutes: number
  ): { title: string; body: string } {
    const title = 'ClassMate — Upcoming Class';

    const parts: string[] = [];
    if (classItem.teacher && classItem.teacher.trim()) {
      parts.push(classItem.teacher.trim());
    }
    const formattedRoom = this.formatRoom(classItem.room);
    if (formattedRoom) {
      parts.push(formattedRoom);
    }

    const detailsSuffix = parts.length > 0 ? ` ${parts.join(' • ')}` : '';
    const body = `${classItem.subject} starts in ${leadMinutes} minutes.${detailsSuffix}`;

    return { title, body };
  }

  /**
   * Prepares a structured notification object for a given class.
   */
  public prepareNotification(
    classItem: ClassItem,
    leadMinutes: number,
    referenceDate: Date = new Date()
  ): PreparedNotification {
    const classStartMinutes = timeToMinutes(classItem.startTime);
    const notificationMinutes = Math.max(0, classStartMinutes - leadMinutes);

    const notifHours = Math.floor(notificationMinutes / 60);
    const notifMins = notificationMinutes % 60;

    const notificationTime = new Date(referenceDate);
    notificationTime.setHours(notifHours, notifMins, 0, 0);

    const dateKey = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
    const id = `notif_${classItem.id}_${dateKey}_${leadMinutes}m`;

    const { title, body } = this.generateNotificationContent(classItem, leadMinutes);
    const scheduledForFormatted = formatTime12h(
      `${String(notifHours).padStart(2, '0')}:${String(notifMins).padStart(2, '0')}`
    );

    const isSent = this.hasNotificationBeenSent(id);

    return {
      id,
      classId: classItem.id,
      subject: classItem.subject,
      teacher: classItem.teacher,
      room: classItem.room,
      startTime: classItem.startTime,
      endTime: classItem.endTime,
      notificationTime,
      leadMinutes,
      title,
      body,
      scheduledForFormatted,
      status: isSent ? 'sent' : 'pending',
    };
  }

  /**
   * Evaluates current timetable state against user settings and reference time.
   *
   * Handles:
   * - user has notifications disabled
   * - no classes today
   * - all classes completed today
   * - class currently in progress (with or without a subsequent class)
   * - lunch/break periods
   * - next class upcoming
   * - outside lead window vs within trigger window
   * - deduplication check
   */
  public evaluateNextNotification(
    allClasses: ClassItem[],
    settings: UserSettings,
    referenceDate: Date = new Date()
  ): NotificationEvaluationResult {
    // 1. Check if user has notifications disabled
    if (!settings.remindersEnabled) {
      return {
        shouldNotify: false,
        reason: 'disabled',
        notification: null,
        message: 'Notifications are turned off in Settings.',
        currentClass: null,
        nextClass: null,
        evaluatedAt: referenceDate,
      };
    }

    // 2. Filter classes using user's Section, DV Batch, and Group
    const userFilteredClasses = allClasses.filter((c) => isClassForUser(c, settings));

    // 3. Analyze schedule for today
    const { currentClass, nextClass, hasClassesToday, allCompleted } = analyzeDaySchedule(
      userFilteredClasses,
      referenceDate
    );

    // Case: No classes scheduled today
    if (!hasClassesToday) {
      return {
        shouldNotify: false,
        reason: 'no_classes_today',
        notification: null,
        message: 'No classes scheduled for today.',
        currentClass: null,
        nextClass: null,
        evaluatedAt: referenceDate,
      };
    }

    // Case: All classes for today have concluded
    if (allCompleted) {
      return {
        shouldNotify: false,
        reason: 'all_classes_completed',
        notification: null,
        message: 'All scheduled classes for today have finished.',
        currentClass: null,
        nextClass: null,
        evaluatedAt: referenceDate,
      };
    }

    // Case: Class currently in progress, but no more upcoming classes today
    if (!nextClass) {
      return {
        shouldNotify: false,
        reason: 'class_in_progress_no_upcoming',
        notification: null,
        message: currentClass
          ? `Current class (${currentClass.subject}) is the last class scheduled today.`
          : 'No upcoming classes remain today.',
        currentClass,
        nextClass: null,
        evaluatedAt: referenceDate,
      };
    }

    // Case: Next class exists (could be after current class, or during a break/lunch)
    const leadMinutes = settings.remindMinutesBefore || 10;
    const notification = this.prepareNotification(nextClass, leadMinutes, referenceDate);

    const classStartMinutes = timeToMinutes(nextClass.startTime);
    const notificationMinutes = classStartMinutes - leadMinutes;
    const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

    // Deduplication check
    if (this.hasNotificationBeenSent(notification.id)) {
      notification.status = 'sent';
      return {
        shouldNotify: false,
        reason: 'class_upcoming',
        notification,
        message: `Notification for ${nextClass.subject} was already dispatched.`,
        currentClass,
        nextClass,
        evaluatedAt: referenceDate,
      };
    }

    // Within notification trigger window (between notificationTime and class startTime)
    if (currentMinutes >= notificationMinutes && currentMinutes < classStartMinutes) {
      return {
        shouldNotify: true,
        reason: 'class_upcoming',
        notification,
        message: `Ready to notify: ${nextClass.subject} starts in ${classStartMinutes - currentMinutes} min.`,
        currentClass,
        nextClass,
        evaluatedAt: referenceDate,
      };
    }

    // Earlier than the notification time (outside lead window, e.g. earlier morning or lunch break)
    return {
      shouldNotify: false,
      reason: 'outside_lead_window',
      notification,
      message: `Next reminder scheduled for ${notification.scheduledForFormatted} (${leadMinutes} min before ${nextClass.subject}).`,
      currentClass,
      nextClass,
      evaluatedAt: referenceDate,
    };
  }

  /**
   * Extensible dispatch method that forwards to registered delivery handler when connected in the future.
   */
  public async dispatchIfDue(
    allClasses: ClassItem[],
    settings: UserSettings,
    referenceDate: Date = new Date()
  ): Promise<boolean> {
    const evaluation = this.evaluateNextNotification(allClasses, settings, referenceDate);
    if (!evaluation.shouldNotify || !evaluation.notification) {
      return false;
    }

    if (!this.deliveryHandler) {
      // In Phase 3 foundation: delivery handler is not yet attached
      return false;
    }

    try {
      const delivered = await this.deliveryHandler.send(evaluation.notification);
      if (delivered) {
        this.markNotificationSent(evaluation.notification.id);
      }
      return delivered;
    } catch (err) {
      console.warn('Notification delivery handler failed:', err);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
