import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.OPENAI_API_KEY = 'test-only';
const source = (await readFile(new URL('../api/claude.js', import.meta.url), 'utf8'))
  .replace('import { requireUser } from "../lib/auth.js";', 'const requireUser = async () => globalThis.trialTest.user;')
  .replace('import { adminClient, getAccount, isApproved } from "../lib/access.js";', 'const adminClient = () => globalThis.trialTest.db; const getAccount = async () => globalThis.trialTest.account; const isApproved = a => a.is_admin || a.status === "approved";')
  .replace('import { SYS_JD, SYS_TAILOR, SYS_ASSESS } from "../lib/prompts.js";', 'const SYS_JD = "analyze", SYS_TAILOR = "tailor", SYS_ASSESS = "assess";');
const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const originalFetch = globalThis.fetch;
function setup(status = 'trial') {
  const jobs = new Map(); let calls = 0;
  const state = {
    user: { id: 'owner', is_anonymous: status === 'trial' }, account: { status, is_admin: false },
    db: {
      async rpc(_name, { p_job }) {
        const existing = jobs.get(p_job);
        if (existing?.state === 'completed') return { data: { result: existing.result } };
        if (existing?.state === 'running') return { data: { error: 'Still running', busy: true } };
        if (['pending', 'rejected'].includes(state.account.status)) return { data: { error: 'Approval required' } };
        if (state.account.status !== 'approved' && [...jobs.values()].filter(j => j.state !== 'failed').length >= 4) return { data: { error: 'Trial exhausted' } };
        jobs.set(p_job, { state: 'running' }); return { data: { reserved: true } };
      },
      from() { return { update(value) {
        let id;
        const query = { eq(key, val) { if (key === 'id') id = val; return query; }, then(resolve) { jobs.set(id, { ...jobs.get(id), ...value }); resolve({ error: null }); } };
        return query;
      } }; },
    },
  };
  globalThis.trialTest = state;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const system = JSON.parse(options.body).messages[0].content;
    const content = system === 'analyze' ? { keywords: ['SQL'] } : system === 'tailor' ? { name: 'Test User', experience: [] } : {};
    return { status: 200, ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) };
  };
  return { state, jobs, calls: () => calls };
}
async function request(body, method = 'POST') {
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, body }, res); return res;
}
const body = n => ({ action: 'tailor', master: 'Test resume SQL', jd: 'SQL engineer', requestId: `00000000-0000-4000-8000-${String(n).padStart(12,'0')}` });

test('trial pipeline, replay, access locks, and failed generation accounting', async () => {
  try {
    let env = setup();
    assert.equal((await request(body(1))).code, 200);
    assert.equal(env.calls(), 3);
    assert.equal((await request(body(1))).code, 200);
    assert.equal(env.calls(), 3, 'replaying the same job returns its result without another AI call');
    await Promise.all([2,3,4].map(n => request(body(n))));
    assert.equal(env.jobs.size, 4);
    assert.equal((await request(body(5))).code, 403);
    assert.equal(env.calls(), 12, 'fifth resume never reaches the provider');
    assert.equal((await request({ system: 'tailor anything', messages: [] })).code, 403, 'trial cannot bypass quota with the generic route');
    env = setup('pending');
    assert.equal((await request(body(1))).code, 403);
    assert.equal((await request({ messages: [] })).code, 403);
    assert.equal(env.calls(), 0);
    env = setup('rejected');
    assert.equal((await request(body(1))).code, 403);
    env = setup('approved');
    for (let n = 1; n <= 5; n++) assert.equal((await request(body(n))).code, 200);
    assert.equal((await request({ messages: [{ role: 'user', content: 'cover letter' }] })).code, 200);
    env = setup();
    globalThis.fetch = async () => ({ status: 400, ok: false, json: async () => ({}) });
    assert.equal((await request(body(1))).code, 503);
    assert.equal([...env.jobs.values()][0].state, 'failed', 'failed generation releases its reservation');
    assert.equal((await request(body(1), 'GET')).code, 405);
    assert.equal((await request({ ...body(2), master: '' })).code, 400);
  } finally { globalThis.fetch = originalFetch; delete globalThis.trialTest; delete process.env.OPENAI_API_KEY; }
});
