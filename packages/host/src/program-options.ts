import {
  createCompilerHost,
  createInMemoryFileSystem,
  getBundledLibraryPath,
  ParseCommandLine,
  formatDiagnostics,
} from "@tsonic/tsts";
import type { ProgramOptions } from "@tsonic/tsts";
import type { TsonicProjectConfig } from "@tsonic/target-api";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectPaths } from "./project-paths.js";

export interface CreateProgramOptionsInput {
  readonly project: TsonicProjectConfig;
  readonly projectFilePath: string;
}

export interface CreatedProgramOptions {
  readonly programOptions: ProgramOptions;
  readonly entryPointPath: string;
  readonly projectRoot: string;
  readonly outputRoot: string;
}

export function createProgramOptionsForProject(input: CreateProgramOptionsInput): CreatedProgramOptions {
  const paths = resolveProjectPaths(input);
  const fileSystem = createInMemoryFileSystem({
    files: collectProjectFiles(paths.projectRoot),
  });
  const host = createCompilerHost({
    currentDirectory: paths.projectRoot,
    fileSystem,
    defaultLibraryPath: getBundledLibraryPath(),
  });
  const parsed = ParseCommandLine([
    "--target",
    "es2024",
    "--module",
    "nodenext",
    "--moduleResolution",
    "nodenext",
    "--strict",
    "--preserveSymlinks",
    "--allowArbitraryExtensions",
    "--rootDir",
    paths.projectRoot,
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

function collectProjectFiles(projectRoot: string): ReadonlyMap<string, string> {
  const files = new Map<string, string>();
  visitDirectory(projectRoot, files);
  return files;
}

function visitDirectory(directory: string, files: Map<string, string>): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      visitDirectory(fullPath, files);
      continue;
    }
    if (!entry.isFile() || !isCompilerInputFile(entry.name)) {
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

function isCompilerInputFile(name: string): boolean {
  return /\.(?:mts|ts)$/.test(name) && !/\.d\.(?:mts|ts)$/.test(name);
}
