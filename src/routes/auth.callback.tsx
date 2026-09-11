import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase, formatAuthError } from "@/lib/supabase/client";
import { sanitizeRedirectPath } from "@/lib/auth/require-auth";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

interface AuthCallbackSearch {
  code?: string | undefined;
  error?: string | undefined;
  error_description?: string | undefined;
  next?: string | undefined;
}

// Module-level deduplication to prevent React StrictMode or concurrent re-render race conditions
const inFlightExchanges = new Map<string, Promise<{ hasSession: boolean; errorMessage: string | null }>>();
const completedCodes = new Set<string>();

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): AuthCallbackSearch => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
    error_description:
      typeof search["error_description"] === "string" ? search["error_description"] : undefined,
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Authenticating — Docly" },
      { name: "description", content: "Completing Google authentication for Docly." },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || handledRef.current) return;
    handledRef.current = true;

    let isMounted = true;

    const resolveTarget = (): string => {
      let storedNext: string | null = null;
      try {
        storedNext = window.sessionStorage.getItem("docly_auth_next");
        if (storedNext) {
          window.sessionStorage.removeItem("docly_auth_next");
        }
      } catch {
        // Storage access error handling
      }
      return sanitizeRedirectPath(storedNext || search.next, "/dashboard");
    };

    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const handleCallback = async (): Promise<void> => {
      const targetPath = resolveTarget();

      // Parse hash parameters if present
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const rawError =
        search.error_description ||
        search.error ||
        hashParams.get("error_description") ||
        hashParams.get("error");

      // 1. Handle explicit OAuth error parameters from Google/Supabase
      if (rawError) {
        const friendly = formatAuthError(decodeURIComponent(rawError).replace(/\+/g, " "));
        console.warn("OAuth provider returned error:", rawError);
        if (isMounted) setErrorMessage(friendly);
        toast.error("Google sign-in could not be completed", { description: friendly });
        fallbackTimer = setTimeout(() => {
          navigate({ to: "/login", search: { redirect: targetPath } });
        }, 1500);
        return;
      }

      // 2. Check if a valid session already exists
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          toast.success("Welcome back to Docly!");
          navigate({ to: targetPath });
          return;
        }
      } catch (err) {
        console.warn("Error checking existing session:", err);
      }

      const code = search.code;

      // 3. Handle PKCE authorization code exchange
      if (code) {
        if (completedCodes.has(code)) {
          // This code was already redeemed; check session and redirect
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            toast.success("Welcome back to Docly!");
            navigate({ to: targetPath });
          } else {
            navigate({ to: "/login", search: { redirect: targetPath } });
          }
          return;
        }

        let exchangePromise = inFlightExchanges.get(code);
        if (!exchangePromise) {
          exchangePromise = (async () => {
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) {
                // Check if session was nonetheless established
                const { data: { session: fallbackSession } } = await supabase.auth.getSession();
                if (fallbackSession) {
                  return { hasSession: true, errorMessage: null };
                }
                const friendly = formatAuthError(error);
                return { hasSession: false, errorMessage: friendly };
              }
              return { hasSession: Boolean(data?.session), errorMessage: null };
            } catch (err) {
              const { data: { session: fallbackSession } } = await supabase.auth.getSession();
              if (fallbackSession) {
                return { hasSession: true, errorMessage: null };
              }
              return { hasSession: false, errorMessage: formatAuthError(err) };
            } finally {
              inFlightExchanges.delete(code);
              completedCodes.add(code);
            }
          })();
          inFlightExchanges.set(code, exchangePromise);
        }

        const result = await exchangePromise;
        if (!isMounted) return;

        // Clean query parameters from URL to avoid repeated exchanges on page refresh
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname);
        }

        if (result.hasSession) {
          toast.success("Welcome back to Docly!");
          navigate({ to: targetPath });
        } else {
          const message = result.errorMessage || "Google sign-in could not be completed. Please try again.";
          setErrorMessage(message);
          toast.error("Google sign-in could not be completed", { description: message });
          fallbackTimer = setTimeout(() => {
            navigate({ to: "/login", search: { redirect: targetPath } });
          }, 1500);
        }
        return;
      }

      // 4. Fallback: check session or listen for token arrival
      const { data: { session: finalSession } } = await supabase.auth.getSession();
      if (finalSession) {
        toast.success("Welcome back to Docly!");
        navigate({ to: targetPath });
      } else {
        // Brief fallback timer to allow any background session restore
        fallbackTimer = setTimeout(async () => {
          if (!isMounted) return;
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            navigate({ to: targetPath });
          } else {
            toast.error("Google sign-in timed out. Please try again.");
            navigate({ to: "/login", search: { redirect: targetPath } });
          }
        }, 3000);
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [search, navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 space-y-4">
      {errorMessage ? (
        <div className="flex flex-col items-center space-y-3 text-center max-w-sm">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Sign-In Failed</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">{errorMessage}</p>
          <p className="text-xs text-muted-foreground/80">Redirecting to login...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="animate-pulse">
            <Logo />
          </div>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-full bg-primary animate-indeterminate" />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            Completing sign in to Docly...
          </p>
        </div>
      )}
    </div>
  );
}
