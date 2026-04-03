param(
  [Parameter(Mandatory = $true)]
  [string]$Url
)

Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Windows.Forms

$defaultRoot = "C:\print_uploads"
$syncRoot = if ($env:CJNET_SYNC_ROOT) { $env:CJNET_SYNC_ROOT } else { $defaultRoot }

try {
  $uri = [System.Uri]$Url
  $query = [System.Web.HttpUtility]::ParseQueryString($uri.Query)
  $relativePath = $query.Get("path")
  $action = $query.Get("action")

  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    throw "Missing file path."
  }

  $relativePath = $relativePath.Replace("/", "\").TrimStart("\")
  $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $syncRoot $relativePath))
  $rootPath = [System.IO.Path]::GetFullPath($syncRoot)

  if (-not $resolvedPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved path is outside the synced folder."
  }

  if (-not (Test-Path -LiteralPath $resolvedPath)) {
    throw "File not found in synced folder: $resolvedPath"
  }

  if ($action -eq "print") {
    try {
      Start-Process -FilePath $resolvedPath -Verb Print | Out-Null
    }
    catch {
      Start-Process -FilePath $resolvedPath | Out-Null
    }
  }
  else {
    Start-Process -FilePath $resolvedPath | Out-Null
  }
}
catch {
  [System.Windows.Forms.MessageBox]::Show(
    "CJ NET launcher failed: $($_.Exception.Message)",
    "CJ NET Print Launcher"
  ) | Out-Null
  exit 1
}
