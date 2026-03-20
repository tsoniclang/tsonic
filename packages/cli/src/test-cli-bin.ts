import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const SNAPSHOT_CACHE = new Map<string, string>();

export const getStableCliPath = (repoRoot: string): string => {
  const cached = SNAPSHOT_CACHE.get(repoRoot);
  if (cached && existsSync(cached)) {
    return cached;
  }

  const packageRoot = resolve(repoRoot, "packages", "cli");
  const sourceDir = join(packageRoot, "dist");
  const sourceIndex = join(sourceDir, "index.js");
  if (!existsSync(sourceIndex)) {
    throw new Error(`tsonic CLI dist not found at ${sourceIndex}`);
  }

  const sourceStamp = String(Math.trunc(statSync(sourceIndex).mtimeMs));
  const snapshotRoot = join(
    repoRoot,
    ".tests",
    "cli-package-snapshots",
    `${process.pid}-${sourceStamp}`
  );
  const snapshotDir = join(snapshotRoot, "dist");
  const snapshotEntry = join(snapshotRoot, "index.js");

  if (!existsSync(snapshotEntry)) {
    mkdirSync(dirname(snapshotEntry), { recursive: true });
    copyFileSync(join(packageRoot, "package.json"), join(snapshotRoot, "package.json"));
    cpSync(sourceDir, snapshotDir, { recursive: true });
    const runtimeDir = join(packageRoot, "runtime");
    if (existsSync(runtimeDir)) {
      cpSync(runtimeDir, join(snapshotRoot, "runtime"), { recursive: true });
    }
    writeFileSync(
      snapshotEntry,
      [
        "#!/usr/bin/env node",
        `process.env.TSONIC_REPO_ROOT ??= ${JSON.stringify(repoRoot)};`,
        'await import("./dist/index.js");',
        "",
      ].join("\n"),
      "utf-8"
    );
  }

  SNAPSHOT_CACHE.set(repoRoot, snapshotEntry);
  return snapshotEntry;
};
