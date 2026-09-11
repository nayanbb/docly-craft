import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, FileText, Scale } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Docly" },
      {
        name: "description",
        content: "Docly terms of service, acceptable use policies, and service guidelines.",
      },
      { property: "og:title", content: "Terms of Service — Docly" },
      {
        property: "og:description",
        content: "Docly terms of service and acceptable use policies.",
      },
    ],
  }),
  component: TermsPlaceholder,
});

function TermsPlaceholder() {
  return (
    <>
      <PageHero
        eyebrow="Legal & Terms"
        title="Terms of Service"
        description="Guidelines and acceptable use policies for the Docly document platform."
      />
      <div className="container-page py-14 max-w-3xl space-y-8">
        <div className="rounded-2xl border border-primary/20 bg-accent/40 p-6">
          <div className="flex items-start gap-3.5">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Terms in Preparation</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Full commercial terms of service, SLA guarantees, and enterprise master service
                agreements are being prepared for the general commercial rollout. Please review our
                baseline terms below.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-base font-bold text-foreground">1. User Ownership of Content</h3>
            </div>
            <p>
              You retain full and exclusive ownership of all documents, images, and files that you
              process using Docly. Docly claims no intellectual property rights or licenses over any
              material you manipulate or create using our tools.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-base font-bold text-foreground">2. Acceptable Use</h3>
            </div>
            <p>
              Docly must be used solely for lawful purposes. You agree not to use Docly's tools to
              process, distribute, or facilitate malicious software, unauthorized copyrighted
              material, or any content that violates applicable law.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2.5">
              <Scale className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-base font-bold text-foreground">3. Service Availability</h3>
            </div>
            <p>
              Docly provides its document tools as an evolving software product. While we strive for
              100% reliability, features during this preview phase are provided on an "as is" and
              "as available" basis without warranties of any kind.
            </p>
          </section>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-border">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            to="/privacy"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Privacy Policy &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
