import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PROVIDERS = [
  { name: "groq",   endpoint: "https://api.groq.com/openai/v1/chat/completions",                          key: process.env.GROQ_API_KEY,   model: "llama-3.3-70b-versatile" },
  { name: "gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: process.env.GEMINI_API_KEY, model: "gemini-2.5-flash-lite" },
  { name: "gpt",    endpoint: "https://models.github.ai/inference/chat/completions",                      key: process.env.GITHUB_TOKEN,   model: "openai/gpt-4o-mini" },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
console.log("Providers ready:", PROVIDERS.filter(p => p.key).map(p => p.name).join(", ") || "NONE — add keys to .env");

async function fetchTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function callLLM(body) {
  const active = PROVIDERS.filter(p => p.key);
  if (!active.length) return { error: "No API keys found in .env." };
  for (let round = 0; round < 2; round++) {
    for (const p of active) {
      try {
        const r = await fetchTimeout(p.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": "Bearer " + p.key },
          body: JSON.stringify({ ...body, model: p.model }),
        }, 20000);
        if (r.status === 429 || r.status >= 500) { console.log(`${p.name} busy (${r.status}) → next`); continue; }
        return { r, provider: p.name };
      } catch (e) { console.log(`${p.name} timed out / errored → next:`, String(e)); }
    }
    if (round === 0) { console.log("All providers busy; waiting 5s for one more pass…"); await sleep(5000); }
  }
  return { error: "All providers are busy or unreachable — wait a few seconds and try again." };
}

app.post("/api/claude", async (req, res) => {
  try {
    const messages = [];
    if (req.body.system) messages.push({ role: "system", content: req.body.system });
    (req.body.messages || []).forEach(m => messages.push({ role: m.role, content: m.content }));
    const { r, provider, error } = await callLLM({ max_tokens: 8000, messages });
    if (!r) { console.log("Failover failed:", error); return res.status(503).json({ error }); }
    const data = await r.json();
    if (!r.ok) { console.log(`${provider} said:`, JSON.stringify(data)); return res.status(r.status).json(data); }
    const text = data?.choices?.[0]?.message?.content || "";
    console.log(`✓ via ${provider} | ${text.length} chars`);
    res.json({ content: [{ type: "text", text }] });
  } catch (e) {
    console.log("Server error:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.listen(3001, () => console.log("AI backend running on http://localhost:3001"));