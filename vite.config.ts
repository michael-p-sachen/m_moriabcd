import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Output to dist-spa so we don't collide with Remix/Hydrogen's dist/ worker build.
// scripts/prepare-oxygen.mjs then bridges dist-spa/ into public/assets + the splat route.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-spa',
    emptyOutDir: true,
  },
});
