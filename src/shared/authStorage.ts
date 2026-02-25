export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const AUTH_TOKEN_STORAGE_KEY = 'critterra.auth.token.v1';

export function getAuthToken(): string | null {
  const value = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
