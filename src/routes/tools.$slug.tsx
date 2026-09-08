import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ToolPage } from "@/components/tool/ToolPage";
import { toolBySlug } from "@/lib/tools";

export const Route = createFileRoute("/tools/$slug")({
  loader: ({ params }) => {
    const tool = toolBySlug(params.slug);
    if (!tool) throw notFound();
    return { name: tool.name, description: tool.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Tool unavailable — Docly" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.name} — Docly`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.description },
      ],
    };
  },
  notFoundComponent: ToolNotFound,
  component: ToolRoute,
});

function ToolRoute() {
  const { slug } = Route.useParams();
  const tool = toolBySlug(slug);
  if (!tool) return <ToolNotFound />;
  return <ToolPage tool={tool} />;
}

function ToolNotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl font-bold">This tool isn't available yet</h1>
      <p className="mt-2 text-muted-foreground">Browse the full catalogue to find what you need.</p>
      <Link
        to="/pdf-tools"
        className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        Explore all tools
      </Link>
    </div>
  );
}
