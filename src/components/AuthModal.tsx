import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { XIcon, LockIcon, LogInIcon, UserIcon, AlertCircleIcon, GraduationCapIcon } from './Icons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg('Signed in successfully!');
          setTimeout(() => {
            onClose();
          }, 600);
        }
      } else {
        const { error, user } = await signUp(email, password, studentName);
        if (error) {
          setErrorMsg(error.message);
        } else if (user && !user.identities?.length) {
          setErrorMsg('An account with this email already exists.');
        } else {
          setSuccessMsg(`Account created! Please check ${email} for the verification link to activate your account.`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-container auth-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <LockIcon size={20} />
            </div>
            <div>
              <h2 className="modal-title">
                {mode === 'signin' ? 'Sign In to Supabase' : 'Create Supabase Account'}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                ClassMate Phase 2 Cloud Sync & Profiles
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tab-row">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
            }}
          >
            <LogInIcon size={16} />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
            }}
          >
            <UserIcon size={16} />
            <span>Sign Up</span>
          </button>
        </div>

        {/* Alert / Feedback */}
        {errorMsg && (
          <div className="auth-alert error">
            <AlertCircleIcon size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="auth-alert success">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="studentName">
                Student Name
              </label>
              <div className="input-with-icon">
                <input
                  id="studentName"
                  type="text"
                  className="form-input"
                  placeholder="Enter your full name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="auth-footer-info">
            <GraduationCapIcon size={14} />
            <span>Secured with Supabase Row Level Security (RLS)</span>
          </div>

          {/* Modal Actions */}
          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Connecting...'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
