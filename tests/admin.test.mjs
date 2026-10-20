import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (await readFile(new URL('../api/admin.js', import.meta.url), 'utf8'))
  .replace("import { requireUser } from '../lib/auth.js';", 'const requireUser = async () => globalThis.adminTest.user;')
  .replace("import { adminClient, getAccount } from '../lib/access.js';", 'const getAccount = async () => globalThis.adminTest.account; const adminClient = () => globalThis.adminTest.db;');
const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
async function request(body) {
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', body }, res); return res;
}
test('only admins can grant approval; self changes and privilege injection are rejected', async () => {
  let written;
  const filters = [];
  const chain = { eq(key, value) { filters.push([key,value]); return chain; }, not() { return chain; }, select() { return chain; }, async single() { return { data: { user_id: 'target' } }; } };
  globalThis.adminTest = { user: { id: 'admin' }, account: { is_admin: false }, db: { from() { return { update(value) { written = value; return chain; } }; } } };
  try {
    assert.equal((await request({ userId: 'target', status: 'approved' })).code, 403);
    assert.equal(written, undefined);
    globalThis.adminTest.account.is_admin = true;
    assert.equal((await request({ userId: 'admin', status: 'approved' })).code, 400);
    assert.equal((await request({ userId: 'target', status: 'admin' })).code, 400);
    assert.equal((await request({ userId: 'target', status: 'approved', is_admin: true })).code, 200);
    assert.deepEqual(written, { status: 'approved' });
    assert.ok(filters.some(([key,value]) => key === 'is_admin' && value === false));
  } finally { delete globalThis.adminTest; }
});
