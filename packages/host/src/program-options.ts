import {
  LibPath,
  NewCachedFSCompilerHost,
  ParseCommandLine,
  OSFileSystem,
  WrapBundledFileSystem,
  formatDiagnostics,
} from "@tsonic/tsts";
import type { ProgramOptions } from "@tsonic/tsts";
import type { TsonicProjectConfig } from "@tsonic/target-api";
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
  const fileSystem = WrapBundledFileSystem(OSFileSystem());
  const host = NewCachedFSCompilerHost(paths.projectRoot, fileSystem, LibPath(), undefined, undefined);
  const parsed = ParseCommandLine([
    "--target",
    "es2024",
    "--module",
    "nodenext",
    "--moduleResolution",
    "nodenext",
    "--strict",
    "--skipLibCheck",
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
