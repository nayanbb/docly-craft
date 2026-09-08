# Docly: Your Document Hub

Build a production-quality web application called "Docly".

Docly is an all-in-one PDF, Image and AI document processing SaaS platform.

IMPORTANT PRODUCT DIRECTION:

This is intended to become a REAL SOFTWARE PRODUCT, not a college project or simple demo.

The interface should have the professional usability and organization of modern PDF/document tools, but DO NOT copy iLovePDF, iLoveIMG, Smallpdf, Adobe or any other company's exact design, branding, logo, colors, illustrations, proprietary UI or text.

Create an ORIGINAL visual identity for Docly.

The reference concept is:

A clean professional document toolbox where users can quickly find a tool, upload a file, process it and download the result.

--------------------------------------------------

BRAND

--------------------------------------------------

Product name:

Docly

Temporary tagline:

"Everything you need to work with PDFs, images and documents."

Create a simple professional text-based Docly logo/wordmark.

Do not use a copied logo.

Create an original modern SaaS color system.

--------------------------------------------------

GLOBAL HEADER

--------------------------------------------------

Create a professional sticky header.

Left:

Docly logo

Navigation:

Merge PDF

Split PDF

Compress PDF

Convert PDF ▼

All Tools ▼

Right:

Login

Sign Up

Applications/tools menu icon

The header must be responsive.

On mobile, collapse navigation into a mobile menu.

--------------------------------------------------

ALL TOOLS MEGA MENU

--------------------------------------------------

Create a large professional mega menu that opens when the user clicks "All Tools".

Organize tools into columns.

COLUMN 1:

ORGANIZE PDF

Merge PDF

Split PDF

Remove Pages

Extract Pages

Reorder PDF

Rotate PDF

COLUMN 2:

OPTIMIZE PDF

Compress PDF

Repair PDF

OCR PDF

COLUMN 3:

CONVERT TO PDF

JPG to PDF

PNG to PDF

Word to PDF

Excel to PDF

PowerPoint to PDF

COLUMN 4:

CONVERT FROM PDF

PDF to JPG

PDF to PNG

PDF to Word

PDF to Excel

PDF to PowerPoint

COLUMN 5:

EDIT PDF

Add Page Numbers

Add Watermark

Crop PDF

Edit PDF

COLUMN 6:

PDF SECURITY

Protect PDF

Authorized PDF Unlock

Remove Metadata

COLUMN 7:

AI TOOLS

AI Passport Photo

AI PDF Summary

Chat with PDF

OCR

PDF to Notes

PDF to Questions

Translate PDF

Each tool should have a small consistent icon.

Make the mega menu clean, readable and spacious.

--------------------------------------------------

HOME PAGE

--------------------------------------------------

Create a professional SaaS homepage.

Hero section:

Headline:

"Everything you need to work with PDFs, images and documents."

Subtitle:

"Simple, fast and intelligent tools for converting, editing, organizing and processing your files."

Primary button:

"Explore All Tools"

Secondary button:

"Try a Tool"

Add a subtle professional visual element related to documents/files.

Do NOT make the page look like an AI-generated template.

Keep it clean and product-focused.

--------------------------------------------------

POPULAR TOOLS

--------------------------------------------------

Create a "Popular Tools" section.

Show professional tool cards for:

Merge PDF

Split PDF

Compress PDF

PDF to JPG

PDF to Word

JPG to PDF

Image Compressor

Image Resizer

Each card must contain:

- Icon

- Tool name

- Short description

- Hover effect

- Clickable card

Example:

Merge PDF

"Combine multiple PDF files into one document."

--------------------------------------------------

PDF TOOLS PAGE

--------------------------------------------------

Create:

/pdf-tools

Organize tools into categories.

ORGANIZE PDF

Merge PDF

Split PDF

Remove Pages

Extract Pages

Reorder PDF

Rotate PDF

OPTIMIZE PDF

Compress PDF

Repair PDF

OCR PDF

CONVERT TO PDF

JPG to PDF

PNG to PDF

Word to PDF

Excel to PDF

PowerPoint to PDF

CONVERT FROM PDF

PDF to JPG

PDF to PNG

PDF to Word

PDF to Excel

PDF to PowerPoint

EDIT PDF

Add Page Numbers

Add Watermark

Crop PDF

Edit PDF

PDF SECURITY

Protect PDF

Authorized PDF Unlock

Remove Metadata

Each tool should have a professional card.

--------------------------------------------------

IMAGE TOOLS PAGE

--------------------------------------------------

Create:

/image-tools

IMAGE CONVERSION

JPG to PNG

PNG to JPG

JPG to WEBP

PNG to WEBP

WEBP to JPG

WEBP to PNG

IMAGE EDITING

Resize Image

Crop Image

Rotate Image

Flip Image

Brightness

Contrast

Grayscale

IMAGE OPTIMIZATION

Compress Image

Remove Metadata

IMAGE TO PDF

Image to PDF

Multiple Images to PDF

AI IMAGE TOOLS

Background Remover

AI Passport Photo

--------------------------------------------------

AI TOOLS PAGE

--------------------------------------------------

Create:

/ai-tools

Create a visually distinct but professional AI tools section.

Tools:

AI Passport Photo

AI PDF Summary

Chat with PDF

OCR

PDF to Notes

PDF to Questions

Translate PDF

Highlight:

AI Passport Photo

as the flagship AI feature.

Description:

"Create passport-style photos while preserving the original person and natural appearance."

IMPORTANT:

Do not suggest that generative AI will change a person's face.

The future implementation must preserve the original subject and use segmentation/background replacement and non-generative transformations.

--------------------------------------------------

TOOL PAGE TEMPLATE

--------------------------------------------------

Create a reusable tool page component.

Every tool page should follow the same structure.

Example:

/tools/merge-pdf

Top:

Breadcrumb

PDF Tools

/

Merge PDF

Title:

Merge PDF

Description:

"Combine multiple PDF files into one document."

Large upload area:

"Drag & drop your files here"

Button:

"Choose Files"

Supported file information.

Below the upload area:

Selected files list

File name

File size

Remove button

Placeholder for file preview.

Primary button:

"Merge PDF"

Initially the processing button can display a "Coming soon" or disabled state because actual file processing will be implemented later.

Include:

Loading state

Error state

Success state

Download state

These are UI states only at this stage.

Create this reusable structure so all future tools can use it.

--------------------------------------------------

FILE UPLOADER COMPONENT

--------------------------------------------------

Create reusable components:

FileUploader

FileList

FilePreview

ProcessingButton

DownloadButton

ProgressIndicator

ErrorMessage

The components must be reusable.

Do not duplicate the same code for every tool.

--------------------------------------------------

TOOL CARD COMPONENT

--------------------------------------------------

Create a reusable ToolCard component.

Each card:

- Icon

- Title

- Description

- Hover effect

- Clickable

- Accessible

--------------------------------------------------

DASHBOARD

--------------------------------------------------

Create:

/dashboard

Design a professional dashboard.

Include:

Welcome section

Quick Tools

Recent Tools

Recent Files

Favorite Tools

Usage Statistics

Example statistics can use mock data for now.

IMPORTANT:

Do not implement real user data yet.

Use clearly separated mock data so it can later be replaced with backend data.

--------------------------------------------------

LOGIN

--------------------------------------------------

Create:

/login

Professional login UI.

Fields:

Email

Password

Buttons:

Login

Continue with Google

Add:

Forgot password?

Link:

Create account

Do not implement real authentication yet.

--------------------------------------------------

SIGNUP

--------------------------------------------------

Create:

/signup

Fields:

Name

Email

Password

Confirm Password

Button:

Create Account

Do not implement real authentication yet.

--------------------------------------------------

PRICING

--------------------------------------------------

Create:

/pricing

Two plans:

FREE

Basic PDF tools

Basic image tools

Limited AI tools

Standard file limits

PRO

Larger files

Batch processing

Advanced tools

More AI operations

Higher limits

Priority processing

Use placeholder pricing.

Do NOT implement payment processing yet.

--------------------------------------------------

ABOUT PAGE

--------------------------------------------------

Create:

/about

Explain the product concept.

Docly helps users work with:

PDFs

Images

Documents

AI-powered document workflows

Keep the copy professional and concise.

--------------------------------------------------

FOOTER

--------------------------------------------------

Create a professional footer.

Columns:

Product

PDF Tools

Image Tools

AI Tools

Company

About

Contact

Legal

Privacy

Terms

Social placeholders.

Add:

© 2026 Docly

--------------------------------------------------

DESIGN SYSTEM

--------------------------------------------------

Create a consistent design system.

Requirements:

- Clean white/light background

- Professional SaaS appearance

- Rounded cards

- Subtle borders

- Subtle shadows

- Modern typography

- Strong hierarchy

- Excellent spacing

- Consistent iconography

- Responsive design

- Desktop

- Tablet

- Mobile

Do NOT copy iLovePDF's red branding.

Create an original Docly visual identity.

Avoid excessive gradients.

Avoid excessive animations.

Animations should be subtle and professional.

--------------------------------------------------

RESPONSIVE DESIGN

--------------------------------------------------

Desktop:

Full navigation and multi-column tool grids.

Tablet:

Reduced columns.

Mobile:

Hamburger menu.

Tool cards become one or two columns.

Mega menu becomes a mobile-friendly expandable menu.

Upload areas must work visually on mobile.

--------------------------------------------------

ROUTING

--------------------------------------------------

Create working routes for:

/

 /pdf-tools

 /image-tools

 /ai-tools

 /pricing

 /about

 /dashboard

 /login

 /signup

Create routes for the main tools.

Examples:

/tools/merge-pdf

/tools/split-pdf

/tools/compress-pdf

/tools/pdf-to-jpg

/tools/jpg-to-pdf

/tools/pdf-to-word

/tools/image-resizer

/tools/image-compressor

/tools/background-remover

/tools/passport-photo

All tool pages should use the reusable tool page architecture.

--------------------------------------------------

IMPORTANT ARCHITECTURE

--------------------------------------------------

Use reusable components.

Do not duplicate UI code unnecessarily.

Separate:

components

pages/routes

tool configuration

mock data

utilities

Create a central tool configuration/data structure where practical so new tools can be added easily later.

For example, each tool should have:

id

name

category

description

icon

route

supported formats

status

This will make the application scalable.

--------------------------------------------------

VERY IMPORTANT: PROCESSING

--------------------------------------------------

DO NOT implement real PDF processing yet.

DO NOT implement real image processing yet.

DO NOT implement AI APIs yet.

DO NOT implement Supabase yet.

DO NOT implement authentication yet.

DO NOT implement payment processing yet.

DO NOT create unnecessary backend infrastructure.

This stage is ONLY for building the professional product frontend and scalable UI architecture.

--------------------------------------------------

QUALITY

--------------------------------------------------

Before finishing:

Check all routes.

Check all navigation links.

Check mega menu.

Check mobile menu.

Check desktop layout.

Check tablet layout.

Check mobile layout.

Check buttons.

Check tool cards.

Check tool pages.

Check for broken links.

Check for obvious console errors.

Make sure there are no placeholder "Lorem ipsum" texts.

Make sure the interface looks like a real commercial SaaS product.

Do not make the product look like a college project.

--------------------------------------------------

FINAL REQUIREMENT

--------------------------------------------------

Build the complete Stage 1 frontend now.

Do not ask me to manually create individual components.

Do not implement real processing yet.

Focus on a polished, scalable, production-quality frontend that will later be connected to real PDF processing, image processing and AI services by our engineering workflow.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8a1a00ab-8a31-40b1-8b0b-e87c968042c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
