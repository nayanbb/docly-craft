$ErrorActionPreference = "Stop"

$inXlsx = "C:\Users\nayan\docly-craft\test-fixtures\sample.xlsx"
$outPdf = "C:\Users\nayan\docly-craft\test-fixtures\sample-from-excel.pdf"

if (Test-Path $outPdf) { Remove-Item $outPdf -Force }

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    # If sample.xlsx doesn't exist, create a blank sheet first
    if (-not (Test-Path $inXlsx)) {
        $wbNew = $excel.Workbooks.Add()
        $ws = $wbNew.Sheets.Item(1)
        $ws.Cells.Item(1, 1).Value2 = "Docly Excel Conversion"
        $ws.Cells.Item(2, 1).Value2 = "Q1 Revenue"
        $ws.Cells.Item(2, 2).Value2 = 45000
        $wbNew.SaveAs($inXlsx, 51) # 51 = xlOpenXMLWorkbook
        $wbNew.Close($false)
    }

    Write-Host "Opening XLSX..."
    $wb = $excel.Workbooks.Open($inXlsx)
    Write-Host "Exporting as PDF..."
    # 0 = xlTypePDF
    $wb.ExportAsFixedFormat(0, $outPdf)
    $wb.Close($false)
    Write-Host "Done!"
}
finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}

$exists = Test-Path $outPdf
$size = if ($exists) { (Get-Item $outPdf).Length } else { 0 }
Write-Host "Result: Exists=$exists, Size=$size bytes"
