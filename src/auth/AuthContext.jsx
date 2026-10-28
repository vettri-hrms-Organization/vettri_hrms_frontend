import { createContext, useCallback, useEffect, useState } from 'react';
import { resetSessionExpirationHandling } from '../api/axiosClient';
import { authApi } from '../api/endpoints/auth';
import { queryClient } from '../api/queryClient';
import { mfaDeviceStorage, tokenStorage } from './tokenStorage';
import { tenantStorage } from './tenantStorage';
import { clearQueue } from '../utils/offlineRequestQueue';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState(() => tenantStorage.getSelectedCompanyId());
  const [isLoading, setIsLoading] = useState(true);

  const setSelectedCompanyId = useCallback((companyId) => {
    queryClient.clear();
    clearQueue();
    setSelectedCompanyIdState(companyId ? String(companyId) : null);
    tenantStorage.setSelectedCompanyId(companyId);
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      queryClient.clear();
      clearQueue();
      tokenStorage.clear();
      tenantStorage.clear();
      setSelectedCompanyIdState(null);
      setUser(null);
    }

    window.addEventListener('vettri:session-expired', handleSessionExpired);
    return () => window.removeEventListener('vettri:session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    async function restoreSession() {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        clearQueue();
        setIsLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        setUser(me);
        if (!me?.roles?.includes('SUPER_ADMIN')) setSelectedCompanyId(null);
      } catch {
        // axiosClient's interceptor already tried a refresh and failed if
        // we land here - session really is gone.
        tokenStorage.clear();
        clearQueue();
        tenantStorage.clear();
        setSelectedCompanyIdState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  // Stores the tokens from a login-shaped response ({accessToken, refreshToken, user})
  // and makes that user current. Shared by password login, the two-factor step
  // and change-password (which hands back a fresh session).
  const establishSession = useCallback(async (data) => {
    const accessToken = data.accessToken || data.token;
    const refreshToken = data.refreshToken || data.refreshToken;

    tokenStorage.setTokens(accessToken, refreshToken);
    resetSessionExpirationHandling();
    // Cached queries aren't keyed by user, so a previous user's data must not survive a login.
    queryClient.clear();
    clearQueue();
    tenantStorage.clear();
    setSelectedCompanyIdState(null);

    let nextUser = data.user || null;
    if (!nextUser && accessToken) {
      nextUser = await authApi.me();
    }

    setUser(nextUser);
    return nextUser;
  }, []);

  /**
   * Resolves to the signed-in user, or - when the account needs a second
   * factor - to `{ mfaRequired: true, mfaToken, methods, maskedEmail,
   * expiresInSeconds, identifier }` with nothing stored yet; finish with
   * verifyMfa(). A remembered-device token for this identifier is sent along.
   */
  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password, mfaDeviceStorage.get(username));
    if (data?.mfaRequired) {
      return {
        mfaRequired: true,
        mfaToken: data.mfaToken,
        methods: data.methods || [],
        maskedEmail: data.maskedEmail || null,
        expiresInSeconds: data.mfaExpiresInSeconds || 300,
        identifier: username,
      };
    }
    return establishSession(data);
  }, [establishSession]);

  const verifyMfa = useCallback(async ({ mfaToken, method, code, rememberDevice = false, identifier }) => {
    const data = await authApi.verifyMfa({ mfaToken, method, code, rememberDevice });
    if (rememberDevice && data?.deviceToken) {
      mfaDeviceStorage.set(identifier, data.deviceToken);
    }
    return establishSession(data);
  }, [establishSession]);

  /** Re-reads /api/auth/me (e.g. after enrolling in 2FA clears mfaEnrollmentRequired). */
  const refreshUser = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Best-effort - clear local state regardless of whether the server call succeeded.
    }
    tokenStorage.clear();
    queryClient.clear();
    clearQueue();
    tenantStorage.clear();
    resetSessionExpirationHandling();
    setSelectedCompanyIdState(null);
    setUser(null);
  }, []);

  const hasRole = useCallback((roleName) => !!user?.roles?.includes(roleName), [user]);

  const hasAnyRole = useCallback((roleNames) => roleNames.some((r) => user?.roles?.includes(r)), [user]);

  // Prefer this over hasRole/hasAnyRole for showing/hiding UI - permission
  // codes are aggregated across whatever roles the user holds, so this
  // still works correctly for a custom role built in Settings > Roles that
  // isn't named "HR_ADMIN" but was granted the same permissions.
  const hasPermission = useCallback((code) => !!user?.permissions?.includes(code), [user]);

  const hasAnyPermission = useCallback(
    (codes) => codes.some((c) => user?.permissions?.includes(c)),
    [user]
  );

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    login,
    verifyMfa,
    establishSession,
    refreshUser,
    logout,
    hasRole,
    hasAnyRole,
    hasPermission,
    hasAnyPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
