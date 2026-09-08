import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/PageHero";
import { CategorySection } from "@/components/ToolGrid";
import { categoriesByGroup, toolsByCategory } from "@/lib/tools";

export const Route = createFileRoute("/image-tools")({
  head: () => ({
    meta: [
      { title: "Image Tools — Convert, Resize and Compress | Docly" },
      {
        name: "description",
        content:
          "Convert between JPG, PNG and WEBP, resize, crop, adjust and compress images, and turn photos into PDFs with Docly.",
      },
      { property: "og:title", content: "Image Tools | Docly" },
      {
        property: "og:description",
        content: "Convert, edit, optimize and package images into documents.",
      },
    ],
  }),
  component: ImageTools,
});

function ImageTools() {
  const categories = categoriesByGroup("image");
  return (
    <>
      <PageHero
        eyebrow="Images"
        title="Image tools that keep your files sharp"
        description="Convert formats, adjust dimensions and tone, cut file size and turn photos into documents."
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
