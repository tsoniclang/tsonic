import { createHash } from "node:crypto";
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { run } from "./npm-wave.mjs";
import { readSourceProvenance } from "./source-provenance.mjs";

export function packReleasePackage(entry, tarballRoot) {
  if (Object.hasOwn(entry.manifest, "tsonicRelease")) {
    throw new Error(`Package '${entry.name}' must not author release provenance.`);
  }
  const source = readSourceProvenance(entry);
  if (source.dirty) throw new Error(`Package '${entry.name}' has uncommitted source inputs.`);
  const selected = npmPack(entry, entry.packageRoot, ["--dry-run"]);
  const stagingRoot = mkdtempSync(resolve(tarballRoot, "package-"));
  for (const { path } of selected.files) {
    const original = resolve(entry.packageRoot, path);
    if (!inside(realpathSync(original), realpathSync(entry.packageRoot)) ||
        !lstatSync(original).isFile()) {
      throw new Error(`Package '${entry.name}' contains a non-regular or external file '${path}'.`);
    }
    const destination = resolve(stagingRoot, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(original, destination);
  }
  const manifest = { ...entry.manifest, tsonicRelease: source.provenance };
  writeFileSync(resolve(stagingRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const packed = npmPack(entry, stagingRoot, ["--pack-destination", tarballRoot]);
  const selectedPaths = selected.files.map(({ path }) => path).sort();
  const packedPaths = packed.files.map(({ path }) => path).sort();
  if (JSON.stringify(selectedPaths) !== JSON.stringify(packedPaths)) {
    throw new Error(`Package '${entry.name}' changed its selected file set while staging.`);
  }
  const after = readSourceProvenance(entry);
  if (after.dirty || after.provenance.sourceDigest !== source.provenance.sourceDigest) {
    throw new Error(`Package '${entry.name}' source changed during packing.`);
  }
  const tarballPath = resolve(tarballRoot, packed.filename);
  const bytes = readFileSync(tarballPath);
  return Object.freeze({
    name: entry.name,
    version: entry.manifest.version,
    manifest,
    filename: packed.filename,
    tarballPath,
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    shasum: createHash("sha1").update(bytes).digest("hex"),
    fileCount: packed.files.length,
  });
}

function npmPack(entry, root, args) {
  const output = run("npm", ["pack", "--json", "--ignore-scripts", ...args], { cwd: root, capture: true });
  const result = JSON.parse(output);
  if (!Array.isArray(result) || result.length !== 1) {
    throw new Error(`npm pack returned no unique artifact for '${entry.name}'.`);
  }
  const item = result[0];
  if (item.name !== entry.name || item.version !== entry.manifest.version ||
      typeof item.filename !== "string" || !/^[A-Za-z0-9_.-]+\.tgz$/u.test(item.filename) ||
      !Array.isArray(item.files) || item.files.length === 0 ||
      item.files.some(({ path }) => typeof path !== "string" || isAbsolute(path) ||
        path.includes("\\") || path.split("/").some((part) => part === "" || part === "." || part === "..") ||
        !inside(resolve(root, path), root)) ||
      new Set(item.files.map(({ path }) => path)).size !== item.files.length) {
    throw new Error(`npm pack returned an invalid artifact record for '${entry.name}'.`);
  }
  const paths = new Set(item.files.map(({ path }) => path));
  if (!paths.has("package.json") || [...paths].some((path) =>
    path.includes("node_modules/") || path.endsWith(".tsbuildinfo") ||
    /(?:^|\/)\.temp(?:\/|$)/u.test(path))) {
    throw new Error(`Package '${entry.name}' contains forbidden build state or lacks its manifest.`);
  }
  const runtimeProject = entry.manifest.exports?.["./runtime.csproj"];
  if (typeof runtimeProject === "string" &&
      (!paths.has(runtimeProject.replace(/^\.\//u, "")) || !paths.has("Directory.Build.props") ||
        ![...paths].some((path) => path.endsWith(".cs")) ||
        [...paths].some((path) => /\.(?:dll|pdb|exe)$/iu.test(path) || path === "global.json"))) {
    throw new Error(`Package '${entry.name}' must ship its complete native source project, not native binaries or a contributor SDK pin.`);
  }
  return item;
}

function inside(path, root) {
  const difference = relative(root, path);
  return difference !== "" && !isAbsolute(difference) && difference !== ".." && !difference.startsWith(`..${sep}`);
}
