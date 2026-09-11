import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, Sparkles, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { formatAuthError } from "@/lib/supabase/client";
import { sanitizeRedirectPath } from "@/lib/auth/require-auth";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { toast } from "sonner";

interface LoginSearch {
  redirect?: string | undefined;
  reason?: string | undefined;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const s: LoginSearch = {};
    if (typeof search["redirect"] === "string") s.redirect = search["redirect"];
    if (typeof search["reason"] === "string") s.reason = search["reason"];
    return s;
  },
  head: () => ({
    meta: [
      { title: "Sign In — Docly" },
      {
        name: "description",
        content: "Sign in to your Docly account to access your document workspace.",
      },
      { property: "og:title", content: "Sign In — Docly" },
      {
        property: "og:description",
        content: "Sign in to your Docly account to access your document workspace.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, signIn, signInWithGoogle, isConfigured } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const redirectTarget = sanitizeRedirectPath(search.redirect, "/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect safely to target
  useEffect(() => {
    if (user) {
      navigate({ to: redirectTarget });
    }
  }, [user, navigate, redirectTarget]);

  // Check URL hash/params for OAuth errors returned from Google/Supabase
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const urlParams = new URLSearchParams(window.location.search);
    const rawError =
      hashParams.get("error_description") ||
      urlParams.get("error_description") ||
      hashParams.get("error") ||
      urlParams.get("error");

    if (rawError) {
      const friendly = formatAuthError(decodeURIComponent(rawError).replace(/\+/g, " "));
      setError(friendly);
      toast.error("Google sign-in was not completed", { description: friendly });

      // Clean up hash from URL to avoid re-triggering on reload
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: signInError } = await signIn(cleanEmail, password);

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back to Docly!");
    navigate({ to: redirectTarget });
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);

    const safeTarget = sanitizeRedirectPath(search.redirect, "/dashboard");
    const { error: googleError } = await signInWithGoogle(safeTarget);

    if (googleError) {
      setError(googleError.message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-accent text-primary shadow-xs">
            <KeyRound className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
            Sign in to Docly
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            Access your document workspace and account settings.
          </p>
        </div>

        {/* Upgrade Context Banner if redirected from Pro upgrade */}
        {search.reason === "upgrade" && (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-xs space-y-1 text-foreground shadow-xs">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Upgrade to Pro</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Please sign in or create an account to upgrade to Pro. You will return directly to
              checkout.
            </p>
          </div>
        )}

        {/* Configuration notice if Supabase env vars are absent */}
        {!isConfigured && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs space-y-2 text-foreground">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Supabase Setup Required
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Configure{" "}
                  <code className="font-mono text-[0.7rem] bg-card px-1 py-0.5 rounded border border-border">
                    VITE_SUPABASE_URL
                  </code>{" "}
                  and{" "}
                  <code className="font-mono text-[0.7rem] bg-card px-1 py-0.5 rounded border border-border">
                    VITE_SUPABASE_ANON_KEY
                  </code>{" "}
                  in your <code className="font-mono text-[0.7rem]">.env</code> file to enable live
                  authentication.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-5">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full rounded-xl border border-input bg-surface pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-foreground uppercase tracking-wider"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full rounded-xl border border-input bg-surface pl-10 pr-10 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[0.7rem] uppercase">
              <span className="bg-card px-2.5 text-muted-foreground font-semibold">OR</span>
            </div>
          </div>

          {/* Google Sign-in Button */}
          <GoogleButton
            onClick={handleGoogleSignIn}
            isLoading={isGoogleLoading}
            disabled={isLoading || isGoogleLoading}
          />

          {/* Footer link */}
          <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/signup"
              search={{ redirect: search.redirect, reason: search.reason }}
              className="font-semibold text-primary hover:underline ml-1"
            >
              Sign up
            </Link>
          </div>
        </div>

        {/* Anonymous usage reassurance */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Just want to convert or edit files?{" "}
            <Link to="/pdf-tools" className="text-primary hover:underline font-medium">
              Explore public tools without an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
