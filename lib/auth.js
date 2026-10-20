import { createClient } from '@supabase/supabase-js';

export async function requireUser(req, res, { allowAnonymous = false } = {}) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.status(503).json({ error: 'Authentication is not configured.' });
    return null;
  }
  const token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return null;
  }
  try {
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.getUser(token);
    const user = data?.user;
    const cutoff = process.env.AUTH_USERS_VALID_AFTER;
    if (cutoff && !Number.isFinite(Date.parse(cutoff))) throw new Error('Invalid account cutoff');
    if (error || !user || (!allowAnonymous && (!user.email_confirmed_at || user.is_anonymous)) ||
        (allowAnonymous && !user.is_anonymous && !user.email_confirmed_at) ||
        (cutoff && Date.parse(user.created_at) <= Date.parse(cutoff))) {
      res.status(401).json({ error: 'Your session is no longer valid. Please register or sign in again.' });
      return null;
    }
    return user;
  } catch {
    res.status(503).json({ error: 'Could not verify your session. Please try again.' });
    return null;
  }
}
