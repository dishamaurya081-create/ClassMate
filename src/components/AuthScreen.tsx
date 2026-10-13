import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { LockIcon, LogInIcon, UserIcon, AlertCircleIcon, GraduationCapIcon } from './Icons';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          if (error.message.toLowerCase().includes('email not confirmed')) {
            setErrorMsg(
              'Email not confirmed: Please check your inbox for the Supabase confirmation link (or disable "Confirm email" in your Supabase Auth dashboard settings to log in immediately).'
            );
          } else {
            setErrorMsg(error.message);
          }
        } else {
          setSuccessMsg('Signed in successfully!');
        }
      } else {
        const { error, user } = await signUp(email, password, studentName);
        if (error) {
          setErrorMsg(error.message);
        } else if (user && !user.identities?.length) {
          setErrorMsg('An account with this email already exists.');
        } else {
          setSuccessMsg(
            `Account created! A confirmation email has been sent to ${email}. Please check your inbox and click the verification link to activate your account.`
          );
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
    <div className="auth-screen-container">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand-section">
          <div className="auth-brand-badge">
            <GraduationCapIcon size={26} />
          </div>
          <h1 className="auth-brand-title">ClassMate</h1>
          <p className="auth-brand-subtitle">
            College Timetable & Schedule Management
          </p>
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
            <div style={{ lineHeight: 1.4 }}>{errorMsg}</div>
          </div>
        )}
        {successMsg && (
          <div className="auth-alert success">
            <span>✓</span>
            <div style={{ lineHeight: 1.4 }}>{successMsg}</div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="studentName">
                Student Name
              </label>
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

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: '0.75rem', width: '100%', padding: '0.85rem' }}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Connecting to Supabase...'
              : mode === 'signin'
                ? 'Sign In to ClassMate'
                : 'Create Account & Continue'}
          </button>


          <div className="auth-footer-info" style={{ marginTop: '1rem', justifyContent: 'center' }}>
            <LockIcon size={13} />
            <span>Secured with Supabase Authentication & RLS</span>
          </div>
        </form>
      </div>
    </div>
  );
};
