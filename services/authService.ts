import { supabaseClient } from '../lib/supabaseClient';
import { AuthState, Branch, Role } from '../types';

const BRANCH_SELECT = `
  id,
  code,
  name,
  role,
  google_maps_link,
  whatsapp_number,
  is_spin_enabled,
  is_items_entry_enabled,
  is_kpi_dashboard_enabled
`;

const toBranch = (row: any): Branch => ({
  id: row.id,
  code: row.code,
  name: row.name,
  role: row.role,
  googleMapsLink: row.google_maps_link,
  whatsappNumber: row.whatsapp_number,
  isSpinEnabled: row.is_spin_enabled,
  isItemsEntryEnabled: row.is_items_entry_enabled,
  isKPIDashboardEnabled: row.is_kpi_dashboard_enabled
});

const loginIdentifierToEmail = (identifier: string) => {
  const normalized = identifier.trim().toLowerCase();
  return normalized.includes('@') ? normalized : `${normalized}@tabarak.local`;
};

export const authService = {
  signInWithPassword: async (identifier: string, password: string): Promise<AuthState> => {
    const email = loginIdentifierToEmail(identifier);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }

    const state = await authService.getCurrentAuthState();
    if (!state.user) {
      await supabaseClient.auth.signOut();
      throw new Error('Authenticated user is not linked to an active branch profile.');
    }

    return state;
  },

  getCurrentAuthState: async (): Promise<AuthState> => {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session?.user) {
      return { user: null, pharmacist: null, permissions: [] };
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('app_user_profiles')
      .select(`role, branch:branches(${BRANCH_SELECT})`)
      .eq('user_id', data.session.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return { user: null, pharmacist: null, permissions: [] };
    }

    // Legacy safety: retired accounts users map onto the warehouse model.
    // Admin remains distinct so maintenance/admin access keeps working on
    // deployments that still carry legacy admin profiles.
    const normalizedRole: Role = profile.role === 'accounts'
      ? 'warehouse'
      : profile.role as Role;

    if (normalizedRole !== 'branch') {
      const identityUser: Branch = {
        id: data.session.user.id,
        code: normalizedRole.toUpperCase(),
        name: normalizedRole.toUpperCase(),
        role: normalizedRole
      };
      return { user: identityUser, pharmacist: null, permissions: [] };
    }

    if (!profile.branch) {
      return { user: null, pharmacist: null, permissions: [] };
    }

    const branchRow = Array.isArray(profile.branch) ? profile.branch[0] : profile.branch;
    return { user: toBranch(branchRow), pharmacist: null, permissions: [] };
  },

  getSession: async () => {
    const state = await authService.getCurrentAuthState();
    return { data: { session: state.user ? state : null }, error: null };
  },

  getUser: async () => {
    const state = await authService.getCurrentAuthState();
    return { data: { user: state.user }, error: null };
  },

  setSession: (_session: AuthState) => {
    // Supabase Auth owns persistence. App-only state such as selected pharmacist stays in React state.
  },

  signOut: async () => {
    await supabaseClient.auth.signOut();
  }
};
