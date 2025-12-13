/**
 * CLI argument parser
 */

import type { CliOptions } from "../types.js";

/**
 * Parse CLI arguments
 */
export const parseArgs = (
  args: string[]
): {
  command: string;
  entryFile?: string;
  secondArg?: string; // For commands that take two positional args
  options: CliOptions;
  programArgs?: string[];
} => {
  const options: CliOptions = {};
  let command = "";
  let entryFile: string | undefined;
  let secondArg: string | undefined;
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
      // Handle "add package" as two-word command
      if (command === "add" && nextArg === "package") {
        command = "add:package";
        i++;
      }
      continue;
    }

    // First positional arg after command (entry file or dll path)
    if (command && !entryFile && !arg.startsWith("-")) {
      entryFile = arg;
      continue;
    }

    // Second positional arg (for commands that take two args like add:package)
    if (command && entryFile && !secondArg && !arg.startsWith("-")) {
      secondArg = arg;
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
      case "--runtime":
        options.runtime = (args[++i] ?? "js") as "js" | "dotnet";
        break;
      case "--skip-types":
        options.skipTypes = true;
        break;
      case "--types-version":
        options.typesVersion = args[++i] ?? "";
        break;
      case "--nodejs":
        options.nodejs = true;
        break;
      case "--pure":
        options.pure = true;
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
      case "-L":
      case "--lib":
        {
          const libPath = args[++i] ?? "";
          if (libPath) {
            options.lib = options.lib || [];
            options.lib.push(libPath);
          }
        }
        break;
    }
  }

  return { command, entryFile, secondArg, options, programArgs };
};
