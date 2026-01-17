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
import { addJsCommand } from "../commands/add-js.js";
import { addNodejsCommand } from "../commands/add-nodejs.js";
import { addPackageCommand } from "../commands/add-package.js";
import { addNugetCommand } from "../commands/add-nuget.js";
import { addFrameworkCommand } from "../commands/add-framework.js";
import { removeNugetCommand } from "../commands/remove-nuget.js";
import { updateNugetCommand } from "../commands/update-nuget.js";
import { restoreCommand } from "../commands/restore.js";
import { isBuiltInRuntimeDllPath } from "../dotnet/runtime-dlls.js";
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
      skipTypes: parsed.options.skipTypes,
      typesVersion: parsed.options.typesVersion,
      js: parsed.options.js,
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
  let rawConfig = configResult.value;

  // Project root is the directory containing tsonic.json
  const projectRoot = dirname(configPath);

  // Add commands operate on tsonic.json itself (not ResolvedConfig).
  if (parsed.command === "add:js") {
    const result = addJsCommand(configPath, {
      verbose: parsed.options.verbose,
      quiet: parsed.options.quiet,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "add:nodejs") {
    const result = addNodejsCommand(configPath, {
      verbose: parsed.options.verbose,
      quiet: parsed.options.quiet,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "add:package") {
    const dllPath = parsed.positionals[0];
    const typesPackage = parsed.positionals[1]; // optional: omitted => auto-generate
    if (!dllPath) {
      console.error("Error: DLL path required");
      console.error("Usage: tsonic add package <path/to/library.dll> [types]");
      return 1;
    }

    const result = addPackageCommand(dllPath, typesPackage, configPath, {
      verbose: parsed.options.verbose,
      quiet: parsed.options.quiet,
      deps: parsed.options.deps,
      strict: parsed.options.strict,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "add:nuget") {
    const packageId = parsed.positionals[0];
    const version = parsed.positionals[1];
    const typesPackage = parsed.positionals[2]; // optional: omitted => auto-generate
    if (!packageId || !version) {
      console.error("Error: Package id and version required");
      console.error(
        "Usage: tsonic add nuget <PackageId> <Version> [types]"
      );
      return 1;
    }

    const result = addNugetCommand(packageId, version, typesPackage, configPath, {
      verbose: parsed.options.verbose,
      quiet: parsed.options.quiet,
      deps: parsed.options.deps,
      strict: parsed.options.strict,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "add:framework") {
    const frameworkRef = parsed.positionals[0];
    const typesPackage = parsed.positionals[1]; // optional: omitted => auto-generate
    if (!frameworkRef) {
      console.error("Error: Framework reference required");
      console.error(
        "Usage: tsonic add framework <FrameworkReference> [types]"
      );
      return 1;
    }

    const result = addFrameworkCommand(frameworkRef, typesPackage, configPath, {
      verbose: parsed.options.verbose,
      quiet: parsed.options.quiet,
      deps: parsed.options.deps,
      strict: parsed.options.strict,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "remove:nuget") {
    const packageId = parsed.positionals[0];
    if (!packageId) {
      console.error("Error: Package id required");
      console.error("Usage: tsonic remove nuget <PackageId>");
      return 1;
    }

    const result = removeNugetCommand(packageId, configPath, {
      verbose: parsed.options.verbose,
      quiet: parsed.options.quiet,
      deps: parsed.options.deps,
      strict: parsed.options.strict,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "update:nuget") {
    const packageId = parsed.positionals[0];
    const version = parsed.positionals[1];
    const typesPackage = parsed.positionals[2]; // optional
    if (!packageId || !version) {
      console.error("Error: Package id and version required");
      console.error("Usage: tsonic update nuget <PackageId> <Version> [types]");
      return 1;
    }

    const result = updateNugetCommand(packageId, version, typesPackage, configPath, {
      verbose: parsed.options.verbose,
      quiet: parsed.options.quiet,
      deps: parsed.options.deps,
      strict: parsed.options.strict,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "restore") {
    const result = restoreCommand(configPath, {
      verbose: parsed.options.verbose,
      quiet: parsed.options.quiet,
      deps: parsed.options.deps,
      strict: parsed.options.strict,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  // Airplane-grade UX: projects must be clone-and-build friendly.
  // If the project declares .NET deps (NuGet/framework/DLLs), ensure bindings exist
  // before running the compiler. This keeps `tsonic build` deterministic without
  // requiring users to remember a separate restore step.
  if (
    parsed.command === "generate" ||
    parsed.command === "build" ||
    parsed.command === "run" ||
    parsed.command === "pack"
  ) {
    const hasFrameworkRefs = (rawConfig.dotnet?.frameworkReferences?.length ?? 0) > 0;
    const hasPackageRefs = (rawConfig.dotnet?.packageReferences?.length ?? 0) > 0;
    const hasDllLibs = (rawConfig.dotnet?.libraries ?? []).some((p) => {
      const normalized = p.replace(/\\/g, "/").toLowerCase();
      if (!normalized.endsWith(".dll")) return false;
      if (isBuiltInRuntimeDllPath(p)) return false;
      // Only vendored DLLs (copied into ./lib) require restore-generated bindings.
      // Non-vendored references (e.g., workspace project outputs) are build-time
      // assembly references only and should not trigger restore.
      return normalized.startsWith("lib/") || normalized.startsWith("./lib/");
    });

    if (hasFrameworkRefs || hasPackageRefs || hasDllLibs) {
      const restoreResult = restoreCommand(configPath, {
        verbose: parsed.options.verbose,
        quiet: parsed.options.quiet,
        deps: parsed.options.deps,
        strict: parsed.options.strict,
      });
      if (!restoreResult.ok) {
        console.error(`Error: ${restoreResult.error}`);
        return 1;
      }

      // restore may update tsonic.json (e.g., inferred FrameworkReferences), so reload.
      const reloaded = loadConfig(configPath);
      if (!reloaded.ok) {
        console.error(`Error: ${reloaded.error}`);
        return 1;
      }
      rawConfig = reloaded.value;
    }
  }

  const entryFile = parsed.positionals[0];
  const config = resolveConfig(rawConfig, parsed.options, projectRoot, entryFile);

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
