# CJ NET Shop Launcher

This helper lets the admin dashboard open or print files from the Shop PC's Syncthing mirror by using `cjnet-print://` links.

## Files

- `register-cjnet-print-protocol.ps1`: registers the custom protocol for the current Windows user
- `cjnet-print-launcher.ps1`: resolves a relative file path against the synced root and opens or prints it
- `setup-syncthing-startup.bat`: creates a Windows Scheduled Task so Syncthing starts in the background at logon
- `setup-shop-pc.bat`: one-click setup for Shop PCs that sets `CJNET_SYNC_ROOT`, registers the custom protocol, and configures Syncthing startup

## Setup

1. Copy this folder to the Shop PC.
2. Set `CJNET_SYNC_ROOT` if your Syncthing mirror is not `C:\print_uploads`.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\register-cjnet-print-protocol.ps1
```

If you also want Syncthing to start automatically in the background on Windows, run:

```bat
setup-syncthing-startup.bat
```

What it does:

- finds the installed `syncthing.exe`
- creates or updates a scheduled task named `Syncthing`
- starts Syncthing at Windows logon
- runs it with `serve --no-browser --no-restart --no-console` so staff do not need a visible terminal window

For a full Shop PC setup in one step, run:

```bat
setup-shop-pc.bat
```

To use a custom synced folder path:

```bat
setup-shop-pc.bat "C:\Users\cjnet\Downloads\print_upload"
```

What it does:

- creates the sync root folder if needed
- saves `CJNET_SYNC_ROOT` for the current Windows user
- registers the `cjnet-print://` protocol
- creates or updates the Syncthing background startup task

## Behavior

- `cjnet-print://launch?path=active/General/file.pdf&action=open` opens the file locally.
- `cjnet-print://launch?path=active/General/file.pdf&action=print` asks Windows to print the file locally.
- The launcher rejects paths that escape the configured sync root.
