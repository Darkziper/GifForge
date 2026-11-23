# make-gif.ps1 — Turns numbered PNG frames into a GIF using gifski.
# Run from this folder:  .\make-gif.ps1
# Requires gifski:       winget install --id ImageOptim.gifski -e

$ErrorActionPreference = "Stop"

# ---- Settings (edit these if needed) ----
$FramesDir  = ".\frames"          # folder with your PNG frames
$Pattern    = "frame%04d.png"     # frame0001.png, frame0002.png, ...
$Fps        = 24                  # playback speed (GIF-safe; browsers cap at 50 fps)
$Width      = 0                   # 0 = keep original PNG size (best quality)
$Output     = ".\output.gif"

# ---- Find the gifski CLI (prefer the bundled CLI exe, which is the real command-line tool) ----
$gifski = ".\gifski-cli\win\gifski.exe"
if (-not (Test-Path $gifski)) {
    $cmd = Get-Command gifski -ErrorAction SilentlyContinue
    if ($cmd) { $gifski = $cmd.Source }
}
if (-not (Test-Path $gifski) -and -not (Get-Command gifski -ErrorAction SilentlyContinue)) {
    Write-Host "gifski CLI not found." -ForegroundColor Red
    Write-Host "Download it from https://gif.ski/ (CLI binaries) and extract into .\gifski-cli" -ForegroundColor Yellow
    exit 1
}
Write-Host "Using gifski at: $gifski" -ForegroundColor DarkGray

# ---- Check frames folder exists ----
if (-not (Test-Path $FramesDir)) {
    Write-Host "Frames folder not found: $FramesDir" -ForegroundColor Red
    Write-Host "Put your PNGs in a folder named 'frames' next to this script." -ForegroundColor Yellow
    exit 1
}

# ---- Build the frame list (real CLI takes a wildcard, expanded by PowerShell) ----
$frames = Get-ChildItem -LiteralPath $FramesDir -Filter "*.png" | Sort-Object Name | ForEach-Object { $_.FullName }
if ($frames.Count -eq 0) {
    Write-Host "No PNG frames found in $FramesDir" -ForegroundColor Red
    exit 1
}
Write-Host "Found $($frames.Count) frames (first: $(Split-Path $frames[0] -Leaf))" -ForegroundColor DarkGray

# ---- Run gifski CLI ----
Write-Host "Creating GIF ..." -ForegroundColor Cyan
$args = @("-o", $Output)
if ($Fps -gt 0) { $args += @("--fps", "$Fps") }
if ($Width -gt 0) { $args += @("--width", "$Width") }
$args += $frames

& $gifski @args

if ($LASTEXITCODE -eq 0 -and (Test-Path $Output)) {
    $size = (Get-Item $Output).Length
    Write-Host "Done! Created $Output ($size bytes)" -ForegroundColor Green
} else {
    Write-Host "gifski failed. Check that your frames match the pattern '$Pattern'." -ForegroundColor Red
}
