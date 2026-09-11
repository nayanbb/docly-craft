# Docly Development Plan

## 1. Current Project Overview

Docly is an all-in-one document processing web application designed to serve as a high-performance, private, and intuitive workspace for everyday file operations across three distinct categories:

- **PDF Tools**: Organizing, optimizing, converting, editing, and securing documents.
- **Image Tools**: Converting between formats, resizing, cropping, compressing, and bundling photos into documents.
- **AI Tools**: Assisted document comprehension (summaries, translation, questions, notes) and identity-preserving photo preparation (AI Passport Photo).

### Origin and Current State

- The repository was initialized using **Lovable** based on its TanStack Start TypeScript template and is currently synchronized with GitHub (`nayanbb/docly-craft`).
- The project currently serves as a **frontend presentation prototype**: the global navigation, route structure, design system, tool catalog metadata (60+ tools), and upload/state UI components are implemented.
- However, **no functional processing engines are hooked up yet**: tool action buttons are rendered in a disabled "Coming soon" state, file previews are rudimentary, and no document transformations occur.
- Furthermore, the global `<Header />` and `<Footer />` components are defined in the codebase but **unmounted from the root layout**, rendering every page without its primary navigation header or footer.

---

## 2. Technology Stack

| Layer                    | Technology      | Version           | Details / Role                                                                 |
| :----------------------- | :-------------- | :---------------- | :----------------------------------------------------------------------------- |
| **Framework**            | TanStack Start  | `1.168.32`        | Fullstack SSR framework for React with Vite integration.                       |
| **UI Library**           | React           | `19.2.0`          | React 19 core library and React DOM.                                           |
| **Language**             | TypeScript      | `5.8.3`           | Configured with `target: ES2022`, strict typing, `moduleResolution: Bundler`.  |
| **Routing**              | TanStack Router | `1.170.18`        | Type-safe file-based router with generated route tree (`routeTree.gen.ts`).    |
| **Data Fetching**        | TanStack Query  | `5.101.1`         | Initialized in root route context (`QueryClientProvider`).                     |
| **Server Engine**        | Nitro           | `3.0.260603-beta` | Bundled via `@lovable.dev/vite-tanstack-config`, targeting Cloudflare Workers. |
| **Bundler**              | Vite            | `8.1.5`           | High-performance build tool and local dev server.                              |
| **Styling**              | Tailwind CSS v4 | `4.2.1`           | Next-generation engine with `@theme inline` and custom OKLCH color tokens.     |
| **Animation**            | tw-animate-css  | `1.3.4`           | CSS animation utilities.                                                       |
| **Component Primitives** | Radix UI        | Various           | 25+ accessible unstyled headless UI primitives.                                |
| **Icons**                | Lucide React    | `0.575.0`         | Consistent iconography across mega menu, cards, and file lists.                |
| **Validation**           | Zod             | `3.25.76`         | Schema validation library.                                                     |
| **Form Handling**        | React Hook Form | `7.71.2`          | High-performance form state management with `@hookform/resolvers`.             |
| **Notifications**        | Sonner          | `2.0.7`           | Toast notification system.                                                     |

---

## 3. Folder Structure

```
docly-craft/
├── .git/                               # Git version control directory
├── .lovable/
│   └── project.json                    # Lovable template metadata (tanstack_start_ts_current)
├── public/
│   ├── favicon.ico                     # Docly favicon
│   └── robots.txt                      # Search crawler directives
├── src/
│   ├── components/
│   │   ├── brand/
│   │   │   └── Logo.tsx                # Docly SVG mark and wordmark with hover interaction
│   │   ├── files/
│   │   │   ├── FileList.tsx            # Selected file item list with size and remove triggers
│   │   │   ├── FilePreview.tsx         # Image/document grid preview placeholder
│   │   │   ├── FileUploader.tsx        # Drag-and-drop dropzone with file picker
│   │   │   └── ToolStates.tsx          # ProgressIndicator, ErrorMessage, SuccessMessage, ProcessingButton, DownloadButton
│   │   ├── layout/
│   │   │   ├── Footer.tsx              # Multi-column footer with legal and tool category links
│   │   │   ├── Header.tsx              # Sticky header with quick links, dropdowns, and mobile drawer
│   │   │   ├── MegaMenu.tsx            # 7-column mega menu catalog view
│   │   │   └── PageHero.tsx            # Standardized page title, eyebrow, and blurb banner
│   │   ├── tool/
│   │   │   └── ToolPage.tsx            # Generic tool execution view (uploader, list, preview, CTA)
│   │   ├── ui/                         # 46 Shadcn UI component primitives (button, dialog, select, etc.)
│   │   ├── ToolCard.tsx                # Clickable tool card with icon, title, description, and hover lift
│   │   └── ToolGrid.tsx                # Responsive tool grid and CategorySection wrapper
│   ├── hooks/
│   │   └── use-mobile.tsx              # Window width media query hook (<768px breakpoint)
│   ├── lib/
│   │   ├── error-capture.ts            # Server error recovery and serialization wrapper
│   │   ├── error-page.ts               # Minimal fallback HTML error page renderer
│   │   ├── format.ts                   # Byte formatting helper (formatBytes)
│   │   ├── lovable-error-reporting.ts  # Lovable runtime error telemetry
│   │   ├── mock-data.ts                # Mock dashboard data (user, usage, stats, activity)
│   │   ├── tools.ts                    # Master registry of 60+ tools, categories, and groupings
│   │   └── utils.ts                    # Class name merge utility (clsx + tailwind-merge)
│   ├── routes/
│   │   ├── __root.tsx                  # Root layout, shell HTML, meta tags, and error boundary
│   │   ├── index.tsx                   # Homepage (hero, popular tools, features, CTA)
│   │   ├── pdf-tools.tsx               # PDF category catalog page
│   │   ├── image-tools.tsx             # Image category catalog page
│   │   ├── ai-tools.tsx                # AI tools hub featuring AI Passport Photo
│   │   ├── pricing.tsx                 # Free vs Pro comparison page
│   │   ├── about.tsx                   # Product philosophy and mission statement
│   │   ├── contact.tsx                 # Support contact form
│   │   └── tools.$slug.tsx             # Dynamic parameter route matching any tool slug
│   ├── routeTree.gen.ts                # Auto-generated TanStack route tree definition
│   ├── router.tsx                      # Router instance factory with QueryClient
│   ├── server.ts                       # SSR Nitro server entry with error containment
│   ├── start.ts                        # TanStack Start instance with CSRF and error middlewares
│   └── styles.css                      # Tailwind v4 theme, OKLCH color variables, custom utilities
├── bun.lock                            # Bun dependency lockfile (Lovable environment)
├── bunfig.toml                         # Bun package manager security and release age rules
├── components.json                     # Shadcn UI configuration file (New York style, slate base)
├── eslint.config.js                    # ESLint 9 flat configuration
├── package.json                        # Project metadata, scripts, and dependencies
├── tsconfig.json                       # TypeScript compiler options and path aliases (@/*)
└── vite.config.ts                      # Vite configuration utilizing @lovable.dev/vite-tanstack-config
```

---

## 4. Existing Routes

| Route Path     | File Origin                  | Route Type    | Purpose & Behavior                                                                                                                                                                                                                |
| :------------- | :--------------------------- | :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`            | `src/routes/index.tsx`       | Static Page   | **Homepage**: Hero banner with interactive mock preview card, 8 popular tools grid, 3-pillar value props, and bottom call-to-action banner.                                                                                       |
| `/pdf-tools`   | `src/routes/pdf-tools.tsx`   | Static Page   | **PDF Directory**: Grouped grid of all PDF tools categorized into Organize, Optimize, Convert to, Convert from, Edit, and Security.                                                                                               |
| `/image-tools` | `src/routes/image-tools.tsx` | Static Page   | **Image Directory**: Grouped grid categorized into Image Conversion, Image Editing, Image Optimization, and Image to PDF.                                                                                                         |
| `/ai-tools`    | `src/routes/ai-tools.tsx`    | Static Page   | **AI Directory**: Featured spotlight banner for AI Passport Photo, followed by Document AI tools (Summarize, Chat, Notes, Questions, OCR, Translation).                                                                           |
| `/pricing`     | `src/routes/pricing.tsx`     | Static Page   | **Pricing Page**: Side-by-side Free ($0) vs Pro ($9 placeholder) plan comparison cards.                                                                                                                                           |
| `/about`       | `src/routes/about.tsx`       | Static Page   | **About Page**: Philosophy of calm, fast, privacy-centric document workflows.                                                                                                                                                     |
| `/contact`     | `src/routes/contact.tsx`     | Static Page   | **Contact Page**: Customer support form and direct support email details.                                                                                                                                                         |
| `/tools/$slug` | `src/routes/tools.$slug.tsx` | Dynamic Route | **Dynamic Tool Page**: Resolves `$slug` against `src/lib/tools.ts`. Renders breadcrumbs, title, `FileUploader`, `FileList`, `FilePreview`, and disabled `ProcessingButton`. Returns custom `ToolNotFound` if the slug is invalid. |

---

## 5. Existing Components

### 1. Layout Components

- **`Header.tsx`**: Sticky top navigation bar. Houses the `Logo`, quick links (`Merge PDF`, `Split PDF`, `Compress PDF`), a "Convert PDF" dropdown, the "All Tools" mega menu trigger, `Login`, `Sign Up`, dashboard icon button, and mobile hamburger drawer.
- **`Footer.tsx`**: Global page footer with links organized into Product, Company, and Legal categories, social icon placeholders, and copyright notice.
- **`MegaMenu.tsx` (`MegaMenuPanel`)**: 7-column desktop dropdown listing all 60+ tools organized by task with direct links to `/tools/$slug`.
- **`PageHero.tsx`**: Standardized reusable hero banner component with eyebrow badge, large title, and description paragraph.

### 2. Tool & Catalog Components

- **`ToolPage.tsx`**: Master presentation layout for individual tools. Coordinates file selection state, breadcrumb navigation, and renders the upload area, file list, preview grid, and action states.
- **`ToolCard.tsx`**: Card component representing a single tool with Lucide icon, name, two-line description, and subtle hover lift animation.
- **`ToolGrid.tsx`**: Responsive grid wrapper (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) and `CategorySection` wrapper with section heading and blurb.
- **`Logo.tsx`**: Custom SVG document mark with an animated accent sheet layered over an ink container, accompanied by the bold "Docly" logotype.

### 3. File Handling Components

- **`FileUploader.tsx`**: Drag-and-drop zone with animated upload icon, "Choose Files" button triggering a hidden native file input, and supported format labels.
- **`FileList.tsx`**: Renders selected files with icon or thumbnail, file name, formatted byte size, and an individual delete button.
- **`FilePreview.tsx`**: Thumbnail grid displaying image object URLs or format badges with filenames.
- **`ToolStates.tsx`**: Exportable state sub-components: `ProgressIndicator` (animated progress bar with percentage), `ErrorMessage`, `SuccessMessage`, `ProcessingButton` (with loading spinner and action hint), and `DownloadButton`.

### 4. UI Primitives (`src/components/ui/`)

46 Shadcn UI component wrappers built on top of Radix UI primitives: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip.

---

## 6. Existing Dependencies

### Core Production Dependencies

```json
{
  "@hookform/resolvers": "^5.2.2",
  "@radix-ui/react-*": "25+ headless UI primitives",
  "@tailwindcss/vite": "^4.2.1",
  "@tanstack/react-query": "^5.101.1",
  "@tanstack/react-router": "1.170.18",
  "@tanstack/react-start": "1.168.32",
  "@tanstack/router-plugin": "1.168.23",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "cmdk": "^1.1.1",
  "date-fns": "^4.1.0",
  "embla-carousel-react": "^8.6.0",
  "input-otp": "^1.4.2",
  "lucide-react": "^0.575.0",
  "react": "^19.2.0",
  "react-day-picker": "^9.14.0",
  "react-dom": "^19.2.0",
  "react-hook-form": "^7.71.2",
  "react-resizable-panels": "^4.6.5",
  "recharts": "^2.15.4",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.5.0",
  "tailwindcss": "^4.2.1",
  "tw-animate-css": "^1.3.4",
  "vaul": "^1.1.2",
  "vite-tsconfig-paths": "^6.0.2",
  "zod": "^3.25.76"
}
```

### Dev Dependencies

```json
{
  "@eslint/js": "^9.32.0",
  "@lovable.dev/vite-tanstack-config": "^2.20.0",
  "@types/node": "^22.16.5",
  "@types/react": "^19.2.0",
  "@types/react-dom": "^19.2.0",
  "@vitejs/plugin-react": "^5.2.0",
  "eslint": "^9.32.0",
  "eslint-config-prettier": "^10.1.1",
  "eslint-plugin-prettier": "^5.2.6",
  "eslint-plugin-react-hooks": "^5.2.0",
  "eslint-plugin-react-refresh": "^0.4.20",
  "globals": "^15.15.0",
  "nitro": "3.0.260603-beta",
  "prettier": "^3.7.3",
  "typescript": "^5.8.3",
  "typescript-eslint": "^8.56.1",
  "vite": "8.1.5"
}
```

### Observations on Dependencies

- **React 19 Readiness**: The project runs on React 19. All Radix UI primitives and utility packages installed are compatible with React 19.
- **Tailwind CSS v4**: Built on Tailwind v4 using `@tailwindcss/vite` instead of a legacy `tailwind.config.js`.
- **Rolldown Override**: `package.json` contains `"overrides": { "rolldown": "1.2.1" }` for Vite 8 compatibility.
- **Zero Processing Libraries**: Currently, **no** PDF parsing, document manipulation, or image conversion libraries (such as `pdf-lib`, `pdfjs-dist`, etc.) are installed.

---

## 7. Current UI Architecture

```
                    ┌─────────────────────────┐
                    │       src/styles.css    │
                    │  (OKLCH Tokens, Fonts)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   src/routes/__root.tsx │
                    │   (RootShell / Query)   │
                    └────────────┬────────────┘
                                 │
               ┌─────────────────┴─────────────────┐
               │                                   │
               ▼                                   ▼
      [DISCONNECTED / ORPHANED]           <Outlet /> (Active Route)
      - Header.tsx (Logo, Nav, MegaMenu)           │
      - Footer.tsx (Links, Legal, Brand)   ┌───────┴───────┬──────────────┬──────────────┐
                                           │               │              │              │
                                           ▼               ▼              ▼              ▼
                                       index.tsx     pdf-tools.tsx  ai-tools.tsx   tools.$slug.tsx
                                      (Home Page)    (Catalog Page) (AI Spotlight) (ToolPage View)
                                           │                                             │
                                           ├─ Popular ToolCards                          ├─ FileUploader
                                           └─ DocumentVisual Mock                        ├─ FileList
                                                                                         ├─ FilePreview
                                                                                         └─ ToolStates
```

### Design System and Tokens

- **Color Space**: Strict use of **OKLCH** color values (`--primary: oklch(0.55 0.113 208)` [Signal Teal], `--ink: oklch(0.24 0.04 253)` [Deep Navy], `--surface: oklch(0.982 0.005 240)` [Off-white neutral]).
- **Typography**: Custom variable font stack defaulting to `Plus Jakarta Sans` via `@theme inline`.
- **Elevations**: Subtle multi-layered drop shadows (`--shadow-card`, `--shadow-lift`, `--shadow-menu`).
- **Surface Patterns**: Custom utility `surface-grid` for linear-gradient dot matrix backgrounds with radial masks.

---

## 8. Current Problems (Empirical Findings)

During technical inspection and local browser validation, the following concrete issues were identified:

1. **Disconnected Global Header and Footer (`CRITICAL UI DEFECT`)**:
   - `src/components/layout/Header.tsx` and `src/components/layout/Footer.tsx` are fully coded but **never imported or rendered** in `src/routes/__root.tsx`.
   - As a result, the entire live website renders without a top navigation bar, without a logo, without the Mega Menu, and without the footer.
2. **Broken Internal Navigation Links (404s)**:
   - **Header & Mobile Menu**: Links to `/login`, `/signup`, and `/dashboard` point to non-existent routes. Clicking them triggers a 404 error.
   - **Homepage Hero**: The primary CTA button "Create free account" points to `/signup` (404).
   - **Pricing Page**: Both plan CTA buttons ("Start for free" and "Upgrade to Pro") point to `/signup` (404).
   - **Footer**: Links to `/dashboard`, `/privacy`, and `/terms` point to non-existent routes (404).
3. **Orphaned Mock Data (`src/lib/mock-data.ts`)**:
   - A mock dataset including `mockUser`, `mockRecentTools`, `mockFavoriteTools`, `mockRecentFiles`, and `mockUsage` is defined but not imported anywhere in the application. It was prepared for a `/dashboard` route that was never created.
4. **Hardcoded Disabled Processing State**:
   - `src/components/tool/ToolPage.tsx` renders `<ProcessingButton disabled label="... — Coming soon" />`. No tool can execute any action.
5. **Missing File Input Validation in `FileUploader.tsx`**:
   - The `<input type="file" />` lacks the `accept` attribute based on `tool.formats`. Users can select any arbitrary file extension (`.exe`, `.zip`, `.mp4`).
   - The `handleDrop` drag-and-drop handler accepts any file without verifying MIME types or enforcing the stated 50MB file size limit.
6. **Object URL Memory Leaks**:
   - In `ToolPage.tsx`, `URL.createObjectURL(file)` is called for image previews, but `URL.revokeObjectURL` is never invoked when files are deleted from the list or when the component unmounts, creating cumulative browser memory leaks during prolonged sessions.
7. **Generic Lovable Metadata in Root**:
   - `src/routes/__root.tsx` has title `Lovable App`, description `Lovable Generated Project`, and Twitter handle `@Lovable`. These appear on all unconfigured routes and 404 pages.
8. **Build / Dev Warning**:
   - Vite 8 emits: `"The plugin 'vite-tsconfig-paths' is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option."`
9. **Dual Package Manager Footprint**:
   - `bun.lock` exists in the repository from the upstream Lovable environment, while local environments without Bun use `npm`, generating `package-lock.json`.

---

## 9. Recommended Architecture

To transform Docly into a high-performance, cost-effective, and privacy-first SaaS product, the architecture must strictly enforce **client-side primacy**:

```
                                    ┌──────────────────────────────┐
                                    │       Docly Frontend UI      │
                                    │ (TanStack Start + React 19)  │
                                    └──────────────┬───────────────┘
                                                   │
                                    ┌──────────────▼───────────────┐
                                    │   Client Processing Engine   │
                                    │     (Browser-Side Only)      │
                                    └──────────────┬───────────────┘
                                                   │
         ┌─────────────────────────────────────────┼────────────────────────────────────────┐
         │                                         │                                        │
         ▼                                         ▼                                        ▼
┌──────────────────┐                     ┌──────────────────┐                     ┌──────────────────┐
│  PDF Subsystem   │                     │ Image Subsystem  │                     │   AI Subsystem   │
│ (pdf-lib, PDF.js)│                     │ (OffscreenCanvas)│                     │(Tesseract, ONNX) │
│ - Web Workers    │                     │ - Web Workers    │                     │ - Web Workers    │
│ - Zero Server IO │                     │ - Canvas API     │                     │ - Zero Face Gen  │
└──────────────────┘                     └──────────────────┘                     └──────────────────┘
```

### Core Architecture Principles

1. **100% Client-Side Processing for Standard Tools**: PDF manipulation, image conversions, resizing, compression, and basic OCR must run entirely in the user's browser using WebAssembly and Web Workers.
2. **Zero Server Storage & Zero File Ingestion**: Files never leave the client's device for client-executable operations. This reduces server bandwidth to near zero, eliminates storage costs, and delivers unbeatable data privacy compliance (GDPR/HIPAA friendly by design).
3. **Dedicated Web Worker Isolation**: Heavy CPU-intensive tasks (PDF rendering, raster manipulation, image resizing) must execute in dedicated Web Workers to ensure the React main thread never stutters or drops frames (maintaining a silky 60 FPS UI).
4. **Deferred Infrastructure**: No authentication, no payments/Stripe, no database, no Supabase, and no paid cloud APIs until the core client-side processing suite is fully realized.

---

## 10. PDF Processing Architecture

```
[User PDF Files]
       │
       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Dedicated PDF Web Worker                        │
│                                                                        │
│   ┌────────────────────────────────┐  ┌────────────────────────────┐   │
│   │            pdf-lib             │  │        pdfjs-dist          │   │
│   │     (Document Assembly)        │  │     (Page Rasterizer)      │   │
│   │  - Merge PDF                   │  │  - Render canvas previews  │   │
│   │  - Split / Extract / Reorder   │  │  - PDF to JPG / PNG        │   │
│   │  - Rotate pages                │  │  - Page count & text layer │   │
│   │  - Watermarks & Page Numbers   │  │                            │   │
│   │  - Strip PDF Metadata          │  │                            │   │
│   └────────────────┬───────────────┘  └─────────────┬──────────────┘   │
│                    │                                │                  │
└────────────────────┼────────────────────────────────┼──────────────────┘
                     │                                │
                     ▼                                ▼
              [Modified PDF Blob]             [Image Canvas Blobs]
                     │                                │
                     └────────────────┬───────────────┘
                                      │
                                      ▼
                        [Direct Browser Download]
```

### 1. Technology Selection

- **`pdf-lib`** (Open-Source, Pure JavaScript): Ideal for structural manipulation. Creates, parses, modifies, and saves PDF documents without external binaries.
- **`pdfjs-dist`** (Mozilla PDF.js): Standard for reading and rasterizing PDF pages into HTML5 `<canvas>` elements for thumbnail rendering and PDF-to-Image exports.

### 2. Implementation Specifications for Target PDF Tools

- **Merge PDF**:
  1. Load files into `ArrayBuffer`s.
  2. Instantiate destination `PDFDocument.create()`.
  3. Iterate files, parse with `PDFDocument.load(buffer)`.
  4. Call `destDoc.copyPages(srcDoc, srcDoc.getPageIndices())`.
  5. Add pages to destination document and serialize via `destDoc.save()`.
- **Split PDF / Extract Pages / Delete Pages**:
  1. Load target document.
  2. Based on user page selections/ranges, call `destDoc.copyPages(srcDoc, selectedIndices)`.
  3. Serialize into separate or single output files.
- **Rotate PDF**:
  1. Load document with `pdf-lib`.
  2. For target pages: `page.setRotation(degrees(currentRotation + delta))`.
  3. Output updated PDF.
- **PDF to JPG / PDF to PNG**:
  1. Load document using `pdfjsLib.getDocument({ data: arrayBuffer })`.
  2. Loop pages, render each page into an `OffscreenCanvas` at target DPI (e.g. 150-300 DPI).
  3. Convert canvas to Blob (`canvas.convertToBlob({ type: 'image/jpeg' })`).
  4. Bundle multiple images into a ZIP using `client-zip` or JSZip.
- **JPG / PNG to PDF**:
  1. Create new `PDFDocument`.
  2. Embed images using `pdfDoc.embedJpg(bytes)` or `pdfDoc.embedPng(bytes)`.
  3. Add page with dimensions matching image aspect ratio and draw image.
- **Add Watermark / Page Numbers**:
  1. Use `pdf-lib`'s `page.drawText()` with custom font, size, rotation, and opacity parameters.
- **Remove PDF Metadata**:
  1. Set document title, author, subject, keywords, producer, creator to empty strings.
  2. Clear XMP metadata streams.

---

## 11. Image Processing Architecture

```
[Raw Image File] ──► [OffscreenCanvas / Web Worker]
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Format Change │   │ Resizing/Crop │   │  Compression  │
│(JPG,PNG,WEBP) │   │ (Math/Bicubic)│   │(Quality Tuning│
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                    [Output Image Blob]
```

### 1. Technology Selection

- **Native HTML5 Canvas & `OffscreenCanvas`**: High performance, hardware-accelerated 2D rendering engine built into modern browsers.
- **`createImageBitmap()`**: Efficient decoding of image files directly on background worker threads without touching the DOM.

### 2. Implementation Specifications for Target Image Tools

- **Format Conversions (JPG <-> PNG <-> WEBP)**:
  1. Decode source file via `createImageBitmap(blob)`.
  2. Draw to `OffscreenCanvas` with identical width/height.
  3. Export via `canvas.convertToBlob({ type: targetMimeType, quality: 0.92 })`.
- **Resize**:
  1. Calculate target dimensions based on target width, height, percentage, or aspect-ratio lock.
  2. Render using canvas scaling (leveraging browser high-quality bicubic interpolation).
- **Crop**:
  1. Extract pixel bounding box `(x, y, width, height)` using canvas `drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh)`.
- **Rotate & Flip**:
  1. Translate canvas coordinate origin and apply `ctx.rotate()` or `ctx.scale(-1, 1)` transforms.
- **Compress Image**:
  1. Iterative quality compression for JPEG/WEBP formats using `canvas.convertToBlob({ type, quality: q })`.
  2. Progressive binary search for a target target size threshold (e.g. <500 KB) if specified by the user.

---

## 12. AI Architecture

```
                               ┌───────────────────────────────┐
                               │       AI Document Engine      │
                               └───────────────┬───────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               ▼                                                               ▼
┌───────────────────────────────┐                               ┌───────────────────────────────┐
│     AI Passport Photo Hub     │                               │      Document Intelligence    │
│  (STRICT Identity Preserving) │                               │  - Client OCR (Tesseract.js)  │
│  - MediaPipe / Face Landmark  │                               │  - Client Summaries (Future)  │
│  - Boundary & Geometry Check  │                               │  - Pluggable AI Worker API    │
│  - RMBG / Selfie Segmentation │                               │                               │
│  - Plain Background Fill      │                               │                               │
│  - Standard 2x2" Print Sheet  │                               │                               │
└───────────────────────────────┘                               └───────────────────────────────┘
```

### 1. AI Passport Photo Architecture (Zero-Face-Generation Guarantee)

- **Hard Architectural Constraint**: The original person's face, facial features, geometry, and likeness **must NEVER be redrawn, synthesized, or generated** using diffusion or generative AI models.
- **Identity-Preserving Pipeline**:
  1. **Face Detection & Landmark Analysis**: Use client-side detection (such as `@tensorflow-models/face-landmarks-detection` or MediaPipe Face Mesh) to locate eye centers, chin baseline, and head top.
  2. **Biometric Compliance Checks**: Verify that head tilt is within allowable angles and check eye gaze direction.
  3. **Selfie / Person Segmentation**: Isolate the human subject from the background using a local segmentation model (e.g., MediaPipe Selfie Segmentation running in WebAssembly/WebGL).
  4. **Background Matte & Color Fill**: Replace the segmented background with compliant solid white or light-off-white (per country specifications: US 2x2", UK 35x45mm, Schengen, India, etc.).
  5. **Standard Crop & Scaling**: Scale and position the head so it occupies precisely 50% to 69% of the vertical frame.
  6. **Print Sheet Generation**: Generate both an individual photo and a tiled 4x6" or A6 print sheet (e.g. 2x2 or 2x3 grid) for physical photo printing.

### 2. Document AI (OCR, Summarize, Chat, Translate)

- **Local OCR (Tesseract.js)**: Runs in a client Web Worker using WebAssembly. Extracts raw text and bounding boxes directly from scanned PDFs and photos without uploading sensitive documents to third-party servers.
- **Pluggable Architecture for Future LLM Features**: Document summarization, translation, and chat will interface through a clean `DocumentAssistantAdapter` abstraction. While mock-first today, it can later connect to private local models (WebLLM) or a secure serverless proxy without altering the UI contract.

---

## 13. File Handling Architecture

```
[User Device]
      │ (Local Drag & Drop / File Input)
      ▼
[Memory: ArrayBuffer / Blob]
      │
      ├─► [Magic Byte Verification] (Validates format authenticity)
      │
      ├─► [Processing in Web Worker] (pdf-lib / OffscreenCanvas)
      │
      ▼
[Result Blob in Memory]
      │
      ├─► URL.createObjectURL(resultBlob) (Download trigger)
      │
      ▼
[Automatic Cleanup]
      └──► URL.revokeObjectURL() on complete/unmount
```

1. **Memory Discipline & Stream Handling**:
   - Files are loaded as `ArrayBuffer` or `ReadableStream` instead of Base64 strings to prevent the 33% memory expansion overhead.
   - Large files (>25 MB) are handled with page-by-page chunking to prevent mobile browser tab crashes.
2. **Object URL Lifecycle Management**:
   - All generated preview and download URLs are registered in a centralized React `useRef<Set<string>>` registry.
   - When files are removed from `FileList` or when the user navigates away, `URL.revokeObjectURL(url)` is invoked immediately to release browser memory.
3. **No Local Persistence of Document Data**:
   - Files are kept exclusively in volatile memory (RAM). Neither IndexedDB nor LocalStorage will store raw document contents, guaranteeing privacy upon tab closure.

---

## 14. Security Architecture

| Security Dimension                | Threat / Risk                                                                  | Docly Protective Control                                                                                                                                        |
| :-------------------------------- | :----------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **File Type Spoofing**            | Executables or scripts disguised as `.pdf` or `.png`.                          | **Magic Byte Inspection**: Check file header signatures (e.g., `%PDF-` for PDFs, `\x89PNG` for PNG, `\xFF\xD8\xFF` for JPEG) before passing buffers to parsers. |
| **Denial of Service / Zip Bombs** | Giant canvas allocations or deeply nested PDF objects freezing browser/server. | **Pre-allocation Limits**: Enforce strict dimension caps (e.g. max 8000x8000 canvas) and 50MB file size limits prior to instantiation.                          |
| **PDF Embedded Exploits**         | Malicious PDFs containing `/JavaScript` or `/Launch` actions.                  | **Sanitization on Export**: Clean action dictionaries when rebuilding or processing documents via `pdf-lib`.                                                    |
| **Data Leakage & Upload Privacy** | User contracts, invoices, or medical records being leaked from a server.       | **Zero-Transmission Architecture**: Files never traverse the network for client-side tools. Processing is completely local.                                     |
| **API Key & Secret Safety**       | Exposure of cloud tokens or private keys in client bundles.                    | **Strict Vite Boundary**: No client-side `import.meta.env.SECRET_*`. Future API requests will pass strictly through authenticated Nitro server endpoints.       |
| **Cross-Site Scripting (XSS)**    | Injected payloads in document titles or metadata rendered in DOM.              | **React Auto-Escaping & Input Scrubbing**: Sanitize all file names and metadata before rendering in `FileList` or previews.                                     |
| **CORS & Worker Isolation**       | Hostile third-party script tampering with worker memory.                       | Configure strict `Content-Security-Policy` and `Cross-Origin-Embedder-Policy` headers in production.                                                            |

---

## 15. Testing Strategy

### 1. Unit Testing (Vitest)

- **Magic Byte Validator**: Test validation against genuine and spoofed PDF, JPG, PNG, and WEBP files.
- **Formatting Utilities**: Verify `formatBytes` across boundary values (`0 B`, `1023 B`, `1024 B`, `1.5 MB`, `2.4 GB`).
- **Tool Registry**: Verify every tool in `src/lib/tools.ts` has a unique ID, valid route slug, and designated category.

### 2. Component Testing (React Testing Library)

- **`FileUploader`**: Test file selection, multi-file restriction, drag-and-drop state toggling, and file removal.
- **`Header` & `MegaMenu`**: Test dropdown visibility, keyboard navigation (Escape to close), and mobile menu toggle.
- **`ToolStates`**: Test rendering across `idle`, `loading`, `error`, and `success` states.

### 3. Integration & End-to-End Testing (Playwright)

- **Workflow Verification**:
  1. Navigate to `/tools/merge-pdf`.
  2. Upload two valid mock PDF documents.
  3. Click "Merge PDF".
  4. Verify progress indicator transitions to success message.
  5. Verify that the generated download Blob is a valid PDF containing the sum of the input pages.
- **404 & Fallback Tests**: Verify navigating to unknown routes renders the styled Docly `NotFoundComponent` without runtime errors.

---

## 16. Deployment Strategy

### 1. Deployment Target: Cloudflare Pages / Workers via Nitro

- The current build configuration compiles to `.output/server` using Nitro's `cloudflare-module` preset.
- Static assets (CSS, JS bundles, icons) are automatically placed in `.output/public` for zero-latency edge distribution across Cloudflare's global CDN.

### 2. Static Asset Caching & Headers

- Enable immutable cache headers (`Cache-Control: public, max-age=31536000, immutable`) for hashed Vite assets.
- Configure `robots.txt` and open-graph meta tags for search engine discoverability.

### 3. Progressive Web App (PWA) Evolution

- Because Docly operates on client-side Web Workers, it is primed to become an offline-capable PWA. Adding a service worker in later phases will allow users to merge, split, and convert files even without an active internet connection.

---

## 17. Implementation Roadmap

### Phase 1: Foundation & UI Wiring (Immediate Priority)

- **Connect Header and Footer**: Mount `<Header />` and `<Footer />` in `src/routes/__root.tsx` inside the main layout so navigation and branding appear across all pages.
- **Resolve Broken Links**: Provide lightweight placeholder routes or modal alerts for `/login`, `/signup`, `/dashboard`, `/privacy`, and `/terms`.
- **Enforce File Input Constraints**: Add the `accept` attribute to `FileUploader.tsx` derived from `tool.formats` and validate dropped files.
- **Fix Memory Leaks**: Implement `URL.revokeObjectURL` cleanup hooks in `ToolPage.tsx`.
- **Clean Root Metadata**: Replace generic "Lovable App" metadata with Docly production meta tags.

### Phase 2: First Live Tool — Client-Side "Merge PDF"

- Install `pdf-lib`.
- Build the `PdfEngine` client-side worker service.
- Connect `ToolPage.tsx` for `merge-pdf` to execute genuine merging, display accurate progress, and trigger a direct PDF download.
- Add automated end-to-end tests for PDF merging.

### Phase 3: Core PDF Manipulation Suite

- Implement **Split PDF**, **Rotate PDF**, **Delete PDF Pages**, and **Reorder PDF Pages**.
- Integrate `pdfjs-dist` to render real page thumbnail previews so users can visually inspect and reorder pages before processing.

### Phase 4: Core Image Suite

- Implement **JPG to PNG**, **PNG to JPG**, **WEBP to JPG**, **WEBP to PNG**.
- Implement **Image Resizer**, **Image Cropper**, and **Image Compressor** using `OffscreenCanvas`.
- Implement **Image to PDF** and **Multiple Images to PDF** using `pdf-lib`.

### Phase 5: Advanced PDF Tools

- Implement **Extract Pages**, **Add Watermark**, **Add Page Numbers**, and **Remove PDF Metadata**.
- Implement **PDF to JPG** and **PDF to PNG** by rasterizing PDF pages to image blobs and packaging them in a ZIP.

### Phase 6: Client-Side OCR & AI Passport Photo

- Implement client-side OCR using `tesseract.js` in a Web Worker.
- Implement the AI Passport Photo pipeline (MediaPipe face landmark checks + local segmentation + solid white background fill + 2x2" print sheet tiling).

### Phase 7: Document AI Assistants & Monetization (Future)

- Connect Document AI assistants (Summary, Notes, Questions, Translate).
- Introduce authentication, user accounts, and billing/Pro tier limits when infrastructure is authorized.

---

## 18. Recommended First Feature

### Feature: **Merge PDF** (`/tools/merge-pdf`)

#### Justification:

1. **Highest Commercial Demand**: "Merge PDF" is universally the single most requested, highest-traffic document operation across all document SaaS platforms.
2. **Exemplifies Architecture**: Demonstrates pure client-side processing using `pdf-lib`, fulfilling all architectural principles (100% private, zero server bandwidth, zero cloud processing fees, instant responsiveness).
3. **Low Complexity & Maximum Stability**: Has zero external API dependencies, works flawlessly with `pdf-lib`, and requires no server-side orchestration.
4. **Validates the Entire UI Pipeline**: Fully exercises the existing `FileUploader` (multi-file mode), `FileList` (item order and deletion), `ToolStates` (progress indicator, error handling, success download), and proves the end-to-end system architecture.
