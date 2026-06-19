#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseTsonicProjectConfig } from "@tsonic/host";
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

const result = await run(process.argv.slice(2), process.cwd());
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
  const targetSummaries = config.targets.map((target) => {
    const pack = registry.require(target.id);
    return `${target.id} (${pack.displayName})`;
  });
  return {
    exitCode: 0,
    stdout: [
      "Tsonic clean-slate compiler host is installed.",
      `Project: ${projectPath}`,
      `Entry: ${config.entryPoint}`,
      `Targets: ${targetSummaries.join(", ")}`,
      "Semantic compilation is owned by packages/host and target packs; no legacy frontend path is present.",
      "",
    ].join("\n"),
  };
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
