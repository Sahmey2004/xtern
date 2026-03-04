import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'administrator' | 'po_manager';

export function getRole(user: User | null): UserRole {
  return user?.user_metadata?.role ?? 'po_manager';
}

export function getDisplayName(user: User | null): string {
  return user?.user_metadata?.full_name || user?.email || 'User';
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateDisplayName(fullName: string) {
  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
