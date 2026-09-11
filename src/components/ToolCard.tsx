import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { useSubscription } from "@/lib/monetization/subscription";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  tool: Tool;
  compact?: boolean;
  featured?: boolean;
  className?: string;
}

export function ToolCard({ tool, compact = false, featured = false, className }: ToolCardProps) {
  const { isPro } = useSubscription();
  const Icon = tool.icon;

  return (
    <Link
      to="/tools/$slug"
      params={{ slug: tool.route.replace("/tools/", "") }}
      aria-label={`${tool.name} — ${tool.description}`}
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        featured && "border-primary/30 bg-accent/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-surface text-primary transition-colors group-hover:border-primary/30 group-hover:bg-accent",
            featured && "border-primary/30 bg-card",
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <div className="flex items-center gap-1.5">
          {tool.access === "pro" ? (
            isPro ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.68rem] font-bold text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                PRO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.68rem] font-bold text-primary shadow-2xs">
                🔒 PRO
              </span>
            )
          ) : !isPro && tool.usageLimit && tool.usageUnit ? (
            <span className="inline-flex items-center rounded-md border border-border bg-secondary/80 px-1.5 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">
              {tool.usageUnit === "files"
                ? `${tool.usageLimit}/day`
                : `${tool.usageLimit} pages/day`}
            </span>
          ) : null}
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-[0.975rem] font-semibold text-foreground">{tool.name}</h3>
        {!compact && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {tool.description}
          </p>
        )}
      </div>
    </Link>
  );
}
