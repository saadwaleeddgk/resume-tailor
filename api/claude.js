import { buildGeminiRequest, normalizeGeminiResponse } from "../lib/gemini.js";
import { ipQuotaKey } from "../lib/ip.js";
export const maxDuration = 300;
import { requireUser } from "../lib/auth.js";
import { adminClient, getAccount, isApproved } from "../lib/access.js";
import { SYS_JD, SYS_TAILOR, SYS_ASSESS } from "../lib/prompts.js";
import { createHash } from "node:crypto";

const PROVIDERS = [
  { name: "openai", endpoint: "https://api.openai.com/v1/chat/completions",                              key: process.env.OPENAI_API_KEY, model: "gpt-4o-mini" },
  { name: "groq",   endpoint: "https://api.groq.com/openai/v1/chat/completions",                          key: process.env.GROQ_API_KEY,   model: "llama-3.3-70b-versatile" },
  { name: "gemini", key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || "gemini-3.8-flash" },
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

export async function fetchTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const response = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!response.ok) {
      // Google can wrap API errors in an array, including invalid-key HTTP 400s.
      let data = null;
      try { data = await response.json(); } catch { /* HTML/empty errors still retain their HTTP status */ }
      return { response, data };
    }
    try {
      // Keep the timeout active until the entire body has arrived, not just headers.
      const data = await response.json();
      return { response, data };
    } catch (cause) {
      throw generationError(ctrl.signal.aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_RESPONSE",
        ctrl.signal.aborted ? "The AI response timed out while downloading. Please retry." : "The AI connection returned an incomplete or non-JSON response after automatic retries. Please try again shortly.", {
          httpStatus: response.status,
          contentType: response.headers?.get("content-type") || "unknown",
          transportCode: cause.cause?.code || cause.name,
        });
    }
  } finally { clearTimeout(t); }
}
async function callLLM(body, deadline = Date.now() + 240000) {
  let lastResponse, lastProvider, lastFailure, lastProviderFailure;
  const disabled = new Set();
  const active = PROVIDERS.filter(p => p.key);
  if (!active.length) return { error: "No API keys configured in the project settings." };
  const tried = [];
  for (let round = 0; round < ROUNDS; round++) {
    for (const p of active) {
      if (disabled.has(p.name)) continue;
      if (Date.now() >= deadline) return { failure: lastFailure || generationError("PROVIDER_TIMEOUT", "The AI generation deadline was reached. Please try again."), tried };
      try {
        const request = p.name === "gemini" ? buildGeminiRequest(body, p.model, p.key) : {
          url: p.endpoint,
          options: {
            method: "POST",
            headers: { "content-type": "application/json", "authorization": "Bearer " + p.key },
            body: JSON.stringify({ ...body, stream: false, model: p.model }),
          },
        };
        const { response, data: received } = await fetchTimeout(request.url, request.options, Math.min(TIMEOUT_MS, Math.max(1, deadline - Date.now())));
        const data = p.name === "gemini" ? normalizeGeminiResponse(received) : received;
        const envelope = Array.isArray(data) ? data[0] : data;
        const embeddedError = envelope?.error;
        const embeddedStatus = Number(embeddedError?.code);
        const r = response.ok && embeddedError ? { ok: false, status: embeddedStatus >= 400 && embeddedStatus <= 599 ? embeddedStatus : 502, headers: response.headers } : response;
        if (!r.ok) {
          lastResponse = r; lastProvider = p.name; lastFailure = null;
          lastProviderFailure = classifyProviderFailure(p.name, r.status, data);
          if (r.status !== 429 && r.status < 500) {
            tried.push(`${p.name}:${r.status}`); disabled.add(p.name); continue;
          }
          const ra = parseInt(r.headers.get("retry-after") || "0", 10);
          tried.push(`${p.name}:${r.status}`);
          if (ra > 0 && ra <= 10) await sleep(ra * 1000);
          continue;
        }
        return { r, data, provider: p.name };
      } catch (error) {
        const code = error.code || "PROVIDER_NETWORK";
        tried.push(p.name + ":" + code);
        lastResponse = null;
        lastFailure = error.code ? error : generationError("PROVIDER_NETWORK", "The AI provider connection failed after automatic retries. Please try again shortly.");
        lastFailure.provider = p.name;
      }
    }
    if (disabled.size === active.length) break;
    if (round < ROUNDS - 1) await sleep(2000 + round * 3000);
  }
  if (lastFailure) return { failure: lastFailure, tried };
  if (lastResponse) return { r: lastResponse, provider: lastProvider, failure: lastProviderFailure, tried };
  return { error: "AI providers could not be reached before the deadline.", tried };
}
function generationError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}
function providerFailure(provider, status) {
  const name = provider || "AI provider";
  const messages = {
    400: name + " rejected the generation settings. Check the configured model and request parameters.",
    401: name + " rejected the API key. Check the backend environment key and restart or redeploy.",
    403: name + " denied access to this model. Check API permissions and billing.",
    404: name + " could not find the configured model. Check its model name and availability.",
    429: name + " has reached its rate or usage limit. Wait or check its quota and billing.",
  };
  return generationError("PROVIDER_" + status, messages[status] || name + " is unavailable (HTTP " + status + "). Please try again.", { provider, httpStatus: status });
}
export function classifyProviderFailure(provider, status, body) {
  const error = (Array.isArray(body) ? body[0] : body)?.error;
  const description = typeof error?.message === "string" ? error.message : "";
  const reason = error?.details?.find?.(entry => typeof entry?.reason === "string")?.reason || "";
  if (/valid api key|api.?key.*(?:invalid|not valid|expired)|API_KEY_INVALID/i.test(description + " " + reason)) {
    const failure = providerFailure(provider, 401);
    failure.httpStatus = status;
    return failure;
  }
  return providerFailure(provider, status);
}
export function parseModelJSON(text) {
  if (typeof text !== "string" || !text.trim()) throw generationError("MODEL_EMPTY", "The AI returned no resume content. Please retry.");
  const clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw generationError("MODEL_JSON", "The AI returned an incomplete or invalid JSON response. Please retry.");
  const candidate = clean.slice(start, end + 1);
  let result;
  try { result = JSON.parse(candidate); }
  catch {
    // Remove trailing commas outside quoted strings, without altering resume text.
    const repaired = candidate.replace(/("(?:\\.|[^"\\])*")|,\s*(?=[}\]])/g, (match, string) => string || "");
    try { result = JSON.parse(repaired); }
    catch { throw generationError("MODEL_JSON", "The AI returned an incomplete or invalid JSON response. Please retry."); }
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) throw generationError("MODEL_JSON", "The AI returned an unexpected response format. Please retry.");
  return result;
}
async function generateJSON(system, content, tokens, deadline) {
  let budget = Math.max(4000, tokens);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { r, data: body, provider, error, failure } = await callLLM({ max_tokens: budget, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content }] }, deadline);
    if (!r) throw failure || generationError("PROVIDER_UNREACHABLE", error);
    if (!r.ok) throw failure || providerFailure(provider, r.status);
    const choice = body?.choices?.[0];
    if (choice?.finish_reason === "length") {
      if (attempt === 0 && Date.now() < deadline) { budget *= 2; continue; }
      throw generationError("MODEL_TRUNCATED", "The AI response reached its token limit. Try a shorter source resume or retry.", { provider });
    }
    if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) throw generationError("MODEL_BLOCKED", "The AI provider declined this content. Review the resume and job description.", { provider });
    try { return parseModelJSON(choice?.message?.content); }
    catch (error) {
      if (attempt === 0 && error.code === "MODEL_JSON" && Date.now() < deadline) continue;
      throw error;
    }
  }
}
function publicFailure(error, stage) {
  if (error.code === "AUTH_CONFIG_MISSING") return { code: error.code, error: error.message };
  if (["PGRST202", "42883"].includes(error.code)) return { code: "QUOTA_MIGRATION_REQUIRED", error: "Supabase quota functions are out of date. Run 20261021_verified_ip_limits.sql in the connected Supabase project, then retry." };
  if (["42P01", "PGRST205"].includes(error.code)) return { code: "DATABASE_MIGRATION_REQUIRED", error: "Supabase trial tables are missing. Run both trial access SQL migrations in the connected project." };
  if (error.code === "42501") return { code: "DATABASE_PERMISSIONS", error: "Supabase denied database access. Check the backend service-role key and migration permissions." };
  if (/^(MODEL_|PROVIDER_)/.test(error.code || "")) return { code: error.code, error: error.message };
  const messages = {
    account: "Could not load your account from Supabase. Check the server database configuration and connection.",
    quota: "Could not reserve a resume credit in Supabase. Check the quota migration and server logs.",
    saving: "The resume was generated but Supabase could not save it. Check database permissions and connection, then retry.",
  };
  return { code: "GENERATION_" + stage.toUpperCase(), error: messages[stage] || "Could not complete the " + stage + " step. Please retry." };
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Resume-API-Version", "gemini-native-20261022");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const user = await requireUser(req, res);
  if (!user) return;
  let jobId = null;
  let reserved = false;
  let stage = "account";
  try {
    const account = await getAccount(user);
    const body = req.body || {};
    if (body.action === "tailor") {
      if (typeof body.master !== "string" || typeof body.jd !== "string" || !body.master.trim() || !body.jd.trim() || body.master.length > 80000 || body.jd.length > 40000 || !/^[0-9a-f-]{36}$/i.test(body.requestId || "")) return res.status(400).json({ error: "Provide a resume, job description, and valid request ID." });
      // Bind idempotency to the owner and request contents, not a client-chosen ID alone.
      const hash = createHash("sha256").update(user.id + body.requestId + body.master + body.jd).digest("hex");
      jobId = hash.slice(0,8) + "-" + hash.slice(8,12) + "-" + hash.slice(12,16) + "-" + hash.slice(16,20) + "-" + hash.slice(20,32);
      stage = "quota";
      const { data: slot, error } = await adminClient().rpc("reserve_tailoring", { p_user: user.id, p_job: jobId, p_ip_key: isApproved(account) ? null : ipQuotaKey(req) });
      if (error) throw error;
      if (!slot || typeof slot !== "object") throw new Error("Invalid quota response");
      if (slot.error) return res.status(slot.busy ? 409 : slot.code === "IP_DAILY_LIMIT" ? 429 : 403).json({ error: slot.error, code: slot.code, resetAt: slot.resetAt });
      if (slot.result) return res.json(slot.result);
      reserved = true;
      const deadline = Date.now() + 240000;
      stage = "job analysis";
      const analysis = await generateJSON(SYS_JD, body.jd, 2500, deadline);
      if (!Array.isArray(analysis.keywords)) throw generationError("MODEL_SCHEMA", "The AI job analysis is missing keywords. Please retry.");
      stage = "resume tailoring";
      const tailored = await generateJSON(SYS_TAILOR, "MASTER RESUME:\n" + body.master + "\n\nJD ANALYSIS:\n" + JSON.stringify({ ...analysis, company: "" }), 8000, deadline);
      if (typeof tailored.name !== "string" || !Array.isArray(tailored.experience)) throw generationError("MODEL_SCHEMA", "The AI resume response is missing the name or experience list. Please retry.");
      // Scoring failure must not discard an otherwise completed resume.
      let assess = {};
      try { assess = await generateJSON(SYS_ASSESS, "JD ANALYSIS:\n" + JSON.stringify(analysis) + "\n\nTAILORED RESUME:\n" + JSON.stringify(tailored), 4000, deadline); } catch { /* keyword scoring remains available */ }
      const result = { analysis, tailored, assess };
      stage = "saving";
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
    const { r, data, error, tried, failure } = await callLLM({ max_tokens: clampTokens(body.max_tokens), messages });
    if (!r) { if (failure) throw failure; return res.status(503).json({ error, tried }); }
    if (!r.ok) throw failure || providerFailure(undefined, r.status);
    return res.json({ content: [{ type: "text", text: data?.choices?.[0]?.message?.content || "" }] });
  } catch (error) {
    if (reserved) {
      try { await adminClient().from("tailoring_jobs").update({ state: "failed" }).eq("id",jobId).eq("user_id",user.id).eq("state","running"); } catch { /* stale reservations expire */ }
    }
    const failure = publicFailure(error, stage);
    // Never log resumes, prompts, keys, or raw provider/database response bodies.
    console.error("Generation failed:", { stage, code: failure.code, databaseCode: error.code, provider: error.provider, httpStatus: error.httpStatus, contentType: error.contentType, transportCode: error.transportCode, jobId });
    return res.status(503).json({ ...failure, stage, diagnostic: {
      apiVersion: "gemini-native-20261022",
      provider: error.provider,
      httpStatus: error.httpStatus,
      responseType: error.contentType,
      transportCode: error.transportCode,
    } });
  }
}
