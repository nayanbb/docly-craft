/**
 * Types and interfaces for Docly's Office Document Conversion Architecture.
 */

export type OfficeConversionOperation =
  | "word-to-pdf"
  | "excel-to-pdf"
  | "powerpoint-to-pdf"
  | "pdf-to-word"
  | "pdf-to-excel"
  | "pdf-to-powerpoint";

export type OfficeToolProcessingState =
  | "idle"
  | "uploading"
  | "validating"
  | "converting"
  | "finalizing"
  | "success"
  | "error"
  | "backend_not_configured"
  | "unsupported_conversion";

export interface ConversionBackendStatus {
  configured: boolean;
  provider: "gotenberg" | "cloudconvert" | "local-office" | "self-hosted" | "none";
  supportedOperations: OfficeConversionOperation[];
  statusMessage?: string;
  reachable?: boolean;
}

export interface ConversionInput {
  fileBuffer: Uint8Array;
  fileName: string;
  operation: OfficeConversionOperation;
}

export interface ConversionOutput {
  outputBuffer: Uint8Array;
  outputFileName: string;
  mimeType: string;
}

/**
 * Server-side provider interface for Office document conversions.
 */
export interface OfficeConversionProvider {
  readonly id: string;
  readonly name: string;
  readonly isConfigured: boolean;
  readonly supportedOperations: OfficeConversionOperation[];

  convert(input: ConversionInput): Promise<ConversionOutput>;
  checkHealth?(): Promise<boolean>;
}
