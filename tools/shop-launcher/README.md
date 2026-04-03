# CJ NET Shop Launcher

This helper lets the admin dashboard open or print files from the Shop PC's Syncthing mirror by using `cjnet-print://` links.

## Files

- `register-cjnet-print-protocol.ps1`: registers the custom protocol for the current Windows user
- `cjnet-print-launcher.ps1`: resolves a relative file path against the synced root and opens or prints it

## Setup

1. Copy this folder to the Shop PC.
2. Set `CJNET_SYNC_ROOT` if your Syncthing mirror is not `C:\print_uploads`.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\register-cjnet-print-protocol.ps1
```

## Behavior

- `cjnet-print://launch?path=active/General/file.pdf&action=open` opens the file locally.
- `cjnet-print://launch?path=active/General/file.pdf&action=print` asks Windows to print the file locally.
- The launcher rejects paths that escape the configured sync root.
