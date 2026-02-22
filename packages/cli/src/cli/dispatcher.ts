/**
 * CLI command dispatcher
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { checkDotnetInstalled } from "@tsonic/backend";
import {
  findWorkspaceConfig,
  findProjectConfig,
  listProjects,
  PROJECT_CONFIG_FILE,
  loadProjectConfig,
  loadWorkspaceConfig,
  resolveConfig,
} from "../config.js";
import { initWorkspace } from "../commands/init.js";
import { generateCommand } from "../commands/generate.js";
import { buildCommand } from "../commands/build.js";
import { runCommand } from "../commands/run.js";
import { packCommand } from "../commands/pack.js";
import { testCommand } from "../commands/test.js";
import { addNpmCommand } from "../commands/add-npm.js";
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
import type { Result } from "../types.js";

const mergeUniqueFrameworkReferences = (
  a: readonly (string | { readonly id: string })[],
  b: readonly (string | { readonly id: string })[]
): readonly (string | { readonly id: string })[] => {
  const out: Array<string | { readonly id: string }> = [];
  const seen = new Set<string>();
  const push = (ref: string | { readonly id: string }): void => {
    const id = (typeof ref === "string" ? ref : ref.id).toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    out.push(ref);
  };
  for (const r of a) push(r);
  for (const r of b) push(r);
  return out;
};

const mergeUniquePackageReferences = (
  a: readonly { readonly id: string; readonly version: string }[],
  b: readonly { readonly id: string; readonly version: string }[]
): Result<
  readonly { readonly id: string; readonly version: string }[],
  string
> => {
  const byId = new Map<
    string,
    { readonly id: string; readonly version: string }
  >();
  const add = (p: {
    readonly id: string;
    readonly version: string;
  }): Result<void, string> => {
    const key = p.id.toLowerCase();
    const existing = byId.get(key);
    if (existing && existing.version !== p.version) {
      return {
        ok: false,
        error:
          `Conflicting PackageReference versions for '${p.id}': '${existing.version}' vs '${p.version}'.\n` +
          `Use a single version at the workspace level.`,
      };
    }
    byId.set(key, p);
    return { ok: true, value: undefined };
  };

  for (const p of a) {
    const r = add(p);
    if (!r.ok) return r;
  }
  for (const p of b) {
    const r = add(p);
    if (!r.ok) return r;
  }

  const merged = Array.from(byId.values()).sort((x, y) =>
    x.id.localeCompare(y.id)
  );
  return { ok: true, value: merged };
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

  // Handle workspace init (doesn't need existing config)
  if (parsed.command === "init") {
    const result = initWorkspace(process.cwd(), {
      skipTypes: parsed.options.skipTypes,
      typesVersion: parsed.options.typesVersion,
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

  // Check for dotnet
  const dotnetResult = checkDotnetInstalled();
  if (!dotnetResult.ok) {
    console.error("Error: .NET SDK not found");
    console.error("Install from: https://dotnet.microsoft.com/download");
    return 8;
  }

  // Workspace is mandatory: locate tsonic.workspace.json
  const workspaceConfigPath = parsed.options.config
    ? resolve(process.cwd(), parsed.options.config)
    : findWorkspaceConfig(process.cwd());

  if (!workspaceConfigPath) {
    console.error("Error: No tsonic.workspace.json found");
    console.error("Run 'tsonic init' to initialize a workspace");
    return 3;
  }

  const workspaceRoot = dirname(workspaceConfigPath);

  const workspaceConfigResult = loadWorkspaceConfig(workspaceConfigPath);
  if (!workspaceConfigResult.ok) {
    console.error(`Error: ${workspaceConfigResult.error}`);
    return 1;
  }
  let rawWorkspaceConfig = workspaceConfigResult.value;

  // Add/restore commands operate on the WORKSPACE config.
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
    const typesPackage = parsed.positionals[1]; // optional: omitted => auto-generate
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
    const typesPackage = parsed.positionals[2]; // optional: omitted => auto-generate
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
    const typesPackage = parsed.positionals[1]; // optional: omitted => auto-generate
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
    const typesPackage = parsed.positionals[2]; // optional
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

  // Airplane-grade UX: projects must be clone-and-build friendly.
  // If the project declares .NET deps (NuGet/framework/DLLs), ensure bindings exist
  // before running the compiler. This keeps `tsonic build` deterministic without
  // requiring users to remember a separate restore step.
  if (
    parsed.command === "generate" ||
    parsed.command === "build" ||
    parsed.command === "run" ||
    parsed.command === "pack" ||
    parsed.command === "test"
  ) {
    const testDotnet = rawWorkspaceConfig.testDotnet ?? {};
    const includeTestDeps = parsed.command === "test";
    const hasFrameworkRefs =
      (rawWorkspaceConfig.dotnet?.frameworkReferences?.length ?? 0) > 0 ||
      (includeTestDeps
        ? (testDotnet.frameworkReferences?.length ?? 0) > 0
        : false);
    const hasPackageRefs =
      (rawWorkspaceConfig.dotnet?.packageReferences?.length ?? 0) > 0 ||
      (includeTestDeps
        ? (testDotnet.packageReferences?.length ?? 0) > 0
        : false);
    const hasDllLibs = (rawWorkspaceConfig.dotnet?.libraries ?? []).some(
      (entry) => {
        const p = typeof entry === "string" ? entry : entry.path;
        const normalized = p.replace(/\\/g, "/").toLowerCase();
        if (!normalized.endsWith(".dll")) return false;
        if (isBuiltInRuntimeDllPath(p)) return false;
        // Workspace-managed DLLs live under ./libs
        return (
          normalized.startsWith("libs/") || normalized.startsWith("./libs/")
        );
      }
    );

    if (hasFrameworkRefs || hasPackageRefs || hasDllLibs) {
      const restoreResult = restoreCommand(workspaceConfigPath, {
        verbose: parsed.options.verbose,
        quiet: parsed.options.quiet,
        deps: parsed.options.deps,
        strict: parsed.options.strict,
      });
      if (!restoreResult.ok) {
        console.error(`Error: ${restoreResult.error}`);
        return 1;
      }

      // restore may update workspace config (e.g., inferred FrameworkReferences), so reload.
      const reloaded = loadWorkspaceConfig(workspaceConfigPath);
      if (!reloaded.ok) {
        console.error(`Error: ${reloaded.error}`);
        return 1;
      }
      rawWorkspaceConfig = reloaded.value;
    }
  }

  // Resolve target project (required for build/generate/run/pack).
  const projects = listProjects(workspaceRoot);
  const resolveProjectCfgPath = (): Result<string, string> => {
    if (parsed.options.project) {
      const projectArg = parsed.options.project;
      // Allow "packages/foo" or "foo"
      const asPath =
        projectArg.includes("/") || projectArg.includes("\\")
          ? join(workspaceRoot, projectArg)
          : join(workspaceRoot, "packages", projectArg);
      const cfg = asPath.endsWith(PROJECT_CONFIG_FILE)
        ? asPath
        : join(asPath, PROJECT_CONFIG_FILE);
      if (!cfg.startsWith(workspaceRoot)) {
        return {
          ok: false,
          error: `Project must be within workspace: ${projectArg}`,
        };
      }
      if (!existsSync(cfg)) {
        return { ok: false, error: `Project config not found: ${cfg}` };
      }
      return { ok: true, value: cfg };
    }

    const nearest = findProjectConfig(process.cwd(), workspaceRoot);
    if (nearest) return { ok: true, value: nearest };

    if (projects.length === 1) {
      return { ok: true, value: join(projects[0]!, PROJECT_CONFIG_FILE) };
    }

    return {
      ok: false,
      error:
        `No project selected.\n` +
        `Run from within packages/<project>/ or pass --project <name>.`,
    };
  };

  const projectCfgPathResult = resolveProjectCfgPath();
  if (!projectCfgPathResult.ok) {
    console.error(`Error: ${projectCfgPathResult.error}`);
    return 1;
  }
  const projectConfigPath = projectCfgPathResult.value;
  const projectRoot = dirname(projectConfigPath);

  const projectConfigResult = loadProjectConfig(projectConfigPath);
  if (!projectConfigResult.ok) {
    console.error(`Error: ${projectConfigResult.error}`);
    return 1;
  }

  // Command-specific configuration resolution (e.g. `tsonic test`).
  const baseProjectConfig = projectConfigResult.value;
  const entryFile =
    parsed.command === "test"
      ? baseProjectConfig.tests?.entryPoint
      : parsed.positionals[0];

  const cliOptionsForCommand = { ...parsed.options };
  let workspaceConfigForCommand = rawWorkspaceConfig;

  if (parsed.command === "test") {
    if (!baseProjectConfig.tests) {
      console.error("Error: Project does not define tests configuration");
      console.error(`Add a 'tests' block to ${projectConfigPath} and retry.`);
      return 1;
    }

    // Test builds are MSIL (non-NativeAOT) libraries.
    cliOptionsForCommand.type = "library";
    cliOptionsForCommand.noAot = true;

    const prodDotnet = rawWorkspaceConfig.dotnet ?? {};
    const testDotnet = rawWorkspaceConfig.testDotnet ?? {};

    const mergedPackageRefs = mergeUniquePackageReferences(
      (prodDotnet.packageReferences ?? []) as readonly {
        readonly id: string;
        readonly version: string;
      }[],
      (testDotnet.packageReferences ?? []) as readonly {
        readonly id: string;
        readonly version: string;
      }[]
    );
    if (!mergedPackageRefs.ok) {
      console.error(`Error: ${mergedPackageRefs.error}`);
      return 1;
    }

    workspaceConfigForCommand = {
      ...rawWorkspaceConfig,
      dotnet: {
        ...prodDotnet,
        frameworkReferences: mergeUniqueFrameworkReferences(
          (prodDotnet.frameworkReferences ?? []) as readonly (
            | string
            | { readonly id: string }
          )[],
          (testDotnet.frameworkReferences ?? []) as readonly (
            | string
            | { readonly id: string }
          )[]
        ) as unknown as typeof prodDotnet.frameworkReferences,
        packageReferences:
          mergedPackageRefs.value as unknown as typeof prodDotnet.packageReferences,
        msbuildProperties: {
          ...(prodDotnet.msbuildProperties ?? {}),
          ...(testDotnet.msbuildProperties ?? {}),
          IsTestProject: "true",
        },
      },
    };
  }

  const resolvedConfig = resolveConfig(
    workspaceConfigForCommand,
    baseProjectConfig,
    cliOptionsForCommand,
    workspaceRoot,
    projectRoot,
    entryFile
  );

  const config =
    parsed.command === "test"
      ? (() => {
          const testsCfg = baseProjectConfig.tests!;
          const outDir =
            testsCfg.outputDirectory ??
            `${resolvedConfig.outputDirectory}-test`;
          const outName =
            testsCfg.outputName ?? `${resolvedConfig.outputName}.tests`;

          return {
            ...resolvedConfig,
            outputDirectory: outDir,
            outputName: outName,
            outputConfig: {
              ...resolvedConfig.outputConfig,
              generateDocumentation: false,
            },
          };
        })()
      : resolvedConfig;

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

    case "test": {
      const result = testCommand(config);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        return 10;
      }
      return result.value.exitCode;
    }

    default:
      console.error(`Error: Unknown command '${parsed.command}'`);
      console.error("Run 'tsonic --help' for usage information");
      return 2;
  }
};
