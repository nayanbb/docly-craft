import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, FileCheck, RotateCcw, Sparkles, AlertCircle, FileText } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { FileUploader } from "@/components/files/FileUploader";
import { FileList, type SelectedFile } from "@/components/files/FileList";
import {
  ProgressIndicator,
  ErrorMessage,
  SuccessMessage,
  ProcessingButton,
} from "@/components/files/ToolStates";
import { downloadBlob } from "@/lib/files/download";
import { formatBytes } from "@/lib/format";
import type {
  ConversionBackendStatus,
  OfficeConversionOperation,
  OfficeToolProcessingState,
} from "@/lib/office/types";
import {
  convertDocumentViaBackend,
  fetchConversionStatus,
  ClientConversionError,
} from "@/lib/office/conversion";
import { validateOfficeFile } from "@/lib/office/validation";
import { BackendStatusNotice } from "@/components/tool/office/BackendStatusNotice";
import { useAuth } from "@/lib/supabase/auth-context";
import { useSubscription } from "@/lib/monetization/subscription";
import { checkToolUsage, recordSuccessfulUsage } from "@/lib/monetization/usage";
import { UPGRADE_MESSAGES } from "@/lib/monetization/config";

interface OfficeToolContainerProps {
  tool: Tool;
}

export function OfficeToolContainer({ tool }: OfficeToolContainerProps) {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [state, setState] = useState<OfficeToolProcessingState>("idle");
  const [progressLabel, setProgressLabel] = useState<string | undefined>(undefined);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<ConversionBackendStatus | null>(null);
  const [downloadBlobData, setDownloadBlobData] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const operation = tool.id as OfficeConversionOperation;
  const filesRef = useRef(files);
  filesRef.current = files;

  // Check server conversion backend status on mount or operation change
  useEffect(() => {
    fetchConversionStatus(operation)
      .then((status) => {
        setBackendStatus(status);
        if (!status.configured) {
          // If already has file, keep state; otherwise idle
        }
      })
      .catch(() => {
        setBackendStatus({
          configured: false,
          provider: "none",
          supportedOperations: [],
        });
      });
  }, [operation]);

  // Manage download object URL lifecycle
  useEffect(() => {
    if (downloadBlobData) {
      const url = URL.createObjectURL(downloadBlobData);
      setDownloadUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setDownloadUrl(null);
    return undefined;
  }, [downloadBlobData]);

  const handleFiles = async (incoming: File[]) => {
    const file = incoming[0];
    if (!file) return;

    setErrorDetail(null);

    // Validate file structure and magic bytes
    const check = await validateOfficeFile(file, operation);
    if (!check.valid) {
      setErrorDetail(check.error || "Invalid document format.");
      setState("error");
      return;
    }

    setFiles([
      {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        file,
      },
    ]);

    setState("idle");
    setDownloadBlobData(null);
  };

  const handleRemoveFile = () => {
    setFiles([]);
    setState("idle");
    setErrorDetail(null);
    setDownloadBlobData(null);
  };

  const handleConvert = async () => {
    const currentFile = files[0]?.file;
    if (!currentFile) return;

    // 1. Check per-tool daily conversion limit (10 files/day)
    const usageCheck = checkToolUsage(operation, 1, isPro);
    if (!usageCheck.allowed) {
      setState("error");
      setErrorDetail(
        "You've reached your 10 free conversions for today. Upgrade to Docly Pro for unlimited conversions. Only ₹25/month.",
      );
      return;
    }

    setState("validating");
    setProgressLabel("Validating document...");
    setErrorDetail(null);

    try {
      setState("converting");
      setProgressLabel("Converting your document...");
      const { blob, fileName } = await convertDocumentViaBackend(
        currentFile,
        operation,
        (statusText) => setProgressLabel(statusText),
      );

      setState("finalizing");
      setProgressLabel("Conversion complete");
      setDownloadBlobData(blob);
      setDownloadName(fileName);

      // 2. Increment usage counter ONLY after conversion actually succeeds!
      await recordSuccessfulUsage(operation, 1, user?.id);

      setState("success");
    } catch (err: unknown) {
      console.error("Office conversion failed:", err);
      setProgressLabel("Conversion failed");
      if (err instanceof ClientConversionError && err.code === "BACKEND_NOT_CONFIGURED") {
        setState("backend_not_configured");
        setErrorDetail("Document conversion is temporarily unavailable. Please try again later.");
      } else if (err instanceof ClientConversionError && err.code === "UNSUPPORTED_CONVERSION") {
        setState("unsupported_conversion");
        setErrorDetail("This conversion is not supported for this document type.");
      } else if (err instanceof ClientConversionError && err.code === "USAGE_LIMIT_EXCEEDED") {
        setState("error");
        setErrorDetail(
          "You've reached your 10 free conversions for today. Upgrade to Docly Pro for unlimited conversions. Only ₹25/month.",
        );
      } else {
        setState("error");
        setErrorDetail(err instanceof Error ? err.message : "Conversion failed on server.");
      }
    }
  };

  const handleDownload = () => {
    if (downloadBlobData && downloadName) {
      downloadBlob(downloadBlobData, downloadName);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setState("idle");
    setProgressLabel(undefined);
    setErrorDetail(null);
    setDownloadBlobData(null);
  };

  const isConfigured = backendStatus?.configured ?? false;
  const isOperationSupported = isConfigured
    ? backendStatus?.supportedOperations.includes(operation)
    : false;

  const isConverting =
    state === "uploading" ||
    state === "validating" ||
    state === "converting" ||
    state === "finalizing";

  const isReverseOperation =
    operation === "pdf-to-word" ||
    operation === "pdf-to-excel" ||
    operation === "pdf-to-powerpoint";

  return (
    <div className="space-y-6">
      {/* Backend Status Notice */}
      <BackendStatusNotice status={backendStatus} toolName={tool.name} operation={operation} />

      {/* Upload Stage */}
      {files.length === 0 && (
        <FileUploader
          formats={tool.formats}
          multiple={false}
          onFiles={handleFiles}
          disabled={isConverting}
        />
      )}

      {/* Selected File Display */}
      {files.length > 0 && <FileList files={files} onRemove={handleRemoveFile} />}

      {/* Conversion Progress State */}
      {isConverting && (
        <ProgressIndicator
          value={state === "validating" ? 25 : state === "converting" ? 65 : 90}
          label={progressLabel || "Processing document..."}
        />
      )}

      {/* Backend Not Configured Alert */}
      {(state === "backend_not_configured" || (!isConfigured && files.length > 0)) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-xs text-foreground space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            Document conversion is temporarily unavailable
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Document conversion is temporarily unavailable. Please try again later.
          </p>
        </div>
      )}

      {/* Unsupported Conversion Alert */}
      {state === "unsupported_conversion" && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-xs text-foreground space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            Conversion not supported by current provider
          </div>
          <p className="text-muted-foreground leading-relaxed">
            The active conversion backend does not currently support {tool.name}. Please verify
            provider capabilities.
          </p>
        </div>
      )}

      {/* Conversion Limit Exceeded Card */}
      {!isPro && !checkToolUsage(operation, 1, isPro).allowed && (
        <div className="rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-card text-center space-y-3 animate-in fade-in duration-200">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">
              You've reached your 10 free conversions for today.
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Upgrade to Docly Pro for unlimited conversions. Only ₹25/month.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to={user ? "/pricing" : "/login"}
              search={
                user ? { upgrade: "pro" } : { redirect: "/pricing?upgrade=pro", reason: "upgrade" }
              }
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 transition-opacity"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {state === "error" && errorDetail && <ErrorMessage message={errorDetail} />}

      {/* Success State & Download Card */}
      {state === "success" && downloadBlobData && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          <SuccessMessage
            message={`Your document has been converted to ${downloadName.split(".").pop()?.toUpperCase()} successfully.`}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{downloadName}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatBytes(downloadBlobData.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Download className="h-4 w-4" />
                Download Document
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                title="Convert another document"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      {state !== "success" && files.length > 0 && (
        <div className="pt-2">
          {isConfigured && isOperationSupported ? (
            <ProcessingButton
              label={tool.actionLabel ?? tool.name}
              disabled={isConverting}
              loading={isConverting}
              onClick={handleConvert}
            />
          ) : isConfigured && !isOperationSupported ? (
            <ProcessingButton
              label={`${tool.name} — Unsupported by Active Engine`}
              disabled
              hint={`The current backend (${backendStatus?.provider}) does not support this specific conversion.`}
            />
          ) : (
            <ProcessingButton
              label={`${tool.actionLabel ?? tool.name} — Service Unavailable`}
              disabled
              hint="Document conversion is temporarily unavailable. Please try again later."
            />
          )}
        </div>
      )}
    </div>
  );
}
