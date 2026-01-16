/**
 * tsonic project init command
 */

import {
  writeFileSync,
  existsSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Result } from "../types.js";
import { copyRuntimeDllsToProjectLib } from "../dotnet/runtime-assets.js";

type InitOptions = {
  readonly skipTypes?: boolean;
  readonly typesVersion?: string;
  readonly js?: boolean; // Enable JSRuntime interop
  readonly nodejs?: boolean; // Enable Node.js interop
  readonly pure?: boolean; // Use PascalCase .NET bindings
};

const DEFAULT_GITIGNORE = `# .NET build artifacts
generated/bin/
generated/obj/

# Optional: Uncomment to ignore generated C# files
# generated/**/*.cs

# Output executables
out/
*.exe

# Dependencies
node_modules/

# Internal tooling artifacts (restore scratch, caches)
.tsonic/
`;

const SAMPLE_MAIN_TS = `import { Console } from "@tsonic/dotnet/System.js";
import { File } from "@tsonic/dotnet/System.IO.js";

export function main(): void {
  Console.writeLine("Reading README.md...");
  const content = File.readAllText("./README.md");
  Console.writeLine(content);
}
`;

const SAMPLE_MAIN_TS_PURE = `import { Console } from "@tsonic/dotnet-pure/System.js";
import { File } from "@tsonic/dotnet-pure/System.IO.js";

export function main(): void {
  Console.WriteLine("Reading README.md...");
  const content = File.ReadAllText("./README.md");
  Console.WriteLine(content);
}
`;

const SAMPLE_MAIN_TS_JS = `import { Console } from "@tsonic/dotnet/System.js";
import { console, JSON } from "@tsonic/js/index.js";

export function main(): void {
  Console.writeLine("JSRuntime JSON example...");
  const value = JSON.parse<{ x: number }>('{"x": 1}');
  console.log(JSON.stringify(value));
}
`;

const SAMPLE_MAIN_TS_JS_PURE = `import { Console } from "@tsonic/dotnet-pure/System.js";
import { console, JSON } from "@tsonic/js/index.js";

export function main(): void {
  Console.WriteLine("JSRuntime JSON example...");
  const value = JSON.parse<{ x: number }>('{"x": 1}');
  console.log(JSON.stringify(value));
}
`;

const SAMPLE_MAIN_TS_NODEJS = `import { console } from "@tsonic/nodejs/index.js";

export function main(): void {
  console.log("Hello from @tsonic/nodejs");
}
`;

const SAMPLE_README = `# My Tsonic Project

This is a sample Tsonic project that demonstrates .NET interop.

## Getting Started

Build and run the project:

\`\`\`bash
npm run build
./out/app
\`\`\`

Or run directly:

\`\`\`bash
npm run dev
\`\`\`

## Project Structure

- \`src/App.ts\` - Entry point
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
  options: {
    readonly js?: boolean;
    readonly nodejs?: boolean;
    readonly pure?: boolean;
  } = {}
): TypePackageInfo => {
  const js = options.js === true;
  const nodejs = options.nodejs === true;
  const pure = options.pure === true;

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

  // JSRuntime / nodejs bindings currently import from @tsonic/dotnet (not dotnet-pure).
  // In --pure mode, ensure @tsonic/dotnet is installed so these packages typecheck.
  if (pure && (js || nodejs)) {
    packages.push({ name: "@tsonic/dotnet", version: "latest" });
  }

  if (js) {
    packages.push({ name: "@tsonic/js", version: "latest" });
  }
  if (nodejs) {
    packages.push({ name: "@tsonic/nodejs", version: "latest" });
  }
  return {
    packages,
    typeRoots: [`node_modules/${globalsPackage}`],
  };
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
    $schema: "https://tsonic.org/schema/v1.json",
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

  const typeInfo = getTypePackageInfo({ pure });
  const dotnet: Record<string, unknown> = { dllDirs: ["lib"] };

  if (includeTypeRoots) {
    dotnet.typeRoots = typeInfo.typeRoots;
  }

  if (libraryPaths.length > 0) {
    dotnet.libraries = [...libraryPaths];
  }

  // Always include dotnet stanza so dllDirs is explicit (workspace-friendly default).
  config.dotnet = dotnet;

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
    const js = options.js ?? false;
    const nodejs = options.nodejs ?? false;
    const pure = options.pure ?? false;
    const typeInfo = getTypePackageInfo({ js, nodejs, pure });

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
    // This includes:
    // - Tsonic.Runtime.dll (always)
    // - Tsonic.JSRuntime.dll (if --js or --nodejs)
    // - nodejs.dll (if --nodejs)
    // Note: JSRuntime/nodejs are treated like any other CLR assembly and must be
    // listed in dotnet.libraries to be referenced by the generated .csproj.
    console.log("Copying runtime DLLs to lib/...");
    const copyResult = copyRuntimeDllsToProjectLib(cwd, {
      includeJsRuntime: js || nodejs,
      includeNodejs: nodejs,
    });
    if (!copyResult.ok) {
      // Log warning but continue - user can add manually later
      console.log(`⚠ Warning: ${copyResult.error}`);
    } else {
      for (const path of copyResult.value) {
        console.log(`✓ Copied ${path.split("/").pop()}`);
      }
    }

    // Create tsonic.json
    const runtimeLibraries: string[] = [];
    if (js || nodejs) runtimeLibraries.push("lib/Tsonic.JSRuntime.dll");
    if (nodejs) runtimeLibraries.push("lib/nodejs.dll");

    const config = generateConfig(shouldInstallTypes, runtimeLibraries, pure);
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
      const sample = nodejs
        ? SAMPLE_MAIN_TS_NODEJS
        : js
          ? (pure ? SAMPLE_MAIN_TS_JS_PURE : SAMPLE_MAIN_TS_JS)
          : pure
            ? SAMPLE_MAIN_TS_PURE
            : SAMPLE_MAIN_TS;
      writeFileSync(appTsPath, sample, "utf-8");
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
