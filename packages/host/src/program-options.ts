import {
  createCompilerHost,
  createInMemoryFileSystem,
  getBundledLibraryClosure,
  ParseCommandLine,
  formatDiagnostics,
} from "@tsonic/tsts";
import type { BundledLibrarySource, ProgramOptions } from "@tsonic/tsts";
import type { TsonicProjectConfig } from "@tsonic/target-api";
import type { TargetSourceDeclarationPolicy } from "@tsonic/target-api/provider";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  appendInstalledDeclarationPackageFiles,
} from "./declaration-package-inputs.js";
import type { InstalledDeclarationSnapshot } from "./declaration-package-inputs.js";
import { isCompilerSourceFile, isDeclarationFile } from "./package-contract.js";
import { isPathWithinOrEqual } from "./path-relation.js";
import { resolveProjectPaths } from "./project-paths.js";
import { appendInstalledSourcePackageFiles } from "./source-package-inputs.js";

export interface CreateProgramOptionsInput {
  readonly project: TsonicProjectConfig;
  readonly projectFilePath: string;
  readonly sourceProfileFiles?: readonly {
    readonly path: string;
    readonly text: string;
  }[];
  readonly sourceDeclarationPolicy?: TargetSourceDeclarationPolicy;
}

export interface SourceDeclarationSnapshot {
  readonly fingerprint: string;
  readonly installedPackages: InstalledDeclarationSnapshot["packages"];
  readonly installedDeclarationFileCount: number;
  readonly installedDeclarationByteCount: number;
  readonly bundledLibraries: readonly string[];
  readonly bundledLibraryClosure: readonly string[];
  readonly bundledLibraryByteCount: number;
}

export interface CreatedProgramOptions {
  readonly programOptions: ProgramOptions;
  readonly entryPointPath: string;
  readonly rootFilePaths: readonly string[];
  readonly projectRoot: string;
  readonly outputRoot: string;
  readonly sourceDeclarationSnapshot: SourceDeclarationSnapshot;
}

export function createProgramOptionsForProject(input: CreateProgramOptionsInput): CreatedProgramOptions {
  const paths = resolveProjectPaths(input);
  const projectFiles = collectProjectFiles(paths.projectRoot, paths.outputRoot);
  appendProjectPackageJson(paths.projectDirectory, projectFiles);
  appendInstalledSourcePackageFiles(paths.projectDirectory, projectFiles);
  const declarationPolicy = normalizeSourceDeclarationPolicy(input.sourceDeclarationPolicy);
  const installedDeclarationSnapshot = declarationPolicy.installedDeclarations === "package-contract"
    ? appendInstalledDeclarationPackageFiles(paths.projectDirectory, projectFiles)
    : emptyInstalledDeclarationSnapshot();
  for (const file of input.sourceProfileFiles ?? []) {
    projectFiles.set(file.path, file.text);
  }
  const bundledLibrarySources = getBundledLibraryClosure(declarationPolicy.bundledLibraries);
  const bundledLibraryPaths = bundledLibrarySources.map((source) => source.path);
  const fileSystem = createInMemoryFileSystem({
    files: projectFiles,
    includeBundledLibraries: bundledLibrarySources.length > 0,
  });
  const host = createCompilerHost({
    currentDirectory: paths.projectRoot,
    fileSystem,
    includeBundledLibraries: false,
  });
  const parsed = ParseCommandLine([
    "--noLib",
    "--noEmit",
    "--allowImportingTsExtensions",
    "--target",
    "es2024",
    "--module",
    "nodenext",
    "--moduleResolution",
    "nodenext",
    "--strict",
    "--singleThreaded",
    "--preserveSymlinks",
    "--allowArbitraryExtensions",
    "--rootDir",
    paths.projectRoot,
    ...(declarationPolicy.installedDeclarations === "package-contract" ? ["--types", "*"] : []),
    ...bundledLibraryPaths,
    ...(input.sourceProfileFiles ?? []).map((file) => file.path),
    ...paths.rootFilePaths,
  ], host);
  if (parsed === undefined) {
    throw new Error("TSTS command-line parsing returned no project configuration.");
  }
  const parseDiagnostics = (parsed.Errors ?? []).filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  if (parseDiagnostics.length > 0) {
    throw new Error(formatDiagnostics(parseDiagnostics, paths.projectRoot));
  }
  return {
    programOptions: {
      Host: host,
      Config: parsed,
    },
    entryPointPath: paths.entryPointPath,
    rootFilePaths: paths.rootFilePaths,
    projectRoot: paths.projectRoot,
    outputRoot: paths.outputRoot,
    sourceDeclarationSnapshot: createSourceDeclarationSnapshot(
      bundledLibrarySources,
      declarationPolicy.bundledLibraries,
      installedDeclarationSnapshot,
    ),
  };
}

function normalizeSourceDeclarationPolicy(policy: TargetSourceDeclarationPolicy | undefined): {
  readonly bundledLibraries: readonly string[];
  readonly installedDeclarations?: "package-contract";
} {
  if (policy?.installedDeclarations !== undefined && policy.installedDeclarations !== "package-contract") {
    throw new Error(`Unsupported installed source declaration policy '${String(policy.installedDeclarations)}'.`);
  }
  const bundledLibraries = new Set<string>();
  for (const library of policy?.bundledLibraries ?? []) {
    if (typeof library !== "string" || !/^lib(?:\.[a-z0-9-]+)*\.d\.ts$/u.test(library)) {
      throw new Error(`Bundled source declaration '${String(library)}' must be a canonical lib.*.d.ts file name.`);
    }
    bundledLibraries.add(library);
  }
  return {
    bundledLibraries: [...bundledLibraries].sort(),
    ...(policy?.installedDeclarations === undefined ? {} : { installedDeclarations: policy.installedDeclarations }),
  };
}

function emptyInstalledDeclarationSnapshot(): InstalledDeclarationSnapshot {
  return {
    fingerprint: createHash("sha256").digest("hex"),
    packages: [],
    declarationFileCount: 0,
    declarationByteCount: 0,
  };
}

function createSourceDeclarationSnapshot(
  bundledLibrarySources: readonly BundledLibrarySource[],
  bundledLibraries: readonly string[],
  installed: InstalledDeclarationSnapshot,
): SourceDeclarationSnapshot {
  const hash = createHash("sha256");
  hash.update(installed.fingerprint);
  for (const library of bundledLibraries) {
    appendHashPart(hash, library);
  }
  let bundledLibraryByteCount = 0;
  for (const source of bundledLibrarySources) {
    hash.update(String(Buffer.byteLength(source.path, "utf8")));
    hash.update(":");
    hash.update(source.path);
    hash.update(String(Buffer.byteLength(source.text, "utf8")));
    hash.update(":");
    hash.update(source.text);
    bundledLibraryByteCount += Buffer.byteLength(source.text, "utf8");
  }
  return {
    fingerprint: hash.digest("hex"),
    installedPackages: installed.packages,
    installedDeclarationFileCount: installed.declarationFileCount,
    installedDeclarationByteCount: installed.declarationByteCount,
    bundledLibraries,
    bundledLibraryClosure: bundledLibrarySources.map((source) => source.name),
    bundledLibraryByteCount,
  };
}

function appendHashPart(hash: ReturnType<typeof createHash>, value: string): void {
  hash.update(String(Buffer.byteLength(value, "utf8")));
  hash.update(":");
  hash.update(value);
}

function appendProjectPackageJson(projectDirectory: string, files: Map<string, string>): void {
  const packageJsonPath = join(projectDirectory, "package.json");
  if (existsSync(packageJsonPath)) {
    files.set(packageJsonPath.split("\\").join("/"), readFileSync(packageJsonPath, "utf8"));
  }
}

function collectProjectFiles(projectRoot: string, outputRoot: string): Map<string, string> {
  const files = new Map<string, string>();
  visitDirectory(projectRoot, files, outputRoot);
  return files;
}

function visitDirectory(directory: string, files: Map<string, string>, outputRoot: string): void {
  if (isPathWithinOrEqual(outputRoot, directory)) {
    return;
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      visitDirectory(fullPath, files, outputRoot);
      continue;
    }
    if (!entry.isFile() || !isResolverInputFile(entry.name)) {
      continue;
    }
    const normalizedPath = fullPath.split("\\").join("/");
    files.set(normalizedPath, readFileSync(fullPath, "utf8"));
  }
}

function shouldSkipEntry(name: string): boolean {
  return name === ".git" ||
    name === ".temp" ||
    name === "bin" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "obj";
}

function isResolverInputFile(name: string): boolean {
  return name === "package.json" || isCompilerSourceFile(name) || isDeclarationFile(name);
}
