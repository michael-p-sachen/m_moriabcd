import shellHtml from '../spa-shell.generated.js';

// Resource route (no default export) — Remix returns the loader's Response directly,
// bypassing the React render pipeline. Body is the Vite-built index.html baked in
// by scripts/prepare-oxygen.mjs.
export async function loader() {
  return new Response(shellHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
