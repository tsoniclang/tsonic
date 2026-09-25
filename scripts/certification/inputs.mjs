import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const toolArguments = Object.freeze({
  node: ["--version"], npm: ["--version"], dotnet: ["--info"],
  rustc: ["-vV"], cargo: ["--version"], rustfmt: ["--version"],
});
const resourceEnvironment = new Set([
  "TSONIC_TEST_CPUS", "TSONIC_TEST_MEMORY_MIB", "TSONIC_TEST_WORKER_MEMORY_MIB",
  "TSONIC_TEST_CHILD_JOBS", "TSONIC_TEST_WORKERS", "TSONIC_TEST_HEAP_MIB",
  "TSONIC_TEST_RESOURCE_BUDGET", "TSONIC_TEST_TASKS_MAX", "TSONIC_TEST_TIMEOUT_SECONDS",
  "TSONIC_TEST_HEARTBEAT_SECONDS", "TSONIC_TEST_FAILURE_EXCERPT_BYTES", "TSONIC_TEST_LOG_SIZE_MAX_BYTES",
  "TSONIC_TEST_PROGRESS_INTERVAL_MS", "TSONIC_TEST_GUARD_REPORT", "TSONIC_TEST_COUNT_DIRECTORY",
  "TSONIC_TEST_SUITE_REPORT", "CARGO_BUILD_JOBS", "RUST_TEST_THREADS", "DOTNET_PROCESSOR_COUNT",
]);

export function snapshotCertificationInputs(entry, layout, environment = process.env) {
  const repositories = entry.inputs.map(repository => {
    const root = realpathSync(layout.repositoryRoots.get(repository));
    const execute = args => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 }).trim();
    const installedLock = resolve(root, "node_modules/.package-lock.json");
    return {
      repository, root,
      head: execute(["rev-parse", "HEAD"]),
      tree: execute(["rev-parse", "HEAD^{tree}"]),
      dirty: execute(["status", "--porcelain", "--untracked-files=all"]) !== "",
      installedLock: existsSync(installedLock) ? digest(readFileSync(installedLock)) : null,
    };
  });
  const cwd = layout.repositoryRoots.get(entry.repository);
  const tools = Object.fromEntries(entry.tools.map(tool => [tool,
    execFileSync(tool === "node" ? process.execPath : tool, toolArguments[tool], {
      cwd, env: environment, encoding: "utf8", timeout: 30_000,
    }).trim(),
  ]));
  const selectedEnvironment = Object.fromEntries(Object.entries(environment)
    .filter(([name]) => /^(?:TSONIC|RUST|CARGO|DOTNET|COMPlus|NUGET|NODE_|CC$|CXX$)/u.test(name))
    .filter(([name]) => !resourceEnvironment.has(name))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => [name, digest(value)]));
  return {
    repositories, tools, environment: selectedEnvironment,
    platform: process.platform, architecture: process.arch,
  };
}

export function sameCertificationInputs(left, right, coveredPaths = []) {
  const identity = snapshot => ({ ...snapshot, repositories: snapshot.repositories.map(({ head, tree, ...entry }) => entry) });
  if (JSON.stringify(identity(left)) !== JSON.stringify(identity(right))) return false;
  for (let index = 0; index < left.repositories.length; index += 1) {
    const before = left.repositories[index];
    const after = right.repositories[index];
    if (before.tree === after.tree) continue;
    const paths = coveredPaths.filter(path => path.repository === before.repository);
    if (paths.length === 0 || changedTreePaths(before.root, before.tree, after.tree)
      .some(path => !paths.some(input => pathIsCovered(path, input.path)))) return false;
  }
  return true;
}

export function changedTreePaths(root, before, after) {
  return execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", before, after], {
    cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
  }).split("\0").filter(Boolean);
}

export function pathIsCovered(path, input) {
  return input.endsWith("/") ? path.startsWith(input) : path === input;
}

export function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
