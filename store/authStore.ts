import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { analytics } from '../services/observability/analytics';

interface AuthStore {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  loading: true,
  configured: supabaseConfigured,

  initialize: async () => {
    if (!supabase) {
      set({ loading: false });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, loading: false });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signIn: async (email, password) => {
    if (!supabase) return 'Cloud sync is not configured.';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) analytics.track('sign_in');
    return error?.message ?? null;
  },

  signUp: async (email, password) => {
    if (!supabase) return 'Cloud sync is not configured.';
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) analytics.track('sign_up');
    return error?.message ?? null;
  },

  resetPassword: async (email) => {
    if (!supabase) return 'Cloud sync is not configured.';
    const redirectTo = process.env.EXPO_PUBLIC_PASSWORD_RESET_URL;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (!error) analytics.track('password_reset_requested');
    return error?.message ?? null;
  },

  deleteAccount: async () => {
    if (!supabase) return 'Cloud sync is not configured.';
    const user = get().user;
    if (!user) return 'You must be signed in to delete your account.';

    const failures: string[] = [];
    const tables = [
      'user_recipes',
      'user_folders',
      'user_meal_plan',
      'user_grocery_state',
    ] as const;
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('user_id', user.id);
      if (error) failures.push(table);
    }

    try {
      const { data: files } = await supabase.storage.from('recipe-images').list(user.id, {
        limit: 1000,
      });
      if (files?.length) {
        const paths: string[] = [];
        for (const entry of files) {
          if (entry.id == null && entry.name) {
            const nested = await supabase.storage
              .from('recipe-images')
              .list(`${user.id}/${entry.name}`, { limit: 1000 });
            for (const file of nested.data ?? []) {
              paths.push(`${user.id}/${entry.name}/${file.name}`);
            }
          } else if (entry.name) {
            paths.push(`${user.id}/${entry.name}`);
          }
        }
        if (paths.length) {
          await supabase.storage.from('recipe-images').remove(paths);
        }
      }
    } catch (error) {
      analytics.captureException(error, { stage: 'delete_account_storage' });
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) return signOutError.message;
    analytics.track('account_deleted', { tableFailures: failures.length });
    if (failures.length) {
      return 'Cloud recipe data could not be fully cleared. Contact support if anything remains.';
    }
    return null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    analytics.track('sign_out');
  },
}));
