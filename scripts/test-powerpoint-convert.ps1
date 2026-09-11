$ErrorActionPreference = "Stop"

$inPptx = "C:\Users\nayan\docly-craft\test-fixtures\sample.pptx"
$outPdf = "C:\Users\nayan\docly-craft\test-fixtures\sample-from-powerpoint.pdf"

if (Test-Path $outPdf) { Remove-Item $outPdf -Force }

$ppt = New-Object -ComObject PowerPoint.Application

try {
    # If sample.pptx doesn't exist, create a blank presentation first
    if (-not (Test-Path $inPptx)) {
        # 2 is msoFalse (WithWindow: false)
        $presNew = $ppt.Presentations.Add([Microsoft.Office.Core.MsoTriState]::msoFalse)
        $slide = $presNew.Slides.Add(1, 1) # 1 = ppLayoutTitle
        $slide.Shapes.Title.TextFrame.TextRange.Text = "Docly Presentation"
        $presNew.SaveAs($inPptx, 24) # 24 = ppSaveAsOpenXMLPresentation
        $presNew.Close()
    }

    Write-Host "Opening PPTX..."
    $pres = $ppt.Presentations.Open($inPptx, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    Write-Host "Exporting as PDF..."
    # 32 = ppSaveAsPDF
    $pres.SaveAs($outPdf, 32)
    $pres.Close()
    Write-Host "Done!"
}
finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}

$exists = Test-Path $outPdf
$size = if ($exists) { (Get-Item $outPdf).Length } else { 0 }
Write-Host "Result: Exists=$exists, Size=$size bytes"
