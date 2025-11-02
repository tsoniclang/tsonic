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
