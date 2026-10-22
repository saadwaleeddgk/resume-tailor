import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, normalizeIp, ipQuotaKey } from '../lib/ip.js';

test('IP quota canonicalization, trusted headers, and keyed storage', () => {
  const savedVercel = process.env.VERCEL, savedSecret = process.env.IP_QUOTA_SECRET;
  try {
    delete process.env.VERCEL;
    process.env.IP_QUOTA_SECRET = 'test-secret';
    const req = { headers: { 'x-forwarded-for': '203.0.113.99', 'x-real-ip': '203.0.113.88' }, socket: { remoteAddress: '::ffff:192.0.2.1' } };
    assert.equal(clientIp(req), '192.0.2.1', 'direct servers ignore spoofed forwarded headers');
    const hash = ipQuotaKey(req);
    assert.match(hash, /^[a-f0-9]{64}$/);
    req.headers['x-forwarded-for'] = '198.51.100.5';
    assert.equal(ipQuotaKey(req), hash, 'forged headers cannot create a new local quota');
    assert.equal(normalizeIp('2001:0db8:0000:0:0:0:0:1'), normalizeIp('2001:db8::1'));
    assert.equal(normalizeIp('::ffff:c000:201'), '192.0.2.1');
    assert.throws(() => normalizeIp('not-an-ip'));
    assert.throws(() => normalizeIp('fe80::1%eth0'));
    process.env.VERCEL = '1';
    assert.equal(clientIp(req), '198.51.100.5');
    assert.notEqual(ipQuotaKey(req), hash);
    req.headers['x-forwarded-for'] = '1.2.3.4, 5.6.7.8';
    assert.throws(() => clientIp(req), 'ambiguous forwarding chains fail closed');
    delete req.headers['x-forwarded-for'];
    assert.throws(() => clientIp(req), 'Vercel must supply a trusted client IP');
  } finally {
    if (savedVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = savedVercel;
    if (savedSecret === undefined) delete process.env.IP_QUOTA_SECRET; else process.env.IP_QUOTA_SECRET = savedSecret;
  }
});
