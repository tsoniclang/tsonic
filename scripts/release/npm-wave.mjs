import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
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
  for (const entry of manifest.packages) {
    requireManifestEntry(entry, "package", ["directory", "name", "repository"]);
  }
  for (const entry of manifest.certification) {
    requireManifestEntry(entry, "certification", ["command", "repository"]);
    if (!Array.isArray(entry.command) || entry.command.length === 0 ||
        !entry.command.every((part) => typeof part === "string" && part.length > 0)) {
      throw new Error("Every npm certification entry requires a non-empty string command.");
    }
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
  const configuredWorkspaceRoot = process.env.TSONICLANG_WORKSPACE_ROOT;
  if (configuredWorkspaceRoot !== undefined && !isAbsolute(configuredWorkspaceRoot)) {
    throw new Error("TSONICLANG_WORKSPACE_ROOT must be an absolute path.");
  }
  const workspaceRoot = resolve(configuredWorkspaceRoot ?? dirname(hostRoot));
  const expectedHostRoot = resolve(workspaceRoot, "tsonic");
  if (hostRoot !== expectedHostRoot) {
    throw new Error(
      `The host checkout '${hostRoot}' is not the tsonic repository in release workspace '${workspaceRoot}'.`,
    );
  }
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
  const certificationRepositories = new Set(
    layout.certification.map(({ repository }) => repository),
  );
  if (certificationRepositories.size !== layout.certification.length) {
    throw new Error("Every release-wave certification repository must be unique.");
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
  return Object.freeze({
    version,
    packages: Object.freeze(packages),
    certification: layout.certification,
    layout,
  });
}

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.capture === true ? "pipe" : "inherit",
    env: options.env ?? process.env,
  });
}

function requireInsideWorkspace(path, workspaceRoot, repository) {
  if (path === undefined || !isWithin(path, workspaceRoot)) {
    throw new Error(`Repository '${repository}' resolves outside the Tsonic workspace.`);
  }
  return path;
}

function requireInsideRepository(path, repositoryRoot, name) {
  if (!isWithin(path, repositoryRoot)) {
    throw new Error(`Package '${name}' resolves outside repository '${repositoryRoot}'.`);
  }
  return path;
}

function isWithin(path, root) {
  const relativePath = relative(root, path);
  return relativePath === "" ||
    (!isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`));
}

function isStableSemver(value) {
  return typeof value === "string" &&
    /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(value);
}

function requireManifestEntry(value, subject, expectedKeys) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Every npm release-wave ${subject} entry must be an object.`);
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (actualKeys.length !== sortedExpectedKeys.length ||
      actualKeys.some((key, index) => key !== sortedExpectedKeys[index])) {
    throw new Error(
      `Every npm release-wave ${subject} entry must contain exactly: ${sortedExpectedKeys.join(", ")}.`,
    );
  }
  for (const key of expectedKeys.filter((entryKey) => entryKey !== "command")) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      throw new Error(`Every npm release-wave ${subject} entry requires '${key}'.`);
    }
  }
}
