import { useState, useEffect, useCallback, useRef } from 'react';
import type { BeforeInstallPromptEvent, PWAInstallPlatform, InstallOutcome } from '../types/pwa';

const BANNER_DISMISSED_KEY = 'classmate_pwa_banner_dismissed';

/**
 * Detect if the app is already running in standalone / installed mode.
 */
function detectIsInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  // Standard: display-mode standalone (works on Android Chrome, desktop Chrome/Edge)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // Safari iOS navigator.standalone
  if ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}

/**
 * Detect iOS (iPhone / iPad / iPod) — Safari may not expose beforeinstallprompt.
 */
function detectIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad on iOS 13+ reports itself as macOS but has touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detect platform for contextual install instructions.
 */
function detectPlatform(): PWAInstallPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows|macintosh|linux/i.test(ua)) return 'desktop';
  return 'other';
}

/**
 * usePWAInstall — manages the full PWA installation lifecycle.
 *
 * Returns:
 *  isInstalled        — app is running in standalone/installed mode
 *  canPromptNative    — beforeinstallprompt is captured and ready
 *  platform           — 'ios' | 'android' | 'desktop' | 'other'
 *  isIOS              — convenience alias for platform === 'ios'
 *  isBannerDismissed  — user already dismissed the install banner this session
 *  isGuideOpen        — install guide modal is open
 *  installApp()       — triggers native prompt or opens iOS guide
 *  dismissBanner()    — hides banner and remembers dismissal per session
 *  openInstallGuide() — opens the manual guide (for "how to install" link)
 *  closeInstallGuide()— closes the guide modal
 */
export function usePWAInstall() {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectIsInstalled());
  const [canPromptNative, setCanPromptNative] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const platform = detectPlatform();
  const isIOS = detectIsIOS();

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the browser's default mini-infobar from appearing
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanPromptNative(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Listen for successful installation via appinstalled event
  useEffect(() => {
    const handler = () => {
      setIsInstalled(true);
      setCanPromptNative(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener('appinstalled', handler);
    return () => {
      window.removeEventListener('appinstalled', handler);
    };
  }, []);

  // Track standalone mode changes (e.g. user installs externally)
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /**
   * Trigger native install prompt (Android/desktop) or open iOS guide.
   */
  const installApp = useCallback(async (): Promise<InstallOutcome> => {
    // Already installed — nothing to do
    if (isInstalled) return 'dismissed';

    // Native prompt available
    if (deferredPromptRef.current) {
      const prompt = deferredPromptRef.current;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      // Clear the deferred event (can only be used once)
      deferredPromptRef.current = null;
      setCanPromptNative(false);
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      return outcome;
    }

    // iOS — open manual guide
    setIsGuideOpen(true);
    return 'guide';
  }, [isInstalled]);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {
      // sessionStorage unavailable — still hide in state
    }
  }, []);

  const openInstallGuide = useCallback(() => setIsGuideOpen(true), []);
  const closeInstallGuide = useCallback(() => setIsGuideOpen(false), []);

  return {
    isInstalled,
    canPromptNative,
    platform,
    isIOS,
    isBannerDismissed,
    isGuideOpen,
    installApp,
    dismissBanner,
    openInstallGuide,
    closeInstallGuide,
  };
}
