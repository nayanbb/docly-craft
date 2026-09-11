import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  ConversionInput,
  ConversionOutput,
  OfficeConversionOperation,
  OfficeConversionProvider,
} from "@/lib/office/providers/types";
import { UnsupportedOfficeConversionError } from "@/lib/office/providers/types";

const execFileAsync = promisify(execFile);

/**
 * Local Windows Microsoft Office Provider.
 * Automates Word, Excel, and PowerPoint COM on Windows to perform 100% genuine
 * Office -> PDF conversions without requiring Docker or cloud services.
 */
export class LocalOfficeProvider implements OfficeConversionProvider {
  readonly id = "local-office";
  readonly name = "Microsoft Office (Local Desktop Engine)";
  readonly isConfigured: boolean;

  readonly supportedOperations: OfficeConversionOperation[] = [
    "word-to-pdf",
    "excel-to-pdf",
    "powerpoint-to-pdf",
  ];

  constructor() {
    this.isConfigured = this.detectOfficeInstalled();
  }

  private detectOfficeInstalled(): boolean {
    if (typeof process === "undefined" || process.platform !== "win32") {
      return false;
    }
    const standardPath = "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE";
    const x86Path = "C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\WINWORD.EXE";
    return fs.existsSync(standardPath) || fs.existsSync(x86Path);
  }

  async checkHealth(): Promise<boolean> {
    return this.detectOfficeInstalled();
  }

  async convert(input: ConversionInput): Promise<ConversionOutput> {
    if (!this.supportedOperations.includes(input.operation)) {
      throw new UnsupportedOfficeConversionError(input.operation, this.name);
    }

    const tmpDir = os.tmpdir();
    const id = `docly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext = path.extname(input.fileName);
    const baseName = path.basename(input.fileName, ext);
    const inPath = path.join(tmpDir, `${id}${ext}`);
    const outPath = path.join(tmpDir, `${id}.pdf`);
    const psScriptPath = path.join(tmpDir, `${id}.ps1`);

    fs.writeFileSync(inPath, input.fileBuffer);

    let psScript = "";
    if (input.operation === "word-to-pdf") {
      psScript = `
$ErrorActionPreference = "Stop"
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
    $doc = $w.Documents.Open('${inPath.replace(/'/g, "''")}')
    $doc.SaveAs2('${outPath.replace(/'/g, "''")}', 17)
    $doc.Close($false)
} finally {
    $w.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
}
`;
    } else if (input.operation === "excel-to-pdf") {
      psScript = `
$ErrorActionPreference = "Stop"
$e = New-Object -ComObject Excel.Application
$e.Visible = $false
$e.DisplayAlerts = $false
try {
    $wb = $e.Workbooks.Open('${inPath.replace(/'/g, "''")}')
    $wb.ExportAsFixedFormat(0, '${outPath.replace(/'/g, "''")}')
    $wb.Close($false)
} finally {
    $e.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($e) | Out-Null
}
`;
    } else if (input.operation === "powerpoint-to-pdf") {
      psScript = `
$ErrorActionPreference = "Stop"
$p = New-Object -ComObject PowerPoint.Application
try {
    $pres = $p.Presentations.Open('${inPath.replace(/'/g, "''")}', [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    $pres.SaveAs('${outPath.replace(/'/g, "''")}', 32)
    $pres.Close()
} finally {
    $p.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($p) | Out-Null
}
`;
    }

    fs.writeFileSync(psScriptPath, psScript, "utf-8");

    try {
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        psScriptPath,
      ]);

      if (!fs.existsSync(outPath)) {
        throw new Error("Local Office conversion failed to generate output PDF.");
      }

      const outputBuffer = new Uint8Array(fs.readFileSync(outPath));

      // Verify that output is a genuine PDF
      const pdfHeader = String.fromCharCode(...outputBuffer.slice(0, 5));
      if (!pdfHeader.startsWith("%PDF-")) {
        throw new Error("Local Office generated an invalid PDF document.");
      }

      return {
        outputBuffer,
        outputFileName: `${baseName}.pdf`,
        mimeType: "application/pdf",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Microsoft Office conversion failed: ${msg}`);
    } finally {
      try {
        if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
