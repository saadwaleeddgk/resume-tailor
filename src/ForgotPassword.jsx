import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createPasswordRecovery } from './passwordRecovery.js';

export default function ForgotPassword({ onBack }) {
  const [flow] = useState(() => {
    const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { storageKey: 'resume-tailor-password-recovery', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return createPasswordRecovery(client.auth);
  });
  const [stage, setStage] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(n => n - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const send = async () => {
    if (busy || cooldown) return;
    setBusy(true); setMessage('');
    try {
      await flow.send(email, window.location.origin + '/');
      setStage('code'); setCode(''); setCooldown(60);
      setMessage('If an account exists for this email, a password reset code has been sent. Check your inbox and spam folder.');
    } catch (error) { setMessage(error.message || 'Could not send a code. Please try again.'); }
    finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    if (stage === 'email') { await send(); return; }
    setBusy(true); setMessage('');
    try {
      if (stage === 'code') {
        await flow.verify(code);
        setCode(''); setStage('password'); setMessage('Email verified. Choose your new password.');
      } else {
        await flow.save(password, confirm);
        setPassword(''); setConfirm(''); setStage('done');
        setMessage('Your password has been reset. Sign in with your new password and email code.');
      }
    } catch (error) { setMessage(error.message || 'Could not complete the reset. Please try again.'); }
    finally { setBusy(false); }
  };
  const back = async () => { if (busy) return; await flow.cancel(); onBack(); };
  return <div style={{ maxWidth: 520, margin: '50px auto', padding: 20 }}><div className="rb-card"><div className="rb-cb">
    <h2>{stage === 'done' ? 'Password reset' : 'Reset your password'}</h2>
    <p className="rb-hint">{stage === 'email' ? 'We will email you a one-time code to verify your identity.' : stage === 'code' ? 'Enter the password reset code sent to ' + email.trim() : 'Your credits and approval status stay the same.'}</p>
    {stage !== 'done' && <form onSubmit={submit}>
      {stage === 'email' && <><label className="rb-lbl" htmlFor="reset-email">Account email</label><input id="reset-email" className="rb-in" type="email" required autoComplete="email" value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></>}
      {stage === 'code' && <><label className="rb-lbl" htmlFor="reset-code">Verification code</label><input id="reset-code" className="rb-in" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} value={code} disabled={busy} onChange={e => setCode(e.target.value)} /></>}
      {stage === 'password' && <><label className="rb-lbl" htmlFor="reset-password">New password</label><input id="reset-password" className="rb-in" type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /><label className="rb-lbl" htmlFor="reset-confirm">Confirm new password</label><input id="reset-confirm" className="rb-in" type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={confirm} disabled={busy} onChange={e => setConfirm(e.target.value)} /></>}
      <button className="rb-btn rb-btn-pri" style={{ marginTop: 12 }} disabled={busy || (stage === 'email' && cooldown > 0)}>{busy ? 'Please wait...' : stage === 'email' ? 'Send reset code' : stage === 'code' ? 'Verify code' : 'Save new password'}</button>
      {stage === 'code' && <><button className="rb-btn rb-btn-ghost" type="button" onClick={send} disabled={busy || cooldown > 0}>{cooldown ? 'Resend in ' + cooldown + 's' : 'Resend code'}</button><button className="rb-btn rb-btn-ghost" type="button" disabled={busy} onClick={async () => { await flow.cancel(); setStage('email'); setCode(''); setMessage(''); }}>Change email</button></>}
    </form>}
    <p className="rb-hint" role="status" aria-live="polite">{message}</p>
    <button className="rb-btn rb-btn-ghost rb-btn-sm" disabled={busy} onClick={back}>{stage === 'done' ? 'Sign in' : 'Back to sign in'}</button>
  </div></div></div>;
}
