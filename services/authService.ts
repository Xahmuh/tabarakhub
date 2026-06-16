import { supabaseClient } from '../lib/supabaseClient';
import { AuthState, Branch, Role } from '../types';

const BRANCH_SELECT = `
  id,
  code,
  name,
  role,
  google_maps_link,
  whatsapp_number,
  nhra_license_no,
  cr_number,
  branch_manager_name,
  lat,
  lng,
  duty_radius_m,
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
  nhraLicenseNo: row.nhra_license_no,
  crNumber: row.cr_number,
  branchManagerName: row.branch_manager_name,
  lat: row.lat === null || row.lat === undefined ? null : Number(row.lat),
  lng: row.lng === null || row.lng === undefined ? null : Number(row.lng),
  dutyRadiusM: row.duty_radius_m === null || row.duty_radius_m === undefined ? null : Number(row.duty_radius_m),
  isSpinEnabled: row.is_spin_enabled,
  isItemsEntryEnabled: row.is_items_entry_enabled,
  isKPIDashboardEnabled: row.is_kpi_dashboard_enabled
});

const loginIdentifierToEmailCandidates = (identifier: string) => {
  const normalized = identifier.trim().toLowerCase();
  if (normalized.includes('@')) {
    return [normalized];
  }

  const candidates: string[] = [];
  const compactBranchCode = normalized.match(/^([a-z])0(\d{2})$/);

  if (compactBranchCode) {
    candidates.push(`tabarakph.${compactBranchCode[1]}${compactBranchCode[2]}@gmail.com`);
  }

  candidates.push(`tabarakph.${normalized}@gmail.com`, `${normalized}@tabarak.local`);

  return Array.from(new Set(candidates));
};

const isInvalidCredentialsError = (error: unknown) => {
  const authError = error as { message?: string };
  return /invalid login credentials/i.test(authError.message ?? '');
};

export const authService = {
  signInWithPassword: async (identifier: string, password: string): Promise<AuthState> => {
    let signInError: unknown = null;
    for (const email of loginIdentifierToEmailCandidates(identifier)) {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      signInError = error;

      if (!error || !isInvalidCredentialsError(error)) {
        break;
      }
    }

    if (signInError) {
      throw signInError;
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

    // Legacy safety: old "manager" profiles are presented as Admin in the app,
    // while the database helper functions still accept manager during migration.
    const normalizedRole: Role = profile.role === 'manager'
      ? 'admin'
      : profile.role as Role;

    if (normalizedRole !== 'branch') {
      const identityUser: Branch = {
        id: data.session.user.id,
        userId: data.session.user.id,
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
    if (branchRow.role !== 'branch') {
      return { user: null, pharmacist: null, permissions: [] };
    }

    return { user: { ...toBranch(branchRow), userId: data.session.user.id }, pharmacist: null, permissions: [] };
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
