import { useEffect, useState } from 'react';

export default function TrialSignIn({ supabase, onSignIn }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(n => n - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const send = async () => {
    if (busy || cooldown) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + '/' } });
      if (error) throw error;
      setSent(true); setCooldown(60); setMessage('Check your email for the verification code.');
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
      if (error) throw error;
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  return <div style={{ maxWidth: 520, margin: '50px auto', padding: 20 }}><div className="rb-card"><div className="rb-cb">
    <h2>{sent ? 'Verify your email' : 'Start your free trial'}</h2>
    <p className="rb-hint">Four free resumes per verified account. Each network can generate four free resumes per day across all trial accounts. Approved users have full access.</p>
    <form onSubmit={e => { e.preventDefault(); if (sent) verify(); else send(); }}>
      <label className="rb-lbl" htmlFor="trial-email">Email</label><input id="trial-email" className="rb-in" type="email" required autoComplete="email" value={email} disabled={busy || sent} onChange={e => setEmail(e.target.value)} />
      {sent && <><label className="rb-lbl" htmlFor="trial-code">Verification code</label><input id="trial-code" className="rb-in" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} value={code} onChange={e => setCode(e.target.value)} /></>}
      <button className="rb-btn rb-btn-pri" style={{ marginTop: 12 }} disabled={busy || (!sent && cooldown > 0)}>{busy ? 'Please wait...' : sent ? 'Verify and enter' : 'Send verification code'}</button>
      {sent && <><button type="button" className="rb-btn rb-btn-ghost" onClick={send} disabled={busy || cooldown > 0}>{cooldown ? 'Resend in ' + cooldown + 's' : 'Resend code'}</button><button type="button" className="rb-btn rb-btn-ghost" disabled={busy} onClick={() => { setSent(false); setCode(''); }}>Change email</button></>}
    </form><p className="rb-hint" role="status">{message}</p><button className="rb-btn rb-btn-ghost rb-btn-sm" disabled={busy} onClick={onSignIn}>Sign in with password</button>
  </div></div></div>;
}
