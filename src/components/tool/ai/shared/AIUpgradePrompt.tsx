import { useState } from "react";
import { Sparkles, ShieldCheck, Zap } from "lucide-react";
import { openPaymentCheckout } from "@/lib/payment/service";
import { useAuth } from "@/lib/supabase/auth-context";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface AIUpgradePromptProps {
  toolName: string;
  benefitMessage: string;
  toolRoute?: string;
  className?: string;
}

/**
 * Shared Pro AI Upgrade Card.
 * Renders consistent benefit-oriented Pro messaging at ₹25/month with direct checkout.
 */
export function AIUpgradePrompt({
  toolName,
  benefitMessage,
  toolRoute = "/pricing",
  className = "",
}: AIUpgradePromptProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await openPaymentCheckout(
        { redirect: toolRoute },
        {
          email: user?.email,
          name: (user?.user_metadata?.["display_name"] as string | undefined) || undefined,
        },
      );
      if (res.notConfigured) {
        toast.info("Pro checkout isn't available yet.", {
          description: res.error || "Your account is ready for Docly Pro.",
        });
      } else if (res.error && res.error !== "Payment dismissed") {
        toast.error(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border-2 border-primary/40 bg-card p-6 sm:p-8 shadow-card text-center space-y-4 max-w-lg mx-auto animate-in fade-in duration-300 ${className}`}
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>

      <div className="space-y-1.5">
        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
          Docly Pro Feature
        </span>
        <h3 className="text-xl font-extrabold text-foreground tracking-tight">
          Unlock {toolName}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {benefitMessage}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        {user ? (
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Opening Checkout..." : "Upgrade to Pro — ₹25/month"}
          </button>
        ) : (
          <Link
            to="/login"
            search={{ redirect: toolRoute, reason: "upgrade" }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Sign in & Upgrade — ₹25/month
          </Link>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 text-[0.7rem] text-muted-foreground pt-1">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-primary" />
          Cancel anytime
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-primary" />
          Instant access
        </span>
      </div>
    </div>
  );
}
