import { dirname } from "node:path";
import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
} from "../../types.js";
import { applyAikyaWorkspaceOverlay } from "../../aikya/bindings.js";
import { loadWorkspaceConfig } from "../../config.js";
import { resolveNugetConfigFile } from "../../dotnet/nuget-config.js";
import {
  listDotnetRuntimes,
  resolvePackageRoot,
  resolveTsbindgenDllPath,
  type AddCommandOptions,
} from "../add-common.js";
import { restoreDllBindings } from "./dll-bindings.js";
import { generateFrameworkBindings } from "./framework-bindings.js";
import { restoreNugetBindings } from "./nuget-bindings.js";
import {
  mergeFrameworkReferences,
  mergePackageReferences,
} from "./reference-merge.js";

export type RestoreOptions = AddCommandOptions;

export const restoreCommand = (
  configPath: string,
  options: RestoreOptions = {}
): Result<void, string> => {
  const configResult = loadWorkspaceConfig(configPath);
  if (!configResult.ok) return configResult;

  const workspaceRoot = dirname(configPath);
  const nugetConfigResult = resolveNugetConfigFile(workspaceRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;

  const overlay = applyAikyaWorkspaceOverlay(workspaceRoot, configResult.value);
  if (!overlay.ok) return overlay;
  const config = overlay.value.config;

  const tsbindgenDllResult = resolveTsbindgenDllPath(workspaceRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;
  const runtimesResult = listDotnetRuntimes(workspaceRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const dotnetRoot = resolvePackageRoot(workspaceRoot, "@tsonic/dotnet");
  if (!dotnetRoot.ok) return dotnetRoot;

  const dotnet = config.dotnet ?? {};
  const testDotnet = config.testDotnet ?? {};

  const frameworkReferencesResult = mergeFrameworkReferences(
    (dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[],
    (testDotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]
  );
  if (!frameworkReferencesResult.ok) return frameworkReferencesResult;

  const packageReferencesResult = mergePackageReferences(
    (dotnet.packageReferences ?? []) as PackageReferenceConfig[],
    (testDotnet.packageReferences ?? []) as PackageReferenceConfig[]
  );
  if (!packageReferencesResult.ok) return packageReferencesResult;

  const frameworkBindingsResult = generateFrameworkBindings({
    frameworkReferences: frameworkReferencesResult.value,
    runtimes: runtimesResult.value,
    workspaceRoot,
    dotnetLib: dotnetRoot.value,
    tsbindgenDll: tsbindgenDllResult.value,
    options,
  });
  if (!frameworkBindingsResult.ok) return frameworkBindingsResult;

  const nugetBindingsResult = restoreNugetBindings({
    workspaceRoot,
    targetFramework: config.dotnetVersion,
    nugetConfigFile: nugetConfigResult.value,
    packageReferencesAll: packageReferencesResult.value,
    runtimes: runtimesResult.value,
    dotnetLib: dotnetRoot.value,
    tsbindgenDll: tsbindgenDllResult.value,
    options,
  });
  if (!nugetBindingsResult.ok) return nugetBindingsResult;

  return restoreDllBindings({
    configPath,
    config,
    workspaceRoot,
    dotnet,
    runtimes: runtimesResult.value,
    dotnetLib: dotnetRoot.value,
    tsbindgenDll: tsbindgenDllResult.value,
    options,
  });
};
