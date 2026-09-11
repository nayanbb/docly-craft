import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import {
  getActiveAIProvider,
  type TranslateOptions,
  type TranslateResult,
} from "@/lib/ai/providers";

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "en", name: "English", nativeName: "English" },
];

/**
 * Heuristic detector for obvious language scripts (Latin, Cyrillic, CJK, Arabic, Devanagari).
 */
export function detectDocumentScript(text: string): string {
  const sample = text.slice(0, 1000);
  if (/[\u4e00-\u9fa5]/.test(sample)) return "Chinese / CJK";
  if (/[\u3040-\u30ff]/.test(sample)) return "Japanese";
  if (/[\uac00-\ud7af]/.test(sample)) return "Korean";
  if (/[\u0600-\u06ff]/.test(sample)) return "Arabic";
  if (/[\u0900-\u097f]/.test(sample)) return "Hindi / Devanagari";
  if (/[\u0400-\u04ff]/.test(sample)) return "Russian / Cyrillic";
  return "English / Latin script";
}

/**
 * Translates document text using the active AI/translation provider.
 */
export async function translateDocument(
  doc: ExtractedDocument,
  targetLanguage: string,
  options?: TranslateOptions,
): Promise<TranslateResult> {
  const provider = getActiveAIProvider();
  return provider.translate(doc, targetLanguage, options);
}

/**
 * Formats a TranslateResult into an exportable text file.
 */
export function formatTranslationAsText(result: TranslateResult, filename: string): string {
  const targetLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === result.targetLanguage);
  const targetName = targetLangObj
    ? `${targetLangObj.name} (${targetLangObj.nativeName})`
    : result.targetLanguage;

  const lines: string[] = [];
  lines.push(`================================================================`);
  lines.push(`DOCLY DOCUMENT TRANSLATION`);
  lines.push(`Original Document: ${filename}`);
  lines.push(`Target Language: ${targetName}`);
  lines.push(`Date: ${new Date().toLocaleString()}`);
  lines.push(`================================================================\n`);

  for (const page of result.pages) {
    lines.push(`--- Page ${page.pageNumber} ---`);
    lines.push(page.text.trim());
    lines.push("");
  }

  lines.push(`================================================================`);
  lines.push(`Translated via Docly AI Document Architecture.`);
  lines.push(`================================================================`);

  return lines.join("\n");
}
