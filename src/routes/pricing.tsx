import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/layout/PageHero";
import { useAuth } from "@/lib/supabase/auth-context";
import { useSubscription } from "@/lib/monetization/subscription";
import { openPaymentCheckout } from "@/lib/payment/service";
import { useRequireAuth, sanitizeRedirectPath } from "@/lib/auth/require-auth";
import { PRICING, FILE_SIZE_LIMITS } from "@/lib/monetization/config";

interface PricingSearch {
  upgrade?: string | undefined;
  redirect?: string | undefined;
}

export const Route = createFileRoute("/pricing")({
  validateSearch: (search: Record<string, unknown>): PricingSearch => {
    const s: PricingSearch = {};
    if (typeof search["upgrade"] === "string") s.upgrade = search["upgrade"];
    if (typeof search["redirect"] === "string") s.redirect = search["redirect"];
    return s;
  },
  head: () => ({
    meta: [
      { title: "Pricing — Free and Pro plans | Docly" },
      {
        name: "description",
        content:
          "Start free with everyday PDF and image tools, or go Pro for ₹25/month for unlimited conversions, AI tools, and larger files.",
      },
      { property: "og:title", content: "Docly Pricing — Free and Pro Plans" },
      {
        property: "og:description",
        content: "Docly Pro at ₹25/month. Free tools require no account or signup.",
      },
    ],
  }),
  component: Pricing,
});

const freeFeatures = [
  "Basic PDF tools (Merge, Split, Compress, etc.)",
  "Basic image tools (Convert, Resize, Crop, etc.)",
  "10 Office conversions/day per tool",
  "OCR up to 2 pages/day",
  "Scan → Searchable PDF up to 2 pages/day",
  `50 MB maximum file size`,
  "No account or sign up required",
  "Client-side privacy & fast processing",
];

const proFeatures = [
  "Unlimited Office conversions",
  "Reduction Maker",
  "AI Passport Photo",
  "Background Removal & AI Background Replacement",
  "Chat with PDF",
  "AI PDF Summarizer",
  "PDF → Notes & Questions / Quiz",
  "AI Document Assistant & PDF Translator",
  "Resume Analyzer & AI Document Generator",
  "Advanced OCR beyond free allowance",
  "PDF Compare, Redaction & Repair",
  "Batch file processing",
  `Larger files up to ${FILE_SIZE_LIMITS.proMaxMb} MB`,
  "Cloud File History & Saved Files",
  "All future Pro features",
];

function Pricing() {
  const { upgrade, redirect } = Route.useSearch();
  const { user, profile } = useAuth();
  const { isPro } = useSubscription();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const safeTarget = sanitizeRedirectPath(redirect, "/dashboard");
  const authRedirectTarget = redirect
    ? `/pricing?redirect=${encodeURIComponent(redirect)}&upgrade=pro`
    : "/pricing?upgrade=pro";

  const { requireAuth } = useRequireAuth({
    redirectTo: authRedirectTarget,
    reason: "upgrade",
  });

  const handleProUpgrade = () => {
    requireAuth(async () => {
      setIsUpgrading(true);
      const res = await openPaymentCheckout(
        { redirect: safeTarget },
        {
          email: user?.email || undefined,
          name: profile?.display_name || undefined,
        },
      );
      setIsUpgrading(false);
      if (res.notConfigured) {
        toast.info("Pro checkout isn't available yet.", {
          description: res.error || "Your account is ready for Docly Pro.",
        });
      } else if (res.error && res.error !== "Payment dismissed") {
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Straightforward plans, no surprises"
        description="Free tools require no signup or login. Upgrade to Docly Pro for high-volume workflows and advanced AI tools."
      />

      <div className="container-page py-12 lg:max-w-5xl">
        {upgrade === "pro" && user && (
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
            <UserCheck className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-semibold text-primary">Account authenticated for Docly Pro</p>
              <p className="text-xs text-muted-foreground">
                You are signed in as{" "}
                <span className="font-medium text-foreground">{user.email}</span>. Your account is
                ready for Docly Pro.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Free Tier */}
          <div className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Docly Free</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Everyday PDF & image workflows
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground">
                No Login Required
              </span>
            </div>

            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">₹0</span>
              <span className="text-sm text-muted-foreground">/month · forever free</span>
            </p>

            <ul className="mt-6 space-y-3 flex-1">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/pdf-tools"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 px-6 py-3 text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-secondary hover:text-primary"
            >
              Start using free tools
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="relative flex flex-col rounded-2xl border-2 border-primary/50 bg-card p-7 shadow-card ring-1 ring-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Docly Pro</h2>
                <p className="text-xs text-muted-foreground mt-0.5">For power users and teams</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[0.68rem] font-semibold text-primary-foreground">
                <Sparkles className="h-3 w-3" />
                Most popular
              </span>
            </div>

            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">₹25</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </p>

            <ul className="mt-6 space-y-3 flex-1">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isPro ? (
              <Link
                to="/account"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-secondary border border-border px-6 py-3.5 text-sm font-bold text-foreground hover:bg-secondary/80"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                You're on Docly Pro
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleProUpgrade}
                disabled={isUpgrading}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isUpgrading ? "Connecting to checkout..." : "Upgrade to Pro — ₹25/month"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
