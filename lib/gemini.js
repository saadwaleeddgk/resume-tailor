export function buildGeminiRequest(body, model, key) {
  const name = model.replace(/^models\//, '');
  if (!/^[a-z0-9._-]+$/i.test(name)) throw new Error('Invalid Gemini model identifier');
  const systems = [];
  const contents = [];
  for (const message of body.messages || []) {
    if (typeof message.content !== 'string') throw new Error('Gemini expects text messages');
    if (message.role === 'system') systems.push({ text: message.content });
    else contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] });
  }
  const generationConfig = { maxOutputTokens: body.max_tokens };
  if (body.response_format?.type === 'json_object') generationConfig.responseMimeType = 'application/json';
  if (/^gemini-[34]/.test(name)) generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
  else if (/^gemini-2\.5/.test(name)) generationConfig.thinkingConfig = { thinkingBudget: 1024 };
  return {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + name + ':generateContent',
    options: {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents, generationConfig, ...(systems.length ? { systemInstruction: { parts: systems } } : {}) }),
    },
  };
}
export function normalizeGeminiResponse(body) {
  // Keep provider error envelopes intact for safe status/key classification.
  if (!body || body.error || Array.isArray(body)) return body;
  const candidate = body.candidates?.[0];
  const blocked = body.promptFeedback?.blockReason || ['SAFETY','BLOCKLIST','PROHIBITED_CONTENT','SPII'].includes(candidate?.finishReason);
  return {
    choices: [{
      finish_reason: blocked ? 'content_filter' : candidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
      message: { content: (candidate?.content?.parts || []).filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('') },
    }],
  };
}
