import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, Gauge, Lock, Sparkles } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";
import { popularTools, tools } from "@/lib/tools";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Docly — PDF, Image and AI Document Tools" },
      {
        name: "description",
        content:
          "Docly gives you fast, simple tools to convert, edit, organize and process PDFs, images and documents in one place.",
      },
      { property: "og:title", content: "Docly — PDF, Image and AI Document Tools" },
      {
        property: "og:description",
        content: "Simple, fast and intelligent tools for PDFs, images and documents.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="surface-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="container-page relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {tools.length}+ document tools in one workspace
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Everything you need to work with PDFs, images and documents.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Simple, fast and intelligent tools for converting, editing, organizing and processing your
              files.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/pdf-tools"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Explore All Tools
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/tools/$slug"
                params={{ slug: "merge-pdf" }}
                className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary"
              >
                Try a Tool
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No installs", "Files removed after processing", "Works on mobile"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <DocumentVisual />
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Popular tools</h2>
            <p className="mt-2 text-muted-foreground">The operations our users reach for every day.</p>
          </div>
          <Link
            to="/pdf-tools"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            View all tools <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popularTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="container-page grid gap-6 py-14 md:grid-cols-3">
          {[
            {
              icon: Gauge,
              title: "Built for speed",
              copy: "A focused interface that gets you from upload to download without detours.",
            },
            {
              icon: Lock,
              title: "Private by design",
              copy: "Your documents stay yours. Files are cleared automatically after processing.",
            },
            {
              icon: Sparkles,
              title: "Assisted workflows",
              copy: "Summaries, notes and passport photos that respect the original content.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-primary">
                <item.icon className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="rounded-3xl border border-border bg-ink px-6 py-12 text-center text-ink-foreground sm:px-12">
          <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            One workspace for every document task
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed opacity-80 sm:text-base">
            Start free and upgrade when you need larger files, batch processing and more AI operations.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Create free account
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-xl border border-ink-foreground/25 px-6 py-3 text-sm font-semibold"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function DocumentVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-lift">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="text-sm font-semibold">Merge PDF</span>
          <span className="rounded-full bg-accent px-2.5 py-1 text-[0.68rem] font-semibold text-accent-foreground">
            3 files
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {[
            { name: "Contract-part-1.pdf", size: "412 KB" },
            { name: "Contract-part-2.pdf", size: "388 KB" },
            { name: "Appendix.pdf", size: "126 KB" },
          ].map((file) => (
            <li
              key={file.name}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
            >
              <span className="h-8 w-6 shrink-0 rounded-sm border border-border bg-card" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">{file.size}</span>
              </span>
              <span className="text-xs font-medium text-success">Ready</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-3/4 rounded-full bg-primary" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Combining pages · 74%</p>
      </div>
      <div className="absolute -right-3 -top-5 hidden rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-card sm:block">
        <p className="text-xs font-semibold">Output</p>
        <p className="text-xs text-muted-foreground">1 document · 0.9 MB</p>
      </div>
    </div>
  );
}
