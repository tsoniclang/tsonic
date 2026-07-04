import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { TargetDiagnostic, TargetCapabilityImplementation, TsonicPlugin, TsonicTargetPlugin } from "@tsonic/target-api";
import { getTargetIdValidationMessage, isValidTargetId } from "@tsonic/target-api";
import { readTsonicPluginManifest } from "./manifest.js";
import { createInstalledTsonicPluginRegistry } from "./registry.js";
import type { InstalledTsonicPluginRegistry } from "./registry.js";

export async function discoverInstalledTsonicPlugins(projectFilePath: string): Promise<InstalledTsonicPluginRegistry> {
  const projectDirectory = dirname(resolve(projectFilePath));
  const packageJsonPath = resolve(projectDirectory, "package.json");
  const projectPackageJson = await readJsonFile(packageJsonPath).catch((error: unknown) => {
    throw new Error(`Tsonic package discovery requires a project package.json beside or above tsonic.json. ${error instanceof Error ? error.message : String(error)}`);
  });
  const dependencyNames = readDirectDependencyNames(projectPackageJson);
  const requireFromProject = createRequire(`${packageJsonPath}`);
  const targets: TsonicTargetPlugin[] = [];
  const capabilities: TargetCapabilityImplementation[] = [];
  const diagnostics: TargetDiagnostic[] = [];
  for (const dependencyName of dependencyNames) {
    const packageJson = await readDependencyPackageJson(dependencyName, requireFromProject);
    const manifest = readTsonicPluginManifest(dependencyName, packageJson);
    if (manifest === undefined) {
      continue;
    }
    const plugin = await loadPlugin(manifest.packageName, manifest.entry, requireFromProject);
    const validation = validatePlugin(dependencyName, plugin);
    if (validation !== undefined) {
      diagnostics.push(validation);
      continue;
    }
    if (plugin.kind === "target") {
      targets.push(plugin);
    } else {
      capabilities.push(plugin);
    }
  }
  const registry = createInstalledTsonicPluginRegistry(targets, capabilities);
  return {
    ...registry,
    diagnostics: [...diagnostics, ...registry.diagnostics],
  };
}

async function readDependencyPackageJson(packageName: string, requireFromProject: NodeRequire): Promise<unknown> {
  let manifestPath: string;
  try {
    manifestPath = requireFromProject.resolve(`${packageName}/package.json`);
  } catch (error) {
    throw new Error(`Installed dependency '${packageName}' does not export package.json for Tsonic plugin discovery. ${error instanceof Error ? error.message : String(error)}`);
  }
  return readJsonFile(manifestPath);
}

async function loadPlugin(packageName: string, entry: string, requireFromProject: NodeRequire): Promise<TsonicPlugin> {
  let entryPath: string;
  try {
    entryPath = requireFromProject.resolve(entry === "." ? packageName : `${packageName}/${entry}`);
  } catch (error) {
    throw new Error(`Tsonic plugin '${packageName}' entry '${entry}' could not be resolved through the package export map. ${error instanceof Error ? error.message : String(error)}`);
  }
  const module = await import(pathToFileURL(entryPath).href) as Readonly<Record<string, unknown>>;
  const createTsonicPlugin = module.createTsonicPlugin;
  if (typeof createTsonicPlugin !== "function") {
    throw new Error(`Tsonic plugin '${packageName}' must export createTsonicPlugin().`);
  }
  try {
    return createTsonicPlugin() as TsonicPlugin;
  } catch (error) {
    throw new Error(`Tsonic plugin '${packageName}' failed during createTsonicPlugin(): ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validatePlugin(packageName: string, plugin: TsonicPlugin): TargetDiagnostic | undefined {
  if (!isRecord(plugin)) {
    return pluginDiagnostic(packageName, "Tsonic plugin factory must return an object.");
  }
  if (plugin.kind !== "target" && plugin.kind !== "target-capability") {
    return pluginDiagnostic(packageName, "Tsonic plugin kind must be 'target' or 'target-capability'.");
  }
  if (typeof plugin.id !== "string" || plugin.id.length === 0) {
    return pluginDiagnostic(packageName, "Tsonic plugin id must be a non-empty string.");
  }
  if (plugin.id !== packageName) {
    return pluginDiagnostic(packageName, `Tsonic plugin id '${plugin.id}' must match package name '${packageName}'.`);
  }
  if (typeof plugin.targetId !== "string" || !isValidTargetId(plugin.targetId)) {
    return pluginDiagnostic(packageName, getTargetIdValidationMessage(`Tsonic plugin '${packageName}' target id '${String(plugin.targetId)}'`));
  }
  if (plugin.kind === "target" && typeof plugin.createTargetPack !== "function") {
    return pluginDiagnostic(packageName, "Tsonic target plugin must provide createTargetPack().");
  }
  if (plugin.kind === "target-capability") {
    if (typeof plugin.displayName !== "string" || plugin.displayName.length === 0) {
      return pluginDiagnostic(packageName, "Tsonic target capability plugin must provide displayName.");
    }
    if (!Array.isArray(plugin.moduleOwnership) || plugin.moduleOwnership.length === 0) {
      return pluginDiagnostic(packageName, "Tsonic target capability plugin must provide non-empty moduleOwnership.");
    }
    if (typeof plugin.createExtensions !== "function") {
      return pluginDiagnostic(packageName, "Tsonic target capability plugin must provide createExtensions().");
    }
  }
  return undefined;
}

function pluginDiagnostic(packageName: string, message: string): TargetDiagnostic {
  return {
    code: "TSONIC_PLUGIN_INVALID",
    category: "error",
    source: "tsonic-host",
    message: `Tsonic plugin '${packageName}' is invalid: ${message}`,
  };
}

function readDirectDependencyNames(packageJson: unknown): readonly string[] {
  if (!isRecord(packageJson)) {
    throw new Error("Project package.json must be an object.");
  }
  const names = new Set<string>();
  for (const fieldName of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const field = packageJson[fieldName];
    if (field === undefined) {
      continue;
    }
    if (!isRecord(field)) {
      throw new Error(`Project package.json field '${fieldName}' must be an object.`);
    }
    for (const name of Object.keys(field)) {
      names.add(name);
    }
  }
  return [...names].sort();
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
