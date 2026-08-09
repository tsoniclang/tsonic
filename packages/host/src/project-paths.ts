import { dirname, resolve } from "node:path";
import type { TargetCompilationPaths, TargetSelection, TsonicProjectConfig } from "@tsonic/target-api";

export interface ProjectPathOptions {
  readonly projectFilePath: string;
  readonly project: TsonicProjectConfig;
}

export interface ProjectPaths {
  readonly projectFilePath: string;
  readonly projectDirectory: string;
  readonly projectRoot: string;
  readonly entryPointPath: string;
  readonly rootFilePaths: readonly string[];
  readonly outputRoot: string;
}

export function resolveProjectPaths(options: ProjectPathOptions): ProjectPaths {
  const projectFilePath = resolve(options.projectFilePath);
  const projectDirectory = dirname(projectFilePath);
  const projectRoot = resolve(projectDirectory, options.project.rootDir ?? ".");
  const entryPointPath = resolve(projectRoot, options.project.entryPoint);
  const rootFilePaths = resolveRootFilePaths(projectRoot, entryPointPath, options.project.rootFiles);
  const outputRoot = resolve(projectDirectory, options.project.outDir ?? "dist/tsonic");
  return {
    projectFilePath,
    projectDirectory,
    projectRoot,
    entryPointPath,
    rootFilePaths,
    outputRoot,
  };
}

function resolveRootFilePaths(
  projectRoot: string,
  entryPointPath: string,
  configuredRootFiles: readonly string[] | undefined,
): readonly string[] {
  const rootFilePaths = (configuredRootFiles ?? [entryPointPath]).map((rootFile) =>
    resolve(projectRoot, rootFile)
  );
  if (rootFilePaths.length === 0) {
    throw new Error("Project rootFiles must not be empty.");
  }
  if (!rootFilePaths.includes(entryPointPath)) {
    throw new Error("Project rootFiles must contain the resolved entryPoint.");
  }
  if (new Set(rootFilePaths).size !== rootFilePaths.length) {
    throw new Error("Project rootFiles must resolve to distinct source paths.");
  }
  return Object.freeze(rootFilePaths);
}

export function getTargetCompilationPaths(paths: ProjectPaths, target: TargetSelection): TargetCompilationPaths {
  return {
    projectFilePath: paths.projectFilePath,
    projectRoot: paths.projectRoot,
    outputRoot: paths.outputRoot,
    targetOutputRoot: resolve(paths.outputRoot, target.id),
  };
}
