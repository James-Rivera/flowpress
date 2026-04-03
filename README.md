# CJ NET Printing System

Simple QR-based file submission for a printing shop:

- customers upload files without signing in
- staff manually confirm and process print jobs
- uploads can be stored on the local filesystem or in Vercel Blob

## Environment Configuration

Copy `.env.example` to `.env.local` and adjust values as needed.

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Available variables:

- `STORAGE_DRIVER`: optional override. Use `filesystem` for local disk or `blob` for Vercel Blob. If unset, the app uses Blob when `BLOB_READ_WRITE_TOKEN` exists, otherwise filesystem
- `UPLOADS_DIR`: optional upload storage root for filesystem mode. Relative paths resolve from the project root
- `BLOB_PATH_PREFIX`: optional prefix used for Blob object paths. Defaults to `cjnet-print`
- `BLOB_READ_WRITE_TOKEN`: required for blob mode. This is usually added automatically by a Vercel Blob store
- `ADMIN_USERNAME`: staff login username. Required in production
- `ADMIN_PASSWORD`: staff login password. Required in production
- `ADMIN_SESSION_SECRET`: secret used to sign admin session cookies. Required in production
- `UPLOAD_MAX_FILE_COUNT`: max files accepted per upload batch (server enforcement)
- `UPLOAD_MAX_FILE_SIZE_MB`: max size per file in MB (server enforcement)
- `UPLOAD_MAX_BATCH_SIZE_MB`: max total batch size in MB (server enforcement)
- `NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT`: client-side limit shown/validated in UI
- `NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB`: client-side per-file size shown/validated in UI
- `NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB`: client-side batch size shown/validated in UI
- `BATCH_STATUS_LOOKUP_LIMIT_PER_HOUR`: max batch status checks per client per hour

Notes:

- For Vercel, create a Blob store and make sure `BLOB_READ_WRITE_TOKEN` is present in production. That gives you shared storage for uploads, metadata, and batch manifests.
- For your Linux homelab, use filesystem mode and set `UPLOADS_DIR` to an absolute path such as `/srv/cjnet-print/uploads`.
- You can force the mode explicitly with `STORAGE_DRIVER=filesystem` or `STORAGE_DRIVER=blob` if needed.
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
- `/admin/login` staff login
- `/admin` staff print dashboard

## Staff Workflow

1. Customer uploads one or more files.
2. Files enter the pending queue.
3. Staff opens the admin dashboard and starts printing manually.
4. Staff marks the job as done or returns it to pending.

This keeps the shop workflow simple and avoids accidental auto-printing.

## Verification

Run lint checks:

```bash
npm run lint
```

If you deploy to Vercel, connect Blob storage before going live.
