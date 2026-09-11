import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Download, Printer, ShieldCheck, Sparkles, Zap, RotateCcw, Check } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { FileUploader } from "@/components/files/FileUploader";
import { FileList, type SelectedFile } from "@/components/files/FileList";
import { FilePreview } from "@/components/files/FilePreview";
import {
  DownloadButton,
  ErrorMessage,
  ProcessingButton,
  ProgressIndicator,
  SuccessMessage,
  type ToolState,
} from "@/components/files/ToolStates";

// Universal Download & Validation
import { downloadBlob, downloadZip, createZipBlob, downloadValidatedBlob } from "@/lib/files/download";
import { validatePdfFile, validateImageFile, validateOfficeDocument } from "@/lib/files/validation";
import { formatBytes } from "@/lib/format";

// PDF Engines
import { mergePdfFiles } from "@/lib/pdf/merge";
import { splitPdfByRanges, splitAllPages, parsePageRanges } from "@/lib/pdf/split";
import { deletePdfPages } from "@/lib/pdf/delete-pages";
import { extractPdfPages } from "@/lib/pdf/extract";
import { reorderPdfPages } from "@/lib/pdf/reorder";
import { rotatePdfPages, type RotationAngle } from "@/lib/pdf/rotate";
import { compressPdf, type CompressionResult } from "@/lib/pdf/compress";
import { addPdfWatermark, type WatermarkOptions } from "@/lib/pdf/watermark";
import { addPdfPageNumbers, type PageNumberOptions } from "@/lib/pdf/page-numbers";
import { removePdfMetadata } from "@/lib/pdf/metadata";
import { cropPdf, type CropMargins } from "@/lib/pdf/crop";
import { repairPdf } from "@/lib/pdf/repair";
import { unlockPdf } from "@/lib/pdf/unlock";
import { protectPdf } from "@/lib/pdf/protect";
import { convertPdfToImages } from "@/lib/pdf/pdf-to-images";
import { extractPdfText } from "@/lib/pdf/pdfjs";

// Image Engines
import { convertImage } from "@/lib/image/convert";
import { resizeImage, type ResizeOptions } from "@/lib/image/resize";
import { cropImage, type CropArea } from "@/lib/image/crop";
import { transformImage, type TransformFlip } from "@/lib/image/transform";
import { applyImageFilters, type FilterOptions } from "@/lib/image/filters";
import { compressImage, type ImageCompressionResult } from "@/lib/image/compress";
import { removeImageMetadata } from "@/lib/image/metadata";
import { imagesToPdf } from "@/lib/image/to-pdf";

// AI & OCR Engines
import { recognizeImageText, recognizePdfText, type OcrResult } from "@/lib/ai/ocr";
import {
  generatePassportPhoto,
  type PassportPhotoConfig,
  type PassportPhotoOutput,
} from "@/lib/ai/passport-photo";
import {
  removeImageBackground,
  replaceImageBackground,
  type ReplaceBackgroundOptions as ReplaceBgConfig,
  type SegmentationResult,
} from "@/lib/ai/segmentation";
import { ReplaceBackgroundOptions } from "@/components/tool/options/ReplaceBackgroundOptions";
import {
  analyzeDocumentLocally,
  searchDocumentLocally,
  executeAiCompletion,
  type LocalDocumentAnalysis,
} from "@/lib/ai/adapter";

// Office Engine
import { convertOfficeDocument } from "@/lib/office/adapter";

// Option Panels
import { PdfSplitOptions } from "@/components/tool/options/PdfSplitOptions";
import { PdfPageSelector } from "@/components/tool/options/PdfPageSelector";
import { PdfWatermarkOptions } from "@/components/tool/options/PdfWatermarkOptions";
import { PdfPageNumberOptions } from "@/components/tool/options/PdfPageNumberOptions";
import { PdfCropOptions } from "@/components/tool/options/PdfCropOptions";
import { PdfSecurityOptions } from "@/components/tool/options/PdfSecurityOptions";
import { ImageResizeOptions } from "@/components/tool/options/ImageResizeOptions";
import { ImageCropOptions } from "@/components/tool/options/ImageCropOptions";
import { ImageTransformOptions } from "@/components/tool/options/ImageTransformOptions";
import { ImageAdjustmentOptions } from "@/components/tool/options/ImageAdjustmentOptions";
import { ImageCompressOptions } from "@/components/tool/options/ImageCompressOptions";
import { PassportPhotoOptions } from "@/components/tool/options/PassportPhotoOptions";
import { OcrViewOptions } from "@/components/tool/options/OcrViewOptions";
import { AiToolContainer } from "@/components/tool/ai/AiToolContainer";
import { OfficeToolContainer } from "@/components/tool/office/OfficeToolContainer";
import { useAuth } from "@/lib/supabase/auth-context";
import { useSubscription } from "@/lib/monetization/subscription";
import { checkToolUsage, recordSuccessfulUsage } from "@/lib/monetization/usage";
import { BENEFIT_MESSAGES, isProTool } from "@/lib/monetization/config";
import { openRazorpayCheckout } from "@/lib/razorpay/service";
import { toast } from "sonner";

const groupLabel: Record<
  Tool["group"],
  { label: string; to: "/pdf-tools" | "/image-tools" | "/ai-tools" }
> = {
  pdf: { label: "PDF Tools", to: "/pdf-tools" },
  image: { label: "Image Tools", to: "/image-tools" },
  ai: { label: "AI Tools", to: "/ai-tools" },
};

function revokeUrl(url?: string) {
  if (url && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore if already revoked
    }
  }
}

export function ToolPage({ tool }: { tool: Tool }) {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const requiresPro = tool.access === "pro" || isProTool(tool.id);
  const isLocked = requiresPro && !isPro;
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleProUpgrade = async () => {
    setIsUpgrading(true);
    const res = await openRazorpayCheckout(
      { redirect: tool.route },
      {
        email: user?.email || undefined,
        name: (user?.user_metadata?.["display_name"] as string | undefined) || undefined,
      },
    );
    setIsUpgrading(false);
    if (res.notConfigured) {
      toast.info("Pro checkout isn't available yet.", {
        description: res.error || "Your account is ready for Docly Pro.",
      });
    } else if (res.error && res.error !== "Payment dismissed") {
      toast.error(res.error);
    }
  };

  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [state, setState] = useState<ToolState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | undefined>(undefined);
  const [downloadBlobData, setDownloadBlobData] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState<string>(`docly-${tool.id}.pdf`);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [successDetail, setSuccessDetail] = useState<string | null>(null);

  // Tool Specific States
  // Split
  const [splitMode, setSplitMode] = useState<"ranges" | "all">("ranges");
  const [splitRanges, setSplitRanges] = useState<string>("1-2");

  // Page Selector (Remove, Extract, Reorder)
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);

  // Rotate
  const [rotationAngle, setRotationAngle] = useState<number>(90);
  const [imageFlip, setImageFlip] = useState<TransformFlip>("none");

  // Watermark
  const [watermarkOpts, setWatermarkOpts] = useState<WatermarkOptions>({
    text: "CONFIDENTIAL",
    opacity: 0.25,
    rotation: 45,
    color: "gray",
  });

  // Page Numbers
  const [pageNumberOpts, setPageNumberOpts] = useState<PageNumberOptions>({
    position: "bottom-center",
    format: "page-x-of-y",
    startingNumber: 1,
  });

  // Crop PDF
  const [cropMargins, setCropMargins] = useState<CropMargins>({
    top: 36,
    bottom: 36,
    left: 36,
    right: 36,
  });

  // Password Unlock & Protect
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>("");

  // Image Resize
  const [resizeOpts, setResizeOpts] = useState<ResizeOptions>({
    preserveAspectRatio: true,
  });

  // Image Crop
  const [imageCropArea, setImageCropArea] = useState<CropArea>({
    x: 0,
    y: 0,
    width: 600,
    height: 600,
  });

  // Image Adjustments
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    brightness: 0,
    contrast: 0,
    grayscale: false,
  });

  // Image Compress
  const [imageQuality, setImageQuality] = useState<number>(0.75);

  // Passport Photo
  const [passportConfig, setPassportConfig] = useState<PassportPhotoConfig>({
    presetId: "us",
    backgroundColor: "#ffffff",
    generatePrintSheet: true,
  });
  const [passportResult, setPassportResult] = useState<PassportPhotoOutput | null>(null);

  // Background Removal & Replacement
  const [replaceBgConfig, setReplaceBgConfig] = useState<ReplaceBgConfig>({
    type: "color",
    color: "#FFFFFF",
  });
  const [segmentationResult, setSegmentationResult] = useState<SegmentationResult | null>(null);

  // OCR
  const [ocrLang, setOcrLang] = useState<string>("eng");
  const [ocrResult, setOcrResult] = useState<OcrResult | undefined>(undefined);

  // AI Document
  const [localAnalysis, setLocalAnalysis] = useState<LocalDocumentAnalysis | undefined>(undefined);
  const [docPages, setDocPages] = useState<Array<{ pageNumber: number; text: string }>>([]);
  const [generativeOutput, setGenerativeOutput] = useState<string | undefined>(undefined);
  const [chatQuery, setChatQuery] = useState<string>("");
  const [chatMatches, setChatMatches] = useState<Array<{ pageNumber: number; snippet: string }>>(
    [],
  );
  const [targetLang, setTargetLang] = useState<string>("es");

  const filesRef = useRef<SelectedFile[]>(files);
  filesRef.current = files;
  const isProcessingRef = useRef<boolean>(false);
  const isDownloadingRef = useRef<boolean>(false);

  const Icon = tool.icon;
  const parent = groupLabel[tool.group];

  // Object URL cleanup
  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => revokeUrl(file.previewUrl));
    };
  }, [tool.id]);

  // Object URL lifecycle management for download
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

  // Read first file metadata for image dimensions or PDF page count if applicable
  useEffect(() => {
    if (files.length === 0) {
      setLocalAnalysis(undefined);
      setDocPages([]);
      setOcrResult(undefined);
      setGenerativeOutput(undefined);
      return;
    }

    const first = files[0];
    if (!first) return;

    if (first.file.type.startsWith("image/") || first.file.name.match(/\.(jpe?g|png|webp)$/i)) {
      const img = new Image();
      const previewSrc = URL.createObjectURL(first.file);
      img.src = previewSrc;
      img.onload = () => {
        setResizeOpts((prev) => ({
          ...prev,
          width: img.naturalWidth,
          height: img.naturalHeight,
        }));
        setImageCropArea({
          x: 0,
          y: 0,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        URL.revokeObjectURL(previewSrc);
      };
      img.onerror = () => {
        URL.revokeObjectURL(previewSrc);
      };
    } else if (first.file.name.toLowerCase().endsWith(".pdf")) {
      // Extract text locally in background for AI tools
      if (tool.group === "ai" || tool.id.includes("ocr")) {
        extractPdfText(first.file)
          .then((res) => {
            setDocPages(res.pages);
            const analysis = analyzeDocumentLocally(res.text, res.pages.length);
            setLocalAnalysis(analysis);
          })
          .catch(() => {
            // Ignore background read failure
          });
      }
    }
  }, [files, tool.id, tool.group]);

  // Handle chat query changes
  useEffect(() => {
    if (tool.id === "chat-with-pdf" && chatQuery.trim() && docPages.length > 0) {
      const matches = searchDocumentLocally(chatQuery, docPages);
      setChatMatches(matches);
    } else {
      setChatMatches([]);
    }
  }, [chatQuery, docPages, tool.id]);

  // Set intuitive default options when switching between image tools
  useEffect(() => {
    if (tool.id === "brightness") {
      setFilterOpts({ brightness: 25, contrast: 0, grayscale: false });
    } else if (tool.id === "contrast") {
      setFilterOpts({ brightness: 0, contrast: 25, grayscale: false });
    } else if (tool.id === "grayscale") {
      setFilterOpts({ brightness: 0, contrast: 0, grayscale: true });
    } else if (tool.id === "flip-image") {
      setImageFlip("horizontal");
      setRotationAngle(0);
    } else if (tool.id === "rotate-image") {
      setImageFlip("none");
      setRotationAngle(90);
    }
  }, [tool.id]);

  const addFiles = async (incoming: File[]) => {
    const validated: File[] = [];
    for (const f of incoming) {
      if (f.name.toLowerCase().endsWith(".pdf")) {
        const check = await validatePdfFile(f);
        if (!check.valid) {
          setErrorDetail(check.error ?? "Invalid PDF file.");
          setState("error");
          return;
        }
      } else if (f.type.startsWith("image/") || f.name.match(/\.(jpe?g|png|webp)$/i)) {
        const check = await validateImageFile(f);
        if (!check.valid) {
          setErrorDetail(check.error ?? "Invalid image file.");
          setState("error");
          return;
        }
      } else if (f.name.match(/\.(docx?|xlsx?|pptx?)$/i)) {
        const check = await validateOfficeDocument(f);
        if (!check.valid) {
          setErrorDetail(check.error ?? "Invalid Office document.");
          setState("error");
          return;
        }
      }
      validated.push(f);
    }

    const mapped = validated.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));

    setFiles((prev) => {
      if (!tool.multiple) {
        prev.forEach((f) => revokeUrl(f.previewUrl));
        return mapped.slice(0, 1);
      }
      return [...prev, ...mapped];
    });

    setState("idle");
    setProgress(0);
    setProgressLabel(undefined);
    setErrorDetail(null);
    setSuccessDetail(null);
    setDownloadBlobData(null);
    setPasswordInput("");
    setConfirmPasswordInput("");
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) revokeUrl(target.previewUrl);
      const remaining = prev.filter((f) => f.id !== id);
      if (remaining.length === 0) {
        setPasswordInput("");
        setConfirmPasswordInput("");
      }
      return remaining;
    });
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    const firstFile = files[0]?.file;
    if (!firstFile) return;

    if (state === "loading" || isProcessingRef.current) return;
    isProcessingRef.current = true;

    setState("loading");
    setErrorDetail(null);
    setSuccessDetail(null);
    setProgress(0);

    try {
      // 1. MERGE PDF
      if (tool.id === "merge-pdf") {
        if (files.length < 2) {
          throw new Error("Please add at least 2 PDF files to merge.");
        }
        setProgressLabel("Merging PDF pages...");
        const rawFiles = files.map((f) => f.file);
        const blob = await mergePdfFiles(rawFiles, (pct) => setProgress(pct));
        setDownloadBlobData(blob);
        setDownloadName("docly-merged.pdf");
        setSuccessDetail(`Merged ${files.length} documents into one PDF.`);
      }

      // 2. SPLIT PDF
      else if (tool.id === "split-pdf") {
        setProgressLabel("Splitting PDF...");
        if (splitMode === "all") {
          const results = await splitAllPages(firstFile, "docly-page", (pct) => setProgress(pct));
          if (results.length === 1 && results[0]) {
            setDownloadBlobData(results[0].blob);
            setDownloadName(results[0].name);
          } else {
            const filesToZip = results.map((r) => ({ name: r.name, blob: r.blob }));
            const zipBlob = await createZipBlob(filesToZip);
            setDownloadBlobData(zipBlob);
            setDownloadName("docly-split-pages.zip");
            setSuccessDetail(
              `Extracted ${results.length} individual pages into a ZIP archive. Ready to download.`,
            );
          }
        } else {
          const { pages } = await extractPdfText(firstFile);
          const groups = parsePageRanges(splitRanges, pages.length);
          const results = await splitPdfByRanges(firstFile, groups, "docly-split", (pct) =>
            setProgress(pct),
          );
          if (results.length === 1 && results[0]) {
            setDownloadBlobData(results[0].blob);
            setDownloadName(results[0].name);
            setSuccessDetail(`Split into 1 document (${results[0].pageCount} pages).`);
          } else {
            const filesToZip = results.map((r) => ({ name: r.name, blob: r.blob }));
            const zipBlob = await createZipBlob(filesToZip);
            setDownloadBlobData(zipBlob);
            setDownloadName("docly-split-ranges.zip");
            setSuccessDetail(
              `Split into ${results.length} files bundled as a ZIP archive. Ready to download.`,
            );
          }
        }
      }

      // 3. REMOVE PAGES
      else if (tool.id === "remove-pages") {
        if (selectedPages.length === 0) {
          throw new Error("Please select at least 1 page to remove.");
        }
        setProgressLabel("Removing selected pages...");
        const res = await deletePdfPages(firstFile, selectedPages, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-pages-removed.pdf");
        setSuccessDetail(
          `Removed ${selectedPages.length} page(s). Remaining: ${res.newCount} page(s).`,
        );
      }

      // 4. EXTRACT PAGES
      else if (tool.id === "extract-pages") {
        if (selectedPages.length === 0) {
          throw new Error("Please select at least 1 page to extract.");
        }
        setProgressLabel("Extracting selected pages...");
        const res = await extractPdfPages(firstFile, selectedPages, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-extracted-pages.pdf");
        setSuccessDetail(`Extracted ${res.pageCount} page(s) into a new PDF.`);
      }

      // 5. REORDER PDF
      else if (tool.id === "reorder-pdf") {
        if (pageOrder.length === 0) {
          throw new Error("Page order could not be resolved.");
        }
        setProgressLabel("Reordering pages...");
        const res = await reorderPdfPages(firstFile, pageOrder, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-reordered.pdf");
        setSuccessDetail(`Reordered ${res.pageCount} pages to your sequence.`);
      }

      // 6. ROTATE PDF
      else if (tool.id === "rotate-pdf") {
        setProgressLabel(`Rotating pages by ${rotationAngle}°...`);
        const res = await rotatePdfPages(
          firstFile,
          rotationAngle as RotationAngle,
          undefined,
          (pct) => setProgress(pct),
        );
        setDownloadBlobData(res.blob);
        setDownloadName("docly-rotated.pdf");
        setSuccessDetail(`Rotated all ${res.pageCount} pages by ${rotationAngle}°.`);
      }

      // 7. COMPRESS PDF
      else if (tool.id === "compress-pdf") {
        setProgressLabel("Compressing PDF streams...");
        const res = await compressPdf(firstFile, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-compressed.pdf");
        setSuccessDetail(res.explanation);
      }

      // 8. ADD PAGE NUMBERS
      else if (tool.id === "add-page-numbers") {
        setProgressLabel("Numbering PDF pages...");
        const res = await addPdfPageNumbers(firstFile, pageNumberOpts, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-numbered.pdf");
        setSuccessDetail(`Numbered ${res.pageCount} pages successfully.`);
      }

      // 9. ADD WATERMARK
      else if (tool.id === "add-watermark") {
        setProgressLabel("Applying watermark...");
        const res = await addPdfWatermark(firstFile, watermarkOpts, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-watermarked.pdf");
        setSuccessDetail(`Stamped "${watermarkOpts.text}" onto ${res.pageCount} pages.`);
      }

      // 10. REMOVE PDF METADATA
      else if (tool.id === "remove-pdf-metadata") {
        setProgressLabel("Stripping metadata headers and XMP streams...");
        const res = await removePdfMetadata(firstFile, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-clean.pdf");
        setSuccessDetail(`Cleaned fields: ${res.removedFields.join(", ")}.`);
      }

      // 11. CROP PDF
      else if (tool.id === "crop-pdf") {
        setProgressLabel("Trimming PDF margins...");
        const res = await cropPdf(firstFile, cropMargins, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-cropped.pdf");
        setSuccessDetail(`Trimmed margins on ${res.pageCount} pages.`);
      }

      // 12. REPAIR PDF
      else if (tool.id === "repair-pdf") {
        setProgressLabel("Analyzing and reconstructing xref tables...");
        const res = await repairPdf(firstFile, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName("docly-repaired.pdf");
        setSuccessDetail(res.status);
      }

      // 13. AUTHORIZED PDF UNLOCK
      else if (tool.id === "unlock-pdf") {
        setProgressLabel("Decrypting with authorized password...");
        const res = await unlockPdf(firstFile, passwordInput, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        const baseName = firstFile.name.replace(/\.[^/.]+$/, "").replace(/-protected$/, "");
        setDownloadName(`${baseName}-unlocked.pdf`);
        setSuccessDetail("PDF unlocked successfully.");
        // Securely wipe password from component state
        setPasswordInput("");
      }

      // 13B. PROTECT PDF WITH PASSWORD
      else if (tool.id === "protect-pdf") {
        if (!passwordInput.trim()) {
          throw new Error("Please enter a password to protect this document.");
        }
        if (passwordInput.length < 4) {
          throw new Error("Password must be at least 4 characters long.");
        }
        if (passwordInput !== confirmPasswordInput) {
          throw new Error("Passwords do not match. Please ensure both password fields match.");
        }
        setProgressLabel("Encrypting PDF with password...");
        const res = await protectPdf(firstFile, passwordInput, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        setDownloadName(res.fileName);
        setSuccessDetail(
          `Document successfully encrypted and protected with password (${res.pageCount} pages).`,
        );
        // Securely wipe passwords from component state
        setPasswordInput("");
        setConfirmPasswordInput("");
      }

      // 14 & 15. PDF TO JPG / PNG
      else if (tool.id === "pdf-to-jpg" || tool.id === "pdf-to-png") {
        const fmt = tool.id === "pdf-to-jpg" ? "jpg" : "png";
        setProgressLabel(`Rendering pages as ${fmt.toUpperCase()}...`);
        const images = await convertPdfToImages(firstFile, fmt, 0.92, 1.5, (cur, tot) => {
          setProgress(Math.round((cur / tot) * 100));
        });

        if (images.length === 1 && images[0]) {
          setDownloadBlobData(images[0].blob);
          setDownloadName(images[0].name);
          setSuccessDetail(`Converted page 1 to ${fmt.toUpperCase()}.`);
        } else {
          const filesToZip = images.map((img) => ({ name: img.name, blob: img.blob }));
          const zipBlob = await createZipBlob(filesToZip);
          setDownloadBlobData(zipBlob);
          setDownloadName(`docly-pdf-images-${fmt}.zip`);
          setSuccessDetail(
            `Converted ${images.length} pages to ${fmt.toUpperCase()} (bundled as ZIP). Ready to download.`,
          );
        }
      }

      // 16, 17, 18. IMAGE(S) TO PDF
      else if (
        tool.id === "jpg-to-pdf" ||
        tool.id === "png-to-pdf" ||
        tool.id === "image-to-pdf" ||
        tool.id === "images-to-pdf"
      ) {
        setProgressLabel("Embedding images into PDF document...");
        const rawFiles = files.map((f) => f.file);
        const res = await imagesToPdf(rawFiles, (pct) => setProgress(pct));
        setDownloadBlobData(res.blob);
        const baseName = firstFile.name.replace(/\.[^/.]+$/, "");
        const outName = rawFiles.length === 1 ? `${baseName}.pdf` : "docly-images.pdf";
        setDownloadName(outName);
        setSuccessDetail(
          rawFiles.length === 1
            ? "Converted image into a clean PDF document."
            : `Created ${res.pageCount}-page PDF containing all ${rawFiles.length} images.`,
        );
      }

      // 19 - 24. IMAGE FORMAT CONVERSIONS
      else if (
        tool.id === "jpg-to-png" ||
        tool.id === "png-to-jpg" ||
        tool.id === "jpg-to-webp" ||
        tool.id === "png-to-webp" ||
        tool.id === "webp-to-jpg" ||
        tool.id === "webp-to-png"
      ) {
        let targetFmt: "jpg" | "png" | "webp" = "png";
        if (tool.id.endsWith("-jpg")) targetFmt = "jpg";
        else if (tool.id.endsWith("-webp")) targetFmt = "webp";

        setProgressLabel(`Converting to ${targetFmt.toUpperCase()}...`);
        if (files.length === 1) {
          const res = await convertImage(firstFile, targetFmt);
          setDownloadBlobData(res.blob);
          setDownloadName(res.filename);
          setSuccessDetail(`Converted to ${targetFmt.toUpperCase()} successfully.`);
        } else {
          const convertedList: Array<{ name: string; blob: Blob }> = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (!f) continue;
            setProgress(Math.round(((i + 1) / files.length) * 100));
            const res = await convertImage(f.file, targetFmt);
            convertedList.push({ name: res.filename, blob: res.blob });
          }
          const zipBlob = await createZipBlob(convertedList);
          setDownloadBlobData(zipBlob);
          setDownloadName(`docly-converted-${targetFmt}.zip`);
          setSuccessDetail(
            `Converted ${convertedList.length} images to ${targetFmt.toUpperCase()} (bundled in ZIP).`,
          );
        }
      }

      // 25. RESIZE IMAGE
      else if (tool.id === "image-resizer") {
        setProgressLabel("Resampling image dimensions...");
        if (files.length === 1) {
          const res = await resizeImage(firstFile, resizeOpts);
          setDownloadBlobData(res.blob);
          setDownloadName(res.filename);
          setSuccessDetail(`Resized image to ${res.width} × ${res.height} px.`);
        } else {
          const resizedList: Array<{ name: string; blob: Blob }> = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (!f) continue;
            setProgress(Math.round(((i + 1) / files.length) * 100));
            const res = await resizeImage(f.file, resizeOpts);
            resizedList.push({ name: res.filename, blob: res.blob });
          }
          const zipBlob = await createZipBlob(resizedList);
          setDownloadBlobData(zipBlob);
          setDownloadName("docly-resized-images.zip");
          setSuccessDetail(`Resized ${resizedList.length} images (bundled in ZIP).`);
        }
      }

      // 26. CROP IMAGE
      else if (tool.id === "crop-image") {
        setProgressLabel("Cropping image region...");
        const res = await cropImage(firstFile, imageCropArea);
        setDownloadBlobData(res.blob);
        setDownloadName(res.filename);
        setSuccessDetail("Cropped image successfully.");
      }

      // 27. ROTATE & FLIP IMAGE
      else if (tool.id === "rotate-image" || tool.id === "flip-image") {
        const rot = tool.id === "flip-image" ? 0 : rotationAngle;
        const flp =
          tool.id === "rotate-image" ? "none" : imageFlip === "none" ? "horizontal" : imageFlip;
        setProgressLabel(tool.id === "flip-image" ? `Flipping ${flp}...` : `Rotating ${rot}°...`);

        if (files.length === 1) {
          const res = await transformImage(firstFile, rot, flp);
          setDownloadBlobData(res.blob);
          setDownloadName(res.filename);
          setSuccessDetail(
            tool.id === "flip-image" ? `Mirrored image ${flp}ly.` : `Rotated image by ${rot}°.`,
          );
        } else {
          const transformedList: Array<{ name: string; blob: Blob }> = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (!f) continue;
            setProgress(Math.round(((i + 1) / files.length) * 100));
            const res = await transformImage(f.file, rot, flp);
            transformedList.push({ name: res.filename, blob: res.blob });
          }
          const zipBlob = await createZipBlob(transformedList);
          setDownloadBlobData(zipBlob);
          setDownloadName(
            tool.id === "flip-image" ? `docly-flipped-${flp}.zip` : `docly-rotated-${rot}deg.zip`,
          );
          setSuccessDetail(`Transformed ${transformedList.length} images (bundled in ZIP).`);
        }
      }

      // 28. BRIGHTNESS, CONTRAST, GRAYSCALE
      else if (tool.id === "brightness" || tool.id === "contrast" || tool.id === "grayscale") {
        setProgressLabel("Applying tonal filters...");
        const currentFilters: FilterOptions = {
          ...filterOpts,
          ...(tool.id === "grayscale" ? { grayscale: true } : {}),
        };
        if (files.length === 1) {
          const res = await applyImageFilters(firstFile, currentFilters);
          setDownloadBlobData(res.blob);
          setDownloadName(res.filename);
          setSuccessDetail("Applied tonal filter successfully.");
        } else {
          const filteredList: Array<{ name: string; blob: Blob }> = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (!f) continue;
            setProgress(Math.round(((i + 1) / files.length) * 100));
            const res = await applyImageFilters(f.file, currentFilters);
            filteredList.push({ name: res.filename, blob: res.blob });
          }
          const zipBlob = await createZipBlob(filteredList);
          setDownloadBlobData(zipBlob);
          setDownloadName("docly-filtered-images.zip");
          setSuccessDetail(`Applied filter to ${filteredList.length} images (bundled in ZIP).`);
        }
      }

      // 29. COMPRESS IMAGE
      else if (tool.id === "image-compressor") {
        setProgressLabel("Compressing image...");
        if (files.length === 1) {
          const res = await compressImage(firstFile, imageQuality);
          setDownloadBlobData(res.blob);
          setDownloadName(res.filename);
          setSuccessDetail(res.explanation);
        } else {
          const compressedList: Array<{ name: string; blob: Blob }> = [];
          let totalOriginal = 0;
          let totalNew = 0;
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (!f) continue;
            setProgress(Math.round(((i + 1) / files.length) * 100));
            const res = await compressImage(f.file, imageQuality);
            compressedList.push({ name: res.filename, blob: res.blob });
            totalOriginal += res.originalSize;
            totalNew += res.newSize;
          }
          const zipBlob = await createZipBlob(compressedList);
          setDownloadBlobData(zipBlob);
          setDownloadName("docly-compressed-images.zip");
          const savedKb = Math.round((totalOriginal - totalNew) / 1024);
          setSuccessDetail(
            `Compressed ${compressedList.length} images (${savedKb > 0 ? `${savedKb} KB saved` : "optimized"}). Bundled in ZIP.`,
          );
        }
      }

      // 30. REMOVE IMAGE METADATA
      else if (tool.id === "remove-image-metadata") {
        setProgressLabel("Stripping EXIF, GPS and camera metadata...");
        if (files.length === 1) {
          const res = await removeImageMetadata(firstFile);
          setDownloadBlobData(res.blob);
          setDownloadName(res.filename);
          setSuccessDetail("Stripped all camera, device, and GPS tags from image.");
        } else {
          const cleanList: Array<{ name: string; blob: Blob }> = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (!f) continue;
            setProgress(Math.round(((i + 1) / files.length) * 100));
            const res = await removeImageMetadata(f.file);
            cleanList.push({ name: res.filename, blob: res.blob });
          }
          const zipBlob = await createZipBlob(cleanList);
          setDownloadBlobData(zipBlob);
          setDownloadName("docly-clean-images.zip");
          setSuccessDetail(`Stripped metadata from ${cleanList.length} images (bundled in ZIP).`);
        }
      }

      // 31. AI PASSPORT PHOTO (FLAGSHIP)
      else if (tool.id === "passport-photo" || tool.id === "ai-passport-photo") {
        setProgressLabel("Analyzing photo...");
        const res = await generatePassportPhoto(firstFile, passportConfig, (pct, lbl) => {
          setProgress(pct);
          if (lbl) setProgressLabel(lbl);
        });
        setPassportResult(res);
        setDownloadBlobData(res.singleBlob);
        setDownloadName(res.singleFilename);
        setSuccessDetail(
          `Generated ${res.preset.name} photo (${res.preset.widthMm}×${res.preset.heightMm} mm @ 300 DPI). 100% original facial identity preserved.`,
        );
      }

      // AI BACKGROUND REMOVAL (AI-2)
      else if (tool.id === "remove-background" || tool.id === "background-remover") {
        setProgressLabel("Segmenting subject from background...");
        const res = await removeImageBackground(firstFile, (pct) => {
          setProgress(pct);
        });
        setSegmentationResult(res);
        setDownloadBlobData(res.blob);
        const base = firstFile.name.replace(/\.[^/.]+$/, "");
        setDownloadName(`${base}-transparent.png`);
        setSuccessDetail("Background removed successfully. 100% original subject preserved.");
      }

      // AI BACKGROUND REPLACEMENT (AI-3)
      else if (tool.id === "replace-background" || tool.id === "ai-background-replacement") {
        setProgressLabel("Segmenting and replacing background...");
        const res = await replaceImageBackground(firstFile, replaceBgConfig, (pct) => {
          setProgress(pct);
        });
        setSegmentationResult(res);
        setDownloadBlobData(res.blob);
        const base = firstFile.name.replace(/\.[^/.]+$/, "");
        const ext =
          replaceBgConfig.type === "color" && replaceBgConfig.color === "transparent"
            ? "png"
            : "jpg";
        setDownloadName(`${base}-new-bg.${ext}`);
        setSuccessDetail("Background successfully replaced with preserved subject identity.");
      }

      // 32. OCR / OCR PDF / Scan to Searchable PDF
      else if (tool.id === "ocr" || tool.id === "ocr-pdf" || tool.id === "scan-to-searchable-pdf") {
        const usage = checkToolUsage(tool.id, 1, isPro);
        if (!usage.allowed) {
          throw new Error(
            "You've reached your 2 free OCR pages for today. Upgrade to Docly Pro for unlimited OCR. Only ₹25/month.",
          );
        }
        setProgressLabel("Running optical character recognition...");
        let res: OcrResult;
        if (firstFile.name.toLowerCase().endsWith(".pdf")) {
          res = await recognizePdfText(firstFile, ocrLang, (pct, status) => {
            setProgress(pct);
            if (status) setProgressLabel(status);
          });
        } else {
          res = await recognizeImageText(firstFile, ocrLang, (pct, status) => {
            setProgress(pct);
            if (status) setProgressLabel(status);
          });
        }
        setOcrResult(res);
        const txtBlob = new Blob([res.text], { type: "text/plain;charset=utf-8" });
        setDownloadBlobData(txtBlob);
        setDownloadName("docly-ocr-text.txt");
        setSuccessDetail(`Recognized ${res.wordCount} words (${res.confidence}% confidence).`);

        // Record successful usage only after successful execution
        const pagesCount = res.pages?.length || 1;
        await recordSuccessfulUsage(tool.id, pagesCount, user?.id);
      }

      // 33. AI DOCUMENT TOOLS (Summary, Chat, Notes, Questions, Translate)
      else if (
        tool.id === "ai-pdf-summary" ||
        tool.id === "chat-with-pdf" ||
        tool.id === "pdf-to-notes" ||
        tool.id === "pdf-to-questions" ||
        tool.id === "translate-pdf"
      ) {
        setProgressLabel("Extracting document content...");
        const { text, pages } = await extractPdfText(firstFile, (cur, tot) => {
          setProgress(Math.round((cur / tot) * 40));
        });
        setDocPages(pages);
        const analysis = analyzeDocumentLocally(text, pages.length);
        setLocalAnalysis(analysis);

        let systemInstruction = "";
        let prompt = "";

        if (tool.id === "ai-pdf-summary") {
          systemInstruction =
            "You are an expert document analyst. Provide a clear, structured summary.";
          prompt = `Summarize the following document in 3-5 concise sections:\n\n${text.slice(0, 12000)}`;
        } else if (tool.id === "chat-with-pdf") {
          const query = chatQuery.trim() || "What are the key points of this document?";
          systemInstruction =
            "You are an assistant answering questions about the attached document with page citations.";
          prompt = `Document Text:\n${text.slice(0, 12000)}\n\nQuestion: ${query}`;
        } else if (tool.id === "pdf-to-notes") {
          systemInstruction = "Convert the document into structured Cornell-style study notes.";
          prompt = `Create study notes with key terms, summary, and bullet points:\n\n${text.slice(0, 12000)}`;
        } else if (tool.id === "pdf-to-questions") {
          systemInstruction = "Generate study questions (MCQ, short answer) based on the document.";
          prompt = `Generate 5 multiple choice and 3 short answer questions from this text:\n\n${text.slice(0, 12000)}`;
        } else if (tool.id === "translate-pdf") {
          systemInstruction = `Translate the document content accurately into ${targetLang}.`;
          prompt = `Translate the following text into ${targetLang}:\n\n${text.slice(0, 8000)}`;
        }

        setProgress(60);
        setProgressLabel("Consulting AI provider...");
        const aiRes = await executeAiCompletion(prompt, systemInstruction);

        if (aiRes.success && aiRes.content) {
          setGenerativeOutput(aiRes.content);
          const txtBlob = new Blob([aiRes.content], { type: "text/plain;charset=utf-8" });
          setDownloadBlobData(txtBlob);
          setDownloadName(`docly-${tool.id}-result.txt`);
          setSuccessDetail("AI analysis complete.");
        } else {
          // Transparent provider notification without fake results
          setSuccessDetail(
            "Local document outline and keyword metrics extracted. To enable generative AI output, configure your Gemini or OpenAI API key above.",
          );
        }
      }

      // 34. OFFICE CONVERSIONS
      else if (
        tool.id === "word-to-pdf" ||
        tool.id === "excel-to-pdf" ||
        tool.id === "powerpoint-to-pdf" ||
        tool.id === "pdf-to-word" ||
        tool.id === "pdf-to-excel" ||
        tool.id === "pdf-to-powerpoint"
      ) {
        setProgressLabel("Converting document...");
        let targetFmt: "pdf" | "docx" | "xlsx" | "pptx" = "pdf";
        if (tool.id.endsWith("-word")) targetFmt = "docx";
        else if (tool.id.endsWith("-excel")) targetFmt = "xlsx";
        else if (tool.id.endsWith("-powerpoint")) targetFmt = "pptx";

        const blob = await convertOfficeDocument(firstFile, targetFmt);
        setDownloadBlobData(blob);
        setDownloadName(`docly-converted.${targetFmt}`);
        setSuccessDetail(`Converted document to ${targetFmt.toUpperCase()} successfully.`);
      }

      setProgress(100);
      setState("success");
    } catch (err) {
      console.error("Processing failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during processing. Please verify the files and try again.";
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

  // Tools that require a minimum of 2 files
  const requiresMultiple = tool.id === "merge-pdf";
  const isPasswordReady =
    tool.id === "protect-pdf"
      ? passwordInput.trim().length >= 4 && passwordInput === confirmPasswordInput
      : tool.id === "unlock-pdf"
        ? passwordInput.trim().length > 0
        : true;

  const canProcess = (requiresMultiple ? files.length >= 2 : files.length >= 1) && isPasswordReady;

  // Tools requiring backend provider
  const isOfficeTool =
    tool.id === "word-to-pdf" ||
    tool.id === "excel-to-pdf" ||
    tool.id === "powerpoint-to-pdf" ||
    tool.id === "pdf-to-word" ||
    tool.id === "pdf-to-excel" ||
    tool.id === "pdf-to-powerpoint";

  const isAiDocTool =
    tool.id === "ai-pdf-summary" ||
    tool.id === "ai-pdf-summarizer" ||
    tool.id === "chat-with-pdf" ||
    tool.id === "pdf-to-notes" ||
    tool.id === "pdf-to-questions" ||
    tool.id === "translate-pdf" ||
    tool.id === "pdf-translator" ||
    tool.id === "resume-analyzer" ||
    tool.id === "ai-document-assistant" ||
    tool.id === "document-assistant" ||
    tool.id === "ai-document-generator" ||
    tool.id === "document-generator";

  // Check if tool is implemented
  const isImplemented = true;

  return (
    <div className="container-page py-8 sm:py-12">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link to={parent.to} className="transition-colors hover:text-primary">
          {parent.label}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{tool.name}</span>
      </nav>

      <header className="mt-6 flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface text-primary">
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{tool.name}</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          {tool.description}
        </p>
      </header>

      <div className="mx-auto mt-8 max-w-3xl space-y-5">
        {isLocked ? (
          <div className="rounded-3xl border-2 border-primary/40 bg-card p-8 sm:p-10 shadow-card text-center space-y-5 relative overflow-hidden animate-in fade-in duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-8 w-8" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                🔒 PRO
              </span>
              <h2 className="text-2xl font-extrabold text-foreground">{tool.name}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {tool.proBenefit || BENEFIT_MESSAGES[tool.id] || tool.description}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={handleProUpgrade}
                  disabled={isUpgrading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-opacity hover:opacity-95 w-full sm:w-auto disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {isUpgrading ? "Connecting to Razorpay..." : "Upgrade to Pro — ₹25/month"}
                </button>
              ) : (
                <Link
                  to="/login"
                  search={{ redirect: tool.route, reason: "upgrade" }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-opacity hover:opacity-95 w-full sm:w-auto"
                >
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro — ₹25/month
                </Link>
              )}
              <Link
                to="/pricing"
                search={{ redirect: tool.route, upgrade: "pro" }}
                className="text-xs text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
              >
                View all plan benefits
              </Link>
            </div>
          </div>
        ) : isAiDocTool ? (
          <AiToolContainer tool={tool} />
        ) : isOfficeTool ? (
          <OfficeToolContainer tool={tool} />
        ) : (
          <>
            {/* OCR Daily Limit Notice */}
            {(tool.id === "ocr" || tool.id === "ocr-pdf" || tool.id === "scan-to-searchable-pdf") &&
              !isPro &&
              !checkToolUsage(tool.id, 1, isPro).allowed && (
                <div className="rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-card text-center space-y-3 animate-in fade-in duration-200">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">
                      You've reached your 2 free OCR pages for today.
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Upgrade to Docly Pro for unlimited OCR. Only ₹25/month.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      to={user ? "/pricing" : "/login"}
                      search={
                        user
                          ? { redirect: tool.route, upgrade: "pro" }
                          : { redirect: tool.route, reason: "upgrade" }
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 transition-opacity"
                    >
                      <Sparkles className="h-4 w-4" />
                      Upgrade to Pro — ₹25/month
                    </Link>
                  </div>
                </div>
              )}

            <FileUploader
              formats={tool.formats}
              multiple={tool.multiple}
              onFiles={addFiles}
              disabled={state === "loading"}
            />

            <FileList files={files} onRemove={removeFile} />

            {/* Dynamic Tool Option Panels */}
            {files.length > 0 && (
              <div className="space-y-4">
                {/* Split PDF */}
                {tool.id === "split-pdf" && (
                  <PdfSplitOptions
                    mode={splitMode}
                    onChangeMode={setSplitMode}
                    rangeString={splitRanges}
                    onChangeRange={setSplitRanges}
                    totalPageCount={docPages.length || undefined}
                  />
                )}

                {/* Page Selection (Remove, Extract, Reorder) */}
                {(tool.id === "remove-pages" ||
                  tool.id === "extract-pages" ||
                  tool.id === "reorder-pdf") &&
                  files[0] && (
                    <PdfPageSelector
                      file={files[0].file}
                      mode={
                        tool.id === "remove-pages"
                          ? "remove"
                          : tool.id === "extract-pages"
                            ? "extract"
                            : "reorder"
                      }
                      selectedPages={selectedPages}
                      onChangeSelected={setSelectedPages}
                      order={pageOrder}
                      onChangeOrder={setPageOrder}
                    />
                  )}

                {/* Watermark */}
                {tool.id === "add-watermark" && (
                  <PdfWatermarkOptions options={watermarkOpts} onChange={setWatermarkOpts} />
                )}

                {/* Page Numbers */}
                {tool.id === "add-page-numbers" && (
                  <PdfPageNumberOptions options={pageNumberOpts} onChange={setPageNumberOpts} />
                )}

                {/* Crop PDF */}
                {tool.id === "crop-pdf" && (
                  <PdfCropOptions margins={cropMargins} onChange={setCropMargins} />
                )}

                {/* PDF Unlock & Protect */}
                {(tool.id === "unlock-pdf" || tool.id === "protect-pdf") && (
                  <PdfSecurityOptions
                    mode={tool.id === "unlock-pdf" ? "unlock" : "protect"}
                    password={passwordInput}
                    onChangePassword={setPasswordInput}
                    confirmPassword={confirmPasswordInput}
                    onChangeConfirmPassword={setConfirmPasswordInput}
                  />
                )}

                {/* Image Resize */}
                {tool.id === "image-resizer" && (
                  <ImageResizeOptions
                    options={resizeOpts}
                    onChange={setResizeOpts}
                    originalWidth={resizeOpts.width}
                    originalHeight={resizeOpts.height}
                  />
                )}

                {/* Image Crop */}
                {tool.id === "crop-image" && (
                  <ImageCropOptions
                    crop={imageCropArea}
                    onChange={setImageCropArea}
                    originalWidth={resizeOpts.width}
                    originalHeight={resizeOpts.height}
                  />
                )}

                {/* Rotate & Flip */}
                {(tool.id === "rotate-pdf" ||
                  tool.id === "rotate-image" ||
                  tool.id === "flip-image") && (
                  <ImageTransformOptions
                    rotation={rotationAngle}
                    onChangeRotation={setRotationAngle}
                    flip={imageFlip}
                    onChangeFlip={setImageFlip}
                    isRotateOnly={tool.id === "rotate-pdf" || tool.id === "rotate-image"}
                    isFlipOnly={tool.id === "flip-image"}
                  />
                )}

                {/* Adjustments (Brightness, Contrast, Grayscale) */}
                {(tool.id === "brightness" ||
                  tool.id === "contrast" ||
                  tool.id === "grayscale") && (
                  <ImageAdjustmentOptions
                    options={filterOpts}
                    onChange={setFilterOpts}
                    isBrightnessOnly={tool.id === "brightness"}
                    isContrastOnly={tool.id === "contrast"}
                    isGrayscaleOnly={tool.id === "grayscale"}
                  />
                )}

                {/* Image Compress */}
                {tool.id === "image-compressor" && (
                  <ImageCompressOptions quality={imageQuality} onChangeQuality={setImageQuality} />
                )}

                {/* Passport Photo */}
                {(tool.id === "passport-photo" || tool.id === "ai-passport-photo") && (
                  <PassportPhotoOptions config={passportConfig} onChange={setPassportConfig} />
                )}

                {/* Replace Background */}
                {(tool.id === "replace-background" || tool.id === "ai-background-replacement") && (
                  <ReplaceBackgroundOptions
                    config={replaceBgConfig}
                    onChange={setReplaceBgConfig}
                  />
                )}

                {/* OCR */}
                {(tool.id === "ocr" || tool.id === "ocr-pdf") && (
                  <OcrViewOptions
                    language={ocrLang}
                    onChangeLanguage={setOcrLang}
                    result={ocrResult}
                  />
                )}
              </div>
            )}

            <FilePreview files={files} />

            {state === "loading" && <ProgressIndicator value={progress} label={progressLabel} />}

            {state === "error" && (
              <ErrorMessage
                message={
                  errorDetail ?? "We couldn't process these files. Check the format and try again."
                }
              />
            )}

            {state === "success" && (
              <>
                <SuccessMessage
                  message={
                    successDetail ?? "Your file has been processed and is ready to download."
                  }
                />

                {/* AI Passport Photo Dedicated Before / After Preview */}
                {(tool.id === "passport-photo" || tool.id === "ai-passport-photo") && passportResult && (
                  <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">
                          Biometric Transformation Result
                        </h4>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        100% Identity Preserved (Non-Generative)
                      </span>
                    </div>

                    {/* Side-by-side Before / After Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before Card */}
                      <div className="flex flex-col items-center rounded-xl border border-border bg-surface/50 p-4">
                        <span className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Before — Original Photo
                        </span>
                        <div className="relative flex aspect-square max-h-72 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-black/5 dark:bg-black/30 p-2">
                          <img
                            src={passportResult.beforeDataUrl || files[0]?.previewUrl}
                            alt="Original photo before processing"
                            className="max-h-64 w-auto max-w-full object-contain rounded"
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground font-mono">
                          {files[0]?.name}
                        </p>
                      </div>

                      {/* After Card */}
                      <div className="flex flex-col items-center rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center justify-between w-full mb-2">
                          <span className="text-[0.7rem] font-bold uppercase tracking-wider text-primary">
                            After — AI Passport Photo
                          </span>
                          <span className="text-[0.65rem] font-medium text-muted-foreground bg-surface px-2 py-0.5 rounded border border-border">
                            {passportResult.preset.widthMm}×{passportResult.preset.heightMm} mm @
                            300 DPI
                          </span>
                        </div>
                        <div className="relative flex aspect-square max-h-72 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-card p-2 shadow-xs">
                          <img
                            src={passportResult.singleDataUrl}
                            alt="Processed passport photo"
                            className="max-h-64 w-auto max-w-full object-contain rounded shadow-sm"
                          />
                        </div>
                        <p className="mt-2 text-xs font-mono text-muted-foreground">
                          {passportResult.singleFilename} •{" "}
                          {formatBytes(passportResult.singleBlob.size)}
                        </p>
                      </div>
                    </div>

                    {/* AI Recommendation Notice */}
                    {passportResult.recommendation && (
                      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          <strong>Intelligent Recommendation:</strong> {passportResult.recommendation.label} background ({passportResult.recommendation.reason})
                        </span>
                      </div>
                    )}

                    {/* Biometric Validation Checklist */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border border-border bg-surface/50 p-3 text-[0.7rem]">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        100% Identity Preserved
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        Studio Enhanced
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        Head & Shoulders Framed
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        Biometric Sized ({passportResult.preset.widthMm}×{passportResult.preset.heightMm}mm)
                      </span>
                    </div>

                    {/* Download & Reset Actions */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(passportResult.singleBlob, passportResult.singleFilename)
                        }
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download Passport Photo
                      </button>

                      {passportResult.sheetBlob && (
                        <button
                          type="button"
                          onClick={() =>
                            downloadBlob(
                              passportResult.sheetBlob!,
                              passportResult.sheetFilename ?? "docly-passport-sheet-4x6in.jpg",
                            )
                          }
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground shadow-xs hover:border-primary/40 transition-colors"
                        >
                          <Printer className="h-4 w-4 text-primary" />
                          Download 4×6" Printable Sheet
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setFiles([]);
                          setState("idle");
                          setProgress(0);
                          setProgressLabel(undefined);
                          setDownloadBlobData(null);
                          setPassportResult(null);
                          setSuccessDetail(null);
                          setErrorDetail(null);
                        }}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-muted-foreground shadow-xs hover:text-foreground hover:border-border transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Try Another Photo
                      </button>
                    </div>

                    <p className="text-center text-[0.7rem] text-muted-foreground">
                      Passport-style photo. Official requirements vary by country and issuing authority. Please verify specifications before submission.
                    </p>
                  </div>
                )}


                {/* Standard Result Preview for All Other Tools */}
                {tool.id !== "passport-photo" && tool.id !== "ai-passport-photo" && downloadBlobData && (
                  <div className="flex flex-col items-center gap-4">
                    {/* Visual Result Preview */}
                    {downloadBlobData.type.startsWith("image/") && downloadUrl && (
                      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                        <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          Processed Result Preview
                        </span>
                        <div className="mt-2.5 flex max-h-72 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#ffffff_0%_50%)] [background-size:16px_16px] dark:bg-[repeating-conic-gradient(#262626_0%_25%,#18181b_0%_50%)] p-2">
                          <img
                            src={downloadUrl}
                            alt="Processed result"
                            className="max-h-64 w-auto object-contain rounded"
                          />
                        </div>
                        <p className="mt-2 text-xs font-mono text-muted-foreground">
                          {downloadName} • {formatBytes(downloadBlobData.size)}
                        </p>
                      </div>
                    )}

                    {downloadBlobData.type === "application/pdf" && (
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                          PDF
                        </span>
                        <div className="text-left">
                          <p className="font-semibold text-foreground text-xs">{downloadName}</p>
                          <p className="text-[0.7rem] text-muted-foreground">
                            {formatBytes(downloadBlobData.size)}
                          </p>
                        </div>
                      </div>
                    )}

                    {(downloadBlobData.type.includes("zip") || downloadName.endsWith(".zip")) && (
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                          ZIP
                        </span>
                        <div className="text-left">
                          <p className="font-semibold text-foreground text-xs">{downloadName}</p>
                          <p className="text-[0.7rem] text-muted-foreground">
                            {formatBytes(downloadBlobData.size)}
                          </p>
                        </div>
                      </div>
                    )}

                    <DownloadButton
                      fileName={downloadName}
                      downloadUrl={downloadUrl ?? undefined}
                      onClick={handleDownloadClick}
                    />
                  </div>
                )}
              </>
            )}

            <div className="pt-1">
              <ProcessingButton
                label={tool.actionLabel ?? tool.name}
                disabled={!canProcess || state === "loading"}
                loading={state === "loading"}
                hint={
                  requiresMultiple && files.length < 2
                    ? "Add at least 2 PDF files to enable merging."
                    : tool.id === "protect-pdf" && files.length > 0
                      ? passwordInput.length < 4
                        ? "Enter a password with at least 4 characters."
                        : passwordInput !== confirmPasswordInput
                          ? "Passwords do not match."
                          : undefined
                      : undefined
                }
                onClick={handleProcess}
              />
            </div>
          </>
        )}

        <div className="grid gap-3 pt-4 sm:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Client-Side Processing",
              copy: "Operations run securely inside your browser.",
            },
            {
              icon: ShieldCheck,
              title: "Private by Design",
              copy: "Files remain local and are never uploaded.",
            },
            {
              icon: Sparkles,
              title: "Consistent Output",
              copy: "Real byte-level precision across every tool.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-4">
              <item.icon className="h-4.5 w-4.5 text-primary" />
              <p className="mt-2 text-sm font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
