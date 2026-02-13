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

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import type {
  Result,
  TsonicProjectConfig,
  TsonicWorkspaceConfig,
} from "../types.js";

type InitOptions = {
  readonly skipTypes?: boolean;
  readonly typesVersion?: string;
};

type TypePackageInfo = {
  readonly packages: readonly { name: string; version: string }[];
  readonly typeRoots: readonly string[];
};

// Unified CLI package version - installed as devDependency for npm scripts.
const CLI_PACKAGE = { name: "tsonic", version: "latest" };

export const getTypePackageInfo = (
  _options: Record<string, never> = {}
): TypePackageInfo => {
  const packages = [
    CLI_PACKAGE,
    { name: "@tsonic/core", version: "latest" },
    { name: "@tsonic/globals", version: "latest" },
  ];

  return {
    packages,
    typeRoots: ["node_modules/@tsonic/globals"],
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
import { File } from "@tsonic/dotnet/System.IO.js";

export function main(): void {
  Console.WriteLine("Reading README.md...");
  const content = File.ReadAllText("./README.md");
  Console.WriteLine(content);
}
`;

const createOrUpdateRootPackageJson = (workspaceRoot: string): void => {
  const packageJsonPath = join(workspaceRoot, "package.json");
  const workspaceName = basename(workspaceRoot);

  let pkg: Record<string, unknown>;
  if (existsSync(packageJsonPath)) {
    pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as Record<string, unknown>;
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

const writeProjectConfig = (projectRoot: string, config: TsonicProjectConfig): void => {
  writeFileSync(
    join(projectRoot, "tsonic.json"),
    JSON.stringify(config, null, 2) + "\n",
    "utf-8"
  );
};

const npmInstallDev = (workspaceRoot: string, spec: string): Result<void, string> => {
  const result = spawnSync("npm", ["install", "--save-dev", spec, "--no-fund", "--no-audit"], {
    cwd: workspaceRoot,
    stdio: "inherit",
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    return { ok: false, error: `npm install failed: ${spec}` };
  }
  return { ok: true, value: undefined };
};

export const initWorkspace = (
  workspaceRoot: string,
  options: InitOptions = {}
): Result<void, string> => {
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
    let workspaceConfig: TsonicWorkspaceConfig = {
      $schema: "https://tsonic.org/schema/workspace/v1.json",
      dotnetVersion: "net10.0",
      dotnet: {
        typeRoots: ["node_modules/@tsonic/globals"],
        libraries: [],
        frameworkReferences: [],
        packageReferences: [],
      },
    };

    // Install type declarations at workspace root
    const shouldInstallTypes = options.skipTypes !== true;

    if (shouldInstallTypes) {
      const typeInfo = getTypePackageInfo();
      for (const pkg of typeInfo.packages) {
        const version = options.typesVersion ?? pkg.version;
        const r = npmInstallDev(workspaceRoot, `${pkg.name}@${version}`);
        if (!r.ok) return r;
      }
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
            private: true,
            version: "1.0.0",
            type: "module",
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

    // Sample source
    const appTsPath = join(projectRoot, "src", "App.ts");
    if (!existsSync(appTsPath)) {
      writeFileSync(appTsPath, SAMPLE_MAIN_TS, "utf-8");
    }

    // Root .gitignore
    const gitignorePath = join(workspaceRoot, ".gitignore");
    if (existsSync(gitignorePath)) {
      const existing = readFileSync(gitignorePath, "utf-8");
      if (!existing.includes("packages/*/generated/")) {
        writeFileSync(gitignorePath, existing + "\n" + DEFAULT_ROOT_GITIGNORE, "utf-8");
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
