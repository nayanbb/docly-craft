import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { openPaymentCheckout } from "@/lib/payment/service";
import { useAuth } from "@/lib/supabase/auth-context";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirect?: string;
  sourceFeature?: string;
}

const proFeatures = [
  "Unlimited Office conversions (Word, Excel, PowerPoint)",
  "Reduction Maker",
  "AI Passport Photo & Background Removal",
  "Chat with PDF & AI Document Summarizer",
  "PDF → Notes & Questions / Quiz generation",
  "Advanced OCR beyond free allowance",
  "PDF Compare, Redaction & Repair",
  "Larger files up to 250 MB",
  "Batch file processing",
];

export function UpgradeModal({ isOpen, onClose, redirect = "/dashboard", sourceFeature }: UpgradeModalProps) {
  const { user, profile } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    const res = await openPaymentCheckout(
      { redirect },
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border-2 border-primary/40 bg-card p-6 sm:p-8 shadow-2xl space-y-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          aria-label="Close upgrade dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            🔒 PRO
          </span>
          <h2 className="text-2xl font-extrabold text-foreground">Docly Pro</h2>
          <p className="text-sm text-muted-foreground">
            {sourceFeature
              ? `Unlock ${sourceFeature} and the complete Docly Pro suite.`
              : "Experience limitless document workflows with advanced AI and higher limits."}
          </p>
          <div className="pt-2">
            <span className="text-3xl font-extrabold text-foreground">₹25/month</span>
            <span className="text-xs text-muted-foreground ml-1.5 font-medium">· recurring subscription</span>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-xs">
          <p className="font-semibold text-foreground mb-1 uppercase tracking-wider text-[0.68rem]">
            Included with Pro feature access:
          </p>
          <ul className="space-y-2">
            {proFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2 text-foreground/90">
                <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-6 text-sm font-bold text-primary-foreground shadow-md hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isUpgrading ? "Connecting to checkout..." : "Upgrade to Pro — ₹25/month"}</span>
          </button>
          <p className="text-center text-[0.7rem] text-muted-foreground">
            Payments are securely processed. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
