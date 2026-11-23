# make-clean-gif.ps1 - Clean PNG frames -> noise-free transparent GIF
# Fixes alpha noise + white bleeding by binarizing the alpha channel first.
# Requires the bundled gifski CLI.

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\msey7\Downloads\FNF-THINK-CHARACTERS\CesarTHINK"
$Output      = Join-Path $ProjectRoot "output-clean.gif"
$Fps        = 12
$gifski     = Join-Path $ProjectRoot "gifski-cli\win\gifski.exe"

if (-not (Test-Path $gifski)) { Write-Host "Missing gifski CLI: $gifski" -ForegroundColor Red; exit 1 }

& (Join-Path $ProjectRoot "clean-frames.ps1")

$cleanFrames = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "frames-clean") -Filter "*.png" | Sort-Object Name | ForEach-Object { $_.FullName }
$args = @("-o", $Output, "--fps", "$Fps")
$args += $cleanFrames
& $gifski @args

if ($LASTEXITCODE -eq 0 -and (Test-Path $Output)) {
    Write-Host "Done! Created $Output"
} else {
    Write-Host "gifski failed."
}
