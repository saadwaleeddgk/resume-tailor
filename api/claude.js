const PROVIDERS = [
  { name: "groq",   endpoint: "https://api.groq.com/openai/v1/chat/completions",                          key: process.env.GROQ_API_KEY,   model: "llama-3.3-70b-versatile" },
  { name: "gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: process.env.GEMINI_API_KEY, model: "gemini-2.5-flash-lite" },
  { name: "gpt",    endpoint: "https://models.github.ai/inference/chat/completions",                      key: process.env.GITHUB_TOKEN,   model: "openai/gpt-4o-mini" },
];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
}
async function callLLM(body) {
  const active = PROVIDERS.filter(p => p.key);
  if (!active.length) return { error: "No API keys configured in the project settings." };
  for (let round = 0; round < 2; round++) {
    for (const p of active) {
      try {
        const r = await fetchTimeout(p.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": "Bearer " + p.key },
          body: JSON.stringify({ ...body, model: p.model }),
        }, 25000);
        if (r.status === 429 || r.status >= 500) continue;
        return { r, provider: p.name };
      } catch (e) { /* timed out / errored — try next provider */ }
    }
    if (round === 0) await sleep(4000);
  }
  return { error: "All providers are busy — try again in a moment." };
}
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    const body = req.body || {};
    const messages = [];
    if (body.system) messages.push({ role: "system", content: body.system });
    (body.messages || []).forEach(m => messages.push({ role: m.role, content: m.content }));
    const { r, provider, error } = await callLLM({ max_tokens: 8000, messages });
    if (!r) { res.status(503).json({ error }); return; }
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    const text = data?.choices?.[0]?.message?.content || "";
    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) { res.status(500).json({ error: String(e) }); }
}