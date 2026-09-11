import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MegaMenuPanel } from "@/components/layout/MegaMenu";
import { convertMenuToolIds, megaMenuColumns, toolById } from "@/lib/tools";
import { useAuth } from "@/lib/supabase/auth-context";
import { useSubscription } from "@/lib/monetization/subscription";
import { cn } from "@/lib/utils";

const quickLinks = [
  { label: "Merge PDF", slug: "merge-pdf" },
  { label: "Split PDF", slug: "split-pdf" },
  { label: "Compress PDF", slug: "compress-pdf" },
];

export function Header() {
  const [openMenu, setOpenMenu] = useState<"convert" | "all" | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { user, profile, signOut } = useAuth();
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpenMenu(null);
    setUserMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    await signOut();
    navigate({ to: "/" });
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
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
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md"
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-1">
          <Logo />
          <nav className="ml-4 hidden items-center lg:flex">
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
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openMenu === "convert" && "rotate-180",
                  )}
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
          {user ? (
            <>
              {isPro ? (
                <Link
                  to="/account"
                  className="hidden items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary sm:inline-flex hover:bg-primary/20 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Pro
                </Link>
              ) : (
                <Link
                  to="/pricing"
                  search={{ upgrade: "pro" }}
                  className="hidden items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:inline-flex"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Upgrade to Pro
                </Link>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="hidden items-center gap-2 rounded-xl border border-border bg-card py-1.5 px-3 text-sm font-medium hover:border-primary/40 transition-colors sm:inline-flex"
                  aria-label="User account menu"
                  aria-expanded={userMenuOpen}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                    {(profile?.display_name || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[120px] truncate text-xs text-foreground font-semibold">
                    {profile?.display_name || user.email?.split("@")[0] || "User"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform",
                      userMenuOpen && "rotate-180",
                    )}
                  />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-menu z-50">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {profile?.display_name || "Docly User"}
                      </p>
                      <p className="text-[0.7rem] text-muted-foreground truncate">{user.email}</p>
                    </div>

                    {isPro && (
                      <div className="px-3 py-1.5 text-[0.7rem] font-bold text-primary flex items-center gap-1.5 bg-primary/5 rounded-lg mb-1">
                        <Sparkles className="h-3 w-3" />
                        <span>Docly Pro Member</span>
                      </div>
                    )}

                    <Link
                      to="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4 text-primary" />
                      Dashboard
                    </Link>

                    <Link
                      to="/account"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      <UserIcon className="h-4 w-4 text-primary" />
                      Account Settings
                    </Link>

                    {profile?.role === "admin" && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                      >
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Admin Panel
                      </Link>
                    )}

                    <div className="border-t border-border my-1" />

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="hidden rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary sm:inline-flex"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                search={{ redirect: "/pricing?upgrade=pro", reason: "upgrade" }}
                className="hidden items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Link>
            </>
          )}

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

            {user ? (
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary text-sm font-bold">
                    {(profile?.display_name || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {profile?.display_name || "Docly User"}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>

                {isPro ? (
                  <div className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary/15 border border-primary/40 px-3 py-2 text-center text-xs font-bold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Docly Pro Active</span>
                  </div>
                ) : (
                  <Link
                    to="/pricing"
                    search={{ upgrade: "pro" }}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary/10 border border-primary/30 px-3 py-2.5 text-center text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Upgrade to Pro
                  </Link>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-center text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/account"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-center text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    Account
                  </Link>
                </div>

                {profile?.role === "admin" && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-primary/30 bg-card px-3 py-2 text-center text-xs font-bold text-primary hover:bg-secondary"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Admin Panel
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="border-t border-border pt-4 space-y-2">
                <Link
                  to="/login"
                  search={{ redirect: "/pricing?upgrade=pro", reason: "upgrade" }}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                >
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-border px-3 py-2.5 text-center text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-border px-3 py-2.5 text-center text-sm font-medium"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
