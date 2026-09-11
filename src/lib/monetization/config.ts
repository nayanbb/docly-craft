/**
 * Centralized Docly Monetization Configuration
 *
 * Single source of truth for pricing, file size limits, daily usage allowances,
 * Pro-only tool designations, and benefit-driven messaging.
 * DO NOT hard-code or duplicate these values elsewhere in the codebase.
 */

export const PRICING = {
  currencySymbol: "₹",
  free: {
    name: "Docly Free",
    planId: "free",
    price: 0,
    priceDisplay: "₹0",
    interval: "month",
    intervalDisplay: "/month",
    badge: "Forever Free",
  },
  pro: {
    name: "Docly Pro",
    planId: "pro",
    price: 25,
    priceDisplay: "₹25",
    interval: "month",
    intervalDisplay: "/month",
    ctaText: "Upgrade to Pro",
    ctaPriceText: "Upgrade to Pro — ₹25/month",
    badge: "Most popular",
  },
} as const;

export const FILE_SIZE_LIMITS = {
  freeMaxMb: 50,
  freeMaxBytes: 50 * 1024 * 1024,
  /** Configurable technical maximum for Pro users based on server/backend capacity */
  proMaxMb: 250,
  proMaxBytes: 250 * 1024 * 1024,
} as const;

export const CONVERSION_LIMITS = {
  /** 10 successful files per day per tool */
  dailyFreeLimitPerTool: 10,
  freeDailyConversions: 10,
  proDailyConversions: Infinity,
  tools: [
    "pdf-to-word",
    "pdf-to-excel",
    "pdf-to-powerpoint",
    "word-to-pdf",
    "excel-to-pdf",
    "powerpoint-to-pdf",
  ] as const,
} as const;

export type ConversionLimitedToolId = (typeof CONVERSION_LIMITS.tools)[number];

export const OCR_LIMITS = {
  /** 2 successful pages per day */
  dailyFreePages: 2,
  freeDailyPages: 2,
  proDailyPages: Infinity,
  tools: ["ocr-pdf", "ocr", "scan-to-searchable-pdf"] as const,
} as const;

export type OcrLimitedToolId = (typeof OCR_LIMITS.tools)[number];

/**
 * Tools that strictly require an active Pro subscription.
 * Free users can preview the tool and benefit message, but cannot execute them.
 */
export const PRO_ONLY_TOOL_IDS = new Set<string>([
  // AI Tools
  "passport-photo",
  "ai-passport-photo",
  "background-remover",
  "ai-background-replacement",
  "chat-with-pdf",
  "ai-pdf-summary",
  "pdf-to-notes",
  "pdf-to-questions",
  "ai-document-assistant",
  "translate-pdf",
  "resume-analyzer",
  "ai-document-generator",

  // Advanced PDF Tools
  "repair-pdf",
  "pdf-compare",
  "pdf-redaction",
  "edit-pdf",
  "advanced-security",
]);

/**
 * Benefit-oriented upgrade messages for locked tools and premium features.
 */
export const BENEFIT_MESSAGES: Record<string, string> = {
  "passport-photo":
    "Create a passport-style photo automatically while keeping your face and natural appearance unchanged.",
  "ai-passport-photo":
    "Create a passport-style photo automatically while keeping your face and natural appearance unchanged.",
  "chat-with-pdf": "Ask questions about your PDF instead of searching through every page manually.",
  "ai-pdf-summary": "Turn long PDFs into easy-to-read summaries in seconds.",
  "pdf-to-notes": "Convert lengthy study material into organized notes automatically.",
  "pdf-to-questions":
    "Generate practice questions and study quizzes from your document automatically.",
  "translate-pdf":
    "Translate documents into multiple languages while preserving structure and formatting.",
  "background-remover": "Cleanly isolate subjects and remove background with automated precision.",
  "ai-background-replacement": "Replace photo backgrounds with clean passport studio backdrops.",
  "ai-document-assistant": "Summarize, analyze, and draft content with dedicated AI assistance.",
  "resume-analyzer": "Review, critique, and optimize resumes against job descriptions.",
  "ai-document-generator": "Generate structured documents and reports with intelligent outlines.",
  "repair-pdf": "Analyze cross-reference tables and recover data from damaged PDF files.",
  "pdf-compare": "Compare two PDF versions side-by-side with visual change detection.",
  "pdf-redaction": "Permanently sanitize and black out sensitive data from documents.",
  "edit-pdf": "Add text, annotations, signatures, and shapes directly to PDF pages.",
  ocr: "Turn scanned documents into searchable and usable text.",
  "ocr-pdf": "Turn scanned documents into searchable and usable text.",
  "scan-to-searchable-pdf": "Turn scanned documents into searchable and usable text.",
  "batch-processing": "Process multiple files at once instead of uploading them one by one.",
  "large-files": "Process files larger than the 50 MB Free limit.",
  "office-conversions": "Get unlimited PDF and Office conversions with Docly Pro.",
};

export const UPGRADE_MESSAGES = {
  conversionLimit: {
    title: "You've reached your 10 free conversions for today.",
    description: "Upgrade to Docly Pro for unlimited conversions. Only ₹25/month.",
    price: "₹25/month",
    cta: "Upgrade to Pro",
  },
  ocrLimit: {
    title: "You've reached your 2 free OCR pages for today.",
    description: "Upgrade to Docly Pro for unlimited OCR. Only ₹25/month.",
    price: "₹25/month",
    cta: "Upgrade to Pro",
  },
  fileSizeLimit: {
    title: "Your file is larger than the 50 MB Free limit.",
    description: "Upgrade to Docly Pro to process larger files.",
    price: "₹25/month",
    cta: "Upgrade to Pro",
  },
} as const;

export function isProTool(toolId: string): boolean {
  return PRO_ONLY_TOOL_IDS.has(toolId);
}

export function isConversionLimitedTool(toolId: string): boolean {
  return (CONVERSION_LIMITS.tools as readonly string[]).includes(toolId);
}

export function isOcrLimitedTool(toolId: string): boolean {
  return (OCR_LIMITS.tools as readonly string[]).includes(toolId);
}

export function getMaxFileSizeBytes(isPro: boolean): number {
  return isPro ? FILE_SIZE_LIMITS.proMaxBytes : FILE_SIZE_LIMITS.freeMaxBytes;
}

export function getMaxFileSizeMb(isPro: boolean): number {
  return isPro ? FILE_SIZE_LIMITS.proMaxMb : FILE_SIZE_LIMITS.freeMaxMb;
}
