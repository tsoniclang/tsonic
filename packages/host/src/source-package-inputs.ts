import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  TargetSourcePackage,
  TargetSourcePackageComponent,
  TargetSourcePackageExport,
  TargetSourcePackageGraph,
} from "@tsonic/target-api";
import {
  collectCompilerSourceExports,
  findInstalledPackageRoot,
  hasCompilerSourceExport,
  isCompilerSourceFile,
  normalizePackagePath,
  readDependencyNames,
  readPackageJson,
} from "./package-contract.js";

interface PendingSourcePackage {
  readonly id: string;
  readonly name?: string;
  readonly packageRoot: string;
  readonly sourceRoot: string;
  readonly sourceFiles: readonly string[];
  dependencies: readonly string[];
  readonly exports: readonly TargetSourcePackageExport[];
}

export function collectTargetSourcePackageGraph(
  projectDirectory: string,
  projectRoot: string,
  files: Map<string, string>,
): TargetSourcePackageGraph {
  const packageJsonPath = join(projectDirectory, "package.json");
  const projectPackage = existsSync(packageJsonPath)
    ? readPackageJson(packageJsonPath)
    : {};
  const projectSourceFiles = [...files.keys()]
    .filter((fileName) => isCompilerSourceFile(fileName) && pathIsWithin(projectRoot, fileName))
    .sort(compareNames);
  const rootPackageId = packageIdentity(projectDirectory);
  const pending = new Map<string, PendingSourcePackage>();
  const root: PendingSourcePackage = {
    id: rootPackageId,
    ...packageNameField(projectPackage),
    packageRoot: normalizePackagePath(resolve(projectDirectory)),
    sourceRoot: normalizePackagePath(resolve(projectRoot)),
    sourceFiles: Object.freeze(projectSourceFiles),
    dependencies: Object.freeze([]),
    exports: Object.freeze(collectCompilerSourceExports(
      projectDirectory,
      projectPackage,
      projectSourceFiles,
    )),
  };
  pending.set(root.id, root);
  root.dependencies = Object.freeze(readDependencyNames(projectPackage, true)
    .flatMap((packageName) => {
      const dependency = collectInstalledSourcePackage(
        projectDirectory,
        packageName,
        files,
        pending,
      );
      return dependency === undefined ? [] : [dependency];
    })
    .filter(distinct)
    .sort(compareNames));
  const components = sourcePackageComponents(pending);
  const componentByPackage = new Map(components.flatMap((component) =>
    component.packages.map((packageId) => [packageId, component.id] as const)));
  const packages = [...pending.values()]
    .sort((left, right) => compareNames(left.id, right.id))
    .map((entry): TargetSourcePackage => Object.freeze({
      id: entry.id,
      ...(entry.name === undefined ? {} : { name: entry.name }),
      packageRoot: entry.packageRoot,
      sourceRoot: entry.sourceRoot,
      sourceFiles: entry.sourceFiles,
      dependencies: entry.dependencies,
      exports: entry.exports,
      componentId: componentByPackage.get(entry.id)!,
    }));
  return Object.freeze({
    fingerprint: sourcePackageGraphFingerprint(rootPackageId, packages, components),
    rootPackageId,
    packages: Object.freeze(packages),
    components,
  });
}

function collectInstalledSourcePackage(
  resolutionDirectory: string,
  packageName: string,
  files: Map<string, string>,
  pending: Map<string, PendingSourcePackage>,
): string | undefined {
  const packageRoot = findInstalledPackageRoot(resolutionDirectory, packageName);
  if (packageRoot === undefined) {
    return undefined;
  }
  const id = packageIdentity(packageRoot);
  if (pending.has(id)) {
    return id;
  }
  const packageJsonPath = join(packageRoot, "package.json");
  const packageJson = readPackageJson(packageJsonPath);
  const sourceFiles = collectCompilerSourceFiles(packageRoot);
  if (!hasCompilerSourceExport(packageRoot, packageJson, sourceFiles)) {
    return undefined;
  }
  const declaredName = packageJson.name;
  if (typeof declaredName !== "string" || declaredName !== packageName) {
    throw new Error(
      `Installed source package '${packageName}' at '${packageRoot}' declares package name '${String(declaredName)}'.`,
    );
  }
  const sourceExports = collectCompilerSourceExports(
    packageRoot,
    packageJson,
    sourceFiles,
  );
  const entry: PendingSourcePackage = {
    id,
    name: declaredName,
    packageRoot: normalizePackagePath(resolve(packageRoot)),
    sourceRoot: sourcePackageRoot(packageRoot, sourceFiles),
    sourceFiles: Object.freeze([...sourceFiles].sort(compareNames)),
    dependencies: Object.freeze([]),
    exports: Object.freeze(sourceExports),
  };
  pending.set(id, entry);
  files.set(normalizePackagePath(packageJsonPath), readFileSync(packageJsonPath, "utf8"));
  for (const sourceFile of sourceFiles) {
    files.set(normalizePackagePath(sourceFile), readFileSync(sourceFile, "utf8"));
  }
  entry.dependencies = Object.freeze(readDependencyNames(packageJson, false)
    .flatMap((dependencyName) => {
      const dependency = collectInstalledSourcePackage(
        packageRoot,
        dependencyName,
        files,
        pending,
      );
      return dependency === undefined ? [] : [dependency];
    })
    .filter(distinct)
    .sort(compareNames));
  return id;
}

function sourcePackageRoot(
  packageRoot: string,
  sourceFiles: readonly string[],
): string {
  const directories = sourceFiles.map((sourceFile) =>
    normalizePackagePath(resolve(dirname(sourceFile))));
  if (directories.length === 0) {
    return normalizePackagePath(resolve(packageRoot));
  }
  const rootSegments = normalizePackagePath(resolve(packageRoot)).split("/");
  const directorySegments = directories.map((directory) => directory.split("/"));
  let length = rootSegments.length;
  for (let index = rootSegments.length; index < directorySegments[0]!.length; index += 1) {
    const segment = directorySegments[0]![index];
    if (directorySegments.every((candidate) => candidate[index] === segment)) {
      length = index + 1;
    } else {
      break;
    }
  }
  return directorySegments[0]!.slice(0, length).join("/");
}

function sourcePackageComponents(
  packages: ReadonlyMap<string, PendingSourcePackage>,
): readonly TargetSourcePackageComponent[] {
  const indexByPackage = new Map<string, number>();
  const lowLinkByPackage = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const packageGroups: string[][] = [];
  let nextIndex = 0;
  const connect = (packageId: string): void => {
    const index = nextIndex;
    nextIndex += 1;
    indexByPackage.set(packageId, index);
    lowLinkByPackage.set(packageId, index);
    stack.push(packageId);
    onStack.add(packageId);
    const entry = packages.get(packageId)!;
    for (const dependency of entry.dependencies) {
      if (!packages.has(dependency)) {
        continue;
      }
      if (!indexByPackage.has(dependency)) {
        connect(dependency);
        lowLinkByPackage.set(
          packageId,
          Math.min(lowLinkByPackage.get(packageId)!, lowLinkByPackage.get(dependency)!),
        );
      } else if (onStack.has(dependency)) {
        lowLinkByPackage.set(
          packageId,
          Math.min(lowLinkByPackage.get(packageId)!, indexByPackage.get(dependency)!),
        );
      }
    }
    if (lowLinkByPackage.get(packageId) !== indexByPackage.get(packageId)) {
      return;
    }
    const group: string[] = [];
    for (;;) {
      const member = stack.pop()!;
      onStack.delete(member);
      group.push(member);
      if (member === packageId) {
        break;
      }
    }
    group.sort(compareNames);
    packageGroups.push(group);
  };
  for (const packageId of [...packages.keys()].sort(compareNames)) {
    if (!indexByPackage.has(packageId)) {
      connect(packageId);
    }
  }
  const componentIdByPackage = new Map<string, string>();
  const componentIdByGroup = new Map<string[], string>();
  for (const group of packageGroups) {
    const id = `source-package-component:${hashParts(group)}`;
    componentIdByGroup.set(group, id);
    for (const packageId of group) {
      componentIdByPackage.set(packageId, id);
    }
  }
  return Object.freeze(packageGroups.map((group): TargetSourcePackageComponent => {
    const id = componentIdByGroup.get(group)!;
    const dependencies = new Set<string>();
    for (const packageId of group) {
      for (const dependency of packages.get(packageId)!.dependencies) {
        const componentId = componentIdByPackage.get(dependency);
        if (componentId !== undefined && componentId !== id) {
          dependencies.add(componentId);
        }
      }
    }
    return Object.freeze({
      id,
      packages: Object.freeze(group),
      dependencies: Object.freeze([...dependencies].sort(compareNames)),
    });
  }).sort((left, right) => compareNames(left.id, right.id)));
}

function sourcePackageGraphFingerprint(
  rootPackageId: string,
  packages: readonly TargetSourcePackage[],
  components: readonly TargetSourcePackageComponent[],
): string {
  return hashParts([
    rootPackageId,
    ...packages.flatMap((entry) => [
      entry.id,
      entry.name ?? "",
      entry.packageRoot,
      entry.sourceRoot,
      ...entry.sourceFiles,
      ...entry.dependencies,
      ...entry.exports.flatMap((exported) => [exported.specifier, exported.sourceFile]),
      entry.componentId,
    ]),
    ...components.flatMap((component) => [
      component.id,
      ...component.packages,
      ...component.dependencies,
    ]),
  ]);
}

function hashParts(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(Buffer.byteLength(part, "utf8")));
    hash.update(":");
    hash.update(part);
  }
  return hash.digest("hex");
}

function packageIdentity(packageRoot: string): string {
  return `source-package:${normalizePackagePath(resolve(packageRoot))}`;
}

function packageNameField(packageJson: Readonly<Record<string, unknown>>): {
  readonly name?: string;
} {
  return typeof packageJson.name === "string" && packageJson.name.length > 0
    ? { name: packageJson.name }
    : {};
}

function collectCompilerSourceFiles(directory: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    compareNames(left.name, right.name)
  )) {
    if (shouldSkipPackageEntry(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCompilerSourceFiles(fullPath));
      continue;
    }
    if (entry.isFile() && isCompilerSourceFile(entry.name)) {
      files.push(normalizePackagePath(fullPath));
    }
  }
  return Object.freeze(files);
}

function pathIsWithin(root: string, candidate: string): boolean {
  const path = relative(resolve(root), resolve(candidate));
  return path === "" || path !== ".." && !path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(path);
}

function compareNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function distinct(value: string, index: number, values: readonly string[]): boolean {
  return values.indexOf(value) === index;
}

function shouldSkipPackageEntry(name: string): boolean {
  return name === ".git" ||
    name === ".temp" ||
    name === "bin" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "obj";
}
