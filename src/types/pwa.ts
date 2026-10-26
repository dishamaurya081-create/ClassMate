/**
 * PWA Installation types and interfaces for ClassMate
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type PWAInstallPlatform = 'ios' | 'android' | 'desktop' | 'other';

export type InstallOutcome = 'accepted' | 'dismissed' | 'guide';

export interface PWAInstallContext {
  isInstalled: boolean;
  canPromptNative: boolean;
  platform: PWAInstallPlatform;
  isIOS: boolean;
  isBannerDismissed: boolean;
  installApp: () => Promise<InstallOutcome>;
  dismissBanner: () => void;
  openInstallGuide: () => void;
  closeInstallGuide: () => void;
  isGuideOpen: boolean;
}
