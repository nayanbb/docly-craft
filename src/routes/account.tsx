import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Calendar,
  KeyRound,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  User as UserIcon,
  Lock,
  ArrowLeft,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useAuth } from "@/lib/supabase/auth-context";
import { useSubscription, triggerSubscriptionRefresh } from "@/lib/monetization/subscription";
import { cancelRazorpaySubscription } from "@/lib/razorpay/service";
import { formatBillingDate } from "@/lib/monetization/plan";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account Settings — Docly" },
      {
        name: "description",
        content: "Manage your Docly account profile and security settings.",
      },
      { property: "og:title", content: "Account Settings — Docly" },
      {
        property: "og:description",
        content: "Manage your Docly account profile and security settings.",
      },
    ],
  }),
  component: AccountRoute,
});

function AccountRoute() {
  return (
    <ProtectedRoute>
      <ErrorBoundary
        fallbackTitle="Account settings unavailable"
        fallbackMessage="We couldn't load your account details. Your credentials and session remain secure. You can try refreshing or go to home."
      >
        <AccountView />
      </ErrorBoundary>
    </ProtectedRoute>
  );
}

function AccountView() {
  const { user, profile, updateProfile, updatePassword, signOut } = useAuth();
  const {
    plan,
    isPro,
    status: subStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    isExpired,
    isCancelled,
    isPastDue,
  } = useSubscription();
  const navigate = useNavigate();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  // Display name form state
  const [displayName, setDisplayName] = useState(
    profile?.display_name || (user?.user_metadata?.["display_name"] as string | undefined) || "",
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Recently";

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    const { error } = await updateProfile({
      display_name: displayName.trim(),
    });

    setIsSavingProfile(false);
    if (error) {
      setProfileError(error.message);
      return;
    }

    setProfileSuccess(true);
    toast.success("Profile updated successfully!");
    setTimeout(() => setProfileSuccess(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    const { error } = await updatePassword(newPassword);

    setIsSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }

    setPasswordSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password changed successfully!");
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  const handleManageSubscription = async () => {
    if (
      !confirm(
        "Are you sure you want to cancel your recurring Docly Pro subscription? You will retain all Pro benefits until the end of your current billing period.",
      )
    ) {
      return;
    }
    setIsOpeningPortal(true);
    const res = await cancelRazorpaySubscription();
    setIsOpeningPortal(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.message || "Your subscription has been cancelled at period end.");
      triggerSubscriptionRefresh();
    }
  };

  const handleCancelSubscription = handleManageSubscription;

  const handleSignOut = async () => {
    await signOut();
    toast.info("You have signed out.");
    navigate({ to: "/" });
  };

  return (
    <div className="container-page py-10 sm:py-14 space-y-8 max-w-3xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link to="/dashboard" className="hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Dashboard
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Account Settings</span>
          </div>
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-muted-foreground/30 text-xl font-light hidden sm:inline">|</span>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
              Account & Security
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile?.role === "admin" && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Panel</span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Subscription Status Notifications */}
      {isPastDue && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">We couldn't process your Pro payment.</p>
              <p className="text-amber-600/90 dark:text-amber-400/90">
                Please update your payment method to keep Pro active.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleManageSubscription}
            disabled={isOpeningPortal}
            className="rounded-xl bg-amber-500 text-white px-4 py-2 font-bold hover:bg-amber-600 transition-colors shrink-0 self-start sm:self-auto"
          >
            {isOpeningPortal ? "Opening..." : "Manage Subscription"}
          </button>
        </div>
      )}

      {isCancelled && currentPeriodEnd && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-muted-foreground flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>
            Your Docly Pro subscription ends on <strong className="text-foreground">{formatBillingDate(currentPeriodEnd)}</strong>.
          </span>
        </div>
      )}

      {isExpired && (
        <div className="rounded-2xl border border-border bg-card p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-foreground">Your Docly Pro plan has expired.</p>
              <p className="text-muted-foreground">Upgrade again for ₹25/month to continue using Pro features.</p>
            </div>
          </div>
          <Link
            to="/pricing"
            search={{ upgrade: "pro" }}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2 font-bold hover:opacity-90 transition-opacity shrink-0 self-start sm:self-auto"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      {/* Subscription Card Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Plan Status & Subscription
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPro
                ? "Your active membership plan and recurring billing details."
                : "Free-tier access. Upgrade for unlimited conversions, AI tools, and larger files."}
            </p>
          </div>

          <div>
            {isPro ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
                {isCancelled ? `Active until ${formatBillingDate(currentPeriodEnd)}` : "Active ✓"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                Free
              </span>
            )}
          </div>
        </div>

        {isPro ? (
          <div className="space-y-4 pt-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[0.68rem] text-muted-foreground font-medium uppercase tracking-wider">
                  Plan & Price
                </span>
                <p className="text-sm font-bold text-foreground">Docly Pro (₹25/mo)</p>
                <p className="text-xs text-muted-foreground">₹25/month</p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[0.68rem] text-muted-foreground font-medium uppercase tracking-wider">
                  Status
                </span>
                <p className="text-sm font-bold text-foreground">
                  {isCancelled ? "Cancelled at Period End" : "Active"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isCancelled ? "Will not renew" : "Auto-renews monthly"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[0.68rem] text-muted-foreground font-medium uppercase tracking-wider">
                  {isCancelled ? "Access Until" : "Next Billing"}
                </span>
                <p className="text-sm font-bold text-foreground">
                  {isCancelled ? "Ends " : "Renews on "}
                  {formatBillingDate(currentPeriodEnd)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isCancelled ? "Expires after date" : "Next payment: ₹25"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                {isCancelled
                  ? "Your Pro plan remains active until the date shown above."
                  : "Update payment method, download invoices, or cancel subscription anytime."}
              </p>
              {isCancelled ? (
                <Link
                  to="/pricing"
                  search={{ upgrade: "pro" }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Reactivate Pro</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={isOpeningPortal}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isOpeningPortal ? "Processing..." : "Manage Subscription"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[0.68rem] text-muted-foreground font-medium uppercase tracking-wider">
                  Current Tier
                </span>
                <p className="text-sm font-bold text-foreground">Docly Free (₹0/mo)</p>
                <p className="text-xs text-muted-foreground">₹0/month</p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[0.68rem] text-muted-foreground font-medium uppercase tracking-wider">
                  Status
                </span>
                <p className="text-sm font-bold text-foreground">Free</p>
                <p className="text-xs text-muted-foreground">Forever free basic tools</p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
                <span className="text-[0.68rem] text-muted-foreground font-medium uppercase tracking-wider">
                  Free Allowance
                </span>
                <p className="text-sm font-bold text-foreground">10 files / 2 OCR pages</p>
                <p className="text-xs text-muted-foreground">Per day per tool</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Unlock unlimited conversions, AI Passport Photo, Chat with PDF, and 250 MB files for ₹25/mo.
              </p>
              <Link
                to="/pricing"
                search={{ upgrade: "pro" }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Upgrade to Pro</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Account Overview Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-primary" />
          Account Details
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 pt-1">
          <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
            <span className="text-[0.68rem] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email Address
            </span>
            <p className="text-xs sm:text-sm font-bold text-foreground truncate">{user?.email}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
            <span className="text-[0.68rem] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Member Since
            </span>
            <p className="text-xs sm:text-sm font-bold text-foreground">{joinedDate}</p>
          </div>
        </div>
      </div>

      {/* Profile / Display Name Form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Public Profile
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Update the display name shown in your workspace navigation.
          </p>
        </div>

        {profileError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateDisplayName} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label
              htmlFor="profile-display-name"
              className="block text-xs font-semibold text-foreground"
            >
              Display Name
            </label>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name or nickname"
              disabled={isSavingProfile}
              className="w-full max-w-md rounded-xl border border-input bg-surface px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSavingProfile ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                <span>Saving...</span>
              </>
            ) : profileSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Change Password Form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Change Password
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ensure your account is using a secure password.
          </p>
        </div>

        {passwordError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 pt-1 max-w-md">
          <div className="space-y-1.5">
            <label
              htmlFor="account-new-password"
              className="block text-xs font-semibold text-foreground"
            >
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                disabled={isSavingPassword}
                className="w-full rounded-xl border border-input bg-surface pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="account-confirm-password"
              className="block text-xs font-semibold text-foreground"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                disabled={isSavingPassword}
                className="w-full rounded-xl border border-input bg-surface pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingPassword || !newPassword}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSavingPassword ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                <span>Updating...</span>
              </>
            ) : passwordSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Updated!</span>
              </>
            ) : (
              <>
                <KeyRound className="h-3.5 w-3.5" />
                <span>Update Password</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Privacy Notice */}
      <div className="rounded-2xl border border-border bg-surface p-4 flex items-start gap-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Docly stores minimal profile information (email and display name). Passwords are
          cryptographically salted and hashed by Supabase Auth and never stored in plain text.
        </p>
      </div>
    </div>
  );
}
