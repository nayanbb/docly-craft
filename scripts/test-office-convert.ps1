$ErrorActionPreference = "Stop"

$inDocx = "C:\Users\nayan\docly-craft\test-fixtures\sample.docx"
$outPdf = "C:\Users\nayan\docly-craft\test-fixtures\sample-from-word.pdf"

if (Test-Path $outPdf) { Remove-Item $outPdf -Force }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0 # wdAlertsNone

try {
    # If sample.docx doesn't exist, create a blank doc first and save as sample.docx
    if (-not (Test-Path $inDocx)) {
        $docNew = $word.Documents.Add()
        $docNew.Content.Text = "Hello from Docly Office Conversion Engine!"
        $docNew.SaveAs2($inDocx, 16) # wdFormatXMLDocument
        $docNew.Close()
    }

    Write-Host "Opening DOCX..."
    $doc = $word.Documents.Open($inDocx)
    Write-Host "Exporting as PDF..."
    # 17 = wdFormatPDF
    $doc.SaveAs2($outPdf, 17)
    $doc.Close($false)
    Write-Host "Done!"
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

$exists = Test-Path $outPdf
$size = if ($exists) { (Get-Item $outPdf).Length } else { 0 }
Write-Host "Result: Exists=$exists, Size=$size bytes"
