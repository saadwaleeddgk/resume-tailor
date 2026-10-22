# Resume Tailor

React + Vite resume tailoring app with browser/PDF export and a Vercel-compatible `/api/claude.js` serverless endpoint.

## Resume templates

The app includes the original templates plus four recognizable industry layouts:

- **Jake's Resume** — based on Jake Gutierrez's MIT-licensed single-column LaTeX template. Recommended default for U.S. Data Engineering, Software Engineering, and AI/ML roles.
- **Harvard** — follows the clean bullet-resume structure published by Harvard FAS career services.
- **Deedy OpenFonts** — based on the Apache-2.0 Deedy Resume typography and engineering-focused hierarchy, adapted to this app's single-column ATS-safe renderer.
- **Awesome-CV** — based on the CC BY-SA 4.0 Awesome-CV visual language, adapted to a single-column U.S.-letter layout.

Template references:
- https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs
- https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/
- https://github.com/deedy/Deedy-Resume
- https://github.com/posquit0/Awesome-CV

## Local development

```bash
npm install
npm run dev
```

For local API calls, run the API server separately if you use `server.js`; Vite proxies `/api` to port 3001.

## Free Vercel test deployment

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New > Project**, import the repository, and keep the detected **Vite** settings.
3. Build command: `npm run build`. Output directory: `dist`.
4. Add at least one server-side LLM secret under **Settings > Environment Variables**: `OPENAI_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, or `GITHUB_TOKEN`.
5. Authentication requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These two are public client configuration values; API provider keys must remain server-side secrets.
6. Redeploy after adding environment variables. Vercel will serve the Vite frontend and `/api/claude.js` as a serverless function.

The Vercel Hobby plan is suitable for personal/non-commercial testing, subject to Vercel's current Hobby limits and terms.

## Verified-account trial, shared daily IP quota, and approved accounts

Visitors verify their email with an OTP before entering the editor. Each verified account
can complete four free resumes in total. Trial accounts also share a limit of four completed
resumes per public IP per UTC calendar day. Both limits include active reservations to prevent
parallel requests exceeding the quota. Failed attempts release slots; crashed reservations
expire after 20 minutes. Replaying a completed request returns the same result without charging again.

Approved users and administrators bypass both trial limits. After the trial, the user sets
a password, verifies a fresh email code, and requests admin approval. Pending and rejected
accounts cannot generate more resumes. The generic AI route requires approval.
The in-app password login also asks for email OTP; Supabase itself still supports OTP-only
sign-in, so this is not an enforced Supabase MFA factor.

### Required Supabase setup before running

Use a separate development Supabase project if you want to avoid test accounts in production.

1. In SQL Editor, run the complete contents of
   [the base migration](supabase/migrations/20261020_trial_access.sql), followed by
   [the IP-limit migration](supabase/migrations/20261021_verified_ip_limits.sql).
   If the base migration is already installed, run only the new IP-limit migration.
   It creates app_accounts, tailoring_jobs and the atomic reservation function.
   Browser roles cannot read or change these tables or execute the reservation function.
2. Enable **Allow new signups**, **Email**, and **Confirm email**. Disable **Anonymous sign-ins**.
   Email confirmation must stay enabled; manual identity linking is no longer needed.
   Existing anonymous sessions are signed out and cannot call the tailoring API.
3. Configure custom SMTP. Save your OTP HTML containing {{ .Token }} in **Confirm signup** and **Magic Link**.
4. Add http://localhost:5173/ to Authentication ? URL Configuration ? Redirect URLs.
   Leave your production Site URL set to your Vercel URL. If Vite uses another port, allow it too.
5. Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and one AI
   provider key to local .env. The service-role key must belong to the same project; it is
   server-only and must NEVER have a VITE_ prefix. Existing SUPABASE_URL/ANON_KEY aliases,
   if configured, must also match. Supabase verifies credentials; this app never stores passwords.
6. Bootstrap an administrator after registering your own email using the SQL below.

### Make your own registered account an administrator

Register in the app and finish verification and the approval request first. Then run in SQL Editor,
replacing the email below with your own verified account email:

```sql
update public.app_accounts as account
set is_admin = true, status = 'approved', email = users.email
from auth.users as users
where account.user_id = users.id
  and lower(users.email) = lower('YOUR_ADMIN_EMAIL@gmail.com')
  and users.email_confirmed_at is not null
returning account.user_id, account.email, account.is_admin;
```

The query must return your row. Refresh the app, open **Manage approvals**, and approve,
reject or revoke registered users. Admin privileges are assigned only through trusted SQL,
never through browser user metadata. Changes apply on the next API request; the UI polls
every 15 seconds. The admin list shows the newest 200 registered accounts.

### Test locally before deployment

```powershell
npm.cmd install
npm.cmd run server
```

Keep that terminal open. Open a second terminal:

```powershell
npm.cmd run dev
```

Visit the printed URL (normally http://localhost:5173/). The Vite proxy forwards API
requests to the same handlers used on Vercel, on local port 3001.

1. Open an incognito window. Verify email account A with its OTP before the editor appears.
2. Generate four resumes. The account and network allowances both drop. A fifth request is blocked.
3. Sign in using email account B in another browser on the same network. Its account allowance
   is fresh but its network allowance must be zero; generation is blocked with a daily-IP message.
4. After the next midnight UTC, B can use its remaining account credits, but A still has no
   account credits. The IP reset does not reset the lifetime account allowance.
5. In local development, all browsers connect through the same loopback IP and share its daily
   quota. Do not fake X-Forwarded-For headers locally; the server intentionally ignores them.
6. Request full access, verify a fresh OTP, set a password and submit. Approve from your admin
   account and confirm tailoring plus other AI tools unlock despite exhausted trial allowances.
7. Test failures and retries: provider failures must not consume either quota; a completed
   request replay must not consume another slot. Wrong OTPs and anonymous tokens must fail.
8. Run checks:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Automated tests mock Supabase/provider responses; the real database locks, email delivery
and conversion settings must also be checked with the above end-to-end steps.

### Deploy after local verification

Apply the migration and auth/template settings to the production Supabase project too.
Set the same required environment variables in Vercel Production and redeploy. The tailoring
function requests a 300-second runtime; actual availability depends on your hosting configuration.

### IP handling, limits, and stored data

Daily IP buckets use midnight UTC, not each visitor's local midnight. The browser displays
the reset time in its local time zone. Account credits never reset daily. Existing account
job counts are preserved; historical jobs without IP metadata are not retroactively counted
against today's IP bucket.

The Vercel runtime reads its platform-provided X-Forwarded-For header. Direct/local Express
uses the socket address and ignores client-supplied forwarding headers. Non-Vercel reverse
proxy deployments need a deliberately configured trusted-proxy strategy before use. Missing
or invalid trusted IPs fail closed for trial generation. Approved users do not need an IP bucket.

Only HMAC digests of IP addresses are stored, not raw addresses. Set an optional stable
server-only IP_QUOTA_SECRET to a random value; otherwise SUPABASE_SERVICE_ROLE_KEY is
used. Never prefix it with VITE_. Keep it the same across deployments sharing a database.
Rotating that secret (or the service key when used as fallback) resets effective IP buckets.
Vercel reference: https://vercel.com/docs/headers/request-headers

Shared Wi-Fi users share the daily allowance. VPNs, network changes and multiple distinct
IPv6 addresses may bypass the network layer, but do not reset a verified account's credits.
This does not identify a physical device and does not include VPN detection. CAPTCHA can
be added separately to reduce automated registrations.

Completed job results (structured resume, analysis, assessment) are stored in private Supabase
rows for retry recovery, alongside quota and approval metadata. They are not Word files or
a cross-device resume library. Local editor history still lives in browser storage. Deleting
completed jobs resets their quota contribution; keep counts when designing data retention.

Automated tests mock Supabase/provider responses and test IP normalization/header trust.
The migration and real cross-account database concurrency must also be verified against
your development Supabase project before production rollout.

### Select the intended AI provider

Set server-only `AI_PROVIDER=gemini` to use only the configured `GEMINI_API_KEY`.
Other choices are `openai`, `groq`, or `gpt`. Without AI_PROVIDER the enabled providers
are tried in order. A GITHUB_TOKEN alone no longer enables GitHub Models: set
`ENABLE_GITHUB_MODELS=true` only if that token is intentionally configured for model access.
This avoids using repository/deployment tokens as AI credentials. Diagnostics retain
safe failure codes from each attempted provider so a later fallback cannot hide an
earlier provider rejection. Set these variables in Vercel Production and redeploy;
changing local .env does not update the hosted runtime.
