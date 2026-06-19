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
  readonly outputRoot: string;
}

export function resolveProjectPaths(options: ProjectPathOptions): ProjectPaths {
  const projectFilePath = resolve(options.projectFilePath);
  const projectDirectory = dirname(projectFilePath);
  const projectRoot = resolve(projectDirectory, options.project.rootDir ?? ".");
  const entryPointPath = resolve(projectRoot, options.project.entryPoint);
  const outputRoot = resolve(projectDirectory, options.project.outDir ?? "dist/tsonic");
  return {
    projectFilePath,
    projectDirectory,
    projectRoot,
    entryPointPath,
    outputRoot,
  };
}

export function getTargetCompilationPaths(paths: ProjectPaths, target: TargetSelection): TargetCompilationPaths {
  return {
    projectFilePath: paths.projectFilePath,
    projectRoot: paths.projectRoot,
    outputRoot: paths.outputRoot,
    targetOutputRoot: resolve(paths.outputRoot, target.id),
  };
}
