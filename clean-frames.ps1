# clean-frames.ps1 - Convert semi-transparent PNGs to binary-alpha PNGs.
# Any pixel with alpha >= cutoff becomes fully opaque; the rest fully transparent.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$ProjectRoot = "C:\Users\msey7\Downloads\FNF-THINK-CHARACTERS\CesarTHINK"
$FramesDir   = Join-Path $ProjectRoot "frames"
$CleanDir    = Join-Path $ProjectRoot "frames-clean"
$AlphaCutoff = 200   # 0-255

if (Test-Path $CleanDir) { Remove-Item $CleanDir -Recurse -Force }
New-Item -ItemType Directory -Path $CleanDir -Force | Out-Null

$pngs = Get-ChildItem -LiteralPath $FramesDir -Filter "*.png" | Sort-Object Name
$i = 1
foreach ($f in $pngs) {
    $src = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $dst = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        for ($y = 0; $y -lt $src.Height; $y++) {
            for ($x = 0; $x -lt $src.Width; $x++) {
                $c = $src.GetPixel($x, $y)
                if ($c.A -ge $AlphaCutoff) {
                    $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
                } else {
                    $dst.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
                }
            }
        }
        $outPath = Join-Path $CleanDir ("frame{0:D4}.png" -f $i)
        $ms = New-Object System.IO.MemoryStream
        $dst.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bytes = $ms.ToArray()
        $ms.Dispose()
        [System.IO.File]::WriteAllBytes($outPath, $bytes)
    } finally {
        if ($dst) { $dst.Dispose() }
        if ($src) { $src.Dispose() }
    }
    $i++
}
Write-Host "Cleaned $($pngs.Count) frames into $CleanDir (alpha cutoff $AlphaCutoff)."
