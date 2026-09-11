/**
 * Daily Usage Tracking & Enforcement Service
 *
 * Enforces per-tool daily limits on UTC day boundaries:
 * - 10 files/day per conversion tool (PDF->Word, PDF->Excel, etc.)
 * - 2 pages/day for OCR and Scan->Searchable PDF
 * Increments counters ONLY on successful completion.
 */

import {
  CONVERSION_LIMITS,
  OCR_LIMITS,
  isConversionLimitedTool,
  isOcrLimitedTool,
  UPGRADE_MESSAGES,
} from "./config";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface UsageCheckResult {
  allowed: boolean;
  limit: number;
  currentUsage: number;
  remaining: number;
  unit: "files" | "pages" | "unlimited";
  title?: string;
  message?: string;
  error?: string;
  ctaText?: string;
}

/**
 * Returns current date string formatted as YYYY-MM-DD in UTC timezone.
 */
export function getUtcDateString(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const CLIENT_ID_KEY = "docly_client_device_id";

export function getClientDeviceIdentifier(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = "cl_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    } catch {
      // Ignore in restricted iframe
    }
  }
  return id;
}

function getUsageStorageKey(toolId: string, utcDate: string): string {
  return `docly_usage_${toolId}_${utcDate}`;
}

/**
 * Retrieves the current day's recorded successful usage for a specific tool.
 */
export function getToolUsageToday(toolId: string): number {
  if (typeof window === "undefined") return 0;
  const today = getUtcDateString();
  const key = getUsageStorageKey(toolId, today);
  const raw = window.localStorage.getItem(key);
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/**
 * Checks whether the current user is permitted to execute an operation for the tool.
 */
export function checkToolUsage(
  toolId: string,
  requestedUnits: number = 1,
  isPro: boolean = false,
): UsageCheckResult {
  // Pro users have unlimited access within technical bounds
  if (isPro) {
    return {
      allowed: true,
      limit: Infinity,
      currentUsage: 0,
      remaining: Infinity,
      unit: "unlimited",
    };
  }

  // 1. Office Conversion tools: 10 files/day per tool
  if (isConversionLimitedTool(toolId)) {
    const limit = CONVERSION_LIMITS.dailyFreeLimitPerTool;
    const current = getToolUsageToday(toolId);
    const remaining = Math.max(0, limit - current);

    if (current + requestedUnits > limit) {
      return {
        allowed: false,
        limit,
        currentUsage: current,
        remaining,
        unit: "files",
        title: UPGRADE_MESSAGES.conversionLimit.title,
        message: UPGRADE_MESSAGES.conversionLimit.description,
        error: UPGRADE_MESSAGES.conversionLimit.title,
        ctaText: UPGRADE_MESSAGES.conversionLimit.cta,
      };
    }

    return {
      allowed: true,
      limit,
      currentUsage: current,
      remaining,
      unit: "files",
    };
  }

  // 2. OCR and Scan tools: 2 pages/day
  if (isOcrLimitedTool(toolId)) {
    const limit = OCR_LIMITS.dailyFreePages;
    const current = getToolUsageToday(toolId);
    const remaining = Math.max(0, limit - current);

    if (current + requestedUnits > limit) {
      return {
        allowed: false,
        limit,
        currentUsage: current,
        remaining,
        unit: "pages",
        title: UPGRADE_MESSAGES.ocrLimit.title,
        message: UPGRADE_MESSAGES.ocrLimit.description,
        error: UPGRADE_MESSAGES.ocrLimit.title,
        ctaText: UPGRADE_MESSAGES.ocrLimit.cta,
      };
    }

    return {
      allowed: true,
      limit,
      currentUsage: current,
      remaining,
      unit: "pages",
    };
  }

  // 3. Normal free tools (Merge, Split, Compress, etc.) have unlimited usage
  return {
    allowed: true,
    limit: Infinity,
    currentUsage: 0,
    remaining: Infinity,
    unit: "unlimited",
  };
}

/**
 * Records successful tool execution.
 * MUST ONLY be called AFTER the operation has succeeded!
 */
export async function recordSuccessfulUsage(
  toolId: string,
  units: number = 1,
  userId?: string,
): Promise<number> {
  if (typeof window === "undefined") return units;
  const today = getUtcDateString();
  const key = getUsageStorageKey(toolId, today);
  const current = getToolUsageToday(toolId);
  const updated = current + units;

  try {
    window.localStorage.setItem(key, String(updated));
  } catch {
    // Ignore storage quota errors
  }

  // Asynchronously record in Supabase daily_usage if configured
  if (isSupabaseConfigured) {
    try {
      const identifier = userId || getClientDeviceIdentifier();
      await supabase.from("daily_usage").upsert(
        {
          identifier,
          tool_id: toolId,
          usage_date: today,
          count: updated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "identifier,tool_id,usage_date" },
      );
    } catch {
      // Non-blocking sync failure
    }
  }

  return updated;
}
