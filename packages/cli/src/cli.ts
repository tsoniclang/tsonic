/**
 * CLI argument parsing and command dispatch
 */

import { join } from "node:path";
import { checkDotnetInstalled } from "@tsonic/backend";
import { loadConfig, findConfig, resolveConfig } from "./config.js";
import { initProject } from "./commands/init.js";
import { emitCommand } from "./commands/emit.js";
import { buildCommand } from "./commands/build.js";
import { runCommand } from "./commands/run.js";
import type { CliOptions } from "./types.js";

const VERSION = "0.0.1";

/**
 * Show help message
 */
const showHelp = () => {
  console.log(`
Tsonic - TypeScript to C# to NativeAOT compiler v${VERSION}

USAGE:
  tsonic <command> [options]

COMMANDS:
  project init              Initialize a new Tsonic project
  emit [entry]              Generate C# code only
  build [entry]             Build native executable
  run [entry] [-- args...]  Build and run executable

GLOBAL OPTIONS:
  -h, --help                Show help
  -v, --version             Show version
  -V, --verbose             Verbose output
  -q, --quiet               Suppress output
  -c, --config <file>       Config file path (default: tsonic.json)

EMIT/BUILD/RUN OPTIONS:
  -s, --src <dir>           Source root directory
  -o, --out <path>          Output directory (emit) or file (build)
  -n, --namespace <ns>      Root namespace override
  -r, --rid <rid>           Runtime identifier (e.g., linux-x64)
  -O, --optimize <level>    Optimization: size or speed
  -k, --keep-temp           Keep build artifacts
  --no-strip                Keep debug symbols

EXAMPLES:
  tsonic project init
  tsonic emit src/main.ts
  tsonic build src/main.ts --rid linux-x64
  tsonic run src/main.ts -- --arg1 value1

LEARN MORE:
  Documentation: https://tsonic.dev/docs
  GitHub: https://github.com/tsoniclang/tsonic
`);
};

/**
 * Parse CLI arguments
 */
const parseArgs = (
  args: string[]
): {
  command: string;
  entryFile?: string;
  options: CliOptions;
  programArgs?: string[];
} => {
  const options: CliOptions = {};
  let command = "";
  let entryFile: string | undefined;
  const programArgs: string[] = [];
  let captureProgramArgs = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue; // Skip if undefined

    // Separator for program arguments
    if (arg === "--") {
      captureProgramArgs = true;
      continue;
    }

    if (captureProgramArgs) {
      programArgs.push(arg);
      continue;
    }

    // Commands
    if (!command && !arg.startsWith("-")) {
      command = arg;
      // Handle "project init" as two-word command
      const nextArg = args[i + 1];
      if (command === "project" && nextArg === "init") {
        command = "project:init";
        i++;
      }
      continue;
    }

    // Entry file (first non-option after command)
    if (command && !entryFile && !arg.startsWith("-")) {
      entryFile = arg;
      continue;
    }

    // Options
    switch (arg) {
      case "-h":
      case "--help":
        options.verbose = true; // reuse for help flag
        return { command: "help", options: {} };
      case "-v":
      case "--version":
        return { command: "version", options: {} };
      case "-V":
      case "--verbose":
        options.verbose = true;
        break;
      case "-q":
      case "--quiet":
        options.quiet = true;
        break;
      case "-c":
      case "--config":
        options.config = args[++i] ?? "";
        break;
      case "-s":
      case "--src":
        options.src = args[++i] ?? "";
        break;
      case "-o":
      case "--out":
        options.out = args[++i] ?? "";
        break;
      case "-n":
      case "--namespace":
        options.namespace = args[++i] ?? "";
        break;
      case "-r":
      case "--rid":
        options.rid = args[++i] ?? "";
        break;
      case "-O":
      case "--optimize":
        options.optimize = (args[++i] ?? "speed") as "size" | "speed";
        break;
      case "-k":
      case "--keep-temp":
        options.keepTemp = true;
        break;
      case "--no-strip":
        options.noStrip = true;
        break;
    }
  }

  return { command, entryFile, options, programArgs };
};

/**
 * Main CLI entry point
 */
export const runCli = async (args: string[]): Promise<number> => {
  const parsed = parseArgs(args);

  // Handle version and help
  if (parsed.command === "version") {
    console.log(`tsonic v${VERSION}`);
    return 0;
  }

  if (parsed.command === "help" || !parsed.command) {
    showHelp();
    return 0;
  }

  // Handle project init (doesn't need config)
  if (parsed.command === "project:init") {
    const result = initProject(process.cwd());
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    console.log("✓ Initialized Tsonic project");
    console.log("  Created: tsonic.json");
    console.log("  Created/Updated: .gitignore");
    console.log("\nNext steps:");
    console.log("  1. Edit tsonic.json to configure your project");
    console.log("  2. Create src/main.ts");
    console.log("  3. Run: tsonic build");
    return 0;
  }

  // Check for dotnet
  const dotnetResult = checkDotnetInstalled();
  if (!dotnetResult.ok) {
    console.error("Error: .NET SDK not found");
    console.error("Install from: https://dotnet.microsoft.com/download");
    return 8;
  }

  // Load config
  const configPath = parsed.options.config
    ? join(process.cwd(), parsed.options.config)
    : findConfig(process.cwd());

  if (!configPath) {
    console.error("Error: No tsonic.json found");
    console.error("Run 'tsonic project init' to initialize a project");
    return 3;
  }

  const configResult = loadConfig(configPath);
  if (!configResult.ok) {
    console.error(`Error: ${configResult.error}`);
    return 1;
  }

  const config = resolveConfig(
    configResult.value,
    parsed.options,
    parsed.entryFile
  );

  // Dispatch to command handlers
  switch (parsed.command) {
    case "emit": {
      const result = emitCommand(config);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        return 5;
      }
      return 0;
    }

    case "build": {
      const result = buildCommand(config);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        return 6;
      }
      return 0;
    }

    case "run": {
      const result = runCommand(config, parsed.programArgs ?? []);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        return 7;
      }
      return result.value.exitCode;
    }

    default:
      console.error(`Error: Unknown command '${parsed.command}'`);
      console.error("Run 'tsonic --help' for usage information");
      return 2;
  }
};
