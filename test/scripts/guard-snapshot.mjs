import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const guardSourceFiles = Object.freeze([
  "bounded-test-scope.sh", "test-resource-budget.mjs", "memory-admission.mjs",
  "guard-command.mjs", "guard-cgroup.mjs", "guard-report.mjs", "calibrate-utilization.mjs",
]);

export function snapshotTestGuard(source, destination) {
  const capture = () => guardSourceFiles.map(name => ({ name, text: readFileSync(resolve(source, name)) }));
  const digest = entries => {
    const hash = createHash("sha256");
    for (const entry of entries) hash.update(entry.name).update("\0").update(entry.text).update("\0");
    return hash.digest("hex");
  };
  const entries = capture();
  const identity = digest(entries);
  if (digest(capture()) !== identity) throw new Error("The test guard changed while its execution snapshot was captured.");
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  const temporary = mkdtempSync(resolve(destination, "pending-"));
  const snapshot = resolve(destination, identity);
  try {
    for (const entry of entries) writeFileSync(resolve(temporary, entry.name), entry.text, { flag: "wx", mode: 0o444 });
    try {
      renameSync(temporary, snapshot);
    } catch (error) {
      if (error.code !== "EEXIST" && error.code !== "ENOTEMPTY") throw error;
    }
    const existing = guardSourceFiles.map(name => ({ name, text: readFileSync(resolve(snapshot, name)) }));
    if (digest(existing) !== identity) throw new Error("An immutable test-guard snapshot was modified.");
    return snapshot;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = dirname(fileURLToPath(import.meta.url));
  console.log(snapshotTestGuard(source, resolve(source, "../../.temp/test-guard-snapshots")));
}
