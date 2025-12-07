/**
 * CLI command dispatcher
 */

import { dirname, join } from "node:path";
import { checkDotnetInstalled } from "@tsonic/backend";
import { loadConfig, findConfig, resolveConfig } from "../config.js";
import { initProject } from "../commands/init.js";
import { generateCommand } from "../commands/generate.js";
import { buildCommand } from "../commands/build.js";
import { runCommand } from "../commands/run.js";
import { packCommand } from "../commands/pack.js";
import { addPackageCommand } from "../commands/add-package.js";
import { VERSION } from "./constants.js";
import { showHelp } from "./help.js";
import { parseArgs } from "./parser.js";

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
    const result = initProject(process.cwd(), {
      runtime: parsed.options.runtime,
      skipTypes: parsed.options.skipTypes,
      typesVersion: parsed.options.typesVersion,
      nodejs: parsed.options.nodejs,
    });
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

  // Handle add package (needs tsonic.json but not full config)
  if (parsed.command === "add:package") {
    if (!parsed.entryFile) {
      console.error("Error: DLL path required");
      console.error(
        "Usage: tsonic add package /path/to/library.dll @scope/types"
      );
      return 1;
    }
    if (!parsed.secondArg) {
      console.error("Error: Types package name required");
      console.error(
        "Usage: tsonic add package /path/to/library.dll @scope/types"
      );
      return 1;
    }

    const result = addPackageCommand(
      parsed.entryFile,
      parsed.secondArg,
      process.cwd(),
      {
        verbose: parsed.options.verbose,
        quiet: parsed.options.quiet,
      }
    );
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
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

  // Project root is the directory containing tsonic.json
  const projectRoot = dirname(configPath);

  const config = resolveConfig(
    configResult.value,
    parsed.options,
    projectRoot,
    parsed.entryFile
  );

  // Dispatch to command handlers
  switch (parsed.command) {
    case "generate": {
      const result = generateCommand(config);
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

    case "pack": {
      const result = packCommand(config);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        return 9;
      }
      return 0;
    }

    default:
      console.error(`Error: Unknown command '${parsed.command}'`);
      console.error("Run 'tsonic --help' for usage information");
      return 2;
  }
};
