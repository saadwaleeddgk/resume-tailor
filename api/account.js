import { createClient } from '@supabase/supabase-js';
import { requireUser } from '../lib/auth.js';
import { adminClient, accountView, getAccount } from '../lib/access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await requireUser(req, res, { allowAnonymous: true });
  if (!user) return;
  try {
    if (req.method === 'GET') return res.json(await accountView(user));
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
    if (user.is_anonymous || !user.email_confirmed_at) return res.status(403).json({ error: 'Verify your email before requesting approval.' });
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Use a password between 10 and 128 characters.' });
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: user.email, password });
    if (error || data.user?.id !== user.id) return res.status(400).json({ error: 'The password could not be verified.' });
    await auth.auth.signOut({ scope: 'local' });
    await getAccount(user);
    const { error: updateError } = await adminClient().from('app_accounts').update({ status: 'pending', email: user.email }).eq('user_id', user.id).eq('status', 'trial').eq('is_admin', false);
    if (updateError) throw updateError;
    return res.json(await accountView(user));
  } catch (error) {
    let message = 'Account service unavailable. Check the database migration and server configuration.';
    if (error.code === 'AUTH_CONFIG_MISSING') message = 'Set the real SUPABASE_SERVICE_ROLE_KEY in the backend environment and restart the server.';
    if (['42P01', 'PGRST205'].includes(error.code)) message = 'Trial database tables are missing. Run the trial access SQL migration in Supabase SQL Editor.';
    if (error.code === '42501') message = 'Database access denied. Verify the server service-role key and migration permissions.';
    return res.status(503).json({ error: message });
  }
}
