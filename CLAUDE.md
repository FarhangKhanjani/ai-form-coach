Project context, decisions (don't reverse them silently), rule spec and backlog:

@docs/AI-Form-Coach-Project-Context.md

Form standards per exercise (every threshold must cite a source or be tagged [Placeholder]): docs/exercises/

Before pushing: `npm test`, `npm run build`, `npm run test:e2e` (after build), and `npm run test:db` when `supabase/migrations/` changed.
Never edit a migration that may already be applied; add a new one. Never commit exported session JSON (personal data).
