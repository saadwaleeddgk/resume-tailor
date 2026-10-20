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
