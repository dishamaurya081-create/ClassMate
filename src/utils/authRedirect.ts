/**
 * Resolves the authentication redirect URL for Supabase Auth flows
 * (email confirmation, password recovery, magic link).
 *
 * Resolution Order:
 * 1. Environment variable `VITE_SITE_URL` or `VITE_APP_URL`
 *    (set during production / staging deployment, e.g. https://classmate.vercel.app)
 * 2. `window.location.origin` (current browser origin during local development or runtime)
 * 3. Fallback to empty string if run outside browser environment
 */
export function getAuthRedirectUrl(path: string = '/auth/callback'): string {
  const envUrl = import.meta.env.VITE_SITE_URL || import.meta.env.VITE_APP_URL;
  let base = '';

  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    base = envUrl.trim().replace(/\/+$/, '');
  } else if (typeof window !== 'undefined' && window.location.origin) {
    base = window.location.origin.replace(/\/+$/, '');
  }

  if (!base) {
    return '';
  }

  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${base}${normalizedPath}`;
}
