/**
 * tsonic project init command
 */

import {
  writeFileSync,
  existsSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import type { Result } from "../types.js";

type InitOptions = {
  readonly skipTypes?: boolean;
  readonly typesVersion?: string;
  readonly nodejs?: boolean; // Enable Node.js interop
  readonly pure?: boolean; // Use PascalCase CLR naming
};

const DEFAULT_GITIGNORE = `# .NET build artifacts
generated/bin/
generated/obj/

# Optional: Uncomment to ignore generated C# files
# generated/**/*.cs

# Output executables
*.exe
app

# Dependencies
node_modules/
`;

const SAMPLE_MAIN_TS = `import { Console } from "@tsonic/dotnet/System";
import { File } from "@tsonic/dotnet/System.IO";

export function main(): void {
  Console.writeLine("Reading README.md...");
  const content = File.readAllText("./README.md");
  Console.writeLine(content);
}
`;

const SAMPLE_README = `# My Tsonic Project

This is a sample Tsonic project that demonstrates .NET interop.

## Getting Started

Build and run the project:

\`\`\`bash
npm run build
./app
\`\`\`

Or run directly:

\`\`\`bash
npm run dev
\`\`\`

## Project Structure

- \`src/main.ts\` - Entry point
- \`tsonic.json\` - Project configuration
- \`generated/\` - Generated C# code (gitignored)
`;

type TypePackageInfo = {
  readonly packages: readonly { name: string; version: string }[];
  readonly typeRoots: readonly string[];
};

// Unified CLI package version - installed as devDependency for npm run build/dev
const CLI_PACKAGE = { name: "tsonic", version: "latest" };

/**
 * Get type package info
 *
 * typeRoots: Only ambient globals packages (provide global types without imports)
 * packages: All type packages to install (includes explicit import packages)
 *
 * Package structure:
 * - @tsonic/core: Core types (int, float, etc.) - imported as @tsonic/core/types.js
 * - @tsonic/globals depends on @tsonic/dotnet (camelCase BCL methods)
 * - @tsonic/globals-pure depends on @tsonic/dotnet-pure (PascalCase CLR naming)
 * - @tsonic/nodejs has @tsonic/dotnet as peerDependency (uses whichever globals provides)
 */
export const getTypePackageInfo = (
  nodejs: boolean = false,
  pure: boolean = false
): TypePackageInfo => {
  // Core package is always included (provides int, float, etc.)
  const corePackage = { name: "@tsonic/core", version: "latest" };

  // - @tsonic/cli: the compiler CLI (provides `tsonic` command)
  // - @tsonic/core: core types (int, float, etc.) - explicit import
  // - @tsonic/globals[-pure]: base types + BCL methods (transitive @tsonic/dotnet[-pure]) - needs typeRoots
  // - @tsonic/nodejs: Node.js interop (peerDep on @tsonic/dotnet, satisfied by globals)
  const globalsPackage = pure ? "@tsonic/globals-pure" : "@tsonic/globals";
  const packages = [
    CLI_PACKAGE,
    corePackage,
    { name: globalsPackage, version: "latest" },
  ];
  if (nodejs) {
    packages.push({ name: "@tsonic/nodejs", version: "latest" });
  }
  return {
    packages,
    typeRoots: [`node_modules/${globalsPackage}`],
  };
};

/**
 * Find the CLI package runtime directory containing DLLs
 */
const findRuntimeDir = (): string | null => {
  // Try to find runtime directory bundled with CLI package
  // import.meta.dirname is the dist/commands directory when running from built CLI
  // Or src/commands when running from source
  const possiblePaths = [
    // Development: From dist/commands -> ../../runtime
    join(dirname(import.meta.url.replace("file://", "")), "../../runtime"),
    // npm installed: From dist/commands -> ../runtime (inside @tsonic/cli package)
    join(dirname(import.meta.url.replace("file://", "")), "../runtime"),
    // From project's node_modules (when CLI is a dev dependency)
    join(process.cwd(), "node_modules/@tsonic/cli/runtime"),
    // Monorepo structure
    join(process.cwd(), "packages/cli/runtime"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
};

/**
 * Copy runtime DLLs to project's lib/ directory
 * - Tsonic.Runtime.dll: Always copied (core runtime)
 * - nodejs.dll: Copied if --nodejs flag is used
 */
const copyRuntimeDlls = (
  cwd: string,
  includeNodejs: boolean
): Result<readonly string[], string> => {
  const runtimeDir = findRuntimeDir();
  if (!runtimeDir) {
    return {
      ok: false,
      error: "Runtime directory not found. Make sure tsonic is installed.",
    };
  }

  const libDir = join(cwd, "lib");
  mkdirSync(libDir, { recursive: true });

  const copiedPaths: string[] = [];

  // Always copy Tsonic.Runtime.dll
  const runtimeDll = join(runtimeDir, "Tsonic.Runtime.dll");
  if (existsSync(runtimeDll)) {
    copyFileSync(runtimeDll, join(libDir, "Tsonic.Runtime.dll"));
    copiedPaths.push("lib/Tsonic.Runtime.dll");
  } else {
    return {
      ok: false,
      error: "Tsonic.Runtime.dll not found in runtime directory.",
    };
  }

  // Copy nodejs.dll if requested
  if (includeNodejs) {
    const nodejsDll = join(runtimeDir, "nodejs.dll");
    if (existsSync(nodejsDll)) {
      copyFileSync(nodejsDll, join(libDir, "nodejs.dll"));
      copiedPaths.push("lib/nodejs.dll");
    } else {
      console.log("⚠ Warning: nodejs.dll not found in runtime directory.");
    }
  }

  return { ok: true, value: copiedPaths };
};

/**
 * Generate tsonic.json config
 */
const generateConfig = (
  includeTypeRoots: boolean,
  libraryPaths: readonly string[] = [],
  pure: boolean = false
): string => {
  const config: Record<string, unknown> = {
    $schema: "https://tsonic.dev/schema/v1.json",
    rootNamespace: "MyApp",
    entryPoint: "src/App.ts",
    sourceRoot: "src",
    outputDirectory: "generated",
    outputName: "app",
    optimize: "speed",
    buildOptions: {
      stripSymbols: true,
      invariantGlobalization: true,
    },
  };

  if (includeTypeRoots || libraryPaths.length > 0) {
    const typeInfo = getTypePackageInfo(false, pure);
    const dotnet: Record<string, unknown> = {};

    if (includeTypeRoots) {
      dotnet.typeRoots = typeInfo.typeRoots;
    }

    if (libraryPaths.length > 0) {
      dotnet.libraries = [...libraryPaths];
    }

    config.dotnet = dotnet;
  }

  return JSON.stringify(config, null, 2) + "\n";
};

/**
 * Create or update package.json with scripts and metadata
 */
const createOrUpdatePackageJson = (packageJsonPath: string): void => {
  let packageJson: Record<string, unknown>;

  if (existsSync(packageJsonPath)) {
    // Merge with existing package.json
    const existing = readFileSync(packageJsonPath, "utf-8");
    packageJson = JSON.parse(existing);

    // Ensure required fields exist
    if (!packageJson.name) {
      packageJson.name = "my-tsonic-app";
    }
    if (!packageJson.version) {
      packageJson.version = "1.0.0";
    }
    if (!packageJson.type) {
      packageJson.type = "module";
    }

    // Merge scripts
    const existingScripts =
      (packageJson.scripts as Record<string, string>) || {};
    packageJson.scripts = {
      ...existingScripts,
      build: "tsonic build src/App.ts",
      dev: "tsonic run src/App.ts",
    };

    // Ensure devDependencies exists
    if (!packageJson.devDependencies) {
      packageJson.devDependencies = {};
    }
  } else {
    // Create new package.json
    packageJson = {
      name: "my-tsonic-app",
      version: "1.0.0",
      type: "module",
      scripts: {
        build: "tsonic build src/App.ts",
        dev: "tsonic run src/App.ts",
      },
      devDependencies: {},
    };
  }

  writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n",
    "utf-8"
  );
};

/**
 * Install npm package
 */
const installPackage = (
  packageName: string,
  version: string
): Result<void, string> => {
  const result = spawnSync(
    "npm",
    ["install", "--save-dev", `${packageName}@${version}`],
    {
      stdio: "inherit",
      encoding: "utf-8",
    }
  );

  if (result.status !== 0) {
    return {
      ok: false,
      error: `Failed to install ${packageName}@${version}`,
    };
  }

  return { ok: true, value: undefined };
};

/**
 * Initialize a new Tsonic project
 */
export const initProject = (
  cwd: string,
  options: InitOptions = {}
): Result<void, string> => {
  const tsonicJsonPath = join(cwd, "tsonic.json");
  const gitignorePath = join(cwd, ".gitignore");
  const srcDir = join(cwd, "src");
  const appTsPath = join(srcDir, "App.ts");
  const readmePath = join(cwd, "README.md");
  const packageJsonPath = join(cwd, "package.json");

  // Check if tsonic.json already exists
  if (existsSync(tsonicJsonPath)) {
    return {
      ok: false,
      error: "tsonic.json already exists. Project is already initialized.",
    };
  }

  try {
    // Create or update package.json FIRST (before npm install)
    const packageJsonExists = existsSync(packageJsonPath);
    createOrUpdatePackageJson(packageJsonPath);
    console.log(
      packageJsonExists ? "✓ Updated package.json" : "✓ Created package.json"
    );

    // Install type declarations
    const shouldInstallTypes = !options.skipTypes;
    const nodejs = options.nodejs ?? false;
    const pure = options.pure ?? false;
    const typeInfo = getTypePackageInfo(nodejs, pure);

    if (shouldInstallTypes) {
      for (const pkg of typeInfo.packages) {
        const version = options.typesVersion ?? pkg.version;
        console.log(`Installing type declarations (${pkg.name}@${version})...`);
        const installResult = installPackage(pkg.name, version);
        if (!installResult.ok) {
          return installResult;
        }
        console.log(`✓ Installed ${pkg.name}`);
      }
    }

    // Copy runtime DLLs to lib/ directory
    // This includes Tsonic.Runtime.dll (always), nodejs.dll (if --nodejs)
    // Note: These are NOT added to dotnet.libraries - findRuntimeDlls in generate.ts looks in lib/ first
    console.log("Copying runtime DLLs to lib/...");
    const copyResult = copyRuntimeDlls(cwd, nodejs);
    if (!copyResult.ok) {
      // Log warning but continue - user can add manually later
      console.log(`⚠ Warning: ${copyResult.error}`);
    } else {
      for (const path of copyResult.value) {
        console.log(`✓ Copied ${path.split("/").pop()}`);
      }
    }

    // Create tsonic.json
    // Note: Runtime DLLs in lib/ are found automatically by generate command
    const config = generateConfig(shouldInstallTypes, [], pure);
    writeFileSync(tsonicJsonPath, config, "utf-8");
    console.log("✓ Created tsonic.json");

    // Create or append to .gitignore
    if (existsSync(gitignorePath)) {
      const existing = readFileSync(gitignorePath, "utf-8");
      if (!existing.includes("generated/")) {
        writeFileSync(
          gitignorePath,
          existing + "\n" + DEFAULT_GITIGNORE,
          "utf-8"
        );
        console.log("✓ Updated .gitignore");
      }
    } else {
      writeFileSync(gitignorePath, DEFAULT_GITIGNORE, "utf-8");
      console.log("✓ Created .gitignore");
    }

    // Create src directory and App.ts
    if (!existsSync(srcDir)) {
      mkdirSync(srcDir, { recursive: true });
    }
    if (!existsSync(appTsPath)) {
      writeFileSync(appTsPath, SAMPLE_MAIN_TS, "utf-8");
      console.log("✓ Created src/App.ts");
    }

    // Create README.md
    if (!existsSync(readmePath)) {
      writeFileSync(readmePath, SAMPLE_README, "utf-8");
      console.log("✓ Created README.md");
    }

    // Note: .csproj is generated by the build command with proper runtime DLL references

    console.log("\n✓ Project initialized successfully!");
    console.log("\nNext steps:");
    console.log("  npm run build   # Build executable");
    console.log("  npm run dev     # Run directly");

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to initialize project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
