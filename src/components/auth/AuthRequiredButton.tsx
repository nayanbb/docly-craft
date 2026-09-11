import React, { type ReactNode } from "react";
import { useRequireAuth } from "@/lib/auth/require-auth";

interface AuthRequiredButtonProps {
  children: ReactNode;
  redirectTo?: string;
  reason?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Reusable button that executes the action if authenticated,
 * or redirects to /login preserving the return destination if anonymous.
 */
export function AuthRequiredButton({
  children,
  redirectTo,
  reason,
  onClick,
  className,
  disabled,
}: AuthRequiredButtonProps) {
  const { requireAuth } = useRequireAuth();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;

    if (!requireAuth({ redirectTo, reason })) {
      return;
    }

    onClick?.();
  };

  return (
    <button type="button" onClick={handleClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
