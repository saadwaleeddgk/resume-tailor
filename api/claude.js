const PROVIDERS = [
  { name: "openai", endpoint: "https://api.openai.com/v1/chat/completions",                              key: process.env.OPENAI_API_KEY, model: "gpt-4o-mini" },
  { name: "groq",   endpoint: "https://api.groq.com/openai/v1/chat/completions",                          key: process.env.GROQ_API_KEY,   model: "llama-3.3-70b-versatile" },
  { name: "gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: process.env.GEMINI_API_KEY, model: "gemini-2.5-flash-lite" },
  { name: "gpt",    endpoint: "https://models.github.ai/inference/chat/completions",                      key: process.env.GITHUB_TOKEN,   model: "openai/gpt-4o-mini" },
];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TIMEOUT_MS = 60000;
const ROUNDS = 3;
const TOKEN_CAP = 8000;
const clampTokens = (n) => {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v) || v <= 0) return 4000;
  return Math.min(Math.max(v, 256), TOKEN_CAP);
};

async function fetchTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
}
async function callLLM(body) {
  const active = PROVIDERS.filter(p => p.key);
  if (!active.length) return { error: "No API keys configured in the project settings." };
  const tried = [];
  for (let round = 0; round < ROUNDS; round++) {
    for (const p of active) {
      try {
        const r = await fetchTimeout(p.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": "Bearer " + p.key },
          body: JSON.stringify({ ...body, model: p.model }),
        }, TIMEOUT_MS);
        if (r.status === 429 || r.status >= 500) {
          const ra = parseInt(r.headers.get("retry-after") || "0", 10);
          tried.push(`${p.name}:${r.status}`);
          if (ra > 0 && ra <= 10) await sleep(ra * 1000);
          continue;
        }
        return { r, provider: p.name };
      } catch (e) { tried.push(`${p.name}:timeout`); }
    }
    if (round < ROUNDS - 1) await sleep(2000 + round * 3000);
  }
  return { error: "All providers are busy — try again in a moment.", tried };
}
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    const body = req.body || {};
    const messages = [];
    if (body.system) messages.push({ role: "system", content: body.system });
    (body.messages || []).forEach(m => messages.push({ role: m.role, content: m.content }));
    const { r, provider, error, tried } = await callLLM({ max_tokens: clampTokens(body.max_tokens), messages });
    if (!r) { res.status(503).json({ error, tried }); return; }
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    const text = data?.choices?.[0]?.message?.content || "";
    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) { res.status(500).json({ error: String(e) }); }
}