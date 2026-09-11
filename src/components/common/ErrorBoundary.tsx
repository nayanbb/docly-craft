import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  showHomeButton?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Professional Docly Error Boundary.
 * Catches unhandled React component exceptions, isolates failures,
 * and displays a clean, user-friendly fallback UI.
 * Never exposes stack traces, server secrets, or file paths in production.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Safe diagnostic logging: log only safe metadata without leaking user documents or tokens
    if (process.env.NODE_ENV !== "production") {
      console.error("[Docly Error Boundary Caught]:", error, errorInfo);
    } else {
      console.error("[Docly Error Boundary]: An unexpected render error occurred.", {
        name: error?.name || "Error",
      });
    }
  }

  public reset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || "Something went wrong";
      const message =
        this.props.fallbackMessage ||
        "We couldn't load this part of Docly. Your files have not been uploaded unless you explicitly started an upload.";

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex min-h-[50vh] w-full flex-col items-center justify-center px-4 py-12 text-center"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {message}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.reset}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Try Again</span>
              </button>

              {(this.props.showHomeButton ?? true) && (
                <a
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span>Go to Home</span>
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
