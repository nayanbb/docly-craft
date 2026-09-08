import type { Tool } from "@/lib/tools";
import { ToolCard } from "@/components/ToolCard";

export function ToolGrid({ tools }: { tools: Tool[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

export function CategorySection({
  id,
  title,
  blurb,
  tools,
}: {
  id: string;
  title: string;
  blurb: string;
  tools: Tool[];
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-5 border-b border-border pb-4">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
      </div>
      <ToolGrid tools={tools} />
    </section>
  );
}
