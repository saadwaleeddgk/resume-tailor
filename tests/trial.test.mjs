import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.OPENAI_API_KEY = 'test-only';
const source = (await readFile(new URL('../api/claude.js', import.meta.url), 'utf8'))
  .replace('import { buildGeminiRequest, normalizeGeminiResponse } from "../lib/gemini.js";', 'import { buildGeminiRequest, normalizeGeminiResponse } from ' + JSON.stringify(new URL('../lib/gemini.js', import.meta.url).href) + ';')
  .replace('const sleep = (ms) => new Promise(r => setTimeout(r, ms));', 'const sleep = async () => {};')
  .replace('import { ipQuotaKey } from "../lib/ip.js";', 'const ipQuotaKey = () => globalThis.trialTest.ip;')
  .replace('import { requireUser } from "../lib/auth.js";', 'const requireUser = async () => globalThis.trialTest.user;')
  .replace('import { adminClient, getAccount, isApproved } from "../lib/access.js";', 'const adminClient = () => globalThis.trialTest.db; const getAccount = async () => globalThis.trialTest.account; const isApproved = a => a.is_admin || a.status === "approved";')
  .replace('import { SYS_JD, SYS_TAILOR, SYS_ASSESS } from "../lib/prompts.js";', 'const SYS_JD = "analyze", SYS_TAILOR = "tailor", SYS_ASSESS = "assess";');
const { default: handler, parseModelJSON, fetchTimeout, classifyProviderFailure, selectProviders } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const originalFetch = globalThis.fetch;
function setup(status = 'trial') {
  const jobs = new Map(); let calls = 0;
  const state = {
    ip: 'network-a', day: 1, user: { id: 'owner', is_anonymous: false, email_confirmed_at: '2026-10-21' }, account: { status, is_admin: false },
    db: {
      async rpc(_name, { p_job, p_user, p_ip_key }) {
        const existing = jobs.get(p_job);
        if (existing?.state === 'completed') return { data: { result: existing.result } };
        if (existing?.state === 'running') return { data: { error: 'Still running', busy: true } };
        if (['pending', 'rejected'].includes(state.account.status)) return { data: { error: 'Approval required' } };
        if (state.account.status !== 'approved' && [...jobs.values()].filter(j => j.owner === p_user && j.state !== 'failed').length >= 4) return { data: { error: 'Trial exhausted' } };
        if (state.account.status !== 'approved' && [...jobs.values()].filter(j => j.ip === p_ip_key && j.day === state.day && j.state !== 'failed').length >= 4) return { data: { error: 'Network limit reached', code: 'IP_DAILY_LIMIT' } };
        jobs.set(p_job, { state: 'running', owner: p_user, ip: state.account.status === 'approved' ? null : p_ip_key, day: state.day }); return { data: { reserved: true } };
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
    env.state.user.id = 'second-account';
    assert.equal((await request(body(1))).code, 429, 'another verified account on the same IP is blocked');
    env.state.ip = 'network-b';
    assert.equal((await request(body(1))).code, 200, 'another IP has an independent daily bucket');
    env.state.user.id = 'owner';
    assert.equal((await request(body(6))).code, 403, 'changing networks does not reset the account lifetime quota');
    env.state.user.id = 'second-account'; env.state.ip = 'network-a'; env.state.day++;
    assert.equal((await request(body(2))).code, 200, 'daily IP quota resets on the next UTC day');
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
    env = setup();
    env.state.db.rpc = async () => ({ error: { code: 'PGRST202', message: 'private database detail' } });
    const migrationFailure = await request(body(1));
    assert.equal(migrationFailure.body.code, 'QUOTA_MIGRATION_REQUIRED');
    assert.equal(migrationFailure.body.stage, 'quota');
    assert.match(migrationFailure.body.error, /20261021_verified_ip_limits/);
    assert.doesNotMatch(JSON.stringify(migrationFailure.body), /private database detail/);
    assert.equal(env.calls(), 0, 'missing migration is diagnosed before calling AI');
    env = setup();
    let sequence = 0;
    const budgets = [];
    globalThis.fetch = async (_url, options) => {
      const input = JSON.parse(options.body);
      assert.deepEqual(input.response_format, { type: 'json_object' });
      budgets.push(input.max_tokens);
      const step = sequence++;
      const content = step < 2 ? { keywords: ['SQL'] } : step === 2 ? { name: 'Recovered', experience: [] } : {};
      return { status: 200, ok: true, json: async () => ({ choices: [{ finish_reason: step === 0 ? 'length' : 'stop', message: { content: JSON.stringify(content) } }] }) };
    };
    const recovered = await request(body(1));
    assert.equal(recovered.code, 200);
    assert.equal(budgets[1], budgets[0] * 2, 'truncated JSON is retried with more token budget');
    assert.equal(env.jobs.size, 1, 'model retries reserve only one credit');
    env = setup();
    let reads = 0;
    globalThis.fetch = async (_url, options) => {
      const step = reads++;
      assert.equal(JSON.parse(options.body).stream, false);
      if (step === 1) return { status: 200, ok: true, headers: new Headers({ 'content-type': 'text/html' }), json: async () => { throw new SyntaxError('private HTML payload'); } };
      const content = step === 0 ? { keywords: ['SQL'] } : step === 2 ? { name: 'Recovered from interrupted body', experience: [] } : {};
      return { status: 200, ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) };
    };
    assert.equal((await request(body(1))).code, 200, 'interrupted HTTP body during tailoring is retried');
    assert.equal(reads, 4);
    assert.equal(env.jobs.size, 1);
    assert.equal([...env.jobs.values()][0].state, 'completed');
    env = setup();
    let failures = 0;
    globalThis.fetch = async () => { failures++; return { status: 200, ok: true, headers: new Headers({ 'content-type': 'text/html' }), json: async () => { throw new SyntaxError('private HTML payload'); } }; };
    const unreadable = await request(body(1));
    assert.equal(unreadable.body.code, 'PROVIDER_RESPONSE');
    assert.equal(failures, 3, 'persistent unreadable bodies use bounded retries');
    assert.doesNotMatch(JSON.stringify(unreadable.body), /private HTML payload/);
    assert.equal([...env.jobs.values()][0].state, 'failed', 'read failures release the same trial reservation');
    env = setup();
    globalThis.fetch = async () => ({ status: 401, ok: false });
    const badKey = await request(body(1));
    assert.equal(badKey.body.code, 'PROVIDER_401');
    assert.equal(badKey.body.stage, 'job analysis');
    assert.match(badKey.body.error, /API key/);
    assert.equal((await request(body(1), 'GET')).code, 405);
    assert.equal((await request({ ...body(2), master: '' })).code, 400);
  } finally { globalThis.fetch = originalFetch; delete globalThis.trialTest; delete process.env.OPENAI_API_KEY; }
});

test('model JSON handles fences and trailing commas without changing quoted resume content', () => {
  assert.deepEqual(parseModelJSON('Here is the JSON: {"name":"Test",}'), { name: 'Test' });
  assert.deepEqual(parseModelJSON('{"name":"keep , } inside a string",}'), { name: 'keep , } inside a string' });
  assert.throws(() => parseModelJSON('{"name":'), { code: 'MODEL_JSON' });
  assert.throws(() => parseModelJSON(''), { code: 'MODEL_EMPTY' });
});

test('provider timeout stays active while downloading the response body', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, { signal }) => ({ status: 200, ok: true, json: () => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }) });
    await assert.rejects(fetchTimeout('https://example.invalid', {}, 25), { code: 'PROVIDER_TIMEOUT' });
  } finally { globalThis.fetch = saved; }
});

test('Google array-wrapped invalid API key errors are classified without exposing provider text', () => {
  const failure = classifyProviderFailure('gemini', 400, [{ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Please pass a valid API key' } }]);
  assert.equal(failure.code, 'PROVIDER_401');
  assert.equal(failure.httpStatus, 400);
  assert.match(failure.message, /rejected the API key/);
  const details = classifyProviderFailure('gemini', 400, { error: { message: 'redacted', details: [{ reason: 'API_KEY_INVALID' }] } });
  assert.equal(details.code, 'PROVIDER_401');
  assert.equal(classifyProviderFailure('gemini', 400, null).code, 'PROVIDER_400');
});

test('the full Gemini tailoring pipeline uses the native endpoint and normalizes its response', async () => {
  const nativeSource = source.replace(/const PROVIDERS = \[[\s\S]*?\n\];/, 'const PROVIDERS = [{name: "gemini", model: "gemini-3.8-flash", key: "test-only"}];');
  const { default: nativeHandler } = await import('data:text/javascript;base64,' + Buffer.from(nativeSource).toString('base64'));
  const saved = globalThis.fetch;
  try {
    const env = setup();
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.match(url, /models\/gemini-3\.8-flash:generateContent$/);
      assert.equal(options.headers['x-goog-api-key'], 'test-only');
      const input = JSON.parse(options.body);
      assert.equal(input.generationConfig.responseMimeType, 'application/json');
      const system = input.systemInstruction.parts[0].text;
      const output = system === 'analyze' ? { keywords: ['SQL'] } : system === 'tailor' ? { name: 'Native Result', experience: [] } : {};
      return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] }) };
    };
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await nativeHandler({ method: 'POST', body: body(1) }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.tailored.name, 'Native Result');
    assert.equal(calls, 3);
    assert.equal(env.jobs.size, 1);
  } finally { globalThis.fetch = saved; delete globalThis.trialTest; }
});

test('GitHub tokens are not used for AI without explicit opt-in, and provider selection is enforced', () => {
  const providers = [{ name: 'gemini', key: 'test-gemini' }, { name: 'gpt', key: 'github-repository-token' }];
  assert.deepEqual(selectProviders(providers, {}).map(p => p.name), ['gemini']);
  assert.deepEqual(selectProviders(providers, { ENABLE_GITHUB_MODELS: 'true' }).map(p => p.name), ['gemini', 'gpt']);
  assert.deepEqual(selectProviders(providers, { ENABLE_GITHUB_MODELS: 'true', AI_PROVIDER: 'gemini' }).map(p => p.name), ['gemini']);
  assert.equal(selectProviders(providers, { AI_PROVIDER: 'openai' }).length, 0);
});

test('a plain-text GitHub fallback cannot mask an earlier Gemini rejection', async () => {
  const previousEnabled = process.env.ENABLE_GITHUB_MODELS;
  const previousSelected = process.env.AI_PROVIDER;
  const savedFetch = globalThis.fetch;
  try {
    process.env.ENABLE_GITHUB_MODELS = 'true'; delete process.env.AI_PROVIDER;
    const mixedSource = source.replace(/const PROVIDERS = \[[\s\S]*?\n\];/, 'const PROVIDERS = [{name: "gemini", model: "gemini-3.8-flash", key: "test-gemini"}, {name: "gpt", endpoint: "https://example.invalid/github", model: "test-model", key: "test-github"}];');
    const { default: mixedHandler } = await import('data:text/javascript;base64,' + Buffer.from(mixedSource).toString('base64'));
    setup();
    globalThis.fetch = async url => url.includes('generativelanguage')
      ? { status: 403, ok: false, json: async () => ({ error: { code: 403 } }) }
      : { status: 200, ok: true, headers: new Headers({ 'content-type': 'text/plain' }), json: async () => { throw new SyntaxError('private upstream error'); } };
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await mixedHandler({ method: 'POST', body: body(1) }, res);
    assert.equal(res.body.code, 'PROVIDER_403');
    assert.equal(res.body.diagnostic.provider, 'gemini');
    assert.deepEqual(res.body.diagnostic.attempts.map(item => item.provider), ['gemini','gpt']);
    assert.equal(res.body.diagnostic.attempts[1].responseType, 'text/plain');
    assert.doesNotMatch(JSON.stringify(res.body), /private upstream error|test-github|test-gemini/);
  } finally {
    globalThis.fetch = savedFetch; delete globalThis.trialTest;
    if (previousEnabled === undefined) delete process.env.ENABLE_GITHUB_MODELS; else process.env.ENABLE_GITHUB_MODELS = previousEnabled;
    if (previousSelected === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previousSelected;
  }
});
