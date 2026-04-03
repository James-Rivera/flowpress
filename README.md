# CJ NET Printing System

QR-based file submission for a printing shop with split deployment:

- customers upload files without signing in
- Vercel serves the public upload and tracking UI
- the homelab backend stores jobs under `/mnt/backup/print_uploads`
- staff manually confirm prints from the admin dashboard
- the Shop PC opens synced local files through a small launcher protocol

## Architecture

- `frontend` role: public landing, upload UI, and queue tracking
- `backend` role: upload APIs, queue state, admin dashboard, and filesystem storage
- Syncthing mirrors `/mnt/backup/print_uploads` to the Shop PC
- the app never reads or writes `/mnt/backup/nextcloud`

## Storage Layout

Production filesystem storage lives under:

```text
/mnt/backup/print_uploads
├── _batches
├── active
├── done
└── tmp
```

Safety rules:

- `UPLOADS_DIR` must not be empty in backend production
- `UPLOADS_DIR` must not resolve to `/mnt/backup`
- `UPLOADS_DIR` must not point to `/mnt/backup/nextcloud` or any child path
- allowed uploads are `PDF`, `DOCX`, `JPG`, `JPEG`, and `PNG`
- max file size is `100 MB` per file

## Environment Configuration

Copy `.env.example` to `.env.local` and adjust values for each deployment.

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
- `NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT`: client-side limit shown/validated in UI
- `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB`: client-side per-file size shown/validated in UI
- `NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB`: client-side batch size shown/validated in UI
- `BATCH_STATUS_LOOKUP_LIMIT_PER_HOUR`: max batch status checks per client per hour

Notes:

- `frontend` deployments do not serve admin routes or filesystem-backed routes.
- `backend` deployments should be exposed behind your homelab reverse proxy and private admin access controls.
- customer upload and status APIs return CORS headers so the Vercel frontend can call `api.yourdomain.com` directly.
- In development only, staff auth falls back to `staff` / `cjnet123` and a local default session secret to keep setup simple.
- In production, admin login intentionally has no fallback values. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`.
- Keep `NEXT_PUBLIC_*` values aligned with server values so UI messaging matches backend behavior.
- Restart the dev server after changing `.env.local` values.

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

## Shop Launcher

Windows launcher files live in [tools/shop-launcher/README.md](/c:/Users/James%20Carlo/OneDrive/Documents/Avera/flowpress/tools/shop-launcher/README.md).

The helper resolves relative job paths against the local Syncthing mirror, such as `C:\print_uploads`, and opens or prints the file locally.

## Verification

Run lint checks:

```bash
npm run lint
```

Recommended deployment split:

- `yourdomain.com` -> Vercel frontend
- `api.yourdomain.com` -> homelab backend
- `admin.yourdomain.com` -> homelab backend, restricted through Tailscale or internal allowlist
