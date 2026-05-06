# m_moriabcd

## Setup

1. Place files shared via SwissTransfer directly in `public/documents` (the app loads them from there at runtime).

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server (Vite):

   ```bash
   npm run dev
   ```

**What you get:** a bootstrapped site on localhost (usually `http://localhost:5173`) with hot module replacement so changes apply quickly without a full page reload.

## Git hooks

`npm install` runs the `prepare` script, which registers Husky. On each commit:

- `npm run typecheck` runs on the whole project
- `lint-staged` runs ESLint and Prettier only on staged files

If either step fails, the commit is blocked. To run the same checks yourself before committing:

```bash
npm run typecheck && npm run lint && npm run format:check
```
