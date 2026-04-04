# CJ NET Printing System

QR-based file submission for a printing shop with split deployment:

- customers upload files without signing in
- Vercel serves the public upload and tracking UI
- the homelab backend stores jobs under `/mnt/backup/print_uploads`
- staff manually confirm prints from the admin dashboard
- the Shop PC opens synced local files through a small launcher protocol

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Storage Layout](#storage-layout)
- [Environment Configuration](#environment-configuration)
- [Getting Started](#getting-started)
- [Staff Workflow](#staff-workflow)
- [Shop Tools](#shop-tools)
- [Syncthing Setup](#syncthing-setup)
- [Shop Launcher Setup](#shop-launcher-setup)
- [Verification](#verification)
- [Cleanup](#cleanup)
- [Common Pitfalls](#common-pitfalls)
- [Deployment Notes](#deployment-notes)

## Overview

This system is designed for a simple print shop workflow:

- customers upload files from a phone or computer
- the backend stores the files on the homelab server
- Syncthing mirrors those files to the Shop PC
- the admin dashboard triggers local open or print actions on the Shop PC
- staff manually decides when a print job is finished

The system intentionally avoids auto-printing and overengineering.

## Architecture

- `frontend` role: public landing page, upload UI, and queue tracking
- `backend` role: upload APIs, queue state, admin dashboard, and filesystem storage
- Syncthing mirrors `/mnt/backup/print_uploads` to the Shop PC
- the app never reads or writes `/mnt/backup/nextcloud`

## Storage Layout

Production filesystem storage lives under:

```text
/mnt/backup/print_uploads
|-- _batches
|-- active
|-- done
`-- tmp
```

Safety rules:

- `UPLOADS_DIR` must not be empty in backend production
- `UPLOADS_DIR` must not resolve to `/mnt/backup`
- `UPLOADS_DIR` must not point to `/mnt/backup/nextcloud` or any child path
- allowed uploads are `PDF`, `DOCX`, `JPG`, `JPEG`, and `PNG`
- max file size is `100 MB` per file

## Environment Configuration

Copy `.env.example` to `.env.local` and adjust values for each deployment.

On macOS or Linux:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Available variables:

- `APP_ROLE`: `frontend` or `backend`
- `NEXT_PUBLIC_BACKEND_BASE_URL`: public backend origin used by the frontend role, for example `https://api.yourdomain.com`
- `STORAGE_DRIVER`: set to `filesystem` on the backend
- `UPLOADS_DIR`: backend filesystem root, for example `/mnt/backup/print_uploads`
- `ADMIN_USERNAME`: staff login username. Required in production
- `ADMIN_PASSWORD`: staff login password. Required in production
- `ADMIN_SESSION_SECRET`: secret used to sign admin session cookies. Required in production
- `UPLOAD_RETENTION_HOURS`: retention window before cleanup deletes jobs, default `72`
- `UPLOAD_MAX_DISK_USAGE_PERCENT`: disk-pressure cleanup threshold, default `85`
- `SHOP_HELPER_PROTOCOL`: local launcher protocol name, default `cjnet-print`
- `NEXT_PUBLIC_SHOP_HELPER_PROTOCOL`: optional client-visible override for the launcher protocol name
- `UPLOAD_MAX_FILE_COUNT`: max files accepted per upload batch (server enforcement)
- `UPLOAD_MAX_FILE_SIZE_MB`: max size per file in MB (server enforcement)
- `UPLOAD_MAX_BATCH_SIZE_MB`: max total batch size in MB (server enforcement)
- `NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT`: client-side limit shown or validated in UI
- `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB`: client-side per-file size shown or validated in UI
- `NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB`: client-side batch size shown or validated in UI
- `BATCH_STATUS_LOOKUP_LIMIT_PER_HOUR`: max batch status checks per client per hour

Notes:

- `frontend` deployments do not serve admin routes or filesystem-backed routes
- `backend` deployments should be exposed behind your homelab reverse proxy and private admin access controls
- customer upload and status APIs return CORS headers so the Vercel frontend can call `api.yourdomain.com` directly
- in development only, staff auth falls back to `staff` / `cjnet123` and a local default session secret
- in production, admin login intentionally has no fallback values
- keep `NEXT_PUBLIC_*` values aligned with server values so UI messaging matches backend behavior
- restart the dev server after changing `.env.local` values

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Main routes:

- `/` landing page
- `/upload` customer upload flow
- `/upload/track?batch=...` customer queue tracking
- `/admin/login` staff login on backend role only
- `/admin` staff print dashboard on backend role only

## Staff Workflow

1. Customer uploads one or more files.
2. Backend writes jobs to `/mnt/backup/print_uploads/active`.
3. Syncthing mirrors the same relative paths to the Shop PC.
4. Staff opens the admin dashboard and uses `cjnet-print://` links to open or print the local synced copy.
5. Staff marks the job as done or returns it to pending.

This keeps the shop workflow simple and avoids accidental auto-printing.

## Shop Tools

This project uses two separate shop-side tools:

- `Syncthing`: moves files from the homelab to the Shop PC
- `cjnet-print://` launcher: opens or prints files that already exist on the Shop PC

Important:

- the launcher does not perform syncing
- Syncthing does not print files by itself
- staff still manually controls printing from the dashboard

Launcher docs live in [tools/shop-launcher/README.md](c:\Users\cjnet\Desktop\Carlo\cjnet-print\tools\shop-launcher\README.md).

## Syncthing Setup

### Recommended Folder Mapping

- Homelab source: `/mnt/backup/print_uploads`
- Shop PC target: `C:\print_uploads`

The Linux path and Windows path do not need to match. Syncthing mirrors folder contents, not absolute path strings.

For this current Shop PC, the active local sync root is:

```text
C:\Users\cjnet\Downloads\print_upload
```

That is valid. `C:\print_uploads` is only the recommended default for future deployments because it is shorter and easier to document.

### Ubuntu Homelab

Install Syncthing:

```bash
sudo apt update
sudo apt install -y syncthing
```

Start and persist it as your user:

```bash
systemctl --user enable syncthing
systemctl --user start syncthing
loginctl enable-linger $USER
```

Verify:

```bash
systemctl --user status syncthing --no-pager
```

Syncthing's web UI listens on:

```text
http://127.0.0.1:8384
```

If the server is accessed over SSH, tunnel the UI to your local machine:

```bash
ssh -L 8385:127.0.0.1:8384 avera@192.168.1.50
```

Then open:

```text
http://127.0.0.1:8385
```

### Windows Shop PC

Install Syncthing with `winget`:

```powershell
winget install Syncthing.Syncthing
```

If it does not start automatically, launch it once from a new PowerShell window:

```powershell
syncthing
```

The Windows UI should then be available at:

```text
http://127.0.0.1:8384
```

To make Syncthing start automatically in the background on future Shop PCs, run:

```bat
tools\shop-launcher\setup-syncthing-startup.bat
```

This script creates a Windows Scheduled Task named `Syncthing` that launches:

```text
syncthing.exe serve --no-browser --no-restart --no-console
```

If `syncthing` is not yet available as a command in your current shell, close PowerShell and open a new one first.

That means:

- no visible browser window opens for staff
- no terminal window needs to stay open
- sync continues after login even if no one manually launches Syncthing

Create the target folder before accepting the share:

```powershell
New-Item -ItemType Directory -Force -Path C:\print_uploads
```

For this machine, the actual synced folder is:

```text
C:\Users\cjnet\Downloads\print_upload
```

### Pair the Devices

1. Open Windows Syncthing and copy the Shop PC Device ID from `This Device -> Identification`.
2. Open Ubuntu Syncthing and click `Add Remote Device`.
3. Paste the Shop PC Device ID and save.
4. Go back to Windows Syncthing and accept the Ubuntu device request.

Tip:

- the Shop PC device ID is unique per computer
- do not copy another machine's device ID into the docs or scripts

### Share the Print Folder

On Ubuntu Syncthing:

1. Click `Add Folder`.
2. Set:
   Folder Label: `Print Uploads`
   Folder ID: `print_uploads`
   Folder Path: `/mnt/backup/print_uploads`
3. Share it with the Shop PC device.
4. Save.

On Windows Syncthing:

1. Accept the incoming folder share.
2. Set the local path to:

```text
C:\print_uploads
```

3. Save and wait for the initial sync.

For this current setup, use this local path instead:

```text
C:\Users\cjnet\Downloads\print_upload
```

After sync, Windows should contain:

```text
C:\print_uploads\active
C:\print_uploads\done
C:\print_uploads\_batches
C:\print_uploads\tmp
```

## Shop Launcher Setup

After Syncthing is working, configure the launcher so dashboard links know where the local synced files live.

### One-Command Setup for Future Shop PCs

Run:

```bat
tools\shop-launcher\setup-shop-pc.bat
```

To use a non-default local synced folder:

```bat
tools\shop-launcher\setup-shop-pc.bat "C:\Users\cjnet\Downloads\print_upload"
```

This is the recommended setup script for future Windows shop computers.

It does the following:

- creates the local sync folder if needed
- saves `CJNET_SYNC_ROOT` for the current Windows user
- registers the `cjnet-print://` protocol
- creates the Syncthing background startup scheduled task

This script is preferred over manual setup because it avoids hardcoding:

- a Windows username
- a version-specific Syncthing install path
- a fixed launcher location outside the repo copy

### Manual Launcher Root Configuration

For immediate testing:

```powershell
$env:CJNET_SYNC_ROOT="C:\print_uploads"
```

To make it persistent for the current Windows user:

```powershell
[System.Environment]::SetEnvironmentVariable("CJNET_SYNC_ROOT", "C:\print_uploads", "User")
```

For this current Shop PC, use:

```powershell
[System.Environment]::SetEnvironmentVariable("CJNET_SYNC_ROOT", "C:\Users\cjnet\Downloads\print_upload", "User")
```

Then open a new PowerShell window or sign out and back in before testing again.

### Manual Protocol Registration

The launcher scripts can live anywhere on the Shop PC. For this machine they are stored in:

```text
C:\test launcher
```

For future setups, the launcher folder may be different. Use the real folder where you copied:

- `register-cjnet-print-protocol.ps1`
- `cjnet-print-launcher.ps1`
- `setup-syncthing-startup.bat`
- `setup-shop-pc.bat`

Register the custom protocol with:

```powershell
powershell -ExecutionPolicy Bypass -File 'C:\test launcher\register-cjnet-print-protocol.ps1'
```

Recommended one-time setup for this PC:

```powershell
[System.Environment]::SetEnvironmentVariable("CJNET_SYNC_ROOT", "C:\Users\cjnet\Downloads\print_upload", "User")
powershell -ExecutionPolicy Bypass -File 'C:\test launcher\register-cjnet-print-protocol.ps1'
```

For future PCs, prefer this repo-based command when running from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\shop-launcher\register-cjnet-print-protocol.ps1
```

What this registration does:

- creates the Windows handler for the `cjnet-print://` protocol
- points that protocol to `cjnet-print-launcher.ps1`
- lets the admin dashboard trigger local open or print actions on the Shop PC

What it does not do:

- it does not install Syncthing
- it does not start Syncthing
- it does not sync files from the homelab
- it does not print automatically unless a `cjnet-print://...&action=print` link is used

## Verification

### Verify Sync

On Ubuntu:

```bash
ls /mnt/backup/print_uploads/active/General
```

On Windows:

```powershell
Get-ChildItem C:\print_uploads\active\General
```

If the file exists on Ubuntu but not on Windows, the issue is Syncthing configuration rather than the launcher.

### Verify Background Startup

After running the setup script or creating the task manually, verify with:

```powershell
Get-Process syncthing
Test-NetConnection 127.0.0.1 -Port 8384
Get-ScheduledTask -TaskName "Syncthing" | Get-ScheduledTaskInfo
```

Healthy output should show:

- a running `syncthing` process
- `TcpTestSucceeded : True`
- `LastTaskResult : 0`

If the scheduled task fails, the most common cause is incorrect arguments. The correct Syncthing 2.x background command is:

```text
serve --no-browser --no-restart --no-console
```

### Verify the Custom Protocol

Replace the sample filename with a real synced file:

```powershell
Start-Process "cjnet-print://launch?path=active/General/yourfile.pdf&action=open"
Start-Process "cjnet-print://launch?path=active/General/yourfile.pdf&action=print"
```

Expected behavior:

- `action=open` opens the local file in its default app
- `action=print` uses the Windows print verb when supported by the file's default app

If this test works, the shop-side tooling is ready:

- Syncthing supplies the files
- the launcher opens or prints them locally
- staff still manually decides when to print from the dashboard

## Cleanup

Run the cleanup command on the backend host:

```bash
npm run cleanup:uploads
```

The command:

- deletes expired jobs and manifests under `UPLOADS_DIR` only
- never touches `/mnt/backup/nextcloud`
- deletes oldest `done` jobs first when disk usage is at or above `UPLOAD_MAX_DISK_USAGE_PERCENT`
- deletes oldest pending jobs only if pressure cleanup still needs more space

## Common Pitfalls

- If `Open Local File` does nothing, the `cjnet-print://` protocol is usually not registered yet.
- If manual `Start-Process` works only with `/mnt/backup/print_uploads`, your Windows files are probably still under `C:\mnt\backup\print_uploads` instead of `C:\print_uploads`.
- If `http://127.0.0.1:8384` does not open on Windows, Syncthing is installed but not currently running.
- If Syncthing works manually but not from Task Scheduler, the task may be using old flags like `-no-browser` instead of `serve --no-browser --no-restart --no-console`.
- If `systemctl --user status syncthing` shows `failed` on Ubuntu, restart it and inspect logs with:

```bash
journalctl --user -u syncthing -n 50 --no-pager
```

## Deployment Notes

Run lint checks:

```bash
npm run lint
```

Recommended deployment split:

- `yourdomain.com` -> Vercel frontend
- `api.yourdomain.com` -> homelab backend
- `admin.yourdomain.com` -> homelab backend, restricted through Tailscale or internal allowlist
