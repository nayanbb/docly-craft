$ErrorActionPreference = "Stop"

$regPath = "HKCU:\Software\Microsoft\Office\16.0\Word\Options"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "ShowPDFConfirm" -Value 0 -Type DWord

$inPdf = "C:\Users\nayan\docly-craft\test-fixtures\doc1.pdf"
$outDocx = "C:\Users\nayan\docly-craft\test-fixtures\doc1-from-pdf.docx"

if (Test-Path $outDocx) { Remove-Item $outDocx -Force }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    Write-Host "Opening PDF in Word with ShowPDFConfirm=0..."
    # Parameter 2 is ConfirmConversions = False
    $doc = $word.Documents.Open($inPdf, $false, $true, $false)
    Write-Host "Saving as DOCX..."
    # 16 = wdFormatXMLDocument (DOCX)
    $doc.SaveAs2($outDocx, 16)
    $doc.Close($false)
    Write-Host "Done!"
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

$exists = Test-Path $outDocx
$size = if ($exists) { (Get-Item $outDocx).Length } else { 0 }
Write-Host "Result: Exists=$exists, Size=$size bytes"
