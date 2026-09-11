import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/supabase/auth-context";

export interface RequireAuthOptions {
  redirectTo?: string | undefined;
  reason?: "upgrade" | "account" | "saved_workspaces" | string | undefined;
}

/**
 * Validates and sanitizes an internal redirect path, preventing open-redirect vulnerabilities.
 * Strictly permits only relative internal application paths (e.g. "/pricing?upgrade=pro", "/dashboard").
 * Blocks external domains, protocol-relative paths ("//evil.com"), javascript: URIs, and backslash bypasses.
 */
export function sanitizeRedirectPath(
  target: string | undefined | null,
  fallback: string = "/dashboard",
): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Must begin with a single slash, must NOT begin with double slash (protocol-relative),
  // and must NOT contain backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }

  try {
    // Parse using a dummy origin to verify it remains strictly on the relative path
    const parsed = new URL(trimmed, "http://localhost");
    // Ensure protocol and host didn't mutate (only relative path + search + hash allowed)
    if (parsed.origin !== "http://localhost") {
      return fallback;
    }
    // Return decoded search component so URLSearchParams doesn't double-encode
    return parsed.pathname + decodeURI(parsed.search) + parsed.hash;
  } catch {
    return fallback;
  }
}

/**
 * Builds a standardized redirect URL preserving the intended destination and context reason.
 */
export function buildAuthRedirectUrl(redirectTo: string, reason?: string): string {
  const safeTarget = sanitizeRedirectPath(redirectTo, "/dashboard");
  const params = new URLSearchParams();
  params.set("redirect", safeTarget);
  if (reason) {
    params.set("reason", reason);
  }
  return `/login?${params.toString()}`;
}

/**
 * Reusable hook for guarding actions that require user authentication.
 *
 * Example:
 * const { requireAuth } = useRequireAuth({ redirectTo: "/pricing?upgrade=pro", reason: "upgrade" });
 *
 * const handleUpgradeClick = () => {
 *   requireAuth(() => {
 *     // Proceed with authenticated action
 *   });
 * };
 */
export function useRequireAuth(defaultOptions?: RequireAuthOptions) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const requireAuth = (actionOrCallback?: (() => void) | RequireAuthOptions): boolean => {
    if (user) {
      if (typeof actionOrCallback === "function") {
        actionOrCallback();
      }
      return true;
    }

    const options = typeof actionOrCallback === "object" ? actionOrCallback : defaultOptions;
    const target = options?.redirectTo || currentPath;
    const reason = options?.reason;

    navigate({
      to: "/login",
      search: {
        redirect: target,
        reason,
      },
    });

    return false;
  };

  return {
    isAuthenticated: Boolean(user),
    isLoading,
    requireAuth,
    user,
  };
}
