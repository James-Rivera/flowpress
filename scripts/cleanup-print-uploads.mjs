import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const uploadsRoot = (process.env.UPLOADS_DIR ?? "").trim();
const retentionHours = Number.parseInt(process.env.UPLOAD_RETENTION_HOURS ?? "72", 10) || 72;
const maxUsagePercent = Number.parseInt(process.env.UPLOAD_MAX_DISK_USAGE_PERCENT ?? "85", 10) || 85;

function fail(message) {
  console.error(`[cleanup-print-uploads] ${message}`);
  process.exit(1);
}

function resolveRoot(rawPath) {
  if (!rawPath) {
    fail("UPLOADS_DIR is required.");
  }

  const resolved = path.resolve(rawPath);
  const backupRoot = path.resolve("/mnt/backup");
  const nextcloudRoot = path.resolve("/mnt/backup/nextcloud");
  const relativeToNextcloud = path.relative(nextcloudRoot, resolved);

  if (resolved === backupRoot) {
    fail("UPLOADS_DIR must not be /mnt/backup.");
  }

  if (
    resolved === nextcloudRoot ||
    (relativeToNextcloud !== "" &&
      !relativeToNextcloud.startsWith("..") &&
      !path.isAbsolute(relativeToNextcloud))
  ) {
    fail("UPLOADS_DIR must not point to /mnt/backup/nextcloud or its children.");
  }

  return resolved;
}

async function collectFiles(directory, bucket) {
  const results = [];

  async function walk(currentDirectory, relativeBase = "") {
    let entries = [];

    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const nextRelative = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, nextRelative);
        continue;
      }

      if (!entry.isFile() || entry.name.endsWith(".json")) {
        continue;
      }

      const stats = await fs.stat(fullPath);
      results.push({
        bucket,
        relativePath: bucket === "done" ? `done/${nextRelative}` : nextRelative,
        fullPath,
        metadataPath: `${fullPath}.json`,
        timestamp: stats.mtimeMs,
      });
    }
  }

  await walk(directory);
  return results;
}

async function collectManifests(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const manifests = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const fullPath = path.join(directory, entry.name);
          const stats = await fs.stat(fullPath);
          return { relativePath: entry.name, fullPath, timestamp: stats.mtimeMs };
        })
    );

    return manifests;
  } catch {
    return [];
  }
}

async function removeFile(target) {
  await fs.rm(target.fullPath, { force: true });
  await fs.rm(target.metadataPath, { force: true });
}

function getDiskUsagePercent(targetPath) {
  try {
    const output = execFileSync("df", ["-P", targetPath], { encoding: "utf8" });
    const lines = output.trim().split(/\r?\n/);
    const usageLine = lines[lines.length - 1] ?? "";
    const columns = usageLine.trim().split(/\s+/);
    const usageToken = columns[4] ?? "";
    const parsed = Number.parseInt(usageToken.replace("%", ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function main() {
  const root = resolveRoot(uploadsRoot);
  const activeDir = path.join(root, "active");
  const doneDir = path.join(root, "done");
  const batchesDir = path.join(root, "_batches");
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;

  const [activeFiles, doneFiles, manifests] = await Promise.all([
    collectFiles(activeDir, "active"),
    collectFiles(doneDir, "done"),
    collectManifests(batchesDir),
  ]);

  const deleted = {
    active: [],
    done: [],
    manifests: [],
  };

  for (const target of [...activeFiles, ...doneFiles].filter((entry) => entry.timestamp <= cutoff)) {
    await removeFile(target);
    deleted[target.bucket].push(target.relativePath);
  }

  for (const manifest of manifests.filter((entry) => entry.timestamp <= cutoff)) {
    await fs.rm(manifest.fullPath, { force: true });
    deleted.manifests.push(manifest.relativePath);
  }

  const usage = getDiskUsagePercent(root);

  if (usage !== null && usage >= maxUsagePercent) {
    const donePressureQueue = doneFiles
      .filter((entry) => !deleted.done.includes(entry.relativePath))
      .sort((a, b) => a.timestamp - b.timestamp);
    const activePressureQueue = activeFiles
      .filter((entry) => !deleted.active.includes(entry.relativePath))
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const target of [...donePressureQueue, ...activePressureQueue]) {
      await removeFile(target);
      deleted[target.bucket].push(target.relativePath);
    }
  }

  console.info(
    JSON.stringify(
      {
        root,
        retentionHours,
        maxUsagePercent,
        diskUsagePercent: usage,
        deleted,
      },
      null,
      2
    )
  );
}

await main();
