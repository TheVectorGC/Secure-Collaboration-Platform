@echo off
setlocal

cd /d "%~dp0"

if not exist "%~dp0Vector.exe" (
    echo Vector.exe not found next to this launcher.
    echo Current folder: %~dp0
    echo Put this .cmd file in the same folder as Vector.exe.
    pause
    exit /b 1
)

set "VECTOR_PROFILE=admin-device"
echo Starting Vector with profile: %VECTOR_PROFILE%
start "Vector admin-device" /D "%~dp0" "%~dp0Vector.exe"

endlocal
exit /b 0
