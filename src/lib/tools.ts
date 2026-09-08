import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  BadgeCheck,
  Blend,
  Bot,
  Brain,
  Crop,
  Combine,
  Contrast,
  Eraser,
  FileArchive,
  FileCheck2,
  FileDown,
  FileImage,
  FileInput,
  FileOutput,
  FilePlus2,
  FileQuestion,
  FileScan,
  FileSearch,
  FileSpreadsheet,
  FileStack,
  FileText,
  FileType2,
  FileUp,
  FlipHorizontal,
  Hash,
  IdCard,
  Image as ImageIcon,
  Images,
  Languages,
  Layers,
  Lock,
  Maximize2,
  MessageSquareText,
  Minimize2,
  NotebookPen,
  Palette,
  Presentation,
  RotateCw,
  Scissors,
  ShieldCheck,
  ShieldOff,
  Split,
  Stamp,
  Sun,
  Trash2,
  Unlock,
  Wand2,
  Wrench,
} from "lucide-react";

export type ToolStatus = "available" | "coming-soon" | "beta";

export type ToolGroup = "pdf" | "image" | "ai";

export type ToolCategoryId =
  | "organize-pdf"
  | "optimize-pdf"
  | "convert-to-pdf"
  | "convert-from-pdf"
  | "edit-pdf"
  | "pdf-security"
  | "image-conversion"
  | "image-editing"
  | "image-optimization"
  | "image-to-pdf"
  | "ai-image"
  | "ai-tools";

export interface Tool {
  id: string;
  name: string;
  category: ToolCategoryId;
  group: ToolGroup;
  description: string;
  icon: LucideIcon;
  route: string;
  formats: string[];
  multiple?: boolean;
  status: ToolStatus;
  actionLabel?: string;
}

export interface ToolCategory {
  id: ToolCategoryId;
  title: string;
  group: ToolGroup;
  blurb: string;
}

export const toolCategories: ToolCategory[] = [
  {
    id: "organize-pdf",
    title: "Organize PDF",
    group: "pdf",
    blurb: "Rearrange, split and reshape documents page by page.",
  },
  {
    id: "optimize-pdf",
    title: "Optimize PDF",
    group: "pdf",
    blurb: "Shrink, repair and make documents searchable.",
  },
  {
    id: "convert-to-pdf",
    title: "Convert to PDF",
    group: "pdf",
    blurb: "Turn images and office files into clean PDFs.",
  },
  {
    id: "convert-from-pdf",
    title: "Convert from PDF",
    group: "pdf",
    blurb: "Export PDF content into editable formats.",
  },
  { id: "edit-pdf", title: "Edit PDF", group: "pdf", blurb: "Annotate, stamp and adjust page content." },
  {
    id: "pdf-security",
    title: "PDF Security",
    group: "pdf",
    blurb: "Encrypt, unlock and clean sensitive information.",
  },
  {
    id: "image-conversion",
    title: "Image Conversion",
    group: "image",
    blurb: "Move between JPG, PNG and WEBP formats.",
  },
  { id: "image-editing", title: "Image Editing", group: "image", blurb: "Resize, crop and adjust images." },
  {
    id: "image-optimization",
    title: "Image Optimization",
    group: "image",
    blurb: "Reduce weight and strip hidden data.",
  },
  { id: "image-to-pdf", title: "Image to PDF", group: "image", blurb: "Bundle photos into documents." },
  { id: "ai-image", title: "AI Image Tools", group: "image", blurb: "Assisted photo preparation." },
  { id: "ai-tools", title: "AI Document Tools", group: "ai", blurb: "Understand and reuse document content." },
];

const t = (tool: Tool): Tool => tool;

export const tools: Tool[] = [
  // Organize PDF
  t({
    id: "merge-pdf",
    name: "Merge PDF",
    category: "organize-pdf",
    group: "pdf",
    description: "Combine multiple PDF files into one document.",
    icon: Combine,
    route: "/tools/merge-pdf",
    formats: ["PDF"],
    multiple: true,
    status: "coming-soon",
    actionLabel: "Merge PDF",
  }),
  t({
    id: "split-pdf",
    name: "Split PDF",
    category: "organize-pdf",
    group: "pdf",
    description: "Separate one PDF into several smaller files.",
    icon: Split,
    route: "/tools/split-pdf",
    formats: ["PDF"],
    status: "coming-soon",
    actionLabel: "Split PDF",
  }),
  t({
    id: "remove-pages",
    name: "Remove Pages",
    category: "organize-pdf",
    group: "pdf",
    description: "Delete the pages you no longer need.",
    icon: Trash2,
    route: "/tools/remove-pages",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "extract-pages",
    name: "Extract Pages",
    category: "organize-pdf",
    group: "pdf",
    description: "Pull selected pages into a new document.",
    icon: FileOutput,
    route: "/tools/extract-pages",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "reorder-pdf",
    name: "Reorder PDF",
    category: "organize-pdf",
    group: "pdf",
    description: "Drag pages into the order you want.",
    icon: ArrowUpDown,
    route: "/tools/reorder-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "rotate-pdf",
    name: "Rotate PDF",
    category: "organize-pdf",
    group: "pdf",
    description: "Fix page orientation in a few clicks.",
    icon: RotateCw,
    route: "/tools/rotate-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),

  // Optimize PDF
  t({
    id: "compress-pdf",
    name: "Compress PDF",
    category: "optimize-pdf",
    group: "pdf",
    description: "Reduce file size while keeping quality readable.",
    icon: Minimize2,
    route: "/tools/compress-pdf",
    formats: ["PDF"],
    status: "coming-soon",
    actionLabel: "Compress PDF",
  }),
  t({
    id: "repair-pdf",
    name: "Repair PDF",
    category: "optimize-pdf",
    group: "pdf",
    description: "Recover data from damaged or unreadable PDFs.",
    icon: Wrench,
    route: "/tools/repair-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "ocr-pdf",
    name: "OCR PDF",
    category: "optimize-pdf",
    group: "pdf",
    description: "Make scanned documents searchable and selectable.",
    icon: FileScan,
    route: "/tools/ocr-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),

  // Convert to PDF
  t({
    id: "jpg-to-pdf",
    name: "JPG to PDF",
    category: "convert-to-pdf",
    group: "pdf",
    description: "Turn JPG photos into a single PDF document.",
    icon: FileImage,
    route: "/tools/jpg-to-pdf",
    formats: ["JPG", "JPEG"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "png-to-pdf",
    name: "PNG to PDF",
    category: "convert-to-pdf",
    group: "pdf",
    description: "Convert PNG images into a print-ready PDF.",
    icon: FileImage,
    route: "/tools/png-to-pdf",
    formats: ["PNG"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "word-to-pdf",
    name: "Word to PDF",
    category: "convert-to-pdf",
    group: "pdf",
    description: "Export DOC and DOCX files with layout intact.",
    icon: FileType2,
    route: "/tools/word-to-pdf",
    formats: ["DOC", "DOCX"],
    status: "coming-soon",
  }),
  t({
    id: "excel-to-pdf",
    name: "Excel to PDF",
    category: "convert-to-pdf",
    group: "pdf",
    description: "Share spreadsheets as fixed-layout documents.",
    icon: FileSpreadsheet,
    route: "/tools/excel-to-pdf",
    formats: ["XLS", "XLSX"],
    status: "coming-soon",
  }),
  t({
    id: "powerpoint-to-pdf",
    name: "PowerPoint to PDF",
    category: "convert-to-pdf",
    group: "pdf",
    description: "Convert slide decks into shareable PDFs.",
    icon: Presentation,
    route: "/tools/powerpoint-to-pdf",
    formats: ["PPT", "PPTX"],
    status: "coming-soon",
  }),

  // Convert from PDF
  t({
    id: "pdf-to-jpg",
    name: "PDF to JPG",
    category: "convert-from-pdf",
    group: "pdf",
    description: "Save every page as a high quality JPG image.",
    icon: Images,
    route: "/tools/pdf-to-jpg",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "pdf-to-png",
    name: "PDF to PNG",
    category: "convert-from-pdf",
    group: "pdf",
    description: "Export pages as lossless PNG images.",
    icon: ImageIcon,
    route: "/tools/pdf-to-png",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "pdf-to-word",
    name: "PDF to Word",
    category: "convert-from-pdf",
    group: "pdf",
    description: "Get an editable document from your PDF.",
    icon: FileText,
    route: "/tools/pdf-to-word",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "pdf-to-excel",
    name: "PDF to Excel",
    category: "convert-from-pdf",
    group: "pdf",
    description: "Extract tables into workable spreadsheets.",
    icon: FileSpreadsheet,
    route: "/tools/pdf-to-excel",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "pdf-to-powerpoint",
    name: "PDF to PowerPoint",
    category: "convert-from-pdf",
    group: "pdf",
    description: "Rebuild your PDF as an editable slide deck.",
    icon: Presentation,
    route: "/tools/pdf-to-powerpoint",
    formats: ["PDF"],
    status: "coming-soon",
  }),

  // Edit PDF
  t({
    id: "add-page-numbers",
    name: "Add Page Numbers",
    category: "edit-pdf",
    group: "pdf",
    description: "Insert numbering with full position control.",
    icon: Hash,
    route: "/tools/add-page-numbers",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "add-watermark",
    name: "Add Watermark",
    category: "edit-pdf",
    group: "pdf",
    description: "Stamp text or an image across your pages.",
    icon: Stamp,
    route: "/tools/add-watermark",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "crop-pdf",
    name: "Crop PDF",
    category: "edit-pdf",
    group: "pdf",
    description: "Trim margins and set a clean page area.",
    icon: Crop,
    route: "/tools/crop-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "edit-pdf",
    name: "Edit PDF",
    category: "edit-pdf",
    group: "pdf",
    description: "Add text, shapes and notes to any page.",
    icon: FilePlus2,
    route: "/tools/edit-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),

  // Security
  t({
    id: "protect-pdf",
    name: "Protect PDF",
    category: "pdf-security",
    group: "pdf",
    description: "Add a password and restrict document access.",
    icon: Lock,
    route: "/tools/protect-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "unlock-pdf",
    name: "Authorized PDF Unlock",
    category: "pdf-security",
    group: "pdf",
    description: "Remove protection from documents you own.",
    icon: Unlock,
    route: "/tools/unlock-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "remove-pdf-metadata",
    name: "Remove Metadata",
    category: "pdf-security",
    group: "pdf",
    description: "Strip author, device and history details.",
    icon: ShieldOff,
    route: "/tools/remove-pdf-metadata",
    formats: ["PDF"],
    status: "coming-soon",
  }),

  // Image conversion
  t({
    id: "jpg-to-png",
    name: "JPG to PNG",
    category: "image-conversion",
    group: "image",
    description: "Convert photos to lossless PNG files.",
    icon: ArrowLeftRight,
    route: "/tools/jpg-to-png",
    formats: ["JPG", "JPEG"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "png-to-jpg",
    name: "PNG to JPG",
    category: "image-conversion",
    group: "image",
    description: "Flatten PNGs into lighter JPG images.",
    icon: ArrowLeftRight,
    route: "/tools/png-to-jpg",
    formats: ["PNG"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "jpg-to-webp",
    name: "JPG to WEBP",
    category: "image-conversion",
    group: "image",
    description: "Serve smaller images on the modern web.",
    icon: FileDown,
    route: "/tools/jpg-to-webp",
    formats: ["JPG", "JPEG"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "png-to-webp",
    name: "PNG to WEBP",
    category: "image-conversion",
    group: "image",
    description: "Compress PNG assets into WEBP format.",
    icon: FileDown,
    route: "/tools/png-to-webp",
    formats: ["PNG"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "webp-to-jpg",
    name: "WEBP to JPG",
    category: "image-conversion",
    group: "image",
    description: "Convert WEBP files for wider compatibility.",
    icon: FileUp,
    route: "/tools/webp-to-jpg",
    formats: ["WEBP"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "webp-to-png",
    name: "WEBP to PNG",
    category: "image-conversion",
    group: "image",
    description: "Restore transparency-friendly PNG output.",
    icon: FileUp,
    route: "/tools/webp-to-png",
    formats: ["WEBP"],
    multiple: true,
    status: "coming-soon",
  }),

  // Image editing
  t({
    id: "image-resizer",
    name: "Resize Image",
    category: "image-editing",
    group: "image",
    description: "Set exact dimensions or scale by percentage.",
    icon: Maximize2,
    route: "/tools/image-resizer",
    formats: ["JPG", "PNG", "WEBP"],
    multiple: true,
    status: "coming-soon",
    actionLabel: "Resize Image",
  }),
  t({
    id: "crop-image",
    name: "Crop Image",
    category: "image-editing",
    group: "image",
    description: "Cut images to the framing you need.",
    icon: Crop,
    route: "/tools/crop-image",
    formats: ["JPG", "PNG", "WEBP"],
    status: "coming-soon",
  }),
  t({
    id: "rotate-image",
    name: "Rotate Image",
    category: "image-editing",
    group: "image",
    description: "Turn images by 90, 180 or a custom angle.",
    icon: RotateCw,
    route: "/tools/rotate-image",
    formats: ["JPG", "PNG", "WEBP"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "flip-image",
    name: "Flip Image",
    category: "image-editing",
    group: "image",
    description: "Mirror images horizontally or vertically.",
    icon: FlipHorizontal,
    route: "/tools/flip-image",
    formats: ["JPG", "PNG", "WEBP"],
    multiple: true,
    status: "coming-soon",
  }),
  t({
    id: "brightness",
    name: "Brightness",
    category: "image-editing",
    group: "image",
    description: "Lighten or darken a photo with precision.",
    icon: Sun,
    route: "/tools/brightness",
    formats: ["JPG", "PNG", "WEBP"],
    status: "coming-soon",
  }),
  t({
    id: "contrast",
    name: "Contrast",
    category: "image-editing",
    group: "image",
    description: "Balance tones for a sharper looking image.",
    icon: Contrast,
    route: "/tools/contrast",
    formats: ["JPG", "PNG", "WEBP"],
    status: "coming-soon",
  }),
  t({
    id: "grayscale",
    name: "Grayscale",
    category: "image-editing",
    group: "image",
    description: "Convert colour photos to clean black and white.",
    icon: Palette,
    route: "/tools/grayscale",
    formats: ["JPG", "PNG", "WEBP"],
    multiple: true,
    status: "coming-soon",
  }),

  // Image optimization
  t({
    id: "image-compressor",
    name: "Compress Image",
    category: "image-optimization",
    group: "image",
    description: "Cut image weight without visible quality loss.",
    icon: FileArchive,
    route: "/tools/image-compressor",
    formats: ["JPG", "PNG", "WEBP"],
    multiple: true,
    status: "coming-soon",
    actionLabel: "Compress Image",
  }),
  t({
    id: "remove-image-metadata",
    name: "Remove Metadata",
    category: "image-optimization",
    group: "image",
    description: "Delete EXIF, location and camera details.",
    icon: ShieldCheck,
    route: "/tools/remove-image-metadata",
    formats: ["JPG", "PNG", "WEBP"],
    multiple: true,
    status: "coming-soon",
  }),

  // Image to PDF
  t({
    id: "image-to-pdf",
    name: "Image to PDF",
    category: "image-to-pdf",
    group: "image",
    description: "Convert a single image into a PDF page.",
    icon: FileInput,
    route: "/tools/image-to-pdf",
    formats: ["JPG", "PNG", "WEBP"],
    status: "coming-soon",
  }),
  t({
    id: "images-to-pdf",
    name: "Multiple Images to PDF",
    category: "image-to-pdf",
    group: "image",
    description: "Bundle a set of images into one document.",
    icon: FileStack,
    route: "/tools/images-to-pdf",
    formats: ["JPG", "PNG", "WEBP"],
    multiple: true,
    status: "coming-soon",
  }),

  // AI image
  t({
    id: "background-remover",
    name: "Background Remover",
    category: "ai-image",
    group: "image",
    description: "Separate the subject from its background cleanly.",
    icon: Eraser,
    route: "/tools/background-remover",
    formats: ["JPG", "PNG", "WEBP"],
    status: "coming-soon",
  }),
  t({
    id: "passport-photo",
    name: "AI Passport Photo",
    category: "ai-image",
    group: "image",
    description:
      "Create passport-style photos while preserving the original person and natural appearance.",
    icon: IdCard,
    route: "/tools/passport-photo",
    formats: ["JPG", "PNG"],
    status: "coming-soon",
    actionLabel: "Create Passport Photo",
  }),

  // AI document tools
  t({
    id: "ai-pdf-summary",
    name: "AI PDF Summary",
    category: "ai-tools",
    group: "ai",
    description: "Get a structured summary of any long document.",
    icon: Brain,
    route: "/tools/ai-pdf-summary",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "chat-with-pdf",
    name: "Chat with PDF",
    category: "ai-tools",
    group: "ai",
    description: "Ask questions and get answers with page references.",
    icon: MessageSquareText,
    route: "/tools/chat-with-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "ocr",
    name: "OCR",
    category: "ai-tools",
    group: "ai",
    description: "Read text from scans, photos and screenshots.",
    icon: FileSearch,
    route: "/tools/ocr",
    formats: ["PDF", "JPG", "PNG"],
    status: "coming-soon",
  }),
  t({
    id: "pdf-to-notes",
    name: "PDF to Notes",
    category: "ai-tools",
    group: "ai",
    description: "Turn dense documents into clear study notes.",
    icon: NotebookPen,
    route: "/tools/pdf-to-notes",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "pdf-to-questions",
    name: "PDF to Questions",
    category: "ai-tools",
    group: "ai",
    description: "Generate practice questions from your material.",
    icon: FileQuestion,
    route: "/tools/pdf-to-questions",
    formats: ["PDF"],
    status: "coming-soon",
  }),
  t({
    id: "translate-pdf",
    name: "Translate PDF",
    category: "ai-tools",
    group: "ai",
    description: "Translate documents while keeping the structure.",
    icon: Languages,
    route: "/tools/translate-pdf",
    formats: ["PDF"],
    status: "coming-soon",
  }),
];

export const aiFlagshipId = "passport-photo";

export const popularToolIds = [
  "merge-pdf",
  "split-pdf",
  "compress-pdf",
  "pdf-to-jpg",
  "pdf-to-word",
  "jpg-to-pdf",
  "image-compressor",
  "image-resizer",
];

export const toolById = (id: string) => tools.find((tool) => tool.id === id);

export const toolBySlug = (slug: string) => tools.find((tool) => tool.route === `/tools/${slug}`);

export const toolsByCategory = (id: ToolCategoryId) => tools.filter((tool) => tool.category === id);

export const categoriesByGroup = (group: ToolGroup) => toolCategories.filter((c) => c.group === group);

export const popularTools = popularToolIds
  .map((id) => toolById(id))
  .filter((tool): tool is Tool => Boolean(tool));

export const aiTools = tools.filter(
  (tool) => tool.category === "ai-tools" || tool.id === "passport-photo",
);

export interface MegaMenuColumn {
  title: string;
  toolIds: string[];
}

export const megaMenuColumns: MegaMenuColumn[] = [
  {
    title: "Organize PDF",
    toolIds: ["merge-pdf", "split-pdf", "remove-pages", "extract-pages", "reorder-pdf", "rotate-pdf"],
  },
  { title: "Optimize PDF", toolIds: ["compress-pdf", "repair-pdf", "ocr-pdf"] },
  {
    title: "Convert to PDF",
    toolIds: ["jpg-to-pdf", "png-to-pdf", "word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"],
  },
  {
    title: "Convert from PDF",
    toolIds: ["pdf-to-jpg", "pdf-to-png", "pdf-to-word", "pdf-to-excel", "pdf-to-powerpoint"],
  },
  { title: "Edit PDF", toolIds: ["add-page-numbers", "add-watermark", "crop-pdf", "edit-pdf"] },
  { title: "PDF Security", toolIds: ["protect-pdf", "unlock-pdf", "remove-pdf-metadata"] },
  {
    title: "AI Tools",
    toolIds: [
      "passport-photo",
      "ai-pdf-summary",
      "chat-with-pdf",
      "ocr",
      "pdf-to-notes",
      "pdf-to-questions",
      "translate-pdf",
    ],
  },
];

export const convertMenuToolIds = [
  "pdf-to-word",
  "pdf-to-jpg",
  "pdf-to-excel",
  "word-to-pdf",
  "jpg-to-pdf",
  "excel-to-pdf",
];

export const iconSet = {
  Bot,
  Wand2,
  Blend,
  FileCheck2,
  BadgeCheck,
  Layers,
  Scissors,
};
