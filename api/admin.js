import { requireUser } from '../lib/auth.js';
import { adminClient, getAccount } from '../lib/access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    if (!(await getAccount(user)).is_admin) return res.status(403).json({ error: 'Administrator access required.' });
    const db = adminClient();
    if (req.method === 'GET') {
      const { data, error } = await db.from('app_accounts').select('user_id,email,status,is_admin,created_at').not('email','is',null).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return res.json({ users: data });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
    const { userId, status } = req.body || {};
    if (!['approved','rejected'].includes(status) || typeof userId !== 'string' || userId === user.id) return res.status(400).json({ error: 'Invalid approval request.' });
    const { data, error } = await db.from('app_accounts').update({ status }).eq('user_id',userId).eq('is_admin',false).not('email','is',null).select('user_id').single();
    if (error) throw error;
    return res.json({ ok: true, userId: data.user_id });
  } catch { return res.status(503).json({ error: 'Could not update or load user access.' }); }
}
