// Uses a dedicated, non-persistent auth client, never the main application session.
export function createPasswordRecovery(auth) {
  let email = '';
  let verifiedUserId = null;
  const clear = () => { email = ''; verifiedUserId = null; };
  return {
    async send(address, redirectTo) {
      const normalized = address.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email address.');
      verifiedUserId = null;
      const { error } = await auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error) throw error;
      email = normalized;
    },
    async verify(code) {
      if (!email) throw new Error('Request a password reset code first.');
      verifiedUserId = null;
      if (!/^\d{6,10}$/.test(code.trim())) throw new Error('Enter the numeric code from your reset email.');
      const { data, error } = await auth.verifyOtp({ email, token: code.trim(), type: 'recovery' });
      if (error) throw error;
      if (!data?.session || !data.user?.id || data.session.user?.id !== data.user.id || data.user.email?.toLowerCase() !== email) throw new Error('Verification did not complete. Request a new code.');
      verifiedUserId = data.user.id;
    },
    async save(password, confirmation) {
      if (!verifiedUserId) throw new Error('Verify your email code before changing the password.');
      if (password.length < 10 || password.length > 128) throw new Error('Use a password between 10 and 128 characters.');
      if (password !== confirmation) throw new Error('The passwords do not match.');
      const { data, error: sessionError } = await auth.getSession();
      if (sessionError || data?.session?.user?.id !== verifiedUserId) { verifiedUserId = null; throw new Error('Your reset session expired. Request a new code.'); }
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
      clear();
      try { await auth.signOut({ scope: 'local' }); } catch { /* No recovery tokens are persisted. */ }
    },
    async cancel() {
      clear();
      try { await auth.signOut({ scope: 'local' }); } catch { /* Best effort for the isolated session. */ }
    },
  };
}
