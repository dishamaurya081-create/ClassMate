import React from 'react';
import { XIcon } from './Icons';

interface InstallBannerProps {
  isIOS: boolean;
  canPromptNative: boolean;
  isInstalling?: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

/**
 * InstallBanner — compact strip on the Home dashboard.
 * Shown only when:
 *  • App is NOT already installed
 *  • Banner has NOT been dismissed this session
 *  • Either native prompt is ready OR platform is iOS
 */
export const InstallBanner: React.FC<InstallBannerProps> = ({
  isIOS,
  canPromptNative,
  isInstalling = false,
  onInstall,
  onDismiss,
}) => {
  const cta = isIOS
    ? 'View guide'
    : canPromptNative
    ? 'Install'
    : 'How to install';

  return (
    <div className="install-banner" role="region" aria-label="Install ClassMate">
      <div className="install-banner-icon" aria-hidden="true">
        {/* App / download icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>

      <div className="install-banner-text">
        <span className="install-banner-title">Install ClassMate</span>
        <span className="install-banner-sub">Add to your home screen for quicker access</span>
      </div>

      <button
        id="btn-install-banner-action"
        type="button"
        className="install-banner-btn"
        onClick={onInstall}
        disabled={isInstalling}
        aria-label={isInstalling ? 'Installing…' : cta}
      >
        {isInstalling ? 'Opening…' : cta}
      </button>

      <button
        id="btn-install-banner-dismiss"
        type="button"
        className="install-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss install prompt"
      >
        <XIcon size={15} />
      </button>
    </div>
  );
};
