import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ToolPage } from "@/components/tool/ToolPage";
import { ReductionMakerTool } from "@/components/tool/reduction/ReductionMakerTool";
import { toolBySlug } from "@/lib/tools";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TOOL_SEO } from "@/lib/seo/tool-pages";

export const Route = createFileRoute("/tools/$slug")({
  loader: ({ params }) => {
    const tool = toolBySlug(params.slug);

    if (!tool) {
      throw notFound();
    }

    return {
      name: tool.name,
      description: tool.description,
      seo: TOOL_SEO[params.slug] ?? null,
    };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Tool unavailable — Docly" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    const seo = loaderData.seo;

    const title = seo?.title ?? `${loaderData.name} — Docly`;
    const description =
      seo?.description ?? loaderData.description;

    return {
      meta: [
        { title },
        {
          name: "description",
          content: description,
        },
        {
          name: "keywords",
          content: seo?.keywords.join(", ") ?? "",
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          property: "og:type",
          content: "website",
        },
      ],
    };
  },

  notFoundComponent: ToolNotFound,
  component: ToolRoute,
});

function ToolRoute() {
  const { slug } = Route.useParams();
  const tool = toolBySlug(slug);

  if (!tool) {
    return <ToolNotFound />;
  }

  const seo = TOOL_SEO[slug];

  if (slug === "reduction-maker" || tool.id === "reduction-maker") {
    return (
      <ErrorBoundary
        fallbackTitle={`${tool.name} encountered an issue`}
        fallbackMessage="We couldn't process this tool view. Your files were not uploaded or stored. You can try again or explore other tools."
      >
        <ReductionMakerTool tool={tool} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary
      fallbackTitle={`${tool.name} encountered an issue`}
      fallbackMessage="We couldn't process this tool view. Your files were not uploaded or stored. You can try again or explore other tools."
    >
      <div>
        <ToolPage tool={tool} />

        {seo && (
          <section className="container-page py-12">
            <div className="mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold tracking-tight">
                {seo.h1}
              </h1>

              <p className="mt-4 text-lg text-muted-foreground">
                {seo.intro}
              </p>

              <div className="mt-6">
                <p className="text-sm text-muted-foreground">
                  Docly provides simple online tools for working with
                  PDFs, images, and documents.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </ErrorBoundary>
  );
}

function ToolNotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl font-bold">
        This tool isn't available yet
      </h1>

      <p className="mt-2 text-muted-foreground">
        Browse the full catalogue to find what you need.
      </p>

      <Link
        to="/pdf-tools"
        className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        Explore all tools
      </Link>
    </div>
  );
}