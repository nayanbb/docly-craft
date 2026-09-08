import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Free and Pro plans | Docly" },
      {
        name: "description",
        content:
          "Start free with everyday PDF and image tools, or go Pro for larger files, batch processing and more AI operations.",
      },
      { property: "og:title", content: "Docly Pricing" },
      { property: "og:description", content: "Simple plans for individuals and busy teams." },
    ],
  }),
  component: Pricing,
});

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    summary: "Everything you need for occasional document work.",
    features: [
      "Basic PDF tools",
      "Basic image tools",
      "Limited AI tools",
      "Standard file size limits",
      "Single file processing",
    ],
    cta: "Start for free",
    to: "/signup" as const,
    highlight: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "per month (placeholder)",
    summary: "For people who work with documents every day.",
    features: [
      "Larger file limits",
      "Batch processing",
      "Advanced tools",
      "More AI operations",
      "Higher monthly limits",
      "Priority processing",
    ],
    cta: "Upgrade to Pro",
    to: "/signup" as const,
    highlight: true,
  },
];

function Pricing() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Straightforward plans, no surprises"
        description="Pricing shown is placeholder pricing for this preview release. Payments are not enabled yet."
      />
      <div className="container-page grid gap-6 py-14 md:grid-cols-2 lg:max-w-4xl">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`flex flex-col rounded-2xl border p-7 shadow-card ${
              plan.highlight ? "border-primary/40 bg-card ring-1 ring-primary/20" : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{plan.name}</h2>
              {plan.highlight && (
                <span className="rounded-full bg-primary px-2.5 py-1 text-[0.68rem] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </p>
            <ul className="mt-6 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              to={plan.to}
              className={`mt-8 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-opacity ${
                plan.highlight
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border hover:border-primary/40 hover:text-primary"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
