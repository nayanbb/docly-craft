import type {
  ConversionInput,
  ConversionOutput,
  OfficeConversionOperation,
  OfficeConversionProvider,
} from "@/lib/office/types";

export type {
  ConversionInput,
  ConversionOutput,
  OfficeConversionOperation,
  OfficeConversionProvider,
};

export class OfficeBackendNotConfiguredError extends Error {
  constructor(
    message: string = "Document conversion is temporarily unavailable. Please try again later.",
  ) {
    super(message);
    this.name = "OfficeBackendNotConfiguredError";
  }
}

export class UnsupportedOfficeConversionError extends Error {
  constructor(operation: string, providerName: string) {
    super(
      `This conversion (${operation}) is not supported by the current conversion provider (${providerName}).`,
    );
    this.name = "UnsupportedOfficeConversionError";
  }
}
