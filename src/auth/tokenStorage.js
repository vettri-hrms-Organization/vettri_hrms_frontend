// Centralized so axiosClient (which can't import AuthContext without a
// circular dependency) and AuthContext both read/write tokens the same way.
// localStorage is fine here - these are JWTs meant to survive a page
// refresh, and XSS is mitigated at the framework level (React escapes by
// default) rather than by moving the token out of JS-reachable storage.

const ACCESS_TOKEN_KEY = 'haodaone_access_token';
const REFRESH_TOKEN_KEY = 'haodaone_refresh_token';

const readToken = (key) => {
  const value = localStorage.getItem(key);
  return value && value !== 'undefined' && value !== 'null' ? value : null;
};

export const tokenStorage = {
  getAccessToken: () => readToken(ACCESS_TOKEN_KEY),
  getRefreshToken: () => readToken(REFRESH_TOKEN_KEY),
  setTokens: (accessToken, refreshToken) => {
    if (!accessToken || accessToken === 'undefined' || accessToken === 'null') {
      throw new Error('Authentication response did not include an access token');
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// "Remember this device" tokens from two-factor sign-in, keyed by the
// lower-cased login identifier. Deliberately NOT removed by clear()/logout -
// surviving a sign-out is the point. The backend only honours a token for the
// user it was issued to, for 30 days, and an admin 2FA reset revokes it.
const MFA_DEVICE_KEY = 'haodaone_mfa_devices';

function readDeviceMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MFA_DEVICE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const mfaDeviceStorage = {
  get: (identifier) => {
    if (!identifier) return null;
    return readDeviceMap()[String(identifier).trim().toLowerCase()] || null;
  },
  set: (identifier, deviceToken) => {
    if (!identifier || !deviceToken) return;
    try {
      const map = readDeviceMap();
      map[String(identifier).trim().toLowerCase()] = deviceToken;
      localStorage.setItem(MFA_DEVICE_KEY, JSON.stringify(map));
    } catch {
      // Storage full/blocked: the user is simply asked for a code next time.
    }
  },
  remove: (identifier) => {
    if (!identifier) return;
    try {
      const map = readDeviceMap();
      delete map[String(identifier).trim().toLowerCase()];
      localStorage.setItem(MFA_DEVICE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  },
};
