import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

export interface AuthCallbackInfo {
  isCallback: boolean;
  type: string | null;
  code: string | null;
  hasTokens: boolean;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

// Synchronously capture window.location parameters at module evaluation time
// before Supabase gotrue can clear window.location.hash.
const initialSnapshot = typeof window !== 'undefined' ? {
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
} : null;

function parseSnapshot(): AuthCallbackInfo {
  if (!initialSnapshot) {
    return {
      isCallback: false,
      type: null,
      code: null,
      hasTokens: false,
      error: null,
      errorCode: null,
      errorDescription: null,
    };
  }

  const searchParams = new URLSearchParams(initialSnapshot.search);
  const hashString = initialSnapshot.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hashString);

  const error = searchParams.get('error') || hashParams.get('error');
  const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
  const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

  const code = searchParams.get('code');
  const accessToken = hashParams.get('access_token');
  const type = hashParams.get('type') || searchParams.get('type');

  const isCallbackPath = initialSnapshot.pathname.includes('/auth/callback');
  const hasAuthParams = Boolean(
    error ||
    errorCode ||
    errorDescription ||
    code ||
    accessToken ||
    type === 'signup' ||
    type === 'recovery' ||
    type === 'email_change'
  );

  const isCallback = isCallbackPath || hasAuthParams;

  return {
    isCallback,
    type,
    code,
    hasTokens: Boolean(accessToken),
    error,
    errorCode,
    errorDescription,
  };
}

const initialAuthCallbackInfo: AuthCallbackInfo = parseSnapshot();

export function getInitialAuthCallback(): AuthCallbackInfo {
  return initialAuthCallbackInfo;
}

export function isAuthCallbackUrl(): boolean {
  return initialAuthCallbackInfo.isCallback;
}

export function cleanAuthUrl(): void {
  if (typeof window === 'undefined') return;
  const targetPath = window.location.pathname.includes('/auth/callback') ? '/' : window.location.pathname;
  window.history.replaceState({}, document.title, targetPath);
}

export interface ProcessCallbackResult {
  success: boolean;
  user: User | null;
  session: Session | null;
  error: string | null;
  errorCode?: string | null;
}

export async function processAuthCallback(info: AuthCallbackInfo): Promise<ProcessCallbackResult> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      user: null,
      session: null,
      error: 'Supabase is not configured on this environment.',
    };
  }

  // 1. Explicit error in callback parameters (e.g. otp_expired, access_denied)
  if (info.errorCode || info.error || info.errorDescription) {
    return {
      success: false,
      user: null,
      session: null,
      errorCode: info.errorCode || info.error || 'auth_error',
      error: info.errorDescription || info.error || 'Authentication link failed or expired.',
    };
  }

  try {
    // 2. PKCE authorization code exchange
    if (info.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(info.code);
      if (error) {
        return {
          success: false,
          user: null,
          session: null,
          errorCode: error.code || 'code_exchange_failed',
          error: error.message,
        };
      }
      if (data?.session && data.user) {
        return {
          success: true,
          user: data.user,
          session: data.session,
          error: null,
        };
      }
    }

    // 3. Implicit grant / Session restoration check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return {
        success: false,
        user: null,
        session: null,
        error: sessionError.message,
      };
    }

    if (session?.user) {
      return {
        success: true,
        user: session.user,
        session,
        error: null,
      };
    }

    // 4. Brief listener poll if gotrue client initialization is still resolving in the background
    return await new Promise<ProcessCallbackResult>((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          subscription.unsubscribe();
          resolve({
            success: false,
            user: null,
            session: null,
            errorCode: 'session_not_found',
            error: 'No active authentication session could be verified from this link.',
          });
        }
      }, 3500);

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (newSession?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            resolve({
              success: true,
              user: newSession.user,
              session: newSession,
              error: null,
            });
          }
        }
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected confirmation error.';
    return {
      success: false,
      user: null,
      session: null,
      error: message,
    };
  }
}
