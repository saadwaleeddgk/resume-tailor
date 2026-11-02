import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordRecovery } from '../src/passwordRecovery.js';

function fixture() {
  const calls = [];
  let session = null;
  const user = { id: 'existing-user', email: 'user@example.com' };
  const auth = {
    async resetPasswordForEmail(email, options) { calls.push(['send', email, options]); return { error: null }; },
    async verifyOtp(input) { calls.push(['verify', input]); if (input.token !== '123456') return { error: new Error('Invalid or expired code') }; session = { user }; return { data: { user, session }, error: null }; },
    async getSession() { return { data: { session } }; },
    async updateUser(input) { calls.push(['update', input]); return { error: null }; },
    async signOut(options) { calls.push(['signOut', options]); session = null; return { error: null }; },
  };
  return { flow: createPasswordRecovery(auth), calls, expire() { session = null; } };
}

test('password reset requires a valid recovery OTP and updates only the existing password', async () => {
  const { flow, calls } = fixture();
  await assert.rejects(flow.save('new-password-123', 'new-password-123'), /Verify your email/);
  await flow.send(' USER@example.com ', 'http://localhost:5173/');
  assert.deepEqual(calls[0], ['send', 'user@example.com', { redirectTo: 'http://localhost:5173/' }]);
  await assert.rejects(flow.verify('000000'), /Invalid or expired/);
  await assert.rejects(flow.save('new-password-123', 'new-password-123'), /Verify your email/);
  assert.equal(calls.some(([action]) => action === 'update'), false);
  await flow.verify('123456');
  assert.equal(calls.at(-1)[1].type, 'recovery');
  await assert.rejects(flow.save('short', 'short'), /10 and 128/);
  await assert.rejects(flow.save('new-password-123', 'different-password'), /do not match/);
  await flow.save('new-password-123', 'new-password-123');
  assert.deepEqual(calls.find(([action]) => action === 'update'), ['update', { password: 'new-password-123' }]);
  assert.deepEqual(calls.at(-1), ['signOut', { scope: 'local' }]);
  await assert.rejects(flow.save('another-password', 'another-password'), /Verify your email/);
});

test('expired sessions, resending codes, and canceling invalidate the password-reset authorization', async () => {
  const first = fixture();
  await first.flow.send('user@example.com', 'http://localhost:5173/');
  await first.flow.verify('123456');
  first.expire();
  await assert.rejects(first.flow.save('new-password-123', 'new-password-123'), /session expired/);
  assert.equal(first.calls.some(([action]) => action === 'update'), false);
  const second = fixture();
  await second.flow.send('user@example.com', 'http://localhost:5173/');
  await second.flow.verify('123456');
  await second.flow.send('user@example.com', 'http://localhost:5173/');
  await assert.rejects(second.flow.save('new-password-123', 'new-password-123'), /Verify your email/);
  await second.flow.verify('123456');
  await second.flow.cancel();
  await assert.rejects(second.flow.save('new-password-123', 'new-password-123'), /Verify your email/);
});
