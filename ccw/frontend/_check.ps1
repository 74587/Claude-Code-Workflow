Set-Location 'D:\Claude_dms3\ccw\frontend'
$output = npx tsc --noEmit 2>&1
$errors = $output | Select-String 'error TS'

# Real errors only
$real = $errors | Where-Object { $_.Line -notmatch 'TS6133' -and $_.Line -notmatch 'TS1149' -and $_.Line -notmatch 'TS6196' -and $_.Line -notmatch 'TS6192' }

# Source code errors (non-test)
$src = $real | Where-Object { $_.Line -notmatch '\.test\.' -and $_.Line -notmatch '__tests__' }
Write-Host "=== SOURCE CODE ERRORS (non-test) ==="
Write-Host "Count: $($src.Count)"
Write-Host ""
foreach ($e in $src) { Write-Host $e.Line }
