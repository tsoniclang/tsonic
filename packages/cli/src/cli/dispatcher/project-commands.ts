import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  findProjectConfig,
  listProjects,
  loadProjectConfig,
  loadWorkspaceConfig,
  PROJECT_CONFIG_FILE,
  resolveConfig,
} from "../../config.js";
import { buildCommand } from "../../commands/build.js";
import { generateCommand } from "../../commands/generate.js";
import { packCommand } from "../../commands/pack.js";
import { restoreCommand } from "../../commands/restore.js";
import { runCommand } from "../../commands/run.js";
import { testCommand } from "../../commands/test.js";
import { applyAikyaWorkspaceOverlay } from "../../aikya/bindings.js";
import { isBuiltInRuntimeDllPath } from "../../dotnet/runtime-dlls.js";
import type {
  ResolvedConfig,
  Result,
  TsonicWorkspaceConfig,
} from "../../types.js";
import { commandNeedsAikyaOverlay } from "./workspace-commands.js";
import type { DispatcherError, ParsedCliArgs } from "./shared.js";
import {
  mergeUniqueFrameworkReferences,
  mergeUniquePackageReferences,
} from "./shared.js";

const resolveProjectConfigPath = (
  parsed: ParsedCliArgs,
  workspaceRoot: string
): Result<string, string> => {
  const projects = listProjects(workspaceRoot);

  if (parsed.options.project) {
    const projectArg = parsed.options.project;
    const asPath =
      projectArg.includes("/") || projectArg.includes("\\")
        ? join(workspaceRoot, projectArg)
        : join(workspaceRoot, "packages", projectArg);
    const configPath = asPath.endsWith(PROJECT_CONFIG_FILE)
      ? asPath
      : join(asPath, PROJECT_CONFIG_FILE);
    if (!configPath.startsWith(workspaceRoot)) {
      return {
        ok: false,
        error: `Project must be within workspace: ${projectArg}`,
      };
    }
    if (!existsSync(configPath)) {
      return { ok: false, error: `Project config not found: ${configPath}` };
    }
    return { ok: true, value: configPath };
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

const restoreDependenciesIfNeeded = (
  parsed: ParsedCliArgs,
  workspaceConfigPath: string,
  workspaceRoot: string,
  rawWorkspaceConfig: TsonicWorkspaceConfig
): Result<TsonicWorkspaceConfig, DispatcherError> => {
  if (
    parsed.command !== "generate" &&
    parsed.command !== "build" &&
    parsed.command !== "run" &&
    parsed.command !== "pack" &&
    parsed.command !== "test"
  ) {
    return { ok: true, value: rawWorkspaceConfig };
  }

  const testDotnet = rawWorkspaceConfig.testDotnet ?? {};
  const includeTestDeps = parsed.command === "test";
  const hasFrameworkRefs =
    (rawWorkspaceConfig.dotnet?.frameworkReferences?.length ?? 0) > 0 ||
    (includeTestDeps
      ? (testDotnet.frameworkReferences?.length ?? 0) > 0
      : false);
  const hasPackageRefs =
    (rawWorkspaceConfig.dotnet?.packageReferences?.length ?? 0) > 0 ||
    (includeTestDeps ? (testDotnet.packageReferences?.length ?? 0) > 0 : false);
  const hasDllLibs = (rawWorkspaceConfig.dotnet?.libraries ?? []).some(
    (entry) => {
      const pathLike = typeof entry === "string" ? entry : entry.path;
      const normalized = pathLike.replace(/\\/g, "/").toLowerCase();
      if (!normalized.endsWith(".dll")) return false;
      if (isBuiltInRuntimeDllPath(pathLike)) return false;
      return normalized.startsWith("libs/") || normalized.startsWith("./libs/");
    }
  );

  if (!hasFrameworkRefs && !hasPackageRefs && !hasDllLibs) {
    return { ok: true, value: rawWorkspaceConfig };
  }

  const restoreResult = restoreCommand(workspaceConfigPath, {
    verbose: parsed.options.verbose,
    quiet: parsed.options.quiet,
    deps: parsed.options.deps,
    strict: parsed.options.strict,
  });
  if (!restoreResult.ok) {
    return { ok: false, error: { code: 1, error: restoreResult.error } };
  }

  const reloaded = loadWorkspaceConfig(workspaceConfigPath);
  if (!reloaded.ok) {
    return { ok: false, error: { code: 1, error: reloaded.error } };
  }

  let reloadedConfig = reloaded.value;
  if (commandNeedsAikyaOverlay(parsed.command)) {
    const overlay = applyAikyaWorkspaceOverlay(workspaceRoot, reloadedConfig);
    if (!overlay.ok) {
      return { ok: false, error: { code: 1, error: overlay.error } };
    }
    reloadedConfig = overlay.value.config;
  }

  return { ok: true, value: reloadedConfig };
};

export const resolveProjectCommandConfig = (
  parsed: ParsedCliArgs,
  workspaceConfigPath: string,
  workspaceRoot: string,
  rawWorkspaceConfig: TsonicWorkspaceConfig
): Result<ResolvedConfig, DispatcherError> => {
  const restoredWorkspace = restoreDependenciesIfNeeded(
    parsed,
    workspaceConfigPath,
    workspaceRoot,
    rawWorkspaceConfig
  );
  if (!restoredWorkspace.ok) return restoredWorkspace;

  const projectConfigPathResult = resolveProjectConfigPath(
    parsed,
    workspaceRoot
  );
  if (!projectConfigPathResult.ok) {
    return {
      ok: false,
      error: { code: 1, error: projectConfigPathResult.error },
    };
  }

  const projectConfigPath = projectConfigPathResult.value;
  const projectRoot = dirname(projectConfigPath);
  const projectConfigResult = loadProjectConfig(projectConfigPath);
  if (!projectConfigResult.ok) {
    return { ok: false, error: { code: 1, error: projectConfigResult.error } };
  }

  const baseProjectConfig = projectConfigResult.value;
  const entryFile =
    parsed.command === "test"
      ? baseProjectConfig.tests?.entryPoint
      : parsed.positionals[0];

  const cliOptionsForCommand = { ...parsed.options };
  let workspaceConfigForCommand = restoredWorkspace.value;

  if (parsed.command === "test") {
    if (!baseProjectConfig.tests) {
      return {
        ok: false,
        error: {
          code: 1,
          error:
            `Project does not define tests configuration\n` +
            `Add a 'tests' block to ${projectConfigPath} and retry.`,
        },
      };
    }

    cliOptionsForCommand.type = "library";
    cliOptionsForCommand.noAot = true;

    const prodDotnet = restoredWorkspace.value.dotnet ?? {};
    const testDotnet = restoredWorkspace.value.testDotnet ?? {};
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
      return { ok: false, error: { code: 1, error: mergedPackageRefs.error } };
    }

    workspaceConfigForCommand = {
      ...restoredWorkspace.value,
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

  if (parsed.command !== "test") {
    return { ok: true, value: resolvedConfig };
  }

  const testsConfig = baseProjectConfig.tests!;
  const outputDirectory =
    testsConfig.outputDirectory ?? `${resolvedConfig.outputDirectory}-test`;
  const outputName =
    testsConfig.outputName ?? `${resolvedConfig.outputName}.tests`;

  return {
    ok: true,
    value: {
      ...resolvedConfig,
      outputDirectory,
      outputName,
      outputConfig: {
        ...resolvedConfig.outputConfig,
        generateDocumentation: false,
      },
    },
  };
};

export const dispatchProjectCommand = (
  parsed: ParsedCliArgs,
  config: ResolvedConfig
): number => {
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
