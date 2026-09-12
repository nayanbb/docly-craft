import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Users,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Revenue & Subscriptions — Docly" },
      { name: "description", content: "Docly Admin dashboard for verified Razorpay revenue and subscriptions." },
    ],
  }),
  component: AdminRoute,
});

interface AdminMetrics {
  totalSuccessfulPayments: number;
  thisMonthSuccessfulPayments: number;
  grossRevenue: number;
  refundedAmount: number;
  netRevenue: number;
  activeProSubscribers: number;
  cancelledSubscriptions: number;
  expiredSubscriptions: number;
  pastDueSubscriptions: number;
  failedPayments: number;
  sourceOfTruthNotice: string;
}

interface PaymentRecord {
  id: string;
  user_id: string;
  email: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  paid_at: string;
  provider?: string;
  provider_payment_id?: string;
  provider_order_id?: string;
  provider_subscription_id?: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_invoice_id?: string;
}

interface SubscriptionRecord {
  id: string;
  user_id: string;
  email: string;
  plan: string;
  status: string;
  started_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  provider?: string;
  provider_subscription_id?: string;
  provider_customer_id?: string;
  provider_plan_id?: string;
  razorpay_customer_id?: string;
  razorpay_subscription_id?: string;
  razorpay_plan_id?: string;
}

function AdminRoute() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "payments" | "subscriptions">("overview");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setIsLoadingData(true);
    setErrorMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setIsAdmin(false);
        setIsLoadingData(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Metrics
      const metricsRes = await fetch("/api/admin/metrics", { headers });
      if (metricsRes.status === 403 || metricsRes.status === 401) {
        setIsAdmin(false);
        setIsLoadingData(false);
        return;
      }

      if (!metricsRes.ok) {
        throw new Error("Failed to load admin metrics");
      }

      setIsAdmin(true);
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      // 2. Fetch Payments
      const paymentsRes = await fetch("/api/admin/payments", { headers });
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
      }

      // 3. Fetch Subscriptions
      const subsRes = await fetch("/api/admin/subscriptions", { headers });
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscriptions(subsData.subscriptions || []);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error fetching admin data");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setIsAdmin(false);
      setIsLoadingData(false);
      return;
    }
    fetchAdminData();
  }, [user, isAuthLoading]);

  if (isAuthLoading || isLoadingData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-7 w-7 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Verifying admin credentials...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center rounded-3xl border border-destructive/20 bg-card p-8 shadow-md space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-foreground">Access Restricted</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This area is restricted to authorized Docly system administrators. Your account does not have admin privileges.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground font-semibold">Admin Panel</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground flex items-center gap-2.5">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <span>Docly Revenue & Admin</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchAdminData}
            className="inline-flex items-center gap-2 rounded-xl bg-surface border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
          <a
            href="https://onboarding.payu.in"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition-opacity"
          >
            <span>PayU Dashboard</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Source of Truth Disclaimer Banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground/80 flex items-start gap-3">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Revenue Source of Truth</p>
          <p className="text-muted-foreground leading-relaxed">
            Revenue and payment records shown here reflect verified payment and subscription records stored in Supabase (PayU & Razorpay). Bank payouts, settlements, and merchant balances are managed directly within the official payment gateway dashboards.
          </p>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[0.68rem] font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</span>
          <p className="text-xl font-extrabold text-foreground">₹{metrics?.grossRevenue ?? 0}</p>
          <span className="text-[0.65rem] text-emerald-500 font-medium">Verified Gateway Payments</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[0.68rem] font-bold text-muted-foreground uppercase tracking-wider">Active Pro Subscribers</span>
          <p className="text-xl font-extrabold text-primary">{metrics?.activeProSubscribers ?? 0}</p>
          <span className="text-[0.65rem] text-muted-foreground font-medium">₹25/month recurring</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[0.68rem] font-bold text-muted-foreground uppercase tracking-wider">Monthly Recurring Revenue (MRR)</span>
          <p className="text-xl font-extrabold text-foreground">₹{(metrics?.activeProSubscribers ?? 0) * 25}</p>
          <span className="text-[0.65rem] text-muted-foreground font-medium">Projected monthly</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[0.68rem] font-bold text-muted-foreground uppercase tracking-wider">This Month</span>
          <p className="text-xl font-extrabold text-foreground">{metrics?.thisMonthSuccessfulPayments ?? 0}</p>
          <span className="text-[0.65rem] text-muted-foreground font-medium">Successful payments</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[0.68rem] font-bold text-muted-foreground uppercase tracking-wider">Past Due</span>
          <p className="text-xl font-extrabold text-amber-500">{metrics?.pastDueSubscriptions ?? 0}</p>
          <span className="text-[0.65rem] text-muted-foreground font-medium">Retrying charge</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <span className="text-[0.68rem] font-bold text-muted-foreground uppercase tracking-wider">Failed / Cancelled</span>
          <p className="text-xl font-extrabold text-muted-foreground">
            {(metrics?.cancelledSubscriptions ?? 0) + (metrics?.failedPayments ?? 0)}
          </p>
          <span className="text-[0.65rem] text-muted-foreground font-medium">
            {metrics?.cancelledSubscriptions ?? 0} cancelled, {metrics?.failedPayments ?? 0} failed
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "payments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Recent Payments ({payments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("subscriptions")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "subscriptions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Subscriber Directory ({subscriptions.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Quick Subscriptions Summary */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Subscription Breakdown</span>
            </h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Active Pro Subscribers</span>
                <span className="font-bold text-foreground">{metrics?.activeProSubscribers ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Scheduled Cancellations (Active until period end)</span>
                <span className="font-bold text-amber-500">{metrics?.cancelledSubscriptions ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Expired Subscriptions</span>
                <span className="font-bold text-muted-foreground">{metrics?.expiredSubscriptions ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Past Due Invoices</span>
                <span className="font-bold text-amber-500">{metrics?.pastDueSubscriptions ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-muted-foreground">Recurring Price Point</span>
                <span className="font-bold text-foreground">₹25/month</span>
              </div>
            </div>
          </div>

          {/* Quick Financial Summary */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span>Financial Summary</span>
            </h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Total Processed Payments</span>
                <span className="font-bold text-foreground">{metrics?.totalSuccessfulPayments ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Gross Revenue Recorded</span>
                <span className="font-bold text-foreground">₹{metrics?.grossRevenue ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Refunded Amount</span>
                <span className="font-bold text-muted-foreground">₹{metrics?.refundedAmount ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Estimated Net Revenue</span>
                <span className="font-bold text-emerald-500">₹{metrics?.netRevenue ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-muted-foreground">Processing Provider</span>
                <span className="font-bold text-foreground">Razorpay (UPI / Autopay / Cards)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Customer / Email</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Paid Date</th>
                  <th className="px-4 py-3">Payment ID / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No verified payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground">{p.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.plan}</td>
                      <td className="px-4 py-3 font-bold text-foreground">₹{p.amount}</td>
                      <td className="px-4 py-3 uppercase text-[0.68rem] text-muted-foreground">{p.provider || "payu"} ({p.payment_method || "card"})</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                            p.status === "succeeded"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[0.68rem]">
                        {p.provider_payment_id || p.razorpay_payment_id || p.provider_subscription_id || p.razorpay_subscription_id || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "subscriptions" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">User Email</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Period End</th>
                  <th className="px-4 py-3">Auto-Renew</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Subscription Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No user subscriptions found.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground">{s.email}</td>
                      <td className="px-4 py-3 uppercase font-bold text-[0.7rem]">{s.plan}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                            s.status === "active" || s.status === "authenticated"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : s.status === "past_due" || s.status === "halted"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.cancel_at_period_end ? (
                          <span className="text-amber-500 font-semibold">Cancelled</span>
                        ) : (
                          <span className="text-emerald-500 font-semibold">Yes</span>
                        )}
                      </td>
                      <td className="px-4 py-3 uppercase text-[0.68rem] text-muted-foreground">
                        {s.provider || "payu"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[0.68rem] text-muted-foreground">
                        {s.provider_subscription_id || s.razorpay_subscription_id || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
