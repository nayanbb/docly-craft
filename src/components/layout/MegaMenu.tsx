import { Link } from "@tanstack/react-router";
import { megaMenuColumns, toolById } from "@/lib/tools";

export function MegaMenuPanel({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-popover p-6 shadow-menu">
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 xl:grid-cols-7">
        {megaMenuColumns.map((column) => (
          <div key={column.title} className="min-w-0">
            <h3 className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {column.title}
            </h3>
            <ul className="space-y-0.5">
              {column.toolIds.map((id) => {
                const tool = toolById(id);
                if (!tool) return null;
                const Icon = tool.icon;
                return (
                  <li key={id}>
                    <Link
                      to="/tools/$slug"
                      params={{ slug: tool.route.replace("/tools/", "") }}
                      onClick={onNavigate}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground/85 transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.9} />
                      <span className="truncate">{tool.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5 text-sm">
        <Link
          to="/pdf-tools"
          onClick={onNavigate}
          className="rounded-lg border border-border px-3 py-1.5 font-medium transition-colors hover:border-primary/40 hover:text-primary"
        >
          All PDF tools
        </Link>
        <Link
          to="/image-tools"
          onClick={onNavigate}
          className="rounded-lg border border-border px-3 py-1.5 font-medium transition-colors hover:border-primary/40 hover:text-primary"
        >
          All image tools
        </Link>
        <Link
          to="/ai-tools"
          onClick={onNavigate}
          className="rounded-lg border border-border px-3 py-1.5 font-medium transition-colors hover:border-primary/40 hover:text-primary"
        >
          All AI tools
        </Link>
      </div>
    </div>
  );
}
