import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

const packageNameByDirectory = new Map<string, string | undefined>();

const packageNameFromPackageJson = (
  packageJsonPath: string
): string | undefined => {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as unknown;
  if (!parsed || typeof parsed !== "object") return undefined;
  const name = (parsed as { readonly name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
};

const nearestPackageName = (fileName: string): string | undefined => {
  let directory = path.dirname(path.resolve(fileName));
  while (true) {
    const cached = packageNameByDirectory.get(directory);
    if (cached !== undefined || packageNameByDirectory.has(directory)) {
      return cached;
    }
    const packageJsonPath = path.join(directory, "package.json");
    if (existsSync(packageJsonPath)) {
      const name = packageNameFromPackageJson(packageJsonPath);
      packageNameByDirectory.set(directory, name);
      return name;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      packageNameByDirectory.set(directory, undefined);
      return undefined;
    }
    directory = parent;
  }
};

export const sourceFileBelongsToPackage = (
  fileName: string,
  packageName: string
): boolean => nearestPackageName(fileName) === packageName;
