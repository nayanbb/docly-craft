import { useState } from "react";
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

interface PdfSecurityOptionsProps {
  mode: "unlock" | "protect";
  password: string;
  onChangePassword: (password: string) => void;
  confirmPassword?: string;
  onChangeConfirmPassword?: (confirm: string) => void;
}

export function PdfSecurityOptions({
  mode,
  password,
  onChangePassword,
  confirmPassword = "",
  onChangeConfirmPassword,
}: PdfSecurityOptionsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (mode === "protect") {
    const isMatching = password.length > 0 && password === confirmPassword;
    const isMismatch = confirmPassword.length > 0 && password !== confirmPassword;
    const isTooShort = password.length > 0 && password.length < 4;

    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2.5 pb-1 border-b border-border/60">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Document Encryption Settings</h3>
            <p className="text-[0.7rem] text-muted-foreground">
              Configure strong password protection for your document.
            </p>
          </div>
        </div>

        {/* Password input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="protect-pwd" className="block text-xs font-semibold text-foreground">
              Document Password <span className="text-destructive">*</span>
            </label>
            <span className="text-[0.7rem] text-muted-foreground">Min. 4 characters</span>
          </div>
          <div className="relative">
            <input
              id="protect-pwd"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => onChangePassword(e.target.value)}
              placeholder="Enter a strong password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {isTooShort && (
            <p className="text-[0.75rem] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pt-0.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Password must be at least 4 characters long.
            </p>
          )}
        </div>

        {/* Confirm password input */}
        <div className="space-y-1.5">
          <label
            htmlFor="protect-confirm-pwd"
            className="block text-xs font-semibold text-foreground"
          >
            Confirm Password <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              id="protect-confirm-pwd"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => onChangeConfirmPassword?.(e.target.value)}
              placeholder="Re-enter password to confirm"
              autoComplete="new-password"
              className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all font-mono ${
                isMismatch
                  ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                  : isMatching
                    ? "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                    : "border-input focus:border-primary focus:ring-primary/20"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Real-time Match Feedback */}
          {isMismatch && (
            <p className="text-[0.75rem] text-destructive flex items-center gap-1.5 pt-0.5 font-medium">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Passwords do not match.
            </p>
          )}
          {isMatching && !isTooShort && (
            <p className="text-[0.75rem] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Passwords match perfectly.
            </p>
          )}
        </div>

        {/* Security and Privacy Assurance */}
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[0.75rem] text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-foreground">Client-Side Security:</strong> Document encryption
            is performed 100% locally in your browser. Your password and PDF are never transmitted
            across the network or stored on any server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Authorized Document Password</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter the password you have authorized access to. Docly will decrypt the document and
        provide an unlocked copy. Never attempts brute force.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="unlock-pwd" className="block text-xs font-medium text-foreground">
          Document Password
        </label>
        <div className="relative">
          <input
            id="unlock-pwd"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onChangePassword(e.target.value)}
            placeholder="Enter current PDF password"
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
