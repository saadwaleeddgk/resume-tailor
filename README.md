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

## Four-resume guest trial and approved accounts

Visitors receive an anonymous Supabase session, without entering an email. Each session
can complete four tailored resumes and export them. The server owns the prompts and
runs the complete analysis/tailoring/scoring pipeline in one request. A database row
lock reserves each trial slot, including concurrent requests. Failed attempts release
slots; crashed reservations expire after 20 minutes. Stable request IDs recover completed
results without charging again. Only administrators and approved accounts can use the
generic AI route for suggestions, length changes, cover letters, outreach and interview prep.

After the trial, registration links an email to the anonymous identity, verifies an emailed
OTP, sets a password, and requests admin approval. Registration can also be requested
earlier, which locks generation while approval is pending. Existing email-only users must
set a password and request approval too. The in-app returning-user flow checks a password
and then verifies an email OTP. Supabase still supports OTP-only authentication through
its own API; this UI flow is not an enforced Supabase MFA factor.

### Required Supabase setup before running

Use a separate development Supabase project if you want to avoid test accounts in production.

1. In SQL Editor, run the complete contents of
   [the migration](supabase/migrations/20261020_trial_access.sql).
   It creates app_accounts, tailoring_jobs and the atomic reservation function.
   Browser roles cannot read or change these tables or execute the reservation function.
2. Enable **Anonymous sign-ins**, **Allow new signups**, **Email**, **Confirm email**, and
   **manual identity linking** in Authentication settings. Email confirmation must stay enabled.
3. Configure custom SMTP. Save your OTP HTML containing {{ .Token }} in **Change email address**,
   **Confirm signup**, and **Magic Link**. Guest conversion uses the Change email template.
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

1. Open an incognito window. The editor should open without registration and show 4 remaining.
2. Generate four resumes. Each successful result reduces the allowance by one. Refreshing
   the same browser session must retain the count. The fifth generation is blocked.
3. Test failure with a development provider configuration that returns an error: the count
   must not drop. Retry the same submitted request after a connection failure; it must not
   consume a second slot. Do not change production provider keys for this test.
4. Register the guest with a test email and matching password (10?128 characters). Enter
   the Change email OTP. Wrong/expired codes must fail. Password creation and approval
   submission happen only after email verification. The user should now see pending approval.
5. In your normal browser, sign in as the bootstrapped admin, open Manage approvals and
   approve the test user. Within 15 seconds, the test user's account should unlock.
6. Generate another resume and use cover-letter/interview tools. Reject/revoke the user
   and confirm that new generation requests are blocked again.
7. Sign out and test returning sign-in with password plus email OTP. Test a different user
   to confirm their local resume history is separate. Signing in to an existing account does
   not merge an unrelated guest session's local history.
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

### Trial limitations and stored data

The trial is per anonymous browser identity, not per human. Clearing browser data or
using a different browser creates a new trial. CAPTCHA and anonymous-user cleanup are
recommended before public launch. Anonymous sessions use Supabase's authenticated role;
review policies on any other existing tables before enabling them.

Completed job results (structured resume, analysis, assessment) are stored in private Supabase
rows for retry recovery, alongside quota and approval metadata. They are not Word files or
a cross-device resume library. Local editor history still lives in browser storage. Decide a
retention policy before public launch; deleting completed job rows also resets their quota count.

References: https://supabase.com/docs/guides/auth/auth-anonymous and
https://supabase.com/docs/guides/database/functions
