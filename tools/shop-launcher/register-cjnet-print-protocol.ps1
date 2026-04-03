param(
  [string]$ProtocolName = "cjnet-print"
)

Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Windows.Forms

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPath = Join-Path $scriptDirectory "cjnet-print-launcher.ps1"
$command = "powershell.exe -ExecutionPolicy Bypass -File `"$launcherPath`" `"%1`""
$protocolKey = "HKCU:\Software\Classes\$ProtocolName"

New-Item -Path $protocolKey -Force | Out-Null
New-ItemProperty -Path $protocolKey -Name "(default)" -Value "URL:CJ NET Print Launcher" -Force | Out-Null
New-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value "" -Force | Out-Null
New-Item -Path "$protocolKey\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$protocolKey\shell\open\command" -Name "(default)" -Value $command

Write-Host "Registered ${ProtocolName}:// protocol handler."
