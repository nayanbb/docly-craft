import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Grid3X3, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MegaMenuPanel } from "@/components/layout/MegaMenu";
import { convertMenuToolIds, megaMenuColumns, toolById } from "@/lib/tools";
import { cn } from "@/lib/utils";

const quickLinks = [
  { label: "Merge PDF", slug: "merge-pdf" },
  { label: "Split PDF", slug: "split-pdf" },
  { label: "Compress PDF", slug: "compress-pdf" },
];

export function Header() {
  const [openMenu, setOpenMenu] = useState<"convert" | "all" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const triggerClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground",
      active && "bg-secondary text-foreground",
    );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-1">
          <Logo />
          <nav ref={navRef} className="ml-4 hidden items-center lg:flex">
            {quickLinks.map((link) => (
              <Link
                key={link.slug}
                to="/tools/$slug"
                params={{ slug: link.slug }}
                className={triggerClass(pathname === `/tools/${link.slug}`)}
              >
                {link.label}
              </Link>
            ))}

            <div className="relative">
              <button
                type="button"
                aria-expanded={openMenu === "convert"}
                onClick={() => setOpenMenu(openMenu === "convert" ? null : "convert")}
                className={triggerClass(openMenu === "convert")}
              >
                Convert PDF
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", openMenu === "convert" && "rotate-180")}
                />
              </button>
              {openMenu === "convert" && (
                <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-menu">
                  {convertMenuToolIds.map((id) => {
                    const tool = toolById(id);
                    if (!tool) return null;
                    const Icon = tool.icon;
                    return (
                      <Link
                        key={id}
                        to="/tools/$slug"
                        params={{ slug: tool.route.replace("/tools/", "") }}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Icon className="h-4 w-4 text-primary" strokeWidth={1.9} />
                        {tool.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                aria-expanded={openMenu === "all"}
                onClick={() => setOpenMenu(openMenu === "all" ? null : "all")}
                className={triggerClass(openMenu === "all")}
              >
                All Tools
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", openMenu === "all" && "rotate-180")}
                />
              </button>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="hidden rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex"
          >
            Sign Up
          </Link>
          <Link
            to="/dashboard"
            aria-label="Open applications dashboard"
            className="hidden h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:grid"
          >
            <Grid3X3 className="h-4 w-4" />
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-foreground lg:hidden"
          >
            {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {openMenu === "all" && (
        <div className="absolute inset-x-0 top-full hidden lg:block">
          <div className="container-page pb-4 pt-2">
            <MegaMenuPanel onNavigate={() => setOpenMenu(null)} />
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border bg-background lg:hidden">
          <div className="container-page space-y-1 py-4">
            {quickLinks.map((link) => (
              <Link
                key={link.slug}
                to="/tools/$slug"
                params={{ slug: link.slug }}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}

            {megaMenuColumns.map((column) => (
              <div key={column.title} className="border-t border-border pt-1">
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === column.title ? null : column.title)}
                  aria-expanded={openSection === column.title}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold"
                >
                  {column.title}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openSection === column.title && "rotate-180",
                    )}
                  />
                </button>
                {openSection === column.title && (
                  <ul className="pb-2 pl-2">
                    {column.toolIds.map((id) => {
                      const tool = toolById(id);
                      if (!tool) return null;
                      const Icon = tool.icon;
                      return (
                        <li key={id}>
                          <Link
                            to="/tools/$slug"
                            params={{ slug: tool.route.replace("/tools/", "") }}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/85 hover:bg-accent"
                          >
                            <Icon className="h-4 w-4 text-primary" strokeWidth={1.9} />
                            {tool.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}

            <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
              <Link
                to="/login"
                className="rounded-lg border border-border px-3 py-2.5 text-center text-sm font-medium"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
