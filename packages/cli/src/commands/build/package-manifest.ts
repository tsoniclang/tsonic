import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ResolvedConfig, Result } from "../../types.js";
import { VERSION } from "../../cli/constants.js";

type ProjectPackageMetadata = {
  readonly name: string;
  readonly version: string;
};

const readProjectPackageMetadata = (
  projectRoot: string,
  outputName: string
): ProjectPackageMetadata => {
  const packageJsonPath = join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return { name: outputName, version: "0.0.0" };
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      readonly name?: unknown;
      readonly version?: unknown;
    };
    const name =
      typeof parsed.name === "string" && parsed.name.trim().length > 0
        ? parsed.name.trim()
        : outputName;
    const version =
      typeof parsed.version === "string" && parsed.version.trim().length > 0
        ? parsed.version.trim()
        : "0.0.0";
    return { name, version };
  } catch {
    return { name: outputName, version: "0.0.0" };
  }
};

export const writePackageManifest = (
  config: ResolvedConfig
): Result<void, string> => {
  const distRoot = join(config.projectRoot, "dist");
  const bindingsRoot = join(distRoot, "tsonic", "bindings");
  if (!existsSync(bindingsRoot)) {
    return {
      ok: false,
      error:
        `package manifest write failed: bindings root is missing at ${bindingsRoot}.\n` +
        `Build did not produce library bindings.`,
    };
  }

  const packageMeta = readProjectPackageMetadata(config.projectRoot, config.outputName);
  const runtimePackageId = config.outputConfig.package?.id ?? config.outputName;
  const runtimePackageVersion =
    config.outputConfig.package?.version ?? packageMeta.version;
  const manifestDir = join(distRoot, "tsonic");
  const manifestPath = join(manifestDir, "package-manifest.json");
  const facades = existsSync(join(bindingsRoot, "index.d.ts")) ? ["index.d.ts"] : [];

  const runtimeNugetPackagesRaw = [
    { id: runtimePackageId, version: runtimePackageVersion },
    ...config.packageReferences.map((pkg) => ({
      id: pkg.id,
      version: pkg.version,
    })),
  ];
  const seenRuntimeNuget = new Set<string>();
  const runtimeNugetPackages = runtimeNugetPackagesRaw
    .filter((pkg) => {
      const key = `${pkg.id.toLowerCase()}::${pkg.version}`;
      if (seenRuntimeNuget.has(key)) return false;
      seenRuntimeNuget.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        left.id.localeCompare(right.id) ||
        left.version.localeCompare(right.version)
    );

  const manifest = {
    schemaVersion: 1,
    kind: "tsonic-library",
    npmPackage: packageMeta.name,
    npmVersion: packageMeta.version,
    producer: {
      tool: "tsonic",
      version: VERSION,
      mode: "tsonic-firstparty",
    },
    runtime: {
      nugetPackages: runtimeNugetPackages,
      frameworkReferences: config.frameworkReferences,
      assemblies: [config.outputName],
      runtimePackages: [packageMeta.name],
    },
    typing: {
      bindingsRoot: "tsonic/bindings",
      facades,
    },
    dotnet: {
      frameworkReferences: config.frameworkReferences,
      packageReferences: config.packageReferences,
    },
  } as const;

  try {
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write package manifest: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
