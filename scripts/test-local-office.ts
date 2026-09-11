import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function convertViaLocalOffice(
  fileBuffer: Uint8Array,
  fileName: string,
  operation: "word-to-pdf" | "excel-to-pdf" | "powerpoint-to-pdf",
): Promise<{ outputBuffer: Uint8Array; outputFileName: string }> {
  const tmpDir = os.tmpdir();
  const id = `docly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  const inPath = path.join(tmpDir, `${id}${ext}`);
  const outPath = path.join(tmpDir, `${id}.pdf`);

  fs.writeFileSync(inPath, fileBuffer);

  let psScript = "";
  if (operation === "word-to-pdf") {
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
  } else if (operation === "excel-to-pdf") {
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
  } else if (operation === "powerpoint-to-pdf") {
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

  const psScriptPath = path.join(tmpDir, `${id}.ps1`);
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
      throw new Error("Conversion failed to produce an output PDF.");
    }

    const outputBuffer = new Uint8Array(fs.readFileSync(outPath));
    return {
      outputBuffer,
      outputFileName: `${baseName}.pdf`,
    };
  } finally {
    try {
      if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);
    } catch {
      // Ignore cleanup error
    }
  }
}

async function main() {
  const docx = fs.readFileSync("test-fixtures/sample.docx");
  console.log("Converting DOCX via Local Office...");
  const resWord = await convertViaLocalOffice(docx, "sample.docx", "word-to-pdf");
  console.log("Word -> PDF:", resWord.outputFileName, resWord.outputBuffer.length, "bytes");

  const xlsx = fs.readFileSync("test-fixtures/sample.xlsx");
  console.log("Converting XLSX via Local Office...");
  const resExcel = await convertViaLocalOffice(xlsx, "sample.xlsx", "excel-to-pdf");
  console.log("Excel -> PDF:", resExcel.outputFileName, resExcel.outputBuffer.length, "bytes");

  const pptx = fs.readFileSync("test-fixtures/sample.pptx");
  console.log("Converting PPTX via Local Office...");
  const resPpt = await convertViaLocalOffice(pptx, "sample.pptx", "powerpoint-to-pdf");
  console.log("PowerPoint -> PDF:", resPpt.outputFileName, resPpt.outputBuffer.length, "bytes");

  console.log("ALL 3 CONVERSIONS SUCCESSFUL!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
