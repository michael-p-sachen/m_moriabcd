import * as remixBuild from '@remix-run/dev/server-build';
import { createRequestHandler } from '@shopify/remix-oxygen';

export default {
  async fetch(request, env, executionContext) {
    try {
      const waitUntil = (p) => executionContext.waitUntil(p);

      const handleRequest = createRequestHandler({
        build: remixBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => ({ waitUntil, env }),
      });

      return await handleRequest(request);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return new Response('An unexpected error occurred', { status: 500 });
    }
  },
};
