#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { compileProject, parseTsonicProjectConfig, resolveProjectPaths } from "@tsonic/host";
import type { ProjectBuildResult } from "@tsonic/host";
import { createStandardTargetRegistry } from "./standard-targets.js";

interface CliResult {
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

const registry = createStandardTargetRegistry();

const result = await run(process.argv.slice(2), process.cwd()).catch((error: unknown): CliResult => ({
  exitCode: 1,
  stderr: `${error instanceof Error ? error.message : String(error)}\n`,
}));
if (result.stdout !== undefined && result.stdout.length > 0) {
  process.stdout.write(result.stdout);
}
if (result.stderr !== undefined && result.stderr.length > 0) {
  process.stderr.write(result.stderr);
}
process.exitCode = result.exitCode;

export async function run(args: readonly string[], currentDirectory: string): Promise<CliResult> {
  const command = args[0];
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    return {
      exitCode: 0,
      stdout: helpText(),
    };
  }
  if (command === "targets") {
    return {
      exitCode: 0,
      stdout: registry.packs.map((pack) => `${pack.id}\t${pack.displayName}`).join("\n") + "\n",
    };
  }
  if (command !== "build") {
    return {
      exitCode: 2,
      stderr: `Unknown command '${command}'.\n\n${helpText()}`,
    };
  }
  return runBuild(args.slice(1), currentDirectory);
}

async function runBuild(args: readonly string[], currentDirectory: string): Promise<CliResult> {
  const projectPath = resolve(currentDirectory, readProjectPath(args));
  const text = await readFile(projectPath, "utf8");
  const config = parseTsonicProjectConfig(JSON.parse(text));
  const buildResult = compileProject({
    project: config,
    projectFilePath: projectPath,
    registry,
  });
  await writeBuildArtifacts(projectPath, config, buildResult);
  const diagnostics = buildResult.diagnostics.filter((diagnostic) => diagnostic.category === "error");
  return {
    exitCode: diagnostics.length === 0 ? 0 : 1,
    stdout: [
      `Project: ${projectPath}`,
      `Entry: ${config.entryPoint}`,
      `Targets: ${buildResult.targets.map((target) => target.target.id).join(", ")}`,
      `Artifacts: ${buildResult.targets.reduce((count, target) => count + target.compileResult.artifacts.length, 0)}`,
      "",
    ].join("\n"),
    ...(buildResult.diagnostics.length > 0
      ? {
          stderr: buildResult.diagnostics
            .map(formatDiagnostic)
            .join("\n") + "\n",
        }
      : {}),
  };
}

function formatDiagnostic(diagnostic: ProjectBuildResult["diagnostics"][number]): string {
  const evidence = diagnostic.evidence === undefined || diagnostic.evidence.length === 0
    ? ""
    : diagnostic.evidence.map((entry) => `\n  evidence: ${entry}`).join("");
  return `${diagnostic.category.toUpperCase()} ${diagnostic.source ?? "tsonic"}:${diagnostic.code}: ${diagnostic.message}${evidence}`;
}

async function writeBuildArtifacts(
  projectPath: string,
  config: ReturnType<typeof parseTsonicProjectConfig>,
  buildResult: ProjectBuildResult,
): Promise<void> {
  const paths = resolveProjectPaths({ project: config, projectFilePath: projectPath });
  for (const targetResult of buildResult.targets) {
    const targetRoot = resolve(paths.outputRoot, targetResult.target.id);
    assertContainedPath(paths.outputRoot, targetRoot, `target '${targetResult.target.id}' output root`);
    await rm(targetRoot, { recursive: true, force: true });
    for (const artifact of targetResult.compileResult.artifacts) {
      const outputPath = resolve(targetRoot, artifact.path);
      assertSafeArtifactPath(targetRoot, artifact.path, outputPath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, artifact.text, "utf8");
    }
  }
}

function assertSafeArtifactPath(targetRoot: string, artifactPath: string, outputPath: string): void {
  if (isAbsolute(artifactPath)) {
    throw new Error(`Target artifact path '${artifactPath}' must be project-relative inside the target output root.`);
  }
  assertContainedPath(targetRoot, outputPath, `target artifact '${artifactPath}'`);
}

function assertContainedPath(root: string, candidate: string, subject: string): void {
  const relation = relative(root, candidate);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) {
    return;
  }
  throw new Error(`${subject} resolves outside '${root}'.`);
}

function readProjectPath(args: readonly string[]): string {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--project" || value === "-p") {
      const path = args[index + 1];
      if (path === undefined || path.startsWith("-")) {
        throw new Error("Expected a path after --project.");
      }
      return path;
    }
  }
  return "tsonic.json";
}

function helpText(): string {
  return [
    "Usage:",
    "  tsonic build --project <tsonic.json>",
    "  tsonic targets",
    "",
    "Architecture:",
    "  TSTS owns TypeScript parse/bind/check/flow/narrowing and extension facts.",
    "  Tsonic owns project orchestration, target selection, target source generation, and toolchain handoff.",
    "",
  ].join("\n");
}
