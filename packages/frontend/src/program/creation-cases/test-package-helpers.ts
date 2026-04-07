import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentFileDir, "../../../../..");
const repoGlobalsRoot = path.resolve(repoRoot, "../globals/versions/10");
const repoCoreRoot = path.resolve(repoRoot, "../core/versions/10");

export const installRepoPackage = (
  tempDir: string,
  packageName: string,
  sourceRoot: string
): string => {
  const packageRoot = path.join(tempDir, "node_modules", ...packageName.split("/"));
  fs.mkdirSync(path.dirname(packageRoot), { recursive: true });
  fs.cpSync(sourceRoot, packageRoot, { recursive: true });
  return packageRoot;
};

export const installRepoCorePackage = (tempDir: string): string =>
  installRepoPackage(tempDir, "@tsonic/core", repoCoreRoot);

export const installRepoGlobalsPackage = (tempDir: string): string =>
  installRepoPackage(tempDir, "@tsonic/globals", repoGlobalsRoot);

export const copyCoreGlobalsIntoPackageRoot = (packageRoot: string): void => {
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.copyFileSync(
    path.join(repoGlobalsRoot, "core-globals.d.ts"),
    path.join(packageRoot, "core-globals.d.ts")
  );
};

export const installMinimalCoreGlobalsSurface = (tempDir: string): string => {
  installRepoCorePackage(tempDir);
  const globalsRoot = installRepoGlobalsPackage(tempDir);
  copyCoreGlobalsIntoPackageRoot(globalsRoot);
  return globalsRoot;
};
