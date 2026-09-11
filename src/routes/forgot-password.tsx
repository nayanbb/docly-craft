import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, ArrowRight, AlertCircle, KeyRound, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Docly" },
      {
        name: "description",
        content: "Reset your Docly account password.",
      },
      { property: "og:title", content: "Reset Password — Docly" },
      {
        property: "og:description",
        content: "Reset your Docly account password.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setIsLoading(true);
    setError(null);

    await resetPasswordForEmail(cleanEmail);

    // Always show safe generic message without exposing whether email exists
    setIsSubmitted(true);
    setIsLoading(false);
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center pb-2">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
            Reset your password
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            Enter your email and we'll send you instructions to reset your password.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card space-y-5">
          {isSubmitted ? (
            <div className="text-center space-y-4 py-2">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Check your inbox</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If an account exists for{" "}
                  <span className="font-semibold text-foreground">{email}</span>, we've sent
                  password reset instructions to your inbox.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-semibold text-foreground uppercase tracking-wider"
                  >
                    Account Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      disabled={isLoading}
                      className="w-full rounded-xl border border-input bg-surface pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {isLoading ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      <span>Sending instructions...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Instructions</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
                Remembered your password?{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline ml-1">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
