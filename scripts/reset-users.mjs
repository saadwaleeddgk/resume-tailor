import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Capture a fixed set first so registrations during the reset are not deleted.
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local .env. Never use a VITE_ prefix for the service-role key.');
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const cutoff = new Date().toISOString();
const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users.filter(user => Date.parse(user.created_at) <= Date.parse(cutoff)));
  if (data.users.length < 1000) break;
}
console.log(`Existing accounts: ${users.length}. Cutoff: ${cutoff}`);
if (!process.argv.includes('--delete-existing-users')) {
  console.log('Preview only. Run with --delete-existing-users to permanently delete these accounts, including admins.');
  process.exit(0);
}
console.log(`Set AUTH_USERS_VALID_AFTER=${cutoff} on the backend and redeploy to reject old access tokens immediately.`);
let failed = 0;
for (const user of users) {
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) { failed++; console.error(`Could not delete ${user.id}: ${error.message}`); }
}
console.log(`Deleted ${users.length - failed} accounts; ${failed} failures.`);
if (failed) process.exitCode = 1;
