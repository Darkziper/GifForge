@echo off
REM make-gif.bat - Double-click to make a GIF from PNG frames.
REM Uses the gifski CLI included in gifski-cli\win\gifski.exe (full quality, no downscaling).
REM Put your frames in a folder named "frames" next to this file.

cd /d "%~dp0"

set "GIFSKI=%~dp0gifski-cli\win\gifski.exe"

if not exist "%GIFSKI%" (
    echo gifski CLI not found at: %GIFSKI%
    echo Download it from https://gif.ski/gifski-1.32.0.zip and extract into gifski-cli
    pause
    exit /b 1
)

if not exist "frames" (
    echo Frames folder not found: frames
    echo Put your PNGs in a folder named "frames" next to this file.
    pause
    exit /b 1
)

echo Creating GIF from frames\*.png at full quality ...
"%GIFSKI%" --fps 24 -o "output.gif" "frames\*.png"

if %errorlevel% equ 0 (
    echo Done! Created output.gif
) else (
    echo gifski failed. Check that your PNGs are in the "frames" folder.
)
pause
