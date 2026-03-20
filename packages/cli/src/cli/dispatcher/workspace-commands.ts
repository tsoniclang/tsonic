import { checkDotnetInstalled } from "@tsonic/backend";
import { dirname, resolve } from "node:path";
import { findWorkspaceConfig, loadWorkspaceConfig } from "../../config.js";
import { initWorkspace } from "../../commands/init.js";
import { addFrameworkCommand } from "../../commands/add-framework.js";
import { addNpmCommand } from "../../commands/add-npm.js";
import { addPackageCommand } from "../../commands/add-package.js";
import { addNugetCommand } from "../../commands/add-nuget.js";
import { removeNugetCommand } from "../../commands/remove-nuget.js";
import { restoreCommand } from "../../commands/restore.js";
import { updateNugetCommand } from "../../commands/update-nuget.js";
import { applyPackageManifestWorkspaceOverlay } from "../../package-manifests/bindings.js";
import type { TsonicWorkspaceConfig } from "../../types.js";
import { VERSION } from "../constants.js";
import { showHelp } from "../help.js";
import type { DispatcherError, ParsedCliArgs } from "./shared.js";

export const handleBuiltinCliCommand = (
  parsed: ParsedCliArgs
): number | null => {
  if (parsed.command === "version") {
    console.log(`tsonic v${VERSION}`);
    return 0;
  }

  if (parsed.command === "help" || !parsed.command) {
    showHelp();
    return 0;
  }

  if (parsed.command === "init") {
    const result = initWorkspace(process.cwd(), {
      skipTypes: parsed.options.skipTypes,
      typesVersion: parsed.options.typesVersion,
      surface: parsed.options.surface,
    });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    console.log("✓ Initialized Tsonic workspace");
    console.log("  Created: tsonic.workspace.json");
    console.log("\nNext steps:");
    console.log("  1. Edit tsonic.workspace.json to configure the workspace");
    console.log(
      "  2. Edit packages/<project>/tsonic.json to configure the project"
    );
    console.log("  3. Run: tsonic build");
    return 0;
  }

  return null;
};

export const ensureDotnetInstalled = (): DispatcherError | null => {
  const dotnetResult = checkDotnetInstalled();
  if (dotnetResult.ok) return null;

  console.error("Error: .NET SDK not found");
  console.error("Install from: https://dotnet.microsoft.com/download");
  return { code: 8, error: ".NET SDK not found" };
};

export const commandNeedsPackageManifestOverlay = (command: string): boolean =>
  command === "generate" ||
  command === "build" ||
  command === "run" ||
  command === "pack" ||
  command === "test";

export const loadWorkspaceCommandContext = (
  parsed: ParsedCliArgs
):
  | {
      readonly workspaceConfigPath: string;
      readonly workspaceRoot: string;
      readonly rawWorkspaceConfig: TsonicWorkspaceConfig;
    }
  | DispatcherError => {
  const workspaceConfigPath = parsed.options.config
    ? resolve(process.cwd(), parsed.options.config)
    : findWorkspaceConfig(process.cwd());

  if (!workspaceConfigPath) {
    return {
      code: 3,
      error:
        "No tsonic.workspace.json found\nRun 'tsonic init' to initialize a workspace",
    };
  }

  const workspaceRoot = dirname(workspaceConfigPath);
  const workspaceConfigResult = loadWorkspaceConfig(workspaceConfigPath);
  if (!workspaceConfigResult.ok) {
    return { code: 1, error: workspaceConfigResult.error };
  }

  let rawWorkspaceConfig = workspaceConfigResult.value;
  if (commandNeedsPackageManifestOverlay(parsed.command)) {
    const overlay = applyPackageManifestWorkspaceOverlay(
      workspaceRoot,
      rawWorkspaceConfig
    );
    if (!overlay.ok) {
      return { code: 1, error: overlay.error };
    }
    rawWorkspaceConfig = overlay.value.config;
  }

  return { workspaceConfigPath, workspaceRoot, rawWorkspaceConfig };
};

export const runWorkspaceMutationCommand = (
  parsed: ParsedCliArgs,
  workspaceConfigPath: string
): number | null => {
  if (parsed.command === "add:npm") {
    const packageSpec = parsed.positionals[0];
    if (!packageSpec) {
      console.error("Error: npm package spec required");
      console.error("Usage: tsonic add npm <packageSpec>");
      return 1;
    }

    const result = addNpmCommand(packageSpec, workspaceConfigPath, {
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
    const typesPackage = parsed.positionals[1];
    if (!dllPath) {
      console.error("Error: DLL path required");
      console.error("Usage: tsonic add package <path/to/library.dll> [types]");
      return 1;
    }

    const result = addPackageCommand(
      dllPath,
      typesPackage,
      workspaceConfigPath,
      {
        verbose: parsed.options.verbose,
        quiet: parsed.options.quiet,
        deps: parsed.options.deps,
        strict: parsed.options.strict,
      }
    );
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "add:nuget") {
    const packageId = parsed.positionals[0];
    const version = parsed.positionals[1];
    const typesPackage = parsed.positionals[2];
    if (!packageId || !version) {
      console.error("Error: Package id and version required");
      console.error("Usage: tsonic add nuget <PackageId> <Version> [types]");
      return 1;
    }

    const result = addNugetCommand(
      packageId,
      version,
      typesPackage,
      workspaceConfigPath,
      {
        verbose: parsed.options.verbose,
        quiet: parsed.options.quiet,
        deps: parsed.options.deps,
        strict: parsed.options.strict,
      }
    );
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "add:framework") {
    const frameworkRef = parsed.positionals[0];
    const typesPackage = parsed.positionals[1];
    if (!frameworkRef) {
      console.error("Error: Framework reference required");
      console.error("Usage: tsonic add framework <FrameworkReference> [types]");
      return 1;
    }

    const result = addFrameworkCommand(
      frameworkRef,
      typesPackage,
      workspaceConfigPath,
      {
        verbose: parsed.options.verbose,
        quiet: parsed.options.quiet,
        deps: parsed.options.deps,
        strict: parsed.options.strict,
      }
    );
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

    const result = removeNugetCommand(packageId, workspaceConfigPath, {
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
    const typesPackage = parsed.positionals[2];
    if (!packageId || !version) {
      console.error("Error: Package id and version required");
      console.error("Usage: tsonic update nuget <PackageId> <Version> [types]");
      return 1;
    }

    const result = updateNugetCommand(
      packageId,
      version,
      typesPackage,
      workspaceConfigPath,
      {
        verbose: parsed.options.verbose,
        quiet: parsed.options.quiet,
        deps: parsed.options.deps,
        strict: parsed.options.strict,
      }
    );
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      return 1;
    }
    return 0;
  }

  if (parsed.command === "restore") {
    const result = restoreCommand(workspaceConfigPath, {
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

  return null;
};
