import React, { useEffect, useState } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { AuthContext } from './authContextDef';
import { getAuthRedirectUrl } from '../utils/authRedirect';

const DEV_AUTH_STORAGE_KEY = 'classmate_auth_dev_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(DEV_AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as User;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setIsLoading(false);
    }).catch((err) => {
      console.warn('Failed to retrieve initial session:', err);
      setIsLoading(false);
    });

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setUser(newSession.user);
        localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
      } else if (!localStorage.getItem(DEV_AUTH_STORAGE_KEY)) {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase is not configured' } as AuthError };
    }
    const res = await supabase.auth.signInWithPassword({ email, password });
    return { error: res.error };
  };

  const signUp = async (email: string, password: string, studentName?: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase is not configured' } as AuthError, user: null };
    }
    const emailRedirectTo = getAuthRedirectUrl('/auth/callback');
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          student_name: studentName || 'Student',
          section: 'CSE-15',
        },
      },
    });
    return { error: res.error, user: res.data.user };
  };

  const devLogin = (email: string, studentName: string) => {
    const mockUser = {
      id: 'usr_' + Math.abs(email.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)).toString(36),
      app_metadata: { provider: 'email' },
      user_metadata: { student_name: studentName },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email,
    } as unknown as User;

    setUser(mockUser);
    try {
      localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify(mockUser));
    } catch {
      // ignore
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);
    setSession(null);

    if (isSupabaseConfigured) {
      const res = await supabase.auth.signOut();
      return { error: res.error };
    }
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        devLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
