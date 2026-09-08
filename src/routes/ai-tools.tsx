import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ToolCard } from "@/components/ToolCard";
import { toolById, toolsByCategory } from "@/lib/tools";

export const Route = createFileRoute("/ai-tools")({
  head: () => ({
    meta: [
      { title: "AI Document Tools — Summaries, Notes and Passport Photos | Docly" },
      {
        name: "description",
        content:
          "Summarize, translate and question your documents, and create passport-style photos that preserve the original person.",
      },
      { property: "og:title", content: "AI Document Tools | Docly" },
      {
        property: "og:description",
        content: "Assisted document workflows: summaries, notes, translation, OCR and passport photos.",
      },
    ],
  }),
  component: AiTools,
});

function AiTools() {
  const flagship = toolById("passport-photo");
  const docTools = toolsByCategory("ai-tools");
  const backgroundRemover = toolById("background-remover");

  return (
    <>
      <PageHero
        eyebrow="AI"
        title="Document intelligence that stays faithful to your files"
        description="Read, summarize, translate and prepare documents and photos — without altering what makes them yours."
      />

      <div className="container-page py-14">
        {flagship && (
          <section className="overflow-hidden rounded-3xl border border-primary/25 bg-accent/40">
            <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Flagship AI feature
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {flagship.name}
                </h2>
                <p className="mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
                  {flagship.description}
                </p>
                <p className="mt-4 flex max-w-lg items-start gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Docly uses segmentation, background replacement and standards-based cropping. Faces are
                  never redrawn or generated.
                </p>
                <Link
                  to="/tools/$slug"
                  params={{ slug: "passport-photo" }}
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Open passport photo tool
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  "Country-specific sizing presets",
                  "Clean, even background replacement",
                  "Head position and margin checks",
                  "Print sheet and single-photo output",
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-14">
          <div className="mb-5 border-b border-border pb-4">
            <h2 className="text-lg font-bold sm:text-xl">Document AI</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Understand, reuse and translate what is already inside your documents.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
            {backgroundRemover && <ToolCard tool={backgroundRemover} />}
          </div>
        </section>
      </div>
    </>
  );
}
