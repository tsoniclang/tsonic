import { spawnSync } from "node:child_process";
import { relative } from "node:path";
import { npmView } from "./npm-registry.mjs";
import { run } from "./npm-wave.mjs";
import { compareSemver } from "./release-state.mjs";

export function inspectRegistry(packages, options = {}) {
  const view = options.npmView ?? npmView;
  const changedSinceVersion = options.packageChangedSinceVersion ??
    packageChangedSinceVersion;
  const write = options.write ?? ((value) => process.stdout.write(value));
  return packages.map((entry) => {
    const publishedVersion = view(entry.name, "dist-tags.latest");
    const versionIntegrity = view(
      entry.name,
      "dist.integrity",
      entry.manifest.version,
    );
    const relation = publishedVersion === undefined
      ? "missing"
      : compareSemver(publishedVersion, entry.manifest.version) < 0
        ? "behind"
        : compareSemver(publishedVersion, entry.manifest.version) > 0
          ? "ahead"
          : "equal";
    if (relation === "equal" && versionIntegrity === undefined) {
      throw new Error(
        `npm latest tag for '${entry.name}' names ${entry.manifest.version}, but that version has no artifact.`,
      );
    }
    const drift = versionIntegrity !== undefined &&
      changedSinceVersion(entry, entry.manifest.version);
    write(
      `${entry.name}: local=${entry.manifest.version} npm-latest=${publishedVersion ?? "<missing>"} exact=${versionIntegrity === undefined ? "missing" : "published"}${drift ? " content=changed" : ""}\n`,
    );
    return Object.freeze({
      ...entry,
      publishedVersion,
      versionIntegrity,
      relation,
      drift,
    });
  });
}

export function packageChangedSinceVersion(entry, version, options = {}) {
  const runCommand = options.run ?? run;
  const spawn = options.spawnSync ?? spawnSync;
  const packagePath = relative(entry.repositoryRoot, entry.path);
  const commits = runCommand(
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
  const packageRootPath = relative(entry.repositoryRoot, entry.packageRoot) || ".";
  const changed = spawn(
    "git",
    ["diff", "--quiet", versionCommit, "--", packageRootPath],
    { cwd: entry.repositoryRoot },
  );
  if (changed.status === 0) return false;
  if (changed.status === 1) return true;
  throw new Error(`Could not inspect content drift for '${entry.name}'.`);
}
