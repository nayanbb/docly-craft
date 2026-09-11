import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { triggerSubscriptionRefresh, SUBSCRIPTION_QUERY_KEY } from "@/lib/monetization/subscription";
import { sanitizeRedirectPath } from "@/lib/auth/require-auth";
import { supabase } from "@/lib/supabase/client";
import { getEffectivePlan, type RawSubscriptionData } from "@/lib/monetization/plan";

export const Route = createFileRoute("/payment/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    subscription_id: typeof search["subscription_id"] === "string" ? search["subscription_id"] : undefined,
    payment_id: typeof search["payment_id"] === "string" ? search["payment_id"] : undefined,
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment Successful — Docly Pro" },
      { name: "description", content: "Your Docly Pro subscription has been confirmed." },
    ],
  }),
  component: PaymentSuccessRoute,
});

function PaymentSuccessRoute() {
  const { subscription_id, payment_id, redirect } = Route.useSearch();
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const safeTarget = sanitizeRedirectPath(redirect, "/dashboard");

  // Status state: "verifying" | "confirmed" | "timeout"
  const [status, setStatus] = useState<"verifying" | "confirmed" | "timeout">("verifying");
  const [stage, setStage] = useState<number>(0); // 0 = checking, 1 = checkmark, 2 = sparkles, 3 = full unlock copy
  const [countdown, setCountdown] = useState<number>(4);

  const pollAttempts = useRef(0);
  const maxAttempts = 20;

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      // If not logged in, redirect to login with this page preserved
      navigate({
        to: "/login",
        search: { redirect: `/payment/success?subscription_id=${subscription_id || ""}&redirect=${encodeURIComponent(safeTarget)}` },
      });
      return;
    }

    let isMounted = true;
    let timerId: NodeJS.Timeout;

    async function checkProStatus() {
      try {
        const { data } = await supabase
          .from("subscriptions")
          .select("plan, status, current_period_end")
          .eq("user_id", user!.id)
          .maybeSingle();

        const plan = getEffectivePlan(data as RawSubscriptionData);

        if (plan === "pro") {
          if (!isMounted) return;
          setStatus("confirmed");
          queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
          triggerSubscriptionRefresh();
          return;
        }
      } catch (err) {
        console.warn("Error polling subscription verification:", err);
      }

      pollAttempts.current += 1;
      if (pollAttempts.current >= maxAttempts) {
        if (isMounted) setStatus("timeout");
        return;
      }

      timerId = setTimeout(checkProStatus, 1000);
    }

    checkProStatus();

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [user, isAuthLoading, navigate, safeTarget, subscription_id, queryClient]);

  // Handle stage animation sequence once confirmed (respecting prefers-reduced-motion)
  useEffect(() => {
    if (status !== "confirmed") return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setStage(3);
      return;
    }

    // Stage 1: Checkmark appears (400ms)
    const t1 = setTimeout(() => setStage(1), 400);
    // Stage 2: Celebration / particles (900ms)
    const t2 = setTimeout(() => setStage(2), 900);
    // Stage 3: Complete welcome text & unlocked badges (1500ms)
    const t3 = setTimeout(() => setStage(3), 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [status]);

  // Handle countdown and auto-redirect once stage 3 is reached
  useEffect(() => {
    if (stage < 3) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate({ to: safeTarget as any });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [stage, navigate, safeTarget]);

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        {status === "verifying" && (
          <div className="rounded-3xl border border-border bg-card p-8 shadow-md space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">Confirming your subscription...</h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We're securely verifying your payment with Razorpay and activating your Docly Pro benefits.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium pt-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Bank-grade 256-bit encryption</span>
            </div>
          </div>
        )}

        {status === "timeout" && (
          <div className="rounded-3xl border border-border bg-card p-8 shadow-md space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <Sparkles className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">Payment Received</h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your payment was received. Webhook confirmation is taking a few moments. Your account will automatically activate as Docly Pro shortly.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                to={safeTarget as any}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity"
              >
                <span>Continue to Docly</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/account"
                className="inline-flex items-center justify-center rounded-xl bg-surface px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-colors"
              >
                View Account Settings
              </Link>
            </div>
          </div>
        )}

        {status === "confirmed" && (
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 shadow-xl space-y-6">
            {/* Celebration particles */}
            {stage >= 2 && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                <div className="absolute -top-4 left-1/4 h-2 w-2 rounded-full bg-primary/60 animate-ping" />
                <div className="absolute top-8 right-1/4 h-2.5 w-2.5 rounded-full bg-emerald-400/70 animate-pulse" />
                <div className="absolute top-1/2 left-8 h-2 w-2 rounded-full bg-indigo-400/60 animate-bounce" />
                <div className="absolute top-1/3 right-8 h-2 w-2 rounded-full bg-amber-400/70 animate-ping" />
              </div>
            )}

            {/* Checkmark Animation Container */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500 shadow-inner">
              <Check
                className={`h-10 w-10 stroke-[3] transition-all duration-500 ${
                  stage >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
              />
            </div>

            {/* Copy Sequence */}
            <div
              className={`space-y-2 transition-all duration-500 ${
                stage >= 3 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              }`}
            >
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.68rem] font-bold text-primary">
                <Sparkles className="h-3 w-3" />
                <span>Docly Pro Active</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Payment successful!
              </h1>
              <p className="text-base font-semibold text-foreground">
                Welcome to Docly Pro 🎉
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto pt-1">
                All Pro features, unlimited conversions, AI tools, and 250 MB file limits are now unlocked on your account.
              </p>
            </div>

            {/* Action CTA & Auto-redirect */}
            <div
              className={`space-y-3 pt-2 transition-all duration-500 ${
                stage >= 3 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              }`}
            >
              <button
                type="button"
                onClick={() => navigate({ to: safeTarget as any })}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
              >
                <span>Continue to Docly</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="text-[0.7rem] text-muted-foreground">
                Redirecting to your destination in {countdown}s...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
