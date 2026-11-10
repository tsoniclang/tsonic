#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileProject, discoverInstalledTsonicPlugins, parseTsonicProjectConfig, resolveProjectPaths } from "@tsonic/host";
import type { ProjectBuildResult } from "@tsonic/host";
import { publishBuildOutput, recoverBuildOutput } from "./output-publication.js";

interface CliResult {
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

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
    const projectPath = resolve(currentDirectory, readProjectPath(args.slice(1)));
    const plugins = await discoverInstalledTsonicPlugins(projectPath);
    const errors = plugins.diagnostics.filter((diagnostic) => diagnostic.category === "error");
    if (errors.length > 0) {
      return {
        exitCode: 1,
        stderr: errors.map(formatDiagnostic).join("\n") + "\n",
      };
    }
    return {
      exitCode: 0,
      stdout: plugins.targets.map((target) => `${target.targetId}\t${target.id}`).join("\n") + "\n",
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
  const paths = resolveProjectPaths({ project: config, projectFilePath: projectPath });
  const outputOptions = {
    outputRoot: paths.outputRoot,
    protectedPaths: [paths.projectDirectory],
  } as const;
  await recoverBuildOutput(outputOptions);
  const plugins = await discoverInstalledTsonicPlugins(projectPath);
  if (plugins.diagnostics.some((diagnostic) => diagnostic.category === "error")) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: plugins.diagnostics.map(formatDiagnostic).join("\n") + "\n",
    };
  }
  const buildResult = compileProject({
    project: config,
    projectFilePath: projectPath,
    registry: plugins.createTargetRegistry(),
    installedCapabilities: plugins.capabilities,
  });
  const diagnostics = buildResult.diagnostics.filter((diagnostic) => diagnostic.category === "error");
  if (diagnostics.length === 0) {
    const targets = buildResult.targets.map((target) => {
      if (target.compileResult.kind !== "resolved") {
        throw new Error(`Target '${target.target.id}' rejected without an error diagnostic.`);
      }
      return {
        targetId: target.target.id,
        artifacts: target.compileResult.value.artifacts,
      };
    });
    await publishBuildOutput({
      ...outputOptions,
      expectedTargetIds: config.targets.map((target) => target.id),
      targets,
    });
  }
  return {
    exitCode: diagnostics.length === 0 ? 0 : 1,
    stdout: [
      `Project: ${projectPath}`,
      `Entry: ${config.entryPoint}`,
      `Targets: ${buildResult.targets.map((target) => target.target.id).join(", ")}`,
      `Artifacts: ${buildResult.targets.reduce(
        (count, target) => count + (target.compileResult.kind === "resolved" ? target.compileResult.value.artifacts.length : 0),
        0,
      )}`,
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
  const sourceSpan = diagnostic.sourceSpan === undefined
    ? ""
    : ` ${diagnostic.sourceSpan.fileName}:${diagnostic.sourceSpan.line}:${diagnostic.sourceSpan.column}`;
  return `${diagnostic.category.toUpperCase()} ${diagnostic.source ?? "tsonic"}:${diagnostic.code}${sourceSpan}: ${diagnostic.message}${evidence}`;
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
