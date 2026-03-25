/**
 * tsonic init - initialize a mandatory Tsonic workspace.
 *
 * Workspace layout (airplane-grade, deterministic):
 *   tsonic.workspace.json
 *   libs/
 *   packages/<workspaceName>/
 *     tsonic.json
 *     package.json
 *     src/App.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { applyPackageManifestWorkspaceOverlay } from "../package-manifests/bindings.js";
import {
  hasResolvedSurfaceProfile,
  resolveSurfaceCapabilities,
} from "../surface/profiles.js";
import type {
  Result,
  SurfaceMode,
  TsonicProjectConfig,
  TsonicWorkspaceConfig,
} from "../types.js";

type InitOptions = {
  readonly skipTypes?: boolean;
  readonly typesVersion?: string;
  readonly surface?: SurfaceMode;
};

type TypePackageInfo = {
  readonly packages: readonly { name: string; version: string }[];
  readonly typeRoots: readonly string[];
};

const readExistingPackageSpecs = (
  workspaceRoot: string | undefined
): ReadonlyMap<string, string> => {
  if (!workspaceRoot) return new Map<string, string>();

  const packageJsonPath = join(workspaceRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return new Map<string, string>();
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      readonly dependencies?: Record<string, unknown>;
      readonly devDependencies?: Record<string, unknown>;
      readonly optionalDependencies?: Record<string, unknown>;
      readonly peerDependencies?: Record<string, unknown>;
    };

    const specs = new Map<string, string>();
    for (const bucket of [
      parsed.dependencies,
      parsed.devDependencies,
      parsed.optionalDependencies,
      parsed.peerDependencies,
    ]) {
      if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) {
        continue;
      }
      for (const [name, version] of Object.entries(bucket)) {
        if (typeof version === "string" && version.trim().length > 0) {
          specs.set(name, version.trim());
        }
      }
    }
    return specs;
  } catch {
    return new Map<string, string>();
  }
};

// Unified CLI package version - installed as devDependency for npm scripts.
const CLI_PACKAGE = { name: "tsonic", version: "latest" };

export const getTypePackageInfo = (
  options: {
    readonly surface?: SurfaceMode;
    readonly workspaceRoot?: string;
  } = {}
): TypePackageInfo => {
  const surface = options.surface ?? "clr";
  const existingPackageSpecs = readExistingPackageSpecs(options.workspaceRoot);
  const resolveVersion = (name: string, fallback: string): string =>
    existingPackageSpecs.get(name) ?? fallback;
  const packages = [CLI_PACKAGE];

  if (surface !== "clr") {
    packages.push({
      name: surface,
      version: resolveVersion(surface, "latest"),
    });
  }

  const surfaceCapabilities = resolveSurfaceCapabilities(surface, {
    workspaceRoot: options.workspaceRoot,
  });

  for (const pkgName of surfaceCapabilities.requiredNpmPackages) {
    packages.push({
      name: pkgName,
      version: resolveVersion(pkgName, "latest"),
    });
  }

  const uniquePackages: { name: string; version: string }[] = [];
  const seen = new Set<string>();
  for (const pkg of packages) {
    if (seen.has(pkg.name)) continue;
    seen.add(pkg.name);
    uniquePackages.push({
      name: pkg.name,
      version: resolveVersion(pkg.name, pkg.version),
    });
  }

  return {
    packages: uniquePackages,
    typeRoots: surfaceCapabilities.requiredTypeRoots,
  };
};

const DEFAULT_ROOT_GITIGNORE = `# .NET build artifacts (per-project)
packages/*/generated/bin/
packages/*/generated/obj/

# Optional: Uncomment to ignore generated C# files
# packages/*/generated/**/*.cs

# Output executables
packages/*/out/
packages/*/*.exe

# Dependencies
node_modules/

# Internal tooling artifacts (restore scratch, caches)
.tsonic/
`;

const SAMPLE_MAIN_TS = `import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello from Tsonic!");
}
`;

const SAMPLE_MAIN_TS_JS = `export function main(): void {
  const message = "  Hello from Tsonic JS surface!  ".trim();
  console.log(message);
}
`;

const SAMPLE_PROJECT_README = `# Package

This package is authored for Tsonic.
`;

const writeSourcePackageManifest = (
  projectRoot: string,
  surface: SurfaceMode,
  entryPoint: string
): void => {
  writeFileSync(
    join(projectRoot, "tsonic.package.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: "tsonic-source-package",
        surfaces: [surface],
        source: {
          exports: {
            ".": `./${entryPoint}`,
          },
        },
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
};

const createOrUpdateRootPackageJson = (workspaceRoot: string): void => {
  const packageJsonPath = join(workspaceRoot, "package.json");
  const workspaceName = basename(workspaceRoot);

  let pkg: Record<string, unknown>;
  if (existsSync(packageJsonPath)) {
    pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as Record<
      string,
      unknown
    >;
  } else {
    pkg = {
      name: workspaceName,
      private: true,
      version: "1.0.0",
      type: "module",
    };
  }

  pkg.workspaces = ["packages/*"];

  const scripts = (pkg.scripts as Record<string, string>) ?? {};
  pkg.scripts = {
    ...scripts,
    build: "tsonic build",
    dev: "tsonic run",
  };

  pkg.devDependencies = (pkg.devDependencies as Record<string, string>) ?? {};

  writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
};

const writeWorkspaceConfig = (
  workspaceRoot: string,
  config: TsonicWorkspaceConfig
): void => {
  writeFileSync(
    join(workspaceRoot, "tsonic.workspace.json"),
    JSON.stringify(config, null, 2) + "\n",
    "utf-8"
  );
};

const writeProjectConfig = (
  projectRoot: string,
  config: TsonicProjectConfig
): void => {
  writeFileSync(
    join(projectRoot, "tsonic.json"),
    JSON.stringify(config, null, 2) + "\n",
    "utf-8"
  );
};

const npmInstallDev = (
  workspaceRoot: string,
  spec: string
): Result<void, string> => {
  const result = spawnSync(
    "npm",
    [
      "install",
      "--save-dev",
      spec,
      "--no-fund",
      "--no-audit",
    ],
    {
      cwd: workspaceRoot,
      stdio: "inherit",
      encoding: "utf-8",
    }
  );
  if (result.status !== 0) {
    return { ok: false, error: `npm install failed: ${spec}` };
  }
  return { ok: true, value: undefined };
};

export const initWorkspace = (
  workspaceRoot: string,
  options: InitOptions = {}
): Result<void, string> => {
  const surface = options.surface ?? "clr";

  const workspaceConfigPath = join(workspaceRoot, "tsonic.workspace.json");
  if (existsSync(workspaceConfigPath)) {
    return {
      ok: false,
      error:
        "tsonic.workspace.json already exists. Workspace is already initialized.",
    };
  }

  const name = basename(workspaceRoot);
  const packagesDir = join(workspaceRoot, "packages");
  const libsDir = join(workspaceRoot, "libs");
  const projectRoot = join(packagesDir, name);

  try {
    mkdirSync(packagesDir, { recursive: true });
    mkdirSync(libsDir, { recursive: true });
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(join(projectRoot, "src"), { recursive: true });

    // Root package.json (npm workspaces)
    createOrUpdateRootPackageJson(workspaceRoot);

    // Workspace config (deps live here)
    const typeInfo = getTypePackageInfo({ surface, workspaceRoot });

    let workspaceConfig: TsonicWorkspaceConfig = {
      $schema: "https://tsonic.org/schema/workspace/v1.json",
      dotnetVersion: "net10.0",
      surface,
      dotnet: {
        typeRoots: typeInfo.typeRoots,
        libraries: [],
        frameworkReferences: [],
        packageReferences: [],
      },
    };

    // Install type declarations at workspace root
    const shouldInstallTypes = options.skipTypes !== true;
    const installedPackageNames = new Set<string>();

    if (shouldInstallTypes) {
      for (const pkg of typeInfo.packages) {
        const version = options.typesVersion ?? pkg.version;
        const r = npmInstallDev(workspaceRoot, `${pkg.name}@${version}`);
        if (!r.ok) return r;
        installedPackageNames.add(pkg.name);
      }
    }

    let surfaceCapabilities = resolveSurfaceCapabilities(surface, {
      workspaceRoot,
    });

    if (
      surface !== "clr" &&
      !hasResolvedSurfaceProfile(surface, { workspaceRoot })
    ) {
      return {
        ok: false,
        error:
          `Surface '${surface}' is not a valid ambient surface package.\n` +
          `Custom surfaces must provide tsonic.surface.json. Use '@tsonic/js' for JS ambient APIs, and add normal packages (for example '@tsonic/nodejs') separately.`,
      };
    }

    if (shouldInstallTypes) {
      for (const pkgName of surfaceCapabilities.requiredNpmPackages) {
        if (installedPackageNames.has(pkgName)) continue;
        const version = options.typesVersion ?? "latest";
        const r = npmInstallDev(workspaceRoot, `${pkgName}@${version}`);
        if (!r.ok) return r;
        installedPackageNames.add(pkgName);
      }

      surfaceCapabilities = resolveSurfaceCapabilities(surface, {
        workspaceRoot,
      });
    }

    workspaceConfig = {
      ...workspaceConfig,
      dotnet: {
        ...(workspaceConfig.dotnet ?? {}),
        typeRoots: surfaceCapabilities.requiredTypeRoots,
      },
    };

    if (shouldInstallTypes) {
      const overlayResult = applyPackageManifestWorkspaceOverlay(
        workspaceRoot,
        workspaceConfig
      );
      if (!overlayResult.ok) return overlayResult;
      workspaceConfig = overlayResult.value.config;
    }

    writeWorkspaceConfig(workspaceRoot, workspaceConfig);

    // Project package.json (minimal)
    const projectPkgJson = join(projectRoot, "package.json");
    if (!existsSync(projectPkgJson)) {
      writeFileSync(
        projectPkgJson,
        JSON.stringify(
          {
            name,
            version: "1.0.0",
            type: "module",
            files: ["src", "tsonic.package.json", "README.md"],
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
    }

    // Project config
    writeProjectConfig(projectRoot, {
      $schema: "https://tsonic.org/schema/v1.json",
      rootNamespace: "MyApp",
      entryPoint: "src/App.ts",
      sourceRoot: "src",
      outputDirectory: "generated",
      outputName: name,
      output: { type: "executable" },
    });

    writeSourcePackageManifest(projectRoot, surface, "src/App.ts");

    // Sample source
    const appTsPath = join(projectRoot, "src", "App.ts");
    if (!existsSync(appTsPath)) {
      writeFileSync(
        appTsPath,
        surface === "clr" ? SAMPLE_MAIN_TS : SAMPLE_MAIN_TS_JS,
        "utf-8"
      );
    }

    const projectReadmePath = join(projectRoot, "README.md");
    if (!existsSync(projectReadmePath)) {
      writeFileSync(projectReadmePath, SAMPLE_PROJECT_README, "utf-8");
    }

    // Root .gitignore
    const gitignorePath = join(workspaceRoot, ".gitignore");
    if (existsSync(gitignorePath)) {
      const existing = readFileSync(gitignorePath, "utf-8");
      if (!existing.includes("packages/*/generated/")) {
        writeFileSync(
          gitignorePath,
          existing + "\n" + DEFAULT_ROOT_GITIGNORE,
          "utf-8"
        );
      }
    } else {
      writeFileSync(gitignorePath, DEFAULT_ROOT_GITIGNORE, "utf-8");
    }

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to initialize workspace: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
