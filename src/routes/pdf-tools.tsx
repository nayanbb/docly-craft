import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/PageHero";
import { CategorySection } from "@/components/ToolGrid";
import { categoriesByGroup, toolsByCategory } from "@/lib/tools";

export const Route = createFileRoute("/pdf-tools")({
  head: () => ({
    meta: [
      { title: "PDF Tools — Merge, Split, Compress and Convert | Docly" },
      {
        name: "description",
        content:
          "Organize, optimize, convert, edit and secure PDF documents with Docly's complete set of PDF tools.",
      },
      { property: "og:title", content: "PDF Tools | Docly" },
      {
        property: "og:description",
        content: "A complete PDF toolbox: organize, optimize, convert, edit and secure.",
      },
    ],
  }),
  component: PdfTools,
});

function PdfTools() {
  const categories = categoriesByGroup("pdf");
  return (
    <>
      <PageHero
        eyebrow="PDF"
        title="Every PDF tool you need, organized by task"
        description="Merge, split, compress, convert, edit and protect documents — all with the same simple upload-and-download flow."
      />
      <div className="container-page space-y-14 py-14">
        {categories.map((category) => (
          <CategorySection
            key={category.id}
            id={category.id}
            title={category.title}
            blurb={category.blurb}
            tools={toolsByCategory(category.id)}
          />
        ))}
      </div>
    </>
  );
}
