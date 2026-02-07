Set-Location 'D:\Claude_dms3\ccw\frontend'
$output = npx tsc --noEmit 2>&1
$errorLines = $output | Select-String 'error TS'

Write-Host "=== TOTAL ERRORS ==="
Write-Host $errorLines.Count

Write-Host "`n=== BY ERROR CODE ==="
$errorLines | ForEach-Object {
    if ($_.Line -match 'error (TS\d+)') { $Matches[1] }
} | Group-Object | Sort-Object Count -Descending | Select-Object -First 15 | Format-Table Name, Count -AutoSize

Write-Host "`n=== BY FILE (top 25) ==="
$errorLines | ForEach-Object {
    ($_.Line -split '\(')[0]
} | Group-Object | Sort-Object Count -Descending | Select-Object -First 25 | Format-Table Name, Count -AutoSize

Write-Host "`n=== NON-TS6133 ERRORS (real issues, not unused vars) ==="
$errorLines | Where-Object { $_.Line -notmatch 'TS6133' -and $_.Line -notmatch 'TS1149' } | ForEach-Object { $_.Line } | Select-Object -First 60
