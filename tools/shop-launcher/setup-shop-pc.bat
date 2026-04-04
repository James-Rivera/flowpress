@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "DEFAULT_SYNC_ROOT=C:\print_uploads"
set "SYNC_ROOT=%~1"

if "%SYNC_ROOT%"=="" set "SYNC_ROOT=%DEFAULT_SYNC_ROOT%"

echo Configuring Shop PC helper setup...
echo.
echo Launcher folder:
echo %SCRIPT_DIR%
echo.
echo Syncthing sync root:
echo %SYNC_ROOT%
echo.

if not exist "%SCRIPT_DIR%register-cjnet-print-protocol.ps1" (
    echo register-cjnet-print-protocol.ps1 was not found in:
    echo %SCRIPT_DIR%
    exit /b 1
)

if not exist "%SCRIPT_DIR%setup-syncthing-startup.bat" (
    echo setup-syncthing-startup.bat was not found in:
    echo %SCRIPT_DIR%
    exit /b 1
)

if not exist "%SYNC_ROOT%" (
    echo Creating sync root folder...
    mkdir "%SYNC_ROOT%" >nul 2>&1
)

echo Setting CJNET_SYNC_ROOT for the current Windows user...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.Environment]::SetEnvironmentVariable('CJNET_SYNC_ROOT', '%SYNC_ROOT%', 'User')"
if errorlevel 1 (
    echo Failed to set CJNET_SYNC_ROOT.
    exit /b 1
)

echo Registering cjnet-print protocol...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%register-cjnet-print-protocol.ps1"
if errorlevel 1 (
    echo Failed to register the cjnet-print protocol.
    exit /b 1
)

echo Configuring Syncthing background startup...
call "%SCRIPT_DIR%setup-syncthing-startup.bat"
if errorlevel 1 (
    echo Failed to configure Syncthing background startup.
    exit /b 1
)

echo.
echo Shop PC setup is complete.
echo.
echo Configured values:
echo CJNET_SYNC_ROOT=%SYNC_ROOT%
echo Launcher folder=%SCRIPT_DIR%
echo.
echo Recommended verification:
echo powershell -NoProfile -Command "Get-Process syncthing; Test-NetConnection 127.0.0.1 -Port 8384"
echo powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('CJNET_SYNC_ROOT','User')"
echo Start-Process "cjnet-print://launch?path=active/General/yourfile.pdf&action=open"

exit /b 0
