import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/payment/cancelled")({
  head: () => ({
    meta: [
      { title: "Payment Cancelled — Docly" },
      { name: "description", content: "Your checkout was cancelled. No charges were made." },
    ],
  }),
  component: PaymentCancelledRoute,
});

function PaymentCancelledRoute() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center rounded-3xl border border-border bg-card p-8 shadow-md space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Payment wasn't completed</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your checkout was cancelled and no charges were made. You can try again whenever you're ready to unlock Docly Pro.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Pricing</span>
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-surface px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-colors"
          >
            Continue with Free Tools
          </Link>
        </div>
      </div>
    </div>
  );
}
