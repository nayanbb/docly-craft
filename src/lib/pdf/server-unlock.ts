import { resolveServerEnvVar } from "@/lib/office/providers";

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Executes local server-side pypdf decryption if the microservice HTTP endpoint is unreachable.
 * Never logs passwords or document contents.
 */
async function decryptLocallyWithPython(
  fileBuffer: ArrayBuffer,
  password: string,
): Promise<{
  success: boolean;
  status: number;
  bytes?: Uint8Array;
  error?: string;
  pageCount?: number;
}> {
  try {
    const { spawnSync } = await import("node:child_process");
    const pyCode = [
      "import sys, io, pypdf",
      "data = sys.stdin.buffer.read()",
      "password = sys.argv[1] if len(sys.argv) > 1 else ''",
      "try:",
      "    reader = pypdf.PdfReader(io.BytesIO(data))",
      "except Exception:",
      "    sys.exit(3)",
      "if reader.is_encrypted:",
      "    res = reader.decrypt(password)",
      "    if res == 0:",
      "        sys.exit(2)",
      "writer = pypdf.PdfWriter()",
      "writer.append(reader)",
      "out = io.BytesIO()",
      "writer.write(out)",
      "sys.stdout.buffer.write(out.getvalue())",
      "sys.stderr.write(str(len(reader.pages)))",
      "sys.exit(0)",
    ].join("\n");

    const proc = spawnSync("python", ["-c", pyCode, password], {
      input: Buffer.from(fileBuffer),
      maxBuffer: MAX_PDF_SIZE_BYTES,
      windowsHide: true,
    });

    if (proc.status === 0 && proc.stdout && proc.stdout.length > 0) {
      const pageCount = parseInt(proc.stderr?.toString() || "1", 10) || 1;
      return { success: true, status: 200, bytes: new Uint8Array(proc.stdout), pageCount };
    }

    if (proc.status === 2) {
      return {
        success: false,
        status: 401,
        error: "Incorrect PDF password. Please enter the correct password.",
      };
    }

    return {
      success: false,
      status: 400,
      error: "Unable to unlock this PDF. Please try again with a valid PDF and password.",
    };
  } catch {
    return {
      success: false,
      status: 500,
      error: "Unable to unlock this PDF. Please try again with a valid PDF and password.",
    };
  }
}

/**
 * Handles /api/pdf/unlock endpoint.
 * Authenticates with user password, decrypts PDF, and returns a clean, unencrypted PDF.
 */
export async function handlePdfUnlockRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed. Use POST." },
      { status: 405, headers: { Allow: "POST" } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Unable to unlock this PDF. Please try again with a valid PDF and password." },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;
  const password = ((formData.get("password") as string | null) ?? "").trim();

  if (!file) {
    return Response.json(
      { error: "Unable to unlock this PDF. Please try again with a valid PDF and password." },
      { status: 400 },
    );
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return Response.json(
      { error: "Unable to unlock this PDF. File size exceeds the 50MB limit." },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

  // Quick signature check: PDF magic header %PDF-
  if (
    fileBytes.length < 5 ||
    fileBytes[0] !== 0x25 ||
    fileBytes[1] !== 0x50 ||
    fileBytes[2] !== 0x44 ||
    fileBytes[3] !== 0x46
  ) {
    return Response.json(
      { error: "Unable to unlock this PDF. Please try again with a valid PDF and password." },
      { status: 400 },
    );
  }

  // 1. Forward to self-hosted converter microservice
  const converterUrl = (
    resolveServerEnvVar("DOCLY_CONVERTER_URL", env) ||
    resolveServerEnvVar("CONVERTER_SERVICE_URL", env) ||
    "http://127.0.0.1:8001"
  )
    .trim()
    .replace(/\/+$/, "");

  const converterSecret = (
    resolveServerEnvVar("DOCLY_CONVERTER_SECRET", env) ||
    resolveServerEnvVar("CONVERTER_SECRET", env)
  ).trim();

  let microserviceFailed = false;

  try {
    const upstreamForm = new FormData();
    upstreamForm.append(
      "file",
      new Blob([fileBytes], { type: "application/pdf" }),
      file.name || "document.pdf",
    );
    upstreamForm.append("password", password);

    const headers: Record<string, string> = {};
    if (converterSecret) {
      headers["X-Converter-Secret"] = converterSecret;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const upstreamRes = await fetch(`${converterUrl}/unlock`, {
      method: "POST",
      headers,
      body: upstreamForm,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (upstreamRes.status === 401) {
      return Response.json(
        { error: "Incorrect PDF password. Please enter the correct password." },
        { status: 401 },
      );
    }

    if (upstreamRes.status === 400) {
      return Response.json(
        { error: "Unable to unlock this PDF. Please try again with a valid PDF and password." },
        { status: 400 },
      );
    }

    if (!upstreamRes.ok) {
      throw new Error(`Upstream returned ${upstreamRes.status}`);
    }

    const decryptedBytes = await upstreamRes.arrayBuffer();
    const pageCount = upstreamRes.headers.get("X-Page-Count") || "1";
    const baseName = (file.name || "document.pdf").replace(/\.[^/.]+$/, "");

    return new Response(decryptedBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}-unlocked.pdf"`,
        "X-Page-Count": pageCount,
        "X-Decrypted-By": "docly-self-hosted",
      },
    });
  } catch {
    microserviceFailed = true;
  }

  // 2. Direct local Python fallback if microservice was unreachable
  if (microserviceFailed) {
    const fallbackRes = await decryptLocallyWithPython(arrayBuffer, password);
    if (fallbackRes.success && fallbackRes.bytes) {
      const baseName = (file.name || "document.pdf").replace(/\.[^/.]+$/, "");
      return new Response(fallbackRes.bytes as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseName}-unlocked.pdf"`,
          "X-Page-Count": String(fallbackRes.pageCount || 1),
          "X-Decrypted-By": "docly-local-engine",
        },
      });
    }

    if (fallbackRes.status === 401) {
      return Response.json(
        {
          error: fallbackRes.error || "Incorrect PDF password. Please enter the correct password.",
        },
        { status: 401 },
      );
    }

    return Response.json(
      {
        error:
          fallbackRes.error ||
          "Unable to unlock this PDF. Please try again with a valid PDF and password.",
      },
      { status: fallbackRes.status || 500 },
    );
  }

  return Response.json(
    { error: "Unable to unlock this PDF. Please try again with a valid PDF and password." },
    { status: 500 },
  );
}
