import {
  createCompilerHost,
  createInMemoryFileSystem,
  ParseCommandLine,
  formatDiagnostics,
} from "@tsonic/tsts";
import type { ProgramOptions } from "@tsonic/tsts";
import type { TsonicProjectConfig } from "@tsonic/target-api";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { resolveProjectPaths } from "./project-paths.js";

export interface CreateProgramOptionsInput {
  readonly project: TsonicProjectConfig;
  readonly projectFilePath: string;
  readonly sourceProfileFiles?: readonly {
    readonly path: string;
    readonly text: string;
  }[];
}

export interface CreatedProgramOptions {
  readonly programOptions: ProgramOptions;
  readonly entryPointPath: string;
  readonly projectRoot: string;
  readonly outputRoot: string;
}

export function createProgramOptionsForProject(input: CreateProgramOptionsInput): CreatedProgramOptions {
  const paths = resolveProjectPaths(input);
  const projectFiles = collectProjectFiles(paths.projectRoot, paths.outputRoot);
  for (const file of input.sourceProfileFiles ?? []) {
    projectFiles.set(file.path, file.text);
  }
  const fileSystem = createInMemoryFileSystem({
    files: projectFiles,
    includeBundledLibraries: false,
  });
  const host = createCompilerHost({
    currentDirectory: paths.projectRoot,
    fileSystem,
    includeBundledLibraries: false,
  });
  const parsed = ParseCommandLine([
    "--noLib",
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
    ...(input.sourceProfileFiles ?? []).map((file) => file.path),
    paths.entryPointPath,
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
    projectRoot: paths.projectRoot,
    outputRoot: paths.outputRoot,
  };
}

function collectProjectFiles(projectRoot: string, outputRoot: string): Map<string, string> {
  const files = new Map<string, string>();
  visitDirectory(projectRoot, files, outputRoot);
  return files;
}

function visitDirectory(directory: string, files: Map<string, string>, outputRoot: string): void {
  if (pathIsWithinOrEqual(outputRoot, directory)) {
    return;
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        visitNodeModulesDirectory(fullPath, files);
        continue;
      }
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

function pathIsWithinOrEqual(parentPath: string, candidatePath: string): boolean {
  const relativePath = relative(parentPath, candidatePath);
  return relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function shouldSkipEntry(name: string): boolean {
  return name === ".git" ||
    name === ".temp" ||
    name === "bin" ||
    name === "dist" ||
    name === "obj";
}

function visitNodeModulesDirectory(directory: string, files: Map<string, string>): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith("@")) {
      visitScopedNodeModulesDirectory(fullPath, files);
      continue;
    }
    visitPackageDirectory(fullPath, files);
  }
}

function visitScopedNodeModulesDirectory(directory: string, files: Map<string, string>): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      visitPackageDirectory(join(directory, entry.name), files);
    }
  }
}

function visitPackageDirectory(directory: string, files: Map<string, string>): void {
  const packageJsonPath = join(directory, "package.json");
  if (!existsSync(packageJsonPath)) {
    return;
  }
  files.set(packageJsonPath.split("\\").join("/"), readFileSync(packageJsonPath, "utf8"));
  visitPackageSourceDirectory(directory, files);
}

function visitPackageSourceDirectory(directory: string, files: Map<string, string>): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (shouldSkipPackageEntry(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      visitPackageSourceDirectory(fullPath, files);
      continue;
    }
    if (entry.isFile() && isCompilerSourceFile(entry.name)) {
      files.set(fullPath.split("\\").join("/"), readFileSync(fullPath, "utf8"));
    }
  }
}

function shouldSkipPackageEntry(name: string): boolean {
  return name === ".git" ||
    name === "bin" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "obj";
}

function isResolverInputFile(name: string): boolean {
  return name === "package.json" || isCompilerSourceFile(name);
}

function isCompilerSourceFile(name: string): boolean {
  return /\.(?:mts|ts)$/.test(name) && !/\.d\.(?:mts|ts)$/.test(name);
}
