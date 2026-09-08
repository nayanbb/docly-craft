import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="Docly home"
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-ink text-ink-foreground">
        <span className="absolute left-1/2 top-1/2 h-4 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border border-current opacity-40" />
        <span className="absolute left-1/2 top-1/2 h-4 w-3.5 -translate-x-[62%] -translate-y-[38%] rounded-[3px] bg-primary transition-transform duration-300 group-hover:-translate-y-[44%]" />
      </span>
      {!compact && (
        <span className="text-[1.35rem] font-extrabold leading-none tracking-tight text-foreground">
          Docly
        </span>
      )}
    </Link>
  );
}
