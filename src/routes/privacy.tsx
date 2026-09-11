import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Docly" },
      {
        name: "description",
        content:
          "Docly privacy policy, client-side data handling principles and security commitments.",
      },
      { property: "og:title", content: "Privacy Policy — Docly" },
      {
        property: "og:description",
        content: "Docly privacy policy and client-side data handling principles.",
      },
    ],
  }),
  component: PrivacyPlaceholder,
});

function PrivacyPlaceholder() {
  return (
    <>
      <PageHero
        eyebrow="Legal & Privacy"
        title="Privacy Policy"
        description="Docly is built from the ground up to respect your privacy and protect your sensitive documents."
      />
      <div className="container-page py-14 max-w-3xl space-y-8">
        <div className="rounded-2xl border border-primary/20 bg-accent/40 p-6">
          <div className="flex items-start gap-3.5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Formal Legal Policy Notice</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Comprehensive legal terms and regional disclosures (including GDPR and CCPA addenda)
                are being prepared for our upcoming commercial launch. Below are our core technical
                privacy principles.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2.5">
              <Lock className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                1. Local-First Processing Architecture
              </h3>
            </div>
            <p>
              Unlike traditional document SaaS platforms that upload your sensitive files to remote
              servers, Docly processes standard PDF, image, and document operations directly inside
              your web browser using client-side WebAssembly and modern browser APIs.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                2. Zero Server Document Retention
              </h3>
            </div>
            <p>
              Your documents never touch our disks. For client-side tools, no files are transmitted
              across the internet, ensuring that confidential contracts, financial spreadsheets, and
              personal IDs remain strictly on your machine.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                3. Ethical AI & Identity Preservation
              </h3>
            </div>
            <p>
              Our AI tools (such as AI Passport Photo) use mathematical segmentation, landmark
              detection, and standardized framing. We never synthesize, alter, or generate
              artificial faces. Your original identity is preserved with absolute fidelity.
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
            to="/terms"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Terms of Service &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
