const STORAGE_KEY = 'wj_auth_session';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function getAuthSession(): AuthSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
  const session = getAuthSession();
  if (!session) return null;
  if (Date.now() >= session.expiresAt - 30_000) return null;
  return session.accessToken;
}

export function storeTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  setAuthSession({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });
}
