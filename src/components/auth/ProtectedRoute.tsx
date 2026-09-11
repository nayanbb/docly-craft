import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/supabase/auth-context";
import { Logo } from "@/components/brand/Logo";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isConfigured } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({
        to: "/login",
        search: { redirect: pathname },
      });
    }
  }, [user, isLoading, navigate, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 space-y-4">
        <div className="animate-pulse">
          <Logo />
        </div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-full bg-primary animate-indeterminate" />
        </div>
        <p className="text-xs text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
