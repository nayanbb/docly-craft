import type {
  ConversionInput,
  ConversionOutput,
  OfficeConversionOperation,
  OfficeConversionProvider,
} from "@/lib/office/providers/types";
import {
  OfficeBackendNotConfiguredError,
  UnsupportedOfficeConversionError,
} from "@/lib/office/providers/types";

function getRuntimeEnvVar(name: string): string {
  if (typeof process !== "undefined" && process.env && typeof process.env[name] === "string") {
    return process.env[name].trim();
  }
  if (typeof globalThis !== "undefined") {
    const val = (globalThis as Record<string, unknown>)[name];
    if (typeof val === "string") return val.trim();
  }
  return "";
}

function sanitizeError(msg: string, secret?: string): string {
  let cleaned = msg.replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [REDACTED]");
  if (secret && secret.length > 5) {
    cleaned = cleaned.replaceAll(secret, "[REDACTED]");
  }
  return cleaned;
}

/**
 * CloudConvert Provider for Docly.
 * Handles high-fidelity PDF -> Office (Word, Excel, PowerPoint) reverse conversions
 * through CloudConvert's API v2.
 * Server credentials (CLOUDCONVERT_API_KEY) remain strictly on the backend.
 */
export class CloudConvertProvider implements OfficeConversionProvider {
  readonly id = "cloudconvert";
  readonly name = "CloudConvert API Engine";
  readonly isConfigured: boolean;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  readonly supportedOperations: OfficeConversionOperation[] = [
    "pdf-to-word",
    "pdf-to-excel",
    "pdf-to-powerpoint",
    "word-to-pdf",
    "excel-to-pdf",
    "powerpoint-to-pdf",
  ];

  constructor(apiKey?: string, baseUrl?: string) {
    const key = apiKey || getRuntimeEnvVar("CLOUDCONVERT_API_KEY");
    this.apiKey = key.trim();
    this.baseUrl =
      baseUrl || getRuntimeEnvVar("CLOUDCONVERT_BASE_URL") || "https://api.cloudconvert.com/v2";
    this.isConfigured = this.apiKey.length > 0;
  }

  /**
   * Health check verifying whether the CloudConvert API key is valid and reachable.
   * Checks /tasks endpoint (which verifies task.read scope required for conversion).
   */
  async checkHealth(): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/tasks?per_page=1`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return true;
      if (res.status === 404) {
        // Fallback for mock servers or user.read-only keys
        const controllerFallback = new AbortController();
        const timeoutFallback = setTimeout(() => controllerFallback.abort(), 5000);
        const fallbackRes = await fetch(`${this.baseUrl}/users/me`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: controllerFallback.signal,
        });
        clearTimeout(timeoutFallback);
        return fallbackRes.ok;
      }
      return false;
    } catch {
      return false;
    }
  }

  async convert(input: ConversionInput): Promise<ConversionOutput> {
    if (!this.isConfigured) {
      throw new OfficeBackendNotConfiguredError(
        "Document conversion is temporarily unavailable. Please try again later.",
      );
    }

    if (!this.supportedOperations.includes(input.operation)) {
      throw new UnsupportedOfficeConversionError(input.operation, this.name);
    }

    if (input.fileBuffer.length === 0) {
      throw new Error("The uploaded document is empty.");
    }

    if (input.fileBuffer.length > 50 * 1024 * 1024) {
      throw new Error("Document is too large. Maximum supported file size is 50 MB.");
    }

    // Determine target format, extension, and mime-type
    let inputFormat = "pdf";
    let targetFormat = "pdf";
    let mimeType = "application/pdf";
    let targetExt = "pdf";

    if (input.operation === "pdf-to-word") {
      inputFormat = "pdf";
      targetFormat = "docx";
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      targetExt = "docx";
    } else if (input.operation === "pdf-to-excel") {
      inputFormat = "pdf";
      targetFormat = "xlsx";
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      targetExt = "xlsx";
    } else if (input.operation === "pdf-to-powerpoint") {
      inputFormat = "pdf";
      targetFormat = "pptx";
      mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      targetExt = "pptx";
    } else if (input.operation === "word-to-pdf") {
      inputFormat = "docx";
      targetFormat = "pdf";
      mimeType = "application/pdf";
      targetExt = "pdf";
    } else if (input.operation === "excel-to-pdf") {
      inputFormat = "xlsx";
      targetFormat = "pdf";
      mimeType = "application/pdf";
      targetExt = "pdf";
    } else if (input.operation === "powerpoint-to-pdf") {
      inputFormat = "pptx";
      targetFormat = "pdf";
      mimeType = "application/pdf";
      targetExt = "pdf";
    }

    let createdJobId: string | null = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s overall abort timeout

    try {
      // 1. Create conversion job in CloudConvert
      const createJobRes = await fetch(`${this.baseUrl}/jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tasks: {
            "import-file": {
              operation: "import/upload",
            },
            "convert-file": {
              operation: "convert",
              input: ["import-file"],
              input_format: inputFormat,
              output_format: targetFormat,
            },
            "export-file": {
              operation: "export/url",
              input: ["convert-file"],
              inline: false,
              archive_multiple_files: false,
            },
          },
          tag: "docly",
        }),
        signal: controller.signal,
      });

      if (!createJobRes.ok) {
        if (createJobRes.status === 401) {
          throw new Error(
            "Invalid CloudConvert API key. Check CLOUDCONVERT_API_KEY in your server environment.",
          );
        }
        if (createJobRes.status === 402) {
          throw new Error(
            "CloudConvert API credit limit reached. Please check your CloudConvert account.",
          );
        }
        const err = await createJobRes.text().catch(() => "");
        throw new Error(
          `CloudConvert job initialization failed (${createJobRes.status}): ${err || createJobRes.statusText}`,
        );
      }

      const jobData = await createJobRes.json();
      createdJobId = (jobData as { data?: { id?: string } })?.data?.id ?? null;

      const uploadTask = (
        jobData as {
          data?: {
            tasks?: Array<{
              name: string;
              result?: { form?: { url: string; parameters: Record<string, unknown> } };
            }>;
          };
        }
      )?.data?.tasks?.find((t) => t.name === "import-file");

      if (!uploadTask?.result?.form) {
        throw new Error("CloudConvert did not return a valid upload task.");
      }

      // 2. Upload file stream to CloudConvert storage
      const uploadForm = new FormData();
      const formFields = uploadTask.result.form.parameters;
      for (const [k, v] of Object.entries(formFields)) {
        uploadForm.append(k, String(v));
      }
      const blob = new Blob([input.fileBuffer as unknown as BlobPart]);
      uploadForm.append("file", blob, input.fileName);

      const uploadRes = await fetch(uploadTask.result.form.url, {
        method: "POST",
        body: uploadForm,
        signal: controller.signal,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload document to conversion engine.");
      }

      // 3. Find export task and poll for completion
      const exportTask = (
        jobData as {
          data?: {
            tasks?: Array<{
              id: string;
              name: string;
            }>;
          };
        }
      )?.data?.tasks?.find((t) => t.name === "export-file");

      if (!exportTask?.id) {
        throw new Error("Could not find export task in conversion job.");
      }

      const pollUrl = `${this.baseUrl}/tasks/${exportTask.id}`;
      let downloadUrl = "";

      // Poll task status (up to 40 iterations x 1.5s = 60s max)
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        const taskRes = await fetch(pollUrl, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: controller.signal,
        });

        if (taskRes.ok) {
          const tData = (await taskRes.json()) as {
            data?: {
              status: string;
              message?: string;
              result?: { files?: Array<{ url: string }> };
            };
          };

          if (tData.data?.status === "finished") {
            downloadUrl = tData.data.result?.files?.[0]?.url ?? "";
            break;
          }
          if (tData.data?.status === "error") {
            throw new Error(tData.data.message || "CloudConvert task failed during conversion.");
          }
        } else if (taskRes.status === 401) {
          throw new Error(
            "Invalid CloudConvert API key. Check CLOUDCONVERT_API_KEY in your server environment.",
          );
        } else if (taskRes.status === 402) {
          throw new Error(
            "CloudConvert API credit limit reached. Please check your CloudConvert account.",
          );
        }
      }

      if (!downloadUrl) {
        throw new Error("Conversion timed out. The file may be too complex or large.");
      }

      // 4. Retrieve the converted binary
      const fileRes = await fetch(downloadUrl, { signal: controller.signal });
      if (!fileRes.ok) {
        throw new Error("Failed to retrieve converted document from storage.");
      }

      const arrayBuf = await fileRes.arrayBuffer();
      const outputBuffer = new Uint8Array(arrayBuf);

      if (outputBuffer.length === 0) {
        throw new Error("Conversion provider returned an empty document.");
      }

      // 5. Verify output integrity
      // OpenXML files (DOCX, XLSX, PPTX) must begin with PK\x03\x04
      if (targetExt === "docx" || targetExt === "xlsx" || targetExt === "pptx") {
        const isZip =
          outputBuffer[0] === 0x50 &&
          outputBuffer[1] === 0x4b &&
          outputBuffer[2] === 0x03 &&
          outputBuffer[3] === 0x04;
        if (!isZip) {
          throw new Error("Conversion engine returned an invalid Office document package.");
        }
      }

      const baseName = input.fileName.replace(/\.[^/.]+$/, "");
      const outputFileName = `${baseName}.${targetExt}`;

      return {
        outputBuffer,
        outputFileName,
        mimeType,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("CloudConvert conversion timed out after 90 seconds.");
      }
      if (err instanceof Error) {
        throw new Error(sanitizeError(err.message, this.apiKey));
      }
      throw err;
    } finally {
      clearTimeout(timeout);
      // Clean up CloudConvert job storage
      if (createdJobId) {
        await fetch(`${this.baseUrl}/jobs/${createdJobId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }).catch(() => {
          // Ignore deletion error
        });
      }
    }
  }
}
