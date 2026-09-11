import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useAuth } from "@/lib/supabase/auth-context";
import { useSubscription } from "@/lib/monetization/subscription";
import { formatBillingDate } from "@/lib/monetization/plan";
import { popularTools, tools } from "@/lib/tools";
import { ToolCard } from "@/components/ToolCard";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Workspace Dashboard — Docly" },
      {
        name: "description",
        content: "Your Docly document workspace and quick tool launcher.",
      },
      { property: "og:title", content: "Workspace Dashboard — Docly" },
      {
        property: "og:description",
        content: "Your Docly document workspace and quick tool launcher.",
      },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <ProtectedRoute>
      <ErrorBoundary
        fallbackTitle="Dashboard unavailable"
        fallbackMessage="We couldn't load your dashboard right now. Public tools remain available."
      >
        <DashboardView />
      </ErrorBoundary>
    </ProtectedRoute>
  );
}

function DashboardView() {
  const { user, profile } = useAuth();
  const { isPro, currentPeriodEnd, isCancelled, isExpired, isPastDue } = useSubscription();

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Recently";

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";

  return (
    <div className="container-page py-10 sm:py-14 space-y-8">
      {/* Subscription Notifications */}
      {isPastDue && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-bold">We couldn't process your Pro payment.</p>
              <p className="text-amber-600/90 dark:text-amber-400/90">Please update your payment method to keep Pro active.</p>
            </div>
          </div>
          <Link
            to="/account"
            className="rounded-xl bg-amber-500 text-white px-3.5 py-1.5 font-bold hover:bg-amber-600 transition-colors shrink-0"
          >
            Manage Subscription
          </Link>
        </div>
      )}

      {isCancelled && currentPeriodEnd && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-muted-foreground flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <span>Your Docly Pro subscription ends on <strong className="text-foreground">{formatBillingDate(currentPeriodEnd)}</strong>.</span>
          </div>
          <Link
            to="/account"
            className="rounded-xl bg-primary/10 text-primary px-3 py-1 font-bold hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
          >
            Manage
          </Link>
        </div>
      )}

      {isExpired && (
        <div className="rounded-2xl border border-border bg-card p-4 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="font-bold text-foreground">Your Docly Pro plan has expired.</p>
              <p className="text-muted-foreground">Upgrade again for ₹25/month to continue using Pro features.</p>
            </div>
          </div>
          <Link
            to="/pricing"
            search={{ upgrade: "pro" }}
            className="rounded-xl bg-primary text-primary-foreground px-3.5 py-1.5 font-bold hover:opacity-90 transition-opacity shrink-0"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      {isPro && !isCancelled && currentPeriodEnd && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/85 flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>You have Docly Pro until <strong className="text-foreground font-semibold">{formatBillingDate(currentPeriodEnd)}</strong>.</span>
        </div>
      )}
      {/* Welcome Banner */}
      <div className="rounded-3xl border border-primary/20 bg-accent/30 p-6 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="surface-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-3">
              <Logo size="md" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are signed in as{" "}
              <span className="font-semibold text-foreground">{user?.email}</span>. Access your
              favorite tools directly or manage your account settings below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:border-primary/40 transition-colors shadow-xs"
            >
              <UserIcon className="h-3.5 w-3.5 text-primary" />
              Account Settings
            </Link>
            <Link
              to="/pdf-tools"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity"
            >
              Explore Catalog
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Account & Subscription Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Subscription & Plan Card */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Plan</span>
              </div>
              {isPro ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-500">
                  Active ✓
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-bold text-muted-foreground">
                  Free
                </span>
              )}
            </div>

            <p className="text-sm font-bold text-foreground">
              {isPro ? "Docly Pro" : "Free plan"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPro ? "₹25/month recurring" : "₹0/month"}
            </p>
          </div>

          {isPro ? (
            <div className="space-y-1.5 pt-1.5 border-t border-border/50 text-[0.7rem]">
              <div className="flex justify-between text-muted-foreground">
                <span>Status</span>
                <span className="font-semibold text-foreground">
                  {isCancelled ? "Ending soon" : "Active"}
                </span>
              </div>
              {currentPeriodEnd && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{isCancelled ? "Access until" : "Next billing"}</span>
                  <span className="font-semibold text-foreground">
                    {formatBillingDate(currentPeriodEnd)}
                  </span>
                </div>
              )}
              <div className="pt-1">
                <Link
                  to="/account"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-surface border border-border py-1 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  Manage Subscription
                </Link>
              </div>
            </div>
          ) : (
            <div className="pt-1.5 border-t border-border/50">
              <Link
                to="/pricing"
                search={{ upgrade: "pro" }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-bold text-primary-foreground shadow-2xs hover:opacity-90 transition-opacity"
              >
                <Sparkles className="h-3 w-3" />
                <span>Upgrade to Pro</span>
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">
              <Mail className="h-4 w-4 text-primary" />
              <span>Account Email</span>
            </div>
            <p className="text-sm font-bold text-foreground truncate">{user?.email}</p>
          </div>
          <p className="text-[0.7rem] text-muted-foreground pt-1 border-t border-border/50">
            Used for auth and notifications
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Member Since</span>
            </div>
            <p className="text-sm font-bold text-foreground">{joinedDate}</p>
          </div>
          <p className="text-[0.7rem] text-muted-foreground pt-1 border-t border-border/50">
            Standard Docly workspace account
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Privacy Status</span>
            </div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Zero File Tracking
            </p>
          </div>
          <p className="text-[0.7rem] text-muted-foreground pt-1 border-t border-border/50">
            Files remain strictly in-browser or temporary
          </p>
        </div>
      </div>

      {/* Quick Tool Launcher */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Quick Tool Launcher</h2>
          </div>
          <Link
            to="/pdf-tools"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            All {tools.length}+ Tools <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popularTools.slice(0, 8).map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
}
