export const maxDuration = 300;
import { requireUser } from "../lib/auth.js";
import { adminClient, getAccount, isApproved } from "../lib/access.js";
import { SYS_JD, SYS_TAILOR, SYS_ASSESS } from "../lib/prompts.js";
import { createHash } from "node:crypto";

const PROVIDERS = [
  { name: "openai", endpoint: "https://api.openai.com/v1/chat/completions",                              key: process.env.OPENAI_API_KEY, model: "gpt-4o-mini" },
  { name: "groq",   endpoint: "https://api.groq.com/openai/v1/chat/completions",                          key: process.env.GROQ_API_KEY,   model: "llama-3.3-70b-versatile" },
  { name: "gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: process.env.GEMINI_API_KEY, model: "gemini-3.8-flash" },
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
async function callLLM(body, deadline = Date.now() + 240000) {
  const active = PROVIDERS.filter(p => p.key);
  if (!active.length) return { error: "No API keys configured in the project settings." };
  const tried = [];
  for (let round = 0; round < ROUNDS; round++) {
    for (const p of active) {
      if (Date.now() >= deadline) return { error: "Generation deadline exceeded. Please try again." };
      try {
        const r = await fetchTimeout(p.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": "Bearer " + p.key },
          body: JSON.stringify({ ...body, model: p.model }),
        }, Math.min(TIMEOUT_MS, Math.max(1, deadline - Date.now())));
        if (r.status === 429 || r.status >= 500) {
          const ra = parseInt(r.headers.get("retry-after") || "0", 10);
          tried.push(`${p.name}:${r.status}`);
          if (ra > 0 && ra <= 10) await sleep(ra * 1000);
          continue;
        }
        return { r, provider: p.name };
      } catch { tried.push(`${p.name}:timeout`); }
    }
    if (round < ROUNDS - 1) await sleep(2000 + round * 3000);
  }
  return { error: "All providers are busy — try again in a moment.", tried };
}
function parseModelJSON(text) {
  const clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const result = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid model response");
  return result;
}
async function generateJSON(system, content, tokens, deadline) {
  const { r, error } = await callLLM({ max_tokens: tokens, messages: [{ role: "system", content: system }, { role: "user", content }] }, deadline);
  if (!r) throw new Error(error);
  const body = await r.json();
  if (!r.ok) throw new Error("The AI provider could not complete this resume.");
  return parseModelJSON(body?.choices?.[0]?.message?.content || "");
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const user = await requireUser(req, res, { allowAnonymous: true });
  if (!user) return;
  let jobId = null;
  let reserved = false;
  try {
    const account = await getAccount(user);
    const body = req.body || {};
    if (body.action === "tailor") {
      if (typeof body.master !== "string" || typeof body.jd !== "string" || !body.master.trim() || !body.jd.trim() || body.master.length > 80000 || body.jd.length > 40000 || !/^[0-9a-f-]{36}$/i.test(body.requestId || "")) return res.status(400).json({ error: "Provide a resume, job description, and valid request ID." });
      // Bind idempotency to the owner and request contents, not a client-chosen ID alone.
      const hash = createHash("sha256").update(user.id + body.requestId + body.master + body.jd).digest("hex");
      jobId = hash.slice(0,8) + "-" + hash.slice(8,12) + "-" + hash.slice(12,16) + "-" + hash.slice(16,20) + "-" + hash.slice(20,32);
      const { data: slot, error } = await adminClient().rpc("reserve_tailoring", { p_user: user.id, p_job: jobId });
      if (error) throw error;
      if (slot.error) return res.status(slot.busy ? 409 : 403).json({ error: slot.error });
      if (slot.result) return res.json(slot.result);
      reserved = true;
      const deadline = Date.now() + 240000;
      const analysis = await generateJSON(SYS_JD, body.jd, 2500, deadline);
      if (!Array.isArray(analysis.keywords)) throw new Error("Invalid job analysis. Please try again.");
      const tailored = await generateJSON(SYS_TAILOR, "MASTER RESUME:\n" + body.master + "\n\nJD ANALYSIS:\n" + JSON.stringify({ ...analysis, company: "" }), 8000, deadline);
      if (typeof tailored.name !== "string" || !Array.isArray(tailored.experience)) throw new Error("Invalid resume response. Please try again.");
      // Scoring failure must not discard an otherwise completed resume.
      let assess = {};
      try { assess = await generateJSON(SYS_ASSESS, "JD ANALYSIS:\n" + JSON.stringify(analysis) + "\n\nTAILORED RESUME:\n" + JSON.stringify(tailored), 4000, deadline); } catch { /* keyword scoring remains available */ }
      const result = { analysis, tailored, assess };
      const { error: saveError } = await adminClient().from("tailoring_jobs").update({ state: "completed", result }).eq("id",jobId).eq("user_id",user.id);
      if (saveError) throw saveError;
      reserved = false;
      return res.json(result);
    }
    if (!isApproved(account) || user.is_anonymous) return res.status(403).json({ error: "This feature requires an approved account. Trial access includes four tailored resumes and exports." });
    if (!Array.isArray(body.messages) || body.messages.length > 20) return res.status(400).json({ error: "Invalid messages" });
    const messages = [];
    if (body.system) messages.push({ role: "system", content: body.system });
    body.messages.forEach(m => messages.push({ role: m.role, content: m.content }));
    const { r, error, tried } = await callLLM({ max_tokens: clampTokens(body.max_tokens), messages });
    if (!r) return res.status(503).json({ error, tried });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "The AI provider could not complete the request." });
    return res.json({ content: [{ type: "text", text: data?.choices?.[0]?.message?.content || "" }] });
  } catch (error) {
    if (reserved) {
      try { await adminClient().from("tailoring_jobs").update({ state: "failed" }).eq("id",jobId).eq("user_id",user.id).eq("state","running"); } catch { /* stale reservations expire */ }
    }
    console.error("Generation failed:", error.message);
    return res.status(503).json({ error: "Could not complete your request. Please try again. Failed tailoring does not use a free resume." });
  }
}
