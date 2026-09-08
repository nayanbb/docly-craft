import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/PageHero";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Docly — One workspace for document work" },
      {
        name: "description",
        content:
          "Docly brings PDF, image and AI-assisted document workflows into a single, fast and private workspace.",
      },
      { property: "og:title", content: "About Docly" },
      { property: "og:description", content: "One workspace for PDFs, images and document AI." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Document work should take seconds, not sessions"
        description="Docly is a focused workspace for the everyday file tasks that sit between you and finished work."
      />
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
          <p>
            Most document tools solve one problem and send you elsewhere for the next. Docly collects the
            whole workflow — organizing, converting, optimizing, securing and understanding files — into a
            single interface with one predictable pattern: choose a tool, add your files, get your result.
          </p>
          <p>
            We work across three areas. <strong className="text-foreground">PDFs</strong>: merge, split,
            compress, convert, edit and protect. <strong className="text-foreground">Images</strong>:
            convert formats, resize, adjust and optimize.{" "}
            <strong className="text-foreground">AI document workflows</strong>: summaries, notes, questions,
            translation, OCR and passport-ready photos.
          </p>
          <p>
            Our approach to AI is deliberately conservative. Assistance should clarify a document, never
            invent one. Photo tools use segmentation and standards-based transformations — the original
            subject is preserved, not regenerated.
          </p>
          <p>
            Docly is in active development. This release is the product interface; processing is being
            connected tool by tool.
          </p>
          <Link
            to="/pdf-tools"
            className="inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Explore the toolbox
          </Link>
        </div>
        <aside className="space-y-4">
          {[
            { title: "Focused", copy: "One clear path from upload to download in every tool." },
            { title: "Private", copy: "Files are processed for you and then removed." },
            { title: "Scalable", copy: "A shared architecture so new tools ship quickly." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.copy}</p>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
