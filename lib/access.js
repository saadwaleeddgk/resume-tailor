import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || /your_|service_role_key|placeholder/i.test(key)) {
    const error = new Error('Set the real SUPABASE_SERVICE_ROLE_KEY in the backend environment and restart the server.');
    error.code = 'AUTH_CONFIG_MISSING';
    throw error;
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function getAccount(user) {
  const db = adminClient();
  // Ignore duplicates: never overwrite an existing approval or admin flag.
  const { error: insertError } = await db.from('app_accounts').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (insertError) throw insertError;
  const { data, error } = await db.from('app_accounts').select('*').eq('user_id', user.id).single();
  if (error) throw error;
  return data;
}
export async function accountView(user) {
  const account = await getAccount(user);
  const { count, error } = await adminClient().from('tailoring_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('state', 'completed');
  if (error) throw error;
  return { ...account, used: count, remaining: Math.max(0, 4 - count), anonymous: !!user.is_anonymous };
}
export function isApproved(account) { return account.is_admin || account.status === 'approved'; }
