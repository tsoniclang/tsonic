#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compileProject, parseTsonicProjectConfig, resolveProjectPaths } from "@tsonic/host";
import type { ProjectBuildResult } from "@tsonic/host";
import { createTargetRegistry } from "@tsonic/target-api";
import { createCsharpTargetPack } from "@tsonic/target-csharp";

interface CliResult {
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

const registry = createTargetRegistry([
  createCsharpTargetPack(),
]);

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
            .map((diagnostic) => `${diagnostic.category.toUpperCase()} ${diagnostic.source ?? "tsonic"}:${diagnostic.code}: ${diagnostic.message}`)
            .join("\n") + "\n",
        }
      : {}),
  };
}

async function writeBuildArtifacts(
  projectPath: string,
  config: ReturnType<typeof parseTsonicProjectConfig>,
  buildResult: ProjectBuildResult,
): Promise<void> {
  const paths = resolveProjectPaths({ project: config, projectFilePath: projectPath });
  for (const targetResult of buildResult.targets) {
    const targetRoot = resolve(paths.outputRoot, targetResult.target.id);
    for (const artifact of targetResult.compileResult.artifacts) {
      const outputPath = resolve(targetRoot, artifact.path);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, artifact.text, "utf8");
    }
  }
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
    "",
    "Architecture:",
    "  TSTS owns TypeScript parse/bind/check/flow/narrowing and extension facts.",
    "  Tsonic owns project orchestration, target selection, target source generation, and toolchain handoff.",
    "",
  ].join("\n");
}
