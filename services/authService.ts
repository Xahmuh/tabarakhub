import { AuthState } from '../types';

const AUTH_KEY = 'tabarak_hub_auth_session';

export const authService = {
  getSession: async () => {
    const session = localStorage.getItem(AUTH_KEY);
    return { data: { session: session ? JSON.parse(session) : null }, error: null };
  },
  getUser: async () => {
    const session = localStorage.getItem(AUTH_KEY);
    const parsed = session ? JSON.parse(session) : null;
    return { data: { user: parsed?.user || null }, error: null };
  },
  setSession: (session: AuthState) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  },
  signOut: () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.reload();
  }
};
