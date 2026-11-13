import { useLayoutEffect, useState, type ReactNode } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./store/authStore";
import { company } from "./content/site";
import type { Route } from "./+types/root";
import "./index.css";

/** The HTML document around every page (was index.html). */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Email links put one-time tokens in the URL (?token=...): never send it as Referer. */}
        <meta name="referrer" content="no-referrer" />
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Pages without their own title and description (account, admin...) get these. */
export function meta() {
  return [{ title: company.name }, { name: "description", content: company.tagline }];
}

// The headers the static site used to send (render.yaml), now on every page response.
export function headers() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}

export default function Root() {
  // One cache per page load: on the server a shared one would mix up different visitors' requests.
  const [queryClient] = useState(() => new QueryClient());
  const restoreSession = useAuthStore((s) => s.restoreSession);
  // Before the browser paints, so the restored session replaces the visitor view at once.
  useLayoutEffect(restoreSession, [restoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

/** Unexpected errors (e.g. the API is unreachable while rendering). */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="max-w-xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold mb-2">{notFound ? "Page not found" : "Something went wrong"}</h1>
      <p className="text-gray-600 mb-6">
        {notFound ? "This page doesn't exist." : "Please try again in a moment."}
      </p>
      <a href="/" className="text-accent font-semibold">
        Go to the home page
      </a>
    </main>
  );
}
