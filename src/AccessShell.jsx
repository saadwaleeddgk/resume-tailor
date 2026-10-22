import TrialSignIn from "./TrialSignIn.jsx";
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function AccessShell({ supabase, children }) {
  const [session, setSession] = useState(undefined);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState('');
  const starting = useRef(null);
  const api = useCallback(async (path, body, token) => {
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || data.session?.access_token || '') },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Request failed (' + res.status + ')');
    return result;
  }, [supabase]);
  const refresh = useCallback(async () => {
    try { const value = await api('account'); setAccount(value); setError(''); }
    catch (e) { setError(e.message); }
  }, [api]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    // Share initialization across StrictMode's development effect replay.
    if (!starting.current) starting.current = (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        const checked = await supabase.auth.getUser(data.session.access_token);
        if (!checked.error && checked.data.user?.email_confirmed_at && !checked.data.user.is_anonymous) return data.session;
        await supabase.auth.signOut({ scope: 'local' });
      }
      return null;
    })();
    starting.current.then(s => { if (active) setSession(s); }).catch(e => { if (active) { setError(e.message); setSession(null); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(previous => { if (previous?.user.id !== next?.user.id) setAccount(null); return next?.user?.email_confirmed_at && !next.user.is_anonymous ? next : null; }); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [supabase]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const load = async () => {
      try { const value = await api('account', null, session.access_token); if (active) { setAccount(value); setError(''); } }
      catch (e) { if (active) setError(e.message); }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [session, api]);
  if (!supabase) return <Card><h2>Sign-in setup required</h2><p>Configure the Supabase URL and public key.</p></Card>;
  if (session === undefined) return <Card><h2>Checking your session...</h2></Card>;
  if (!session) return <>
    {panel === 'login' ? <Card><Login supabase={supabase} done={() => setPanel('')} /><button className="rb-btn rb-btn-ghost" onClick={() => setPanel('')}>Start a free trial</button></Card> : <TrialSignIn supabase={supabase} onSignIn={() => setPanel('login')} />}
    {error && <Card><p role="alert">{error}</p></Card>}
  </>;
  if (!account || account.user_id !== session.user.id) return <Card><h2>{error ? 'Access setup needed' : 'Loading your allowance...'}</h2><p role="alert">{error}</p><button className="rb-btn rb-btn-ghost" onClick={() => window.location.reload()}>Retry</button></Card>;
  const approved = account.is_admin || account.status === 'approved';
  return <>
    <div className="access-header">
      <div className="rb-card access-card"><div className="rb-cb">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div className="access-summary"><b>{approved ? 'Full access' : account.status === 'pending' ? 'Awaiting admin approval' : account.status === 'rejected' ? 'Access request declined' : 'Free trial'}</b><p className="rb-hint">{session.user.email} · {approved ? 'All features unlocked' : account.accountRemaining + ' of 4 account credits remaining | ' + account.ipRemaining + ' network credits today'}</p></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!approved && account.status === 'trial' && <button className="rb-btn rb-btn-pri" onClick={() => setPanel(panel === 'register' ? '' : 'register')}>Request full access</button>}
            {session.user.is_anonymous ? <button className="rb-btn rb-btn-ghost" onClick={() => setPanel(panel === 'login' ? '' : 'login')}>Already registered? Sign in</button> : <button className="rb-btn rb-btn-ghost" onClick={async () => { const result = await supabase.auth.signOut(); if (result.error) setError(result.error.message); else window.location.reload(); }}>Sign out</button>}
            {account.is_admin && <button className="rb-btn rb-btn-ghost" onClick={() => setPanel(panel === 'admin' ? '' : 'admin')}>Manage approvals</button>}
          </div>
        </div>
        {!approved && <details className="access-help"><summary>About access</summary><p className="rb-hint">{account.status === 'pending' ? 'Your email is verified and your request is waiting for an administrator. This page checks for approval automatically.' : account.status === 'rejected' ? 'An administrator declined your request. Contact the site owner for access.' : 'Your verified account includes four free tailored resumes, with a shared limit of four per network per UTC day. Set a password and request admin approval for continued access and additional AI tools.'}</p></details>}
        {!approved && account.status === 'trial' && account.ipRemaining === 0 && account.accountRemaining > 0 && <p className="rb-hint" role="status">This network has reached its daily free limit. Resets {new Date(account.ipResetAt).toLocaleString()}. Your unused account credits remain available afterward.</p>}
        {error && <p className="rb-err" role="alert">{error}</p>}
      </div></div>
      {panel === 'register' && <Registration supabase={supabase} session={session} api={api} done={async () => { setPanel(''); await refresh(); }} />}
      {panel === 'login' && <Login supabase={supabase} done={() => { setPanel(''); refresh(); }} />}
      {panel === 'admin' && account.is_admin && <Admin api={api} />}
    </div>
    {children(session.user, account, refresh)}
  </>;
}
function Card({ children }) { return <div style={{ maxWidth: 520, margin: '50px auto', padding: 20 }}><div className="rb-card"><div className="rb-cb">{children}</div></div></div>; }
function Registration({ supabase, session, api, done }) {
  const [email, setEmail] = useState(session.user.email || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(n => n - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const send = async () => {
    if (cooldown || busy) return;
    if (password.length < 10 || password.length > 128 || password !== confirm) { setMessage('Enter matching passwords between 10 and 128 characters.'); return; }
    setBusy(true); setMessage('');
    try {
      const address = email.trim().toLowerCase();
      const result = await supabase.auth.signInWithOtp({ email: session.user.email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + '/' } });
      if (result.error) throw result.error;
      setEmail(address); setStage('code'); setCooldown(60); setMessage('We sent a verification code. Check your inbox and spam folder.');
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  const finish = async () => {
    if (password.length < 10 || password.length > 128 || password !== confirm) { setMessage('Passwords must match and contain 10 to 128 characters.'); return; }
    setBusy(true); setMessage('');
    try {
      let token;
      if (stage === 'code') {
        const result = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
        if (result.error) throw result.error;
        token = result.data.session?.access_token;
        setStage('finish');
      }
      const updated = await supabase.auth.updateUser({ password });
      if (updated.error) throw updated.error;
      await api('account', { password }, token);
      setPassword(''); setConfirm(''); await done();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  return <div className="rb-card"><div className="rb-cb"><h2>Request full access</h2>
    <form onSubmit={e => { e.preventDefault(); if (stage === 'email') send(); else finish(); }}>
      <label className="rb-lbl" htmlFor="register-email">Email</label><input id="register-email" className="rb-in" type="email" required value={email} disabled onChange={e => setEmail(e.target.value)} autoComplete="email" />
      <label className="rb-lbl" htmlFor="register-password">Password</label><input id="register-password" className="rb-in" type="password" required minLength={10} maxLength={128} value={password} disabled={busy} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
      <label className="rb-lbl" htmlFor="register-confirm">Confirm password</label><input id="register-confirm" className="rb-in" type="password" required minLength={10} maxLength={128} value={confirm} disabled={busy} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
      {stage === 'code' && <><label className="rb-lbl" htmlFor="register-code">Email verification code</label><input id="register-code" className="rb-in" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} value={code} onChange={e => setCode(e.target.value)} /></>}
      <button className="rb-btn rb-btn-pri" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Please wait…' : stage === 'email' ? 'Send verification code' : 'Verify and request approval'}</button>
      {stage === 'code' && <button type="button" className="rb-btn rb-btn-ghost" disabled={busy || cooldown > 0} onClick={send}>{cooldown ? 'Resend in ' + cooldown + 's' : 'Resend code'}</button>}
    </form><p className="rb-hint" role="status">{message}</p>
  </div></div>;
}
function Login({ supabase, done }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const submit = async () => {
    setBusy(true); setMessage('');
    try {
      if (!sent) {
        // Validate the password without replacing the active guest session before OTP verification.
        const isolated = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const checked = await isolated.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (checked.error) throw checked.error;
        await isolated.auth.signOut({ scope: 'local' });
        const result = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + '/' } });
        if (result.error) throw result.error;
        setSent(true); setPassword(''); setMessage('Enter the code from your email.');
      } else {
        const result = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
        if (result.error) throw result.error;
        done();
      }
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  return <div className="rb-card"><div className="rb-cb"><h2>Sign in</h2><form onSubmit={e => { e.preventDefault(); submit(); }}>
    <label className="rb-lbl" htmlFor="login-email">Email</label><input id="login-email" className="rb-in" type="email" required disabled={sent || busy} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
    {sent ? <><label className="rb-lbl" htmlFor="login-code">Verification code</label><input id="login-code" className="rb-in" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" value={code} onChange={e => setCode(e.target.value)} /></> : <><label className="rb-lbl" htmlFor="login-password">Password</label><input id="login-password" className="rb-in" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></>}
    <button className="rb-btn rb-btn-pri" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Please wait…' : sent ? 'Verify and sign in' : 'Continue'}</button>
    {sent && <button type="button" className="rb-btn rb-btn-ghost" disabled={busy} onClick={() => { setSent(false); setCode(''); }}>Start again</button>}
  </form><p className="rb-hint" role="status">{message}</p></div></div>;
}
function Admin({ api }) {
  const [users, setUsers] = useState([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setBusy(true); try { const data = await api('admin'); setUsers(data.users); setMessage(''); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }, [api]);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);
  const update = async (userId, status) => { setBusy(true); try { await api('admin', { userId, status }); await load(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } };
  return <div className="rb-card"><div className="rb-cb"><h2>Account approvals</h2><button className="rb-btn rb-btn-ghost" disabled={busy} onClick={load}>Refresh</button><p role="status">{message}</p>{users.map(u => <div key={u.user_id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span>{u.email} · {u.status}{u.is_admin ? ' · admin' : ''}</span>{!u.is_admin && <div><button className="rb-btn rb-btn-acc rb-btn-sm" disabled={busy || u.status === 'approved'} onClick={() => update(u.user_id, 'approved')}>Approve</button><button className="rb-btn rb-btn-ghost rb-btn-sm" disabled={busy || u.status === 'rejected'} onClick={() => update(u.user_id, 'rejected')}>Reject / revoke</button></div>}</div>)}{!users.length && <p>No registered accounts yet.</p>}</div></div>;
}
