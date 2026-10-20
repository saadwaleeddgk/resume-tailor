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
5. If Supabase persistence is used, also add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These two are public client configuration values; API provider keys must remain server-side secrets.
6. Redeploy after adding environment variables. Vercel will serve the Vite frontend and `/api/claude.js` as a serverless function.

The Vercel Hobby plan is suitable for personal/non-commercial testing, subject to Vercel's current Hobby limits and terms.

## Required email OTP authentication

The application requires Supabase sign-in. Missing configuration blocks access.
Sign-up and sign-in both use an emailed code, with one account per email address.
This does not restrict simultaneous devices or merge Gmail dot/plus aliases.
Verified users enter immediately; the former profiles/admin approval UI is removed.

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` and in your hosting environment.
2. In Supabase Authentication, enable the Email provider, allow new sign-ups, and enable email confirmation. Disable anonymous sign-ins and unused providers.
3. In Authentication email templates, update **Magic Link** to include `<p>Your verification code is: {{ .Token }}</p>` instead of a confirmation link. Also update **Confirm signup** to include the code if that template is used by your project. Keep OTP expiry short (for example 10 minutes).
4. Configure custom SMTP for delivery to real users. Supabase's default mail service has restricted recipients and rate limits. Never put SMTP or service-role secrets in frontend variables.
5. Restart development servers or redeploy. Test a new email, incorrect/expired codes, resends, sign-out, and returning-user sign-in.

The backend validates the bearer token with Supabase and requires a confirmed email.
Do not disable email confirmation: the server trusts Supabase's confirmation status.
Existing valid sessions remain signed in unless revoked/reset below.

### Reset all existing accounts

This is a remote administrative operation, not performed automatically on deployment.
It permanently deletes existing Supabase Auth users, including admins. Existing database
triggers/foreign keys can cascade related data or prevent deletion; review them first.
The script does not remove unrelated application tables or browser storage.

1. Put your server-only `SUPABASE_SERVICE_ROLE_KEY` in local `.env` (never commit it).
2. Run `node scripts/reset-users.mjs` to preview the account count.
3. Run `node scripts/reset-users.mjs --delete-existing-users` to delete the captured accounts.
4. Copy the printed `AUTH_USERS_VALID_AFTER` value to backend environment variables and restart/redeploy. This boundary rejects old access tokens even before their normal expiry. Deleted accounts cannot refresh their sessions.
5. Remove the service-role key from local `.env` when finished. Register again through OTP.

Reference: https://supabase.com/docs/guides/auth/auth-email-passwordless
