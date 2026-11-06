import { useCallback } from 'react';
import { demoSandboxApi } from '../../api/endpoints/demoSandbox';
import { tokenStorage } from '../../auth/tokenStorage';
import { useAuth } from '../../hooks/useAuth';

// While someone explores their demo workspace, their real sign-in is parked here so "Exit demo"
// returns them to their own company without signing in again. Cleared on exit and on logout.
export const REAL_SESSION_KEY = 'vettri.demo.realSession';

function readRealSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(REAL_SESSION_KEY) || 'null');
    return parsed?.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

export function hasRealSession() {
  return !!readRealSession();
}

export function clearRealSession() {
  try { sessionStorage.removeItem(REAL_SESSION_KEY); } catch { /* storage blocked */ }
}

/** enterDemo(role) opens one of the demo logins (ADMIN, HR, MANAGER, EMPLOYEE); exitDemo() goes back to the real company. */
export function useDemoSession() {
  const { establishSession, refreshUser } = useAuth();

  const enterDemo = useCallback(async (role = 'ADMIN') => {
    const session = await demoSandboxApi.session(role);
    // Only park the real sign-in when entering from the real company, not when switching role inside the demo.
    if (!readRealSession()) {
      try {
        sessionStorage.setItem(REAL_SESSION_KEY, JSON.stringify({
          accessToken: tokenStorage.getAccessToken(),
          refreshToken: tokenStorage.getRefreshToken(),
        }));
      } catch { /* storage blocked: exit will sign out instead */ }
    }
    await establishSession(session);
    return refreshUser();
  }, [establishSession, refreshUser]);

  const exitDemo = useCallback(async () => {
    const real = readRealSession();
    clearRealSession();
    if (!real) return null;
    return establishSession({ accessToken: real.accessToken, refreshToken: real.refreshToken });
  }, [establishSession]);

  return { enterDemo, exitDemo };
}
