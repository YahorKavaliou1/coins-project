import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget. The site key comes from VITE_TURNSTILE_SITE_KEY (see
 * .env.example); without it the widget is not shown and forms don't ask for a token, matching
 * a backend without TURNSTILE_SECRET_KEY.
 *
 * Tokens are single-use and expire after 5 minutes: after a failed submit, remount the widget
 * (change its `key`) to get a fresh one.
 */
const SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
export const captchaEnabled = SITE_KEY !== "";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads the Turnstile script once for the whole app. */
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry on the next mount
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface CaptchaProps {
  /** Called with a fresh token, or null when it expires or the check fails. */
  onToken: (token: string | null) => void;
  /** Shown in Cloudflare's analytics, e.g. "register". */
  action?: string;
  className?: string;
}

export function Captcha({ onToken, action, className = "" }: CaptchaProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const onTokenRef = useRef(onToken);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    if (!captchaEnabled) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          action,
          theme: "light",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
    };
  }, [action]);

  if (!captchaEnabled) return null;
  // Spans, so the widget can also sit inside a paragraph (see ResendVerificationButton).
  return (
    <span className={`block ${className}`}>
      {loadFailed ? (
        <span className="block text-xs text-red-700">
          The security check couldn't load. Check your internet connection and reload the page.
        </span>
      ) : (
        <span ref={containerRef} className="block min-h-[65px]" />
      )}
    </span>
  );
}
