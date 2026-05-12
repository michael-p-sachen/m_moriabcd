import { Links, Meta, Outlet, Scripts } from '@remix-run/react';

// Root is only rendered if a route falls through to Remix's React pipeline. The splat
// route throws a raw Response, so in practice this component never reaches the browser.
// We keep it minimal to satisfy Remix's build requirements.
export default function Root() {
  return (
    <html lang='en'>
      <head>
        <meta charSet='utf-8' />
        <meta
          name='viewport'
          content='width=device-width, initial-scale=1'
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
