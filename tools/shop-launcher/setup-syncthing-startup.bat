@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "TASK_NAME=Syncthing"
set "SYNCTHING_EXE="
set "PACKAGE_ROOT=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Syncthing.Syncthing_Microsoft.Winget.Source_8wekyb3d8bbwe"
set "START_IN=%LOCALAPPDATA%\Syncthing"

echo Searching for Syncthing executable...

for /f "delims=" %%I in ('dir /b /s "%PACKAGE_ROOT%\syncthing.exe" 2^>nul') do (
    set "SYNCTHING_EXE=%%I"
    goto :foundExe
)

for /f "delims=" %%I in ('where syncthing.exe 2^>nul') do (
    set "SYNCTHING_EXE=%%I"
    goto :foundExe
)

echo.
echo Syncthing executable was not found.
echo Install Syncthing first with:
echo winget install Syncthing.Syncthing
exit /b 1

:foundExe
if not exist "%START_IN%" (
    mkdir "%START_IN%" >nul 2>&1
)

set "TASK_COMMAND=\"%SYNCTHING_EXE%\" serve --no-browser --no-restart --no-console"

echo Found:
echo %SYNCTHING_EXE%
echo.
echo Creating or updating scheduled task "%TASK_NAME%"...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$action = New-ScheduledTaskAction -Execute '%SYNCTHING_EXE%' -Argument 'serve --no-browser --no-restart --no-console' -WorkingDirectory '%START_IN%';" ^
  "$trigger = New-ScheduledTaskTrigger -AtLogOn;" ^
  "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew;" ^
  "$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest;" ^
  "Register-ScheduledTask -TaskName '%TASK_NAME%' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null"

if errorlevel 1 (
    echo.
    echo Failed to create the scheduled task.
    echo Try running this batch file as Administrator.
    exit /b 1
)

echo Starting the task once now...
schtasks /Run /TN "%TASK_NAME%" >nul 2>&1

echo.
echo Syncthing startup task is ready.
echo Task name: %TASK_NAME%
echo Executable: %SYNCTHING_EXE%
echo.
echo Verify with:
echo powershell -NoProfile -Command "Get-Process syncthing; Test-NetConnection 127.0.0.1 -Port 8384"

exit /b 0
