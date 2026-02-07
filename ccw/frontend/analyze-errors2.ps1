Set-Location 'D:\Claude_dms3\ccw\frontend'
$output = npx tsc --noEmit 2>&1
$errorLines = $output | Select-String 'error TS'

Write-Host "=== NON-TS6133/TS1149/TS6196/TS6192 ERRORS (real issues) ==="
$real = $errorLines | Where-Object { $_.Line -notmatch 'TS6133' -and $_.Line -notmatch 'TS1149' -and $_.Line -notmatch 'TS6196' -and $_.Line -notmatch 'TS6192' }
Write-Host "Count: $($real.Count)"
Write-Host ""

Write-Host "=== GROUPED BY FILE ==="
$real | ForEach-Object {
    ($_.Line -split '\(')[0]
} | Group-Object | Sort-Object Count -Descending | Format-Table Name, Count -AutoSize

Write-Host "`n=== ROUTER.TSX ERRORS ==="
$errorLines | Where-Object { $_.Line -match 'src/router\.tsx' } | ForEach-Object { $_.Line }

Write-Host "`n=== STORES/INDEX.TS ERRORS ==="
$errorLines | Where-Object { $_.Line -match 'src/stores/index\.ts' } | ForEach-Object { $_.Line }

Write-Host "`n=== TYPES/INDEX.TS ERRORS ==="
$errorLines | Where-Object { $_.Line -match 'src/types/index\.ts' } | ForEach-Object { $_.Line }

Write-Host "`n=== SHARED/INDEX.TS ERRORS ==="
$errorLines | Where-Object { $_.Line -match 'src/components/shared/index\.ts' } | ForEach-Object { $_.Line }

Write-Host "`n=== HOOKS/INDEX.TS ERRORS ==="
$errorLines | Where-Object { $_.Line -match 'src/hooks/index\.ts' } | ForEach-Object { $_.Line }
