import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const releaseDirectory = dirname(fileURLToPath(import.meta.url));
export const hostRoot = resolve(releaseDirectory, "../..");

export function loadNpmWave() {
  const manifest = JSON.parse(
    readFileSync(resolve(releaseDirectory, "npm-wave.json"), "utf8"),
  );
  if (manifest.schemaVersion !== 1 ||
      !Array.isArray(manifest.packages) ||
      !Array.isArray(manifest.certification)) {
    throw new Error("The npm release-wave manifest has an unsupported shape.");
  }
  return Object.freeze({
    packages: Object.freeze(manifest.packages.map((entry) => Object.freeze(entry))),
    certification: Object.freeze(
      manifest.certification.map((entry) => Object.freeze({
        ...entry,
        command: Object.freeze(entry.command),
      })),
    ),
  });
}

export function resolveWaveLayout(wave = loadNpmWave()) {
  const workspaceRoot = process.env.TSONICLANG_WORKSPACE_ROOT ??
    canonicalWorkspaceRoot();
  const repositoryRoots = new Map([["tsonic", hostRoot]]);
  for (const entry of [...wave.packages, ...wave.certification]) {
    if (!repositoryRoots.has(entry.repository)) {
      repositoryRoots.set(entry.repository, resolve(workspaceRoot, entry.repository));
    }
  }
  for (const [repository, repositoryRoot] of repositoryRoots) {
    if (repository !== "tsonic") {
      requireInsideWorkspace(repositoryRoot, workspaceRoot, repository);
    }
  }
  const packages = wave.packages.map((entry) => Object.freeze({
    ...entry,
    repositoryRoot: repositoryRoots.get(entry.repository),
    packageRoot: requireInsideRepository(
      resolve(repositoryRoots.get(entry.repository), entry.directory),
      repositoryRoots.get(entry.repository),
      entry.name,
    ),
  }));
  return Object.freeze({
    workspaceRoot,
    repositoryRoots,
    packages: Object.freeze(packages),
    certification: wave.certification,
  });
}

export function readPackageManifest(entry) {
  const path = resolve(entry.packageRoot, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.name !== entry.name) {
    throw new Error(
      `Release entry '${entry.name}' resolves to package '${String(manifest.name)}' at ${path}.`,
    );
  }
  return Object.freeze({ path, manifest });
}

export function validateWaveManifests(layout = resolveWaveLayout()) {
  const names = new Set(layout.packages.map(({ name }) => name));
  if (names.size !== layout.packages.length) {
    throw new Error("Every release-wave package must have one unique package name.");
  }
  const packages = layout.packages.map((entry) => Object.freeze({
    ...entry,
    ...readPackageManifest(entry),
  }));
  const versions = new Set(packages.map(({ manifest }) => manifest.version));
  if (versions.size !== 1) {
    throw new Error(
      `Every release-wave package must use one version; found ${[...versions].sort().join(", ")}.`,
    );
  }
  const version = packages[0]?.manifest.version;
  if (!isStableSemver(version)) {
    throw new Error(`Release-wave version '${String(version)}' is not stable semantic versioning.`);
  }
  const publishedBefore = new Set();
  for (const entry of packages) {
    if (entry.manifest.private === true) {
      throw new Error(`Release package '${entry.name}' is private.`);
    }
    if (entry.manifest.engines?.node !== ">=22.18.0") {
      throw new Error(
        `Release package '${entry.name}' must declare the supported Node.js floor '>=22.18.0'.`,
      );
    }
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [name, selectedVersion] of Object.entries(entry.manifest[field] ?? {})) {
        if (!name.startsWith("@tsonic/")) continue;
        if (!names.has(name)) {
          throw new Error(
            `Release package '${entry.name}' references unlisted first-party package '${name}'.`,
          );
        }
        if (selectedVersion !== version) {
          throw new Error(
            `Release package '${entry.name}' selects '${name}@${selectedVersion}', expected '${version}'.`,
          );
        }
        if (!publishedBefore.has(name)) {
          throw new Error(
            `Release package '${entry.name}' must follow first-party dependency '${name}'.`,
          );
        }
      }
    }
    publishedBefore.add(entry.name);
  }
  return Object.freeze({ version, packages: Object.freeze(packages), layout });
}

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.capture === true ? "pipe" : "inherit",
    env: options.env ?? process.env,
  });
}

function canonicalWorkspaceRoot() {
  const commonDirectory = run(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: hostRoot, capture: true },
  ).trim();
  return dirname(dirname(commonDirectory));
}

function requireInsideWorkspace(path, workspaceRoot, repository) {
  if (path === undefined ||
      (path !== workspaceRoot && !path.startsWith(`${workspaceRoot}/`))) {
    throw new Error(`Repository '${repository}' resolves outside the Tsonic workspace.`);
  }
  return path;
}

function requireInsideRepository(path, repositoryRoot, name) {
  if (path !== repositoryRoot && !path.startsWith(`${repositoryRoot}/`)) {
    throw new Error(`Package '${name}' resolves outside repository '${repositoryRoot}'.`);
  }
  return path;
}

function isStableSemver(value) {
  return typeof value === "string" &&
    /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(value);
}
