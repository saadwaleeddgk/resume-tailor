import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../lib/auth.js', import.meta.url), 'utf8'))
  .replace("import { createClient } from '@supabase/supabase-js';", 'const createClient = (...args) => globalThis.authTestClient(...args);');
const { requireUser } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('API authentication rejects invalid accounts and permits confirmed new accounts', async () => {
  const saved = { ...process.env };
  const check = async (user, error = null, authorization = 'Bearer test') => {
    globalThis.authTestClient = () => ({ auth: { getUser: async () => ({ data: { user }, error }) } });
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    return { user: await requireUser({ headers: { authorization } }, res), res };
  };
  try {
    delete process.env.SUPABASE_URL; delete process.env.VITE_SUPABASE_URL;
    assert.equal((await check(null)).res.code, 503);
    process.env.SUPABASE_URL = 'https://test.supabase.co'; process.env.SUPABASE_ANON_KEY = 'test';
    delete process.env.AUTH_USERS_VALID_AFTER;
    assert.equal((await check(null, null, '')).res.code, 401);
    assert.equal((await check(null, new Error('bad token'))).res.code, 401);
    assert.equal((await check({ id: 'unconfirmed' })).res.code, 401);
    const user = { id: 'new', email_confirmed_at: '2026-10-20', created_at: '2026-10-20T12:00:00Z' };
    assert.equal((await check({ ...user, is_anonymous: true })).res.code, 401);
    process.env.AUTH_USERS_VALID_AFTER = '2026-10-20T11:00:00Z';
    assert.equal((await check({ ...user, created_at: '2026-10-19' })).res.code, 401);
    assert.equal((await check(user)).user.id, 'new');
    process.env.AUTH_USERS_VALID_AFTER = 'invalid';
    assert.equal((await check(user)).res.code, 503);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved); delete globalThis.authTestClient;
  }
});
