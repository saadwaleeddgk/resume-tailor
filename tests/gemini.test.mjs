import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiRequest, normalizeGeminiResponse } from '../lib/gemini.js';

test('native Gemini requests use Google authentication, system instructions and JSON MIME configuration', () => {
  const request = buildGeminiRequest({ max_tokens: 8000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Return JSON' }, { role: 'user', content: 'Job description' }] }, 'gemini-3.8-flash', 'test-key');
  assert.match(request.url, /models\/gemini-3\.8-flash:generateContent$/);
  assert.ok(!request.url.includes('test-key'));
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key');
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.maxOutputTokens, 8000);
  assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });
  assert.equal(body.systemInstruction.parts[0].text, 'Return JSON');
  assert.equal(body.contents[0].parts[0].text, 'Job description');
  assert.equal(body.stream, undefined);
  const plain = JSON.parse(buildGeminiRequest({ max_tokens: 1000, messages: [{ role: 'user', content: 'Cover letter' }] }, 'gemini-2.5-flash', 'test').options.body);
  assert.equal(plain.generationConfig.responseMimeType, undefined);
  assert.deepEqual(plain.generationConfig.thinkingConfig, { thinkingBudget: 1024 });
});
test('native responses preserve text, truncation, blocking, and errors', () => {
  const data = normalizeGeminiResponse({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'private reasoning', thought: true }, { text: '{"keywords":' }, { text: '["SQL"]}' }] } }] });
  assert.equal(data.choices[0].message.content, '{"keywords":["SQL"]}');
  assert.equal(data.choices[0].finish_reason, 'stop');
  assert.equal(normalizeGeminiResponse({ candidates: [{ finishReason: 'MAX_TOKENS' }] }).choices[0].finish_reason, 'length');
  assert.equal(normalizeGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } }).choices[0].finish_reason, 'content_filter');
  const failure = { error: { code: 429, message: 'Quota exceeded' } };
  assert.deepEqual(normalizeGeminiResponse(failure), failure);
});
