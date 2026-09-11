import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact = false,
  size = "md",
}: {
  className?: string;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const heightClass = {
    sm: compact ? "h-6 w-6" : "h-6 w-auto",
    md: compact ? "h-8 w-8" : "h-8 sm:h-9 w-auto",
    lg: compact ? "h-12 w-12" : "h-12 sm:h-14 w-auto",
  }[size];

  return (
    <Link
      to="/"
      aria-label="Docly home"
      className={cn("group inline-flex items-center select-none", className)}
    >
      {compact ? (
        <img
          src="/brand/docly-icon.png"
          alt="Docly"
          className={cn("object-contain transition-transform duration-200 group-hover:scale-105", heightClass)}
        />
      ) : (
        <img
          src="/brand/docly-logo.png"
          alt="Docly"
          className={cn("object-contain transition-transform duration-200 group-hover:opacity-95", heightClass)}
        />
      )}
    </Link>
  );
}
