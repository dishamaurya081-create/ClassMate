import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  getInitialAuthCallback,
  processAuthCallback,
  cleanAuthUrl,
} from '../utils/authCallback';
import {
  GraduationCapIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  RotateCcwIcon,
  LogInIcon,
  ArrowRightIcon,
} from './Icons';

interface AuthCallbackScreenProps {
  onContinue: () => void;
  onGoToSignIn: () => void;
}

type CallbackStatus = 'verifying' | 'success' | 'error';

export const AuthCallbackScreen: React.FC<AuthCallbackScreenProps> = ({
  onContinue,
  onGoToSignIn,
}) => {
  const [status, setStatus] = useState<CallbackStatus>('verifying');
  const [confirmedUser, setConfirmedUser] = useState<User | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const initialInfo = getInitialAuthCallback();

    processAuthCallback(initialInfo).then((result) => {
      if (!isMounted) return;

      if (result.success && result.user) {
        setConfirmedUser(result.user);
        setStatus('success');
      } else {
        setErrorCode(result.errorCode || 'auth_error');
        setErrorMessage(
          result.error ||
            'We were unable to verify your account with this link. It may have expired or already been used.'
        );
        setStatus('error');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleContinue = () => {
    cleanAuthUrl();
    onContinue();
  };

  const handleGoToSignIn = () => {
    cleanAuthUrl();
    onGoToSignIn();
  };

  const isExpired =
    errorCode === 'otp_expired' ||
    Boolean(errorMessage && errorMessage.toLowerCase().includes('expired'));

  const userEmail = confirmedUser?.email || confirmedUser?.user_metadata?.email || 'Student Account';

  return (
    <div className="auth-screen-container">
      {status === 'verifying' && (
        <div className="auth-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div className="callback-spinner" />
          <h1 className="auth-brand-title" style={{ fontSize: '1.4rem' }}>
            Verifying Your Email
          </h1>
          <p className="auth-brand-subtitle" style={{ maxWidth: '360px', margin: '0.5rem auto 1.5rem' }}>
            Establishing your secure session with Supabase... Just a moment.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <RotateCcwIcon size={14} className="spin-slow" />
            <span>Verifying confirmation token</span>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="auth-card callback-card-success">
          <div className="auth-brand-section">
            <div className="auth-brand-badge callback-badge-success">
              <CheckCircleIcon size={30} />
            </div>
            <h1 className="auth-brand-title">Email Verified!</h1>
            <p className="auth-brand-subtitle">
              Your ClassMate account has been verified successfully.
            </p>
          </div>

          <div className="callback-user-pill">
            <span className="callback-user-email">{userEmail}</span>
            <span className="callback-status-tag">
              ✓ Email Confirmed
            </span>
          </div>

          <div className="callback-message-box">
            <p style={{ margin: 0 }}>
              Your account is ready. Continue to customize your section, specialization, and access your timetable.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: '1.5rem', width: '100%', padding: '0.85rem' }}
            onClick={handleContinue}
          >
            <span>Continue to ClassMate</span>
            <ArrowRightIcon size={16} />
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="auth-card callback-card-error">
          <div className="auth-brand-section">
            <div className="auth-brand-badge callback-badge-error">
              <AlertCircleIcon size={30} />
            </div>
            <h1 className="auth-brand-title">
              {isExpired ? 'Link Expired or Used' : 'Verification Failed'}
            </h1>
            <p className="auth-brand-subtitle">
              {isExpired
                ? 'This confirmation link has expired or has already been used.'
                : 'We could not verify your email with the provided link.'}
            </p>
          </div>

          <div className="auth-alert error" style={{ marginBottom: '1rem' }}>
            <AlertCircleIcon size={16} />
            <div style={{ lineHeight: 1.4 }}>{errorMessage}</div>
          </div>

          {isExpired && (
            <div className="callback-hint-box">
              💡 <strong>Already clicked this link earlier?</strong> If your email was already confirmed, you do not need to confirm again. You can sign in directly with your email and password.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ width: '100%', padding: '0.85rem' }}
              onClick={handleGoToSignIn}
            >
              <LogInIcon size={16} />
              <span>Sign In to ClassMate</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ width: '100%', padding: '0.75rem' }}
              onClick={handleContinue}
            >
              <span>Back to Home</span>
            </button>
          </div>

          <div className="auth-footer-info" style={{ marginTop: '1.25rem', justifyContent: 'center' }}>
            <GraduationCapIcon size={13} />
            <span>ClassMate Authentication</span>
          </div>
        </div>
      )}
    </div>
  );
};
