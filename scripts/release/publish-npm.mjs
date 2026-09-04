import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  hostRoot,
  run,
  validateWaveManifests,
} from "./npm-wave.mjs";

const mode = readMode(process.argv.slice(2));
const wave = validateWaveManifests();

if (mode === "verify-only") {
  process.stdout.write(
    `Verified ${wave.packages.length} release packages at ${wave.version}.\n`,
  );
  process.exit(0);
}

verifyRepositories(wave);
const registryState = inspectRegistry(wave.packages);
const bumpReason = registryState.find(({ relation, drift }) =>
  relation === "ahead" || (relation === "equal" && drift));
if (bumpReason !== undefined) {
  prepareReleaseBranches(wave, registryState);
  process.exit(0);
}

const pending = registryState.filter(({ relation }) =>
  relation === "missing" || relation === "behind");
if (pending.length === 0) {
  process.stdout.write(`Every package in npm wave ${wave.version} is already published.\n`);
  process.exit(0);
}

certifyWave(wave);
const packageResultPath = resolve(
  ensureReleaseScratch(),
  `packed-wave-${wave.version}-${String(process.pid)}.json`,
);
run(
  process.execPath,
  ["scripts/release/verify-packed-install.mjs"],
  {
    cwd: hostRoot,
    env: {
      ...process.env,
      TSONIC_NPM_PACK_RESULT: packageResultPath,
    },
  },
);
const packed = JSON.parse(readFileSync(packageResultPath, "utf8"));
if (packed.version !== wave.version || !Array.isArray(packed.packages)) {
  throw new Error("Packed-install certification did not produce the expected release record.");
}
const packedByName = new Map(packed.packages.map((entry) => [entry.name, entry]));
for (const entry of registryState.filter(({ relation }) => relation === "equal")) {
  const artifact = packedByName.get(entry.name);
  if (artifact === undefined) {
    throw new Error(`Certified release artifact '${entry.name}' is missing.`);
  }
  const publishedIntegrity = npmView(entry.name, "dist.integrity", wave.version);
  if (publishedIntegrity !== artifact.integrity) {
    throw new Error(
      `Published package '${entry.name}@${wave.version}' differs from the certified release artifact; prepare a new version before continuing the wave.`,
    );
  }
}
for (const entry of pending) {
  const artifact = packedByName.get(entry.name);
  if (artifact === undefined) {
    throw new Error(`Certified release artifact '${entry.name}' is missing.`);
  }
  run("npm", ["publish", artifact.tarballPath, "--access", "public"], { cwd: hostRoot });
  verifyPublishedIntegrity(entry.name, wave.version, artifact.integrity);
}
process.stdout.write(
  `Published ${pending.length} packages at ${wave.version}; certified aggregate SHA-256 ${packed.aggregateSha256}.\n`,
);

function readMode(args) {
  if (args.length === 0) return "publish";
  if (args.length === 1 && args[0] === "--verify-only") return "verify-only";
  throw new Error("Usage: ./scripts/publish-npm.sh [--verify-only]");
}

function verifyRepositories(selectedWave) {
  const repositories = [...selectedWave.layout.repositoryRoots.entries()];
  for (const [name, root] of repositories) {
    const branch = run("git", ["branch", "--show-current"], {
      cwd: root,
      capture: true,
    }).trim();
    if (branch !== "main") {
      throw new Error(`Release repository '${name}' is on '${branch}', expected 'main'.`);
    }
    if (run("git", ["status", "--porcelain"], { cwd: root, capture: true }).trim() !== "") {
      throw new Error(`Release repository '${name}' has uncommitted tracked or untracked files.`);
    }
    run("git", ["fetch", "origin", "main"], { cwd: root });
    const local = run("git", ["rev-parse", "HEAD"], { cwd: root, capture: true }).trim();
    const upstream = run("git", ["rev-parse", "origin/main"], {
      cwd: root,
      capture: true,
    }).trim();
    if (local !== upstream) {
      throw new Error(`Release repository '${name}' is not identical to origin/main.`);
    }
  }
}

function inspectRegistry(packages) {
  return packages.map((entry) => {
    const publishedVersion = npmView(entry.name, "version");
    const relation = publishedVersion === undefined
      ? "missing"
      : compareSemver(publishedVersion, entry.manifest.version) < 0
        ? "behind"
        : compareSemver(publishedVersion, entry.manifest.version) > 0
          ? "ahead"
          : "equal";
    const drift = relation === "equal" &&
      packageChangedSinceVersion(entry, entry.manifest.version);
    process.stdout.write(
      `${entry.name}: local=${entry.manifest.version} npm=${publishedVersion ?? "<missing>"}${drift ? " content=changed" : ""}\n`,
    );
    return Object.freeze({ ...entry, publishedVersion, relation, drift });
  });
}

function npmView(name, field, version) {
  const selector = version === undefined ? name : `${name}@${version}`;
  const result = spawnSync("npm", ["view", selector, field, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (/E404|not found/iu.test(combined)) return undefined;
    throw new Error(`npm view failed for '${selector}':\n${combined}`);
  }
  const value = JSON.parse(result.stdout);
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.at(-1);
  }
  throw new Error(`npm returned no scalar '${field}' value for '${selector}'.`);
}

function packageChangedSinceVersion(entry, version) {
  const packagePath = relative(entry.repositoryRoot, entry.path);
  const commits = run(
    "git",
    [
      "log",
      "--format=%H",
      "-G",
      `"version"[[:space:]]*:[[:space:]]*"${version.replaceAll(".", "\\.")}"`,
      "--",
      packagePath,
    ],
    { cwd: entry.repositoryRoot, capture: true },
  ).trim().split("\n").filter(Boolean);
  const versionCommit = commits[0];
  if (versionCommit === undefined) return true;
  const changed = spawnSync(
    "git",
    ["diff", "--quiet", versionCommit, "--", relative(entry.repositoryRoot, entry.packageRoot)],
    { cwd: entry.repositoryRoot },
  );
  if (changed.status === 0) return false;
  if (changed.status === 1) return true;
  throw new Error(`Could not inspect content drift for '${entry.name}'.`);
}

function prepareReleaseBranches(selectedWave, registryState) {
  const highest = registryState.reduce(
    (selected, entry) => entry.publishedVersion !== undefined &&
        compareSemver(entry.publishedVersion, selected) > 0
      ? entry.publishedVersion
      : selected,
    selectedWave.version,
  );
  const nextVersion = incrementPatch(highest);
  const branch = `release/npm-v${nextVersion}`;
  const repositories = [...selectedWave.layout.repositoryRoots.entries()];
  for (const [, root] of repositories) {
    const existing = run(
      "git",
      ["branch", "--list", branch],
      { cwd: root, capture: true },
    ).trim();
    if (existing !== "") {
      throw new Error(`Local branch '${branch}' already exists in '${root}'.`);
    }
  }
  const packageNames = new Set(selectedWave.packages.map(({ name }) => name));
  for (const [name, root] of repositories) {
    run("git", ["switch", "-c", branch], { cwd: root });
    const touched = new Set();
    for (const entry of selectedWave.packages.filter(({ repository }) =>
      repository === name)) {
      updatePackageManifest(entry.path, nextVersion, packageNames);
      touched.add(relative(root, entry.path));
    }
    if (name === "tsonic") {
      const rootManifestPath = resolve(root, "package.json");
      const rootManifest = readJson(rootManifestPath);
      rootManifest.version = nextVersion;
      writeJson(rootManifestPath, rootManifest);
      touched.add("package.json");
    }
    const lockPath = resolve(root, "package-lock.json");
    if (fileExists(lockPath)) {
      updatePackageLock(lockPath, nextVersion, packageNames);
      touched.add("package-lock.json");
    }
    run("git", ["add", "--", ...touched], { cwd: root });
    run("git", ["commit", "-m", `chore: prepare npm wave ${nextVersion}`], { cwd: root });
    run("git", ["push", "-u", "origin", branch], { cwd: root });
    process.stdout.write(
      `https://github.com/tsoniclang/${name}/pull/new/${branch}\n`,
    );
  }
  process.stdout.write(
    `Prepared npm release wave ${nextVersion}. Merge every release branch, pull main, then rerun ./scripts/publish-npm.sh.\n`,
  );
}

function updatePackageManifest(path, version, packageNames) {
  const manifest = readJson(path);
  manifest.version = version;
  updateDependencyGroups(manifest, version, packageNames);
  writeJson(path, manifest);
}

function updatePackageLock(path, version, packageNames) {
  const lock = readJson(path);
  if (lock.name === "@tsonic/monorepo" || packageNames.has(lock.name)) {
    lock.version = version;
  }
  for (const entry of Object.values(lock.packages ?? {})) {
    if (entry !== null && typeof entry === "object") {
      if (entry.name === lock.name || packageNames.has(entry.name)) {
        entry.version = version;
      }
      updateDependencyGroups(entry, version, packageNames);
    }
  }
  writeJson(path, lock);
}

function updateDependencyGroups(value, version, packageNames) {
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    for (const name of Object.keys(value[field] ?? {})) {
      if (packageNames.has(name)) value[field][name] = version;
    }
  }
}

function certifyWave(selectedWave) {
  for (const entry of selectedWave.certification) {
    const root = selectedWave.layout.repositoryRoots.get(entry.repository);
    const [command, ...args] = entry.command;
    process.stdout.write(`Certifying ${entry.repository}: ${entry.command.join(" ")}\n`);
    run(command, args, { cwd: root });
  }
}

function verifyPublishedIntegrity(name, version, expected) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const actual = npmView(name, "dist.integrity", version);
    if (actual === expected) return;
    if (attempt < 5) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
    }
  }
  throw new Error(`Published package '${name}@${version}' does not match its certified artifact.`);
}

function compareSemver(left, right) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1;
    }
  }
  return 0;
}

function parseSemver(value) {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.exec(value);
  if (match === null) throw new Error(`Unsupported release version '${value}'.`);
  return match.slice(1).map(Number);
}

function incrementPatch(value) {
  const [major, minor, patch] = parseSemver(value);
  return `${major}.${minor}.${patch + 1}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function fileExists(path) {
  try {
    readFileSync(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function ensureReleaseScratch() {
  const root = resolve(hostRoot, ".temp/npm-release");
  mkdirSync(root, { recursive: true });
  return root;
}
