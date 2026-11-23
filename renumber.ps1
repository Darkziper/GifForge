# renumber.ps1 — Renames PNGs in .\frames to frame0001.png, frame0002.png, ...
# Run this BEFORE make-gif.ps1 if your frames have random names.
# Run from this folder:  .\renumber.ps1

$ErrorActionPreference = "Stop"

$FramesDir = ".\frames"

if (-not (Test-Path $FramesDir)) {
    Write-Host "Frames folder not found: $FramesDir" -ForegroundColor Red
    exit 1
}

$pngs = Get-ChildItem -Path $FramesDir -Filter *.png | Sort-Object Name

if ($pngs.Count -eq 0) {
    Write-Host "No PNG files found in $FramesDir" -ForegroundColor Red
    exit 1
}

Write-Host "Renaming $($pngs.Count) PNG files..." -ForegroundColor Cyan

$i = 1
foreach ($file in $pngs) {
    $newName = "frame{0:D4}.png" -f $i
    if ($file.Name -ne $newName) {
        Rename-Item -Path $file.FullName -NewName $newName
    }
    $i++
}

Write-Host "Done! Frames are now frame0001.png ... frame$('{0:D4}' -f ($i-1)).png" -ForegroundColor Green
Write-Host "Next step: run .\make-gif.ps1" -ForegroundColor Yellow
