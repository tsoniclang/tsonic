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
  positionals: string[]; // Positional args after command
  options: CliOptions;
  programArgs?: string[];
} => {
  const options: CliOptions = {};
  let command = "";
  const positionals: string[] = [];
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
      const nextArg = args[i + 1];
      // Legacy alias: "project init" -> "init"
      if (command === "project" && nextArg === "init") {
        command = "init";
        i++;
      }
      // Handle "add package" as two-word command
      if (command === "add") {
        if (nextArg === "package") {
          command = "add:package";
          i++;
        } else if (nextArg === "nuget") {
          command = "add:nuget";
          i++;
        } else if (nextArg === "framework") {
          command = "add:framework";
          i++;
        } else if (nextArg === "npm") {
          command = "add:npm";
          i++;
        }
      }
      // Handle "remove nuget" as two-word command
      if (command === "remove") {
        if (nextArg === "nuget") {
          command = "remove:nuget";
          i++;
        }
      }
      // Handle "update nuget" as two-word command
      if (command === "update") {
        if (nextArg === "nuget") {
          command = "update:nuget";
          i++;
        }
      }
      continue;
    }

    // Positional args after command
    if (command && !arg.startsWith("-")) {
      positionals.push(arg);
      continue;
    }

    // Options
    switch (arg) {
      case "-h":
      case "--help":
        options.verbose = true; // reuse for help flag
        return { command: "help", positionals: [], options: {}, programArgs };
      case "-v":
      case "--version":
        return {
          command: "version",
          positionals: [],
          options: {},
          programArgs,
        };
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
      case "--project":
        options.project = args[++i] ?? "";
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
      case "--skip-types":
        options.skipTypes = true;
        break;
      case "--types-version":
        options.typesVersion = args[++i] ?? "";
        break;
      case "-O":
      case "--optimize":
        options.optimize = (args[++i] ?? "speed") as "size" | "speed";
        break;
      case "-k":
      case "--keep-temp":
        options.keepTemp = true;
        break;
      case "--no-generate":
        options.noGenerate = true;
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
      case "--deps":
        {
          const depDir = args[++i] ?? "";
          if (depDir) {
            options.deps = options.deps || [];
            options.deps.push(depDir);
          }
        }
        break;
      case "--strict":
        options.strict = true;
        break;
    }
  }

  return { command, positionals, options, programArgs };
};
