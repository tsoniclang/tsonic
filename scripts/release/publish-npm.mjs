import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  hostRoot,
  run,
  validateWaveManifests,
} from "./npm-wave.mjs";
import {
  npmRegistry,
  requireNpmAuthentication,
  waitForNpmViewPresence,
  waitForNpmViewValue,
} from "./npm-registry.mjs";
import { inspectRegistry } from "./release-inspection.mjs";
import {
  classifyReleaseState,
  incrementPatch,
} from "./release-state.mjs";

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
const releaseAction = classifyReleaseState(wave.version, registryState);
if (releaseAction.kind === "prepare-patch") {
  prepareReleaseBranches(wave, registryState);
  process.exit(0);
}

if (releaseAction.kind === "current") {
  run(
    process.execPath,
    ["scripts/release/verify-public-install.mjs", "--version", wave.version],
    { cwd: hostRoot },
  );
  process.stdout.write(
    `Every package in npm wave ${wave.version} is published and its public install is verified.\n`,
  );
  process.exit(0);
}
const { pending, awaitingPromotion } = releaseAction;
const pendingNames = new Set(pending.map(({ name }) => name));
const recoveryPromotions = awaitingPromotion.filter(({ name }) =>
  !pendingNames.has(name));

const npmUsername = requireNpmAuthentication();
process.stdout.write(`Publishing as npm user '${npmUsername}'.\n`);
certifyWave(wave);
verifyRepositories(wave, { fetch: false });
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
verifyRepositories(wave, { fetch: false });
const packed = JSON.parse(readFileSync(packageResultPath, "utf8"));
if (packed.version !== wave.version || !Array.isArray(packed.packages) ||
    !Number.isSafeInteger(packed.totalFileCount) || packed.totalFileCount < 1) {
  throw new Error("Packed-install certification did not produce the expected release record.");
}
const packedByName = new Map(packed.packages.map((entry) => [entry.name, entry]));
for (const entry of registryState.filter(({ versionIntegrity }) =>
  versionIntegrity !== undefined)) {
  const artifact = packedByName.get(entry.name);
  if (artifact === undefined) {
    throw new Error(`Certified release artifact '${entry.name}' is missing.`);
  }
  if (entry.versionIntegrity !== artifact.integrity) {
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
  run(
    "npm",
    [
      "publish",
      artifact.tarballPath,
      "--access",
      "public",
      "--tag",
      "latest",
      "--registry",
      npmRegistry,
    ],
    { cwd: hostRoot },
  );
}
for (const entry of wave.packages) {
  const artifact = packedByName.get(entry.name);
  if (artifact === undefined) {
    throw new Error(`Certified release artifact '${entry.name}' is missing.`);
  }
  verifyPublishedIntegrity(entry.name, wave.version, artifact.integrity);
}
for (const entry of recoveryPromotions) {
  run(
    "npm",
    [
      "dist-tag",
      "add",
      `${entry.name}@${wave.version}`,
      "latest",
      "--registry",
      npmRegistry,
    ],
    { cwd: hostRoot },
  );
}
for (const entry of wave.packages) {
  const artifact = packedByName.get(entry.name);
  if (artifact === undefined) {
    throw new Error(`Certified release artifact '${entry.name}' is missing.`);
  }
  verifyPublishedRelease(entry.name, wave.version, artifact.integrity, "latest");
}
run(
  process.execPath,
  ["scripts/release/verify-public-install.mjs", "--version", wave.version],
  { cwd: hostRoot },
);
process.stdout.write(
  `Published ${pending.length} packages and recovered ${recoveryPromotions.length} existing latest tags at ${wave.version}; certified ${packed.packages.length} packages, ${packed.totalFileCount} files, aggregate SHA-256 ${packed.aggregateSha256}.\n`,
);

function readMode(args) {
  if (args.length === 0) return "publish";
  if (args.length === 1 && args[0] === "--verify-only") return "verify-only";
  throw new Error("Usage: ./scripts/publish-npm.sh [--verify-only]");
}

function verifyRepositories(selectedWave, options = { fetch: true }) {
  const repositories = [...selectedWave.layout.repositoryRoots.entries()];
  for (const [name, root] of repositories) {
    const hygieneScript = resolve(root, "scripts/check-branch-hygiene.sh");
    if (options.fetch !== false && fileExists(hygieneScript)) {
      run("bash", [hygieneScript], { cwd: root });
    }
    const branch = run("git", ["branch", "--show-current"], {
      cwd: root,
      capture: true,
    }).trim();
    if (branch !== "main" && !(name !== "tsonic" && branch === "")) {
      throw new Error(
        `Release repository '${name}' is on '${branch || "a detached commit"}', expected main${name === "tsonic" ? "" : " or an exact detached origin/main"}.`,
      );
    }
    if (run("git", ["status", "--porcelain"], { cwd: root, capture: true }).trim() !== "") {
      throw new Error(`Release repository '${name}' has uncommitted tracked or untracked files.`);
    }
    if (options.fetch !== false) {
      run("git", ["fetch", "origin", "main"], { cwd: root });
    }
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
    run(command, args, {
      cwd: root,
      env: {
        ...process.env,
        TSONICLANG_WORKSPACE_ROOT: selectedWave.layout.workspaceRoot,
        TSONIC_ROOT: hostRoot,
      },
    });
  }
}

function verifyPublishedIntegrity(name, version, expectedIntegrity) {
  const actualIntegrity = waitForNpmViewPresence(
    name,
    "dist.integrity",
    version,
  );
  if (actualIntegrity === expectedIntegrity) return;
  throw new Error(
    `Published package '${name}@${version}' does not match its certified artifact.`,
  );
}

function verifyPublishedRelease(name, version, expectedIntegrity, tag) {
  verifyPublishedIntegrity(name, version, expectedIntegrity);
  waitForNpmViewValue(name, `dist-tags.${tag}`, version);
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
