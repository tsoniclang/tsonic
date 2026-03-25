import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TsonicWorkspaceConfig } from "../../types.js";
export {
  applyPackageManifestWorkspaceOverlay,
  discoverWorkspaceBindingsManifests,
  mergeManifestIntoWorkspaceConfig,
  resolveInstalledPackageBindingsManifest,
  type NormalizedBindingsManifest,
} from "../bindings.js";

export const buildTestTimeoutMs = 30_000;

export const writeJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
};

export const packageDir = (
  workspaceRoot: string,
  packageName: string
): string => {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    if (!scope || !name) {
      throw new Error(`Invalid scoped package name: ${packageName}`);
    }
    return join(workspaceRoot, "node_modules", scope, name);
  }
  return join(workspaceRoot, "node_modules", packageName);
};

export const writeInstalledPackage = (
  workspaceRoot: string,
  packageName: string,
  version: string,
  opts: {
    readonly bindingsManifest?: unknown;
    readonly packageManifest?: unknown;
    readonly surfaceManifest?: unknown;
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly optionalDependencies?: Readonly<Record<string, string>>;
    readonly peerDependencies?: Readonly<Record<string, string>>;
  } = {}
): string => {
  const pkgRoot = packageDir(workspaceRoot, packageName);
  mkdirSync(pkgRoot, { recursive: true });
  writeJson(join(pkgRoot, "package.json"), {
    name: packageName,
    version,
    private: true,
    type: "module",
    ...(opts.dependencies ? { dependencies: opts.dependencies } : {}),
    ...(opts.optionalDependencies
      ? { optionalDependencies: opts.optionalDependencies }
      : {}),
    ...(opts.peerDependencies
      ? { peerDependencies: opts.peerDependencies }
      : {}),
  });

  if (opts.bindingsManifest !== undefined) {
    writeJson(join(pkgRoot, "tsonic.bindings.json"), opts.bindingsManifest);
  }

  if (opts.surfaceManifest !== undefined) {
    writeJson(join(pkgRoot, "tsonic.surface.json"), opts.surfaceManifest);
  }

  if (opts.packageManifest !== undefined) {
    writeJson(
      join(pkgRoot, "tsonic.package.json"),
      opts.packageManifest
    );
  }

  return pkgRoot;
};

export const baseWorkspaceConfig = (): TsonicWorkspaceConfig => ({
  dotnetVersion: "net10.0",
  dotnet: {
    frameworkReferences: [],
    packageReferences: [],
  },
});

export const installClrSurfacePackages = (workspaceRoot: string): void => {
  writeInstalledPackage(workspaceRoot, "@tsonic/globals", "10.0.0");
  writeInstalledPackage(workspaceRoot, "@tsonic/dotnet", "10.0.0");
};
