import React from 'react';
import type { PWAInstallPlatform } from '../types/pwa';
import { XIcon } from './Icons';

interface InstallGuideModalProps {
  platform: PWAInstallPlatform;
  isIOS: boolean;
  onClose: () => void;
}

/**
 * InstallGuideModal — Shown when native install prompt is unavailable.
 *
 * iOS Safari: step-by-step Share → Add to Home Screen guide.
 * Android (no prompt): explains that Chrome/Edge normally prompt automatically.
 * Desktop/other: generic browser settings guidance.
 */
export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ platform, isIOS, onClose }) => {
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
      onClick={handleOverlayClick}
    >
      <div className="install-guide-modal">
        {/* Header */}
        <div className="install-guide-header">
          <div className="install-guide-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="install-guide-title-block">
            <h2 id="install-guide-title" className="install-guide-title">Install ClassMate</h2>
            <p className="install-guide-subtitle">Add to your home screen for faster access</p>
          </div>
          <button
            id="btn-install-guide-close"
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close installation guide"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* iOS Safari Instructions */}
        {isIOS && (
          <div className="install-guide-body">
            <p className="install-guide-note">
              Safari on iPhone and iPad does not support automatic install prompts. Follow these steps to add ClassMate to your Home Screen:
            </p>
            <ol className="install-guide-steps">
              <li className="install-step">
                <div className="install-step-num">1</div>
                <div className="install-step-content">
                  <strong>Open ClassMate in Safari</strong>
                  <span>Make sure you are using Safari, not another browser app.</span>
                </div>
              </li>
              <li className="install-step">
                <div className="install-step-num">2</div>
                <div className="install-step-content">
                  <strong>Tap the Share button</strong>
                  <span>
                    Tap the{' '}
                    <span className="install-inline-icon" aria-label="Share icon">
                      {/* iOS share icon shape */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </span>{' '}
                    Share button at the bottom of the Safari browser bar.
                  </span>
                </div>
              </li>
              <li className="install-step">
                <div className="install-step-num">3</div>
                <div className="install-step-content">
                  <strong>Select &ldquo;Add to Home Screen&rdquo;</strong>
                  <span>Scroll down in the Share sheet and tap <em>Add to Home Screen</em>.</span>
                </div>
              </li>
              <li className="install-step">
                <div className="install-step-num">4</div>
                <div className="install-step-content">
                  <strong>Tap &ldquo;Add&rdquo; to confirm</strong>
                  <span>ClassMate will appear on your Home Screen and open as a full-screen app.</span>
                </div>
              </li>
            </ol>
            <div className="install-guide-tip">
              💡 Once installed, ClassMate opens without a browser address bar, just like a native app.
            </div>
          </div>
        )}

        {/* Android — prompt normally auto-appears; guidance if it didn't */}
        {platform === 'android' && !isIOS && (
          <div className="install-guide-body">
            <p className="install-guide-note">
              On Android, ClassMate can be installed via Chrome or Edge. If you did not see an install prompt automatically, follow these steps:
            </p>
            <ol className="install-guide-steps">
              <li className="install-step">
                <div className="install-step-num">1</div>
                <div className="install-step-content">
                  <strong>Open ClassMate in Chrome or Edge</strong>
                  <span>The automatic install prompt appears after you use the app for a moment.</span>
                </div>
              </li>
              <li className="install-step">
                <div className="install-step-num">2</div>
                <div className="install-step-content">
                  <strong>Tap the browser menu (⋮)</strong>
                  <span>Tap the three-dot menu in the top-right corner of Chrome or Edge.</span>
                </div>
              </li>
              <li className="install-step">
                <div className="install-step-num">3</div>
                <div className="install-step-content">
                  <strong>Select &ldquo;Add to Home Screen&rdquo; or &ldquo;Install app&rdquo;</strong>
                  <span>Follow the on-screen confirmation to install ClassMate.</span>
                </div>
              </li>
            </ol>
            <div className="install-guide-tip">
              💡 Recommended browsers: Google Chrome or Microsoft Edge for the best install experience on Android.
            </div>
          </div>
        )}

        {/* Desktop */}
        {platform === 'desktop' && !isIOS && (
          <div className="install-guide-body">
            <p className="install-guide-note">
              On desktop, ClassMate can be installed as a progressive web app (PWA) in Chrome, Edge, or Brave:
            </p>
            <ol className="install-guide-steps">
              <li className="install-step">
                <div className="install-step-num">1</div>
                <div className="install-step-content">
                  <strong>Look for the install icon in the address bar</strong>
                  <span>In Chrome or Edge, a small install icon (⊕) appears at the right of the address bar when ClassMate is installable.</span>
                </div>
              </li>
              <li className="install-step">
                <div className="install-step-num">2</div>
                <div className="install-step-content">
                  <strong>Click the icon and confirm</strong>
                  <span>Select <em>&quot;Install&quot;</em> in the prompt that appears.</span>
                </div>
              </li>
              <li className="install-step">
                <div className="install-step-num">3</div>
                <div className="install-step-content">
                  <strong>ClassMate opens as a standalone window</strong>
                  <span>No address bar — it behaves like a native desktop application.</span>
                </div>
              </li>
            </ol>
            <div className="install-guide-tip">
              💡 Firefox and Safari on macOS do not support PWA installation. Use Chrome or Edge for the best desktop experience.
            </div>
          </div>
        )}

        {/* Other / fallback */}
        {platform === 'other' && !isIOS && (
          <div className="install-guide-body">
            <p className="install-guide-note">
              Installation steps vary by browser and device. Generally:
            </p>
            <ol className="install-guide-steps">
              <li className="install-step">
                <div className="install-step-num">1</div>
                <div className="install-step-content">
                  <strong>Open ClassMate in a supported browser</strong>
                  <span>Chrome, Edge, or Brave support PWA installation on most platforms.</span>
                </div>
              </li>
              <li className="install-step">
                <div className="install-step-num">2</div>
                <div className="install-step-content">
                  <strong>Look for an &quot;Install&quot; or &quot;Add to Home Screen&quot; option</strong>
                  <span>Check the browser menu (⋮) or the address bar.</span>
                </div>
              </li>
            </ol>
            <div className="install-guide-tip">
              💡 On iOS, open ClassMate in Safari and use the Share button to find &ldquo;Add to Home Screen&rdquo;.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="install-guide-footer">
          <button
            id="btn-install-guide-dismiss"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
