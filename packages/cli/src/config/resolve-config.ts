import { dirname, resolve } from "node:path";
import { detectRid } from "@tsonic/backend";
import type { OutputType } from "@tsonic/backend";
import type {
  CliOptions,
  FrameworkReferenceConfig,
  LibraryReferenceConfig,
  PackageReferenceConfig,
  ResolvedConfig,
  SurfaceMode,
  TsonicOutputConfig,
  TsonicProjectConfig,
  TsonicWorkspaceConfig,
} from "../types.js";
import { resolveSurfaceCapabilities } from "../surface/profiles.js";

const resolveOutputConfig = (
  projectConfig: TsonicProjectConfig,
  workspaceConfig: TsonicWorkspaceConfig,
  cliOptions: CliOptions,
  entryPoint: string | undefined
): TsonicOutputConfig => {
  const configOutput = projectConfig.output ?? {};
  const autoDetectOutputType = (entry: string | undefined): OutputType =>
    entry ? "executable" : "library";

  const outputType =
    cliOptions.type ?? configOutput.type ?? autoDetectOutputType(entryPoint);
  const baseConfig: TsonicOutputConfig = {
    type: outputType,
    name: configOutput.name ?? projectConfig.outputName,
  };

  if (outputType === "executable") {
    return {
      ...baseConfig,
      nativeAot: cliOptions.noAot ? false : (configOutput.nativeAot ?? true),
      singleFile: cliOptions.singleFile ?? configOutput.singleFile ?? true,
      trimmed: configOutput.trimmed ?? true,
      stripSymbols: cliOptions.noStrip
        ? false
        : (configOutput.stripSymbols ??
          projectConfig.buildOptions?.stripSymbols ??
          workspaceConfig.buildOptions?.stripSymbols ??
          true),
      optimization:
        cliOptions.optimize ??
        projectConfig.optimize ??
        workspaceConfig.optimize ??
        configOutput.optimization ??
        "speed",
      invariantGlobalization:
        configOutput.invariantGlobalization ??
        projectConfig.buildOptions?.invariantGlobalization ??
        workspaceConfig.buildOptions?.invariantGlobalization ??
        true,
      selfContained:
        cliOptions.selfContained ?? configOutput.selfContained ?? true,
    };
  }

  if (outputType === "library") {
    return {
      ...baseConfig,
      targetFrameworks: configOutput.targetFrameworks ?? [
        workspaceConfig.dotnetVersion,
      ],
      libraryPackaging: configOutput.libraryPackaging,
      nativeAot: cliOptions.noAot ? false : (configOutput.nativeAot ?? false),
      nativeLib: configOutput.nativeLib ?? "shared",
      generateDocumentation:
        cliOptions.generateDocs ?? configOutput.generateDocumentation ?? true,
      includeSymbols:
        cliOptions.includeSymbols ?? configOutput.includeSymbols ?? true,
      packable: cliOptions.pack ?? configOutput.packable ?? false,
      package: configOutput.package,
    };
  }

  if (outputType === "console-app") {
    return {
      ...baseConfig,
      targetFramework:
        cliOptions.targetFramework ??
        configOutput.targetFramework ??
        workspaceConfig.dotnetVersion,
      singleFile: cliOptions.singleFile ?? configOutput.singleFile ?? true,
      selfContained:
        cliOptions.selfContained ?? configOutput.selfContained ?? true,
    };
  }

  return baseConfig;
};

export const resolveConfig = (
  workspaceConfig: TsonicWorkspaceConfig,
  projectConfig: TsonicProjectConfig,
  cliOptions: CliOptions,
  workspaceRoot: string,
  projectRoot: string,
  entryFile?: string
): ResolvedConfig => {
  const surface: SurfaceMode = workspaceConfig.surface ?? "clr";
  const surfaceCapabilities = resolveSurfaceCapabilities(surface, {
    workspaceRoot,
  });
  const entryPoint = entryFile ?? projectConfig.entryPoint;
  const sourceRoot =
    cliOptions.src ??
    projectConfig.sourceRoot ??
    (entryPoint ? dirname(entryPoint) : "src");

  const configuredTypeRoots = workspaceConfig.dotnet?.typeRoots;
  const baseTypeRoots =
    configuredTypeRoots ?? surfaceCapabilities.requiredTypeRoots;
  const typeRoots = Array.from(
    new Set<string>([
      ...baseTypeRoots,
      ...surfaceCapabilities.requiredTypeRoots,
    ])
  );

  const configLibraries = (workspaceConfig.dotnet?.libraries ?? []).map(
    (entry: LibraryReferenceConfig) =>
      typeof entry === "string" ? entry : entry.path
  );
  const projectLibraries = (projectConfig.references?.libraries ?? []).map(
    (entry) => resolve(projectRoot, entry)
  );
  const cliLibraries = cliOptions.lib ?? [];
  const rawFrameworkReferences = (workspaceConfig.dotnet?.frameworkReferences ??
    []) as readonly FrameworkReferenceConfig[];
  const packageReferences = (
    (workspaceConfig.dotnet?.packageReferences ??
      []) as readonly PackageReferenceConfig[]
  ).map((pkg) => ({ id: pkg.id, version: pkg.version }));

  return {
    workspaceRoot,
    rootNamespace: cliOptions.namespace ?? projectConfig.rootNamespace,
    entryPoint,
    projectRoot,
    sourceRoot,
    outputDirectory: projectConfig.outputDirectory ?? "generated",
    outputName: cliOptions.out ?? projectConfig.outputName ?? "app",
    rid: cliOptions.rid ?? workspaceConfig.rid ?? detectRid(),
    dotnetVersion: workspaceConfig.dotnetVersion,
    surface,
    optimize:
      cliOptions.optimize ??
      projectConfig.optimize ??
      workspaceConfig.optimize ??
      projectConfig.output?.optimization ??
      "speed",
    outputConfig: resolveOutputConfig(
      projectConfig,
      workspaceConfig,
      cliOptions,
      entryPoint
    ),
    stripSymbols: cliOptions.noStrip
      ? false
      : (projectConfig.output?.stripSymbols ??
        projectConfig.buildOptions?.stripSymbols ??
        workspaceConfig.buildOptions?.stripSymbols ??
        true),
    invariantGlobalization:
      projectConfig.output?.invariantGlobalization ??
      projectConfig.buildOptions?.invariantGlobalization ??
      workspaceConfig.buildOptions?.invariantGlobalization ??
      true,
    keepTemp: cliOptions.keepTemp ?? false,
    noGenerate: cliOptions.noGenerate ?? false,
    verbose: cliOptions.verbose ?? false,
    quiet: cliOptions.quiet ?? false,
    typeRoots,
    libraries: [...configLibraries, ...projectLibraries, ...cliLibraries],
    frameworkReferences: rawFrameworkReferences.map((entry) =>
      typeof entry === "string" ? entry : entry.id
    ),
    packageReferences,
    msbuildProperties: workspaceConfig.dotnet?.msbuildProperties,
  };
};
