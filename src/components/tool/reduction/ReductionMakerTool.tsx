import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  FileText,
  RotateCcw,
  Download,
  CheckCircle2,
  ChevronRight,
  Layers,
  Printer,
  Loader2,
  X,
  Info,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { PageHero } from "@/components/layout/PageHero";
import { FileUploader } from "@/components/files/FileUploader";
import {
  ErrorMessage,
  ProgressIndicator,
  type ToolState,
} from "@/components/files/ToolStates";
import { downloadValidatedBlob } from "@/lib/files/download";
import { formatBytes } from "@/lib/format";
import {
  calculateReductionPlan,
  createReducedPdf,
  getPdfPageCount,
  type ReductionPlanSummary,
} from "@/lib/pdf/reduction-maker";
import { toast } from "sonner";

export function ReductionMakerTool({ tool }: { tool: Tool }) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [sheetCount, setSheetCount] = useState<9 | 12 | 16>(9);
  const [state, setState] = useState<ToolState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | undefined>(undefined);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [successDetail, setSuccessDetail] = useState<string | null>(null);
  const [downloadBlobData, setDownloadBlobData] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState<string>("docly-reduction.pdf");

  const isProcessingRef = useRef(false);
  const isDownloadingRef = useRef(false);

  // Handle incoming file
  const handleFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    const selected = incoming[0]!;
    setFile(selected);
    setState("idle");
    setErrorDetail(null);
    setSuccessDetail(null);
    setDownloadBlobData(null);
    setProgress(0);

    setIsLoadingPages(true);
    try {
      const count = await getPdfPageCount(selected);
      setPageCount(count);
    } catch (err) {
      console.error("Failed to inspect PDF page count:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Could not read this PDF. Please verify the file is valid and unlocked.";
      setErrorDetail(msg);
      setState("error");
      setPageCount(null);
    } finally {
      setIsLoadingPages(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPageCount(null);
    setState("idle");
    setErrorDetail(null);
    setSuccessDetail(null);
    setDownloadBlobData(null);
    setProgress(0);
  };

  // Calculate dynamic reduction plan whenever pageCount or sheetCount changes
  const plan: ReductionPlanSummary | null = useMemo(() => {
    if (!pageCount || pageCount <= 0) return null;
    try {
      return calculateReductionPlan(pageCount, sheetCount);
    } catch (err) {
      return null;
    }
  }, [pageCount, sheetCount]);

  // User-facing distribution description
  const distributionText = useMemo(() => {
    if (!plan) return "";
    if (plan.totalPdfPages < plan.selectedSheetCount * 2) {
      return `1 original page per printable side (fits comfortably in ${plan.actualSheetCount} sheets)`;
    }
    if (plan.minPagesPerSide === plan.maxPagesPerSide) {
      return `${plan.minPagesPerSide} original page${plan.minPagesPerSide === 1 ? "" : "s"} per printable side`;
    }
    return `${plan.minPagesPerSide}–${plan.maxPagesPerSide} original pages per printable side`;
  }, [plan]);

  const handleProcess = async () => {
    if (!file || !pageCount || !plan) return;
    if (state === "loading" || isProcessingRef.current) return;
    isProcessingRef.current = true;

    setState("loading");
    setErrorDetail(null);
    setSuccessDetail(null);
    setProgress(5);
    setProgressLabel("Analyzing document and preparing duplex layout...");

    try {
      const result = await createReducedPdf(file, sheetCount, (pct) => {
        setProgress(pct);
        if (pct < 30) {
          setProgressLabel("Reading original pages...");
        } else if (pct < 85) {
          setProgressLabel("Arranging duplex sheets (front & back)...");
        } else {
          setProgressLabel("Generating final printable PDF...");
        }
      });

      setDownloadBlobData(result.blob);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setDownloadName(`${baseName}-reduced-${result.sheetCount}sheets.pdf`);
      setSuccessDetail(`${result.totalPdfPages} pages arranged across ${result.sheetCount} sheets`);
      setState("success");
    } catch (err) {
      console.error("Reduction processing failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while creating the reduced PDF.";
      setErrorDetail(msg);
      setState("error");
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleDownloadClick = async () => {
    if (!downloadBlobData || isDownloadingRef.current) return;
    isDownloadingRef.current = true;
    try {
      await downloadValidatedBlob(downloadBlobData, downloadName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed.";
      toast.error("Download failed", { description: msg });
    } finally {
      setTimeout(() => {
        isDownloadingRef.current = false;
      }, 1200);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPageCount(null);
    setState("idle");
    setErrorDetail(null);
    setSuccessDetail(null);
    setDownloadBlobData(null);
    setProgress(0);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-border bg-card/60 backdrop-blur-xs">
        <div className="container-page flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/pdf-tools" className="hover:text-foreground transition-colors">
            PDF Tools
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">{tool.name}</span>
        </div>
      </div>

      {/* Hero */}
      <PageHero
        eyebrow="PDF Reduction"
        title={tool.name}
        description="Creates a reduced PDF ready for double-sided printing."
      />

      {/* Main Workspace */}
      <div className="container-page py-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Important Print Instruction Notice */}
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
            <Printer className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <strong>Printing instruction:</strong> After downloading, print normally using{" "}
              <span className="font-semibold text-primary">Both Sides / Duplex</span>. Do not use{" "}
              <em>Pages per Sheet</em> in your printer dialog — the page reduction is already built
              directly into the generated PDF.
            </div>
          </div>

          {/* Uploader (shown when no file selected) */}
          {!file && (
            <div className="space-y-4">
              <FileUploader
                formats={tool.formats}
                multiple={false}
                onFiles={handleFiles}
                disabled={state === "loading" || isLoadingPages}
              />
            </div>
          )}

          {/* Selected File Card */}
          {file && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm sm:text-base text-foreground">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatBytes(file.size)}</span>
                      {isLoadingPages && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Loader2 className="h-3 w-3 animate-spin" /> Counting pages...
                        </span>
                      )}
                      {!isLoadingPages && pageCount !== null && (
                        <span className="font-semibold text-foreground">
                          • PDF pages: {pageCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {state !== "loading" && (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-destructive/40 transition-colors"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Step 2 & 3: Display PDF Pages and Sheet Count Selection */}
              {pageCount !== null && pageCount > 0 && state !== "success" && (
                <div className="border-t border-border pt-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Number of sheets
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Target physical double-sided sheets.
                      </p>
                    </div>

                    {/* Sheet Count Selector Buttons: [ 9 ] [ 12 ] [ 16 ] */}
                    <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1 shadow-xs">
                      {([9, 12, 16] as const).map((count) => {
                        const isSelected = sheetCount === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setSheetCount(count)}
                            disabled={state === "loading"}
                            className={`min-w-16 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {count}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 4: Display Summary */}
                  {plan && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-foreground">
                          {pageCount} pages → {plan.actualSheetCount} sheet
                          {plan.actualSheetCount === 1 ? "" : "s"}
                          {plan.actualSheetCount < sheetCount && (
                            <span className="text-xs font-normal text-muted-foreground ml-1.5">
                              (within {sheetCount} sheets max)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{distributionText}</div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        <Layers className="h-3.5 w-3.5" />
                        {plan.totalPrintableSides} printable sides (Duplex)
                      </div>
                    </div>
                  )}

                  {/* Step 5: Simple Visual Preview */}
                  {plan && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Physical Sheet Layout Preview
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {plan.sheets.length} physical sheet
                          {plan.sheets.length === 1 ? "" : "s"} total
                        </span>
                      </div>

                      <div className="max-h-80 overflow-y-auto rounded-xl border border-border bg-surface/50 p-3 space-y-2.5">
                        {plan.sheets.map((s) => (
                          <div
                            key={s.sheetNumber}
                            className="rounded-lg border border-border bg-card p-3 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-foreground">
                              <span>Sheet {s.sheetNumber}</span>
                              <span className="text-[0.7rem] font-normal text-muted-foreground">
                                {s.frontPages.length + s.backPages.length} source page
                                {s.frontPages.length + s.backPages.length === 1 ? "" : "s"}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {/* FRONT SIDE */}
                              <div className="rounded-md border border-border/70 bg-surface p-2 space-y-1.5">
                                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground block">
                                  FRONT (Output Page {s.sheetNumber * 2 - 1})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {s.frontPages.length > 0 ? (
                                    s.frontPages.map((p) => (
                                      <span
                                        key={p}
                                        className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary border border-primary/20"
                                      >
                                        Page {p}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs italic text-muted-foreground">
                                      Blank side
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* BACK SIDE */}
                              <div className="rounded-md border border-border/70 bg-surface p-2 space-y-1.5">
                                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground block">
                                  BACK (Output Page {s.sheetNumber * 2})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {s.backPages.length > 0 ? (
                                    s.backPages.map((p) => (
                                      <span
                                        key={p}
                                        className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground border border-border"
                                      >
                                        Page {p}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs italic text-muted-foreground">
                                      Blank side
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 6: Button "Create Reduced PDF" */}
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={handleProcess}
                      disabled={state === "loading" || isLoadingPages || !plan}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-90 sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                      Create Reduced PDF
                    </button>
                    <p className="text-xs text-muted-foreground">
                      Creates a reduced PDF with native vector quality. Ready for Both Sides / Duplex
                      printing.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress Indicator */}
          {state === "loading" && (
            <ProgressIndicator value={progress} label={progressLabel} />
          )}

          {/* Error Message */}
          {state === "error" && (
            <ErrorMessage
              message={
                errorDetail ??
                "We encountered an issue reducing your PDF. Please check the file and try again."
              }
            />
          )}

          {/* Step 8 & 9: Success State */}
          {state === "success" && downloadBlobData && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center space-y-5 animate-in fade-in duration-200">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-foreground">Reduction complete</h3>
                <p className="text-sm text-muted-foreground">
                  {successDetail ??
                    `${pageCount} pages arranged across ${plan?.actualSheetCount} sheets`}
                </p>
              </div>

              {/* Crucial Duplex Print Instruction */}
              <div className="max-w-lg mx-auto rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground text-left flex items-center gap-2.5">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <span>
                  <strong>Print Instruction:</strong> After downloading, print normally using{" "}
                  <strong>Both Sides / Duplex</strong>. Do not use <em>Pages per Sheet</em> in your
                  printer dialog.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadClick}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reduce Another PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
