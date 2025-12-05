/**
 * tsonic project init command
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Result } from "../types.js";

type InitOptions = {
  readonly skipTypes?: boolean;
  readonly typesVersion?: string;
  readonly runtime?: "js" | "dotnet";
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

const SAMPLE_MAIN_TS_JS = `export function main(): void {
  console.log("Hello from Tsonic!");

  const numbers = [1, 2, 3, 4, 5];
  const doubled = numbers.map((n) => n * 2);
  console.log("Doubled:", doubled.join(", "));
}
`;

const SAMPLE_MAIN_TS_DOTNET = `import { Console } from "@tsonic/dotnet/System";
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
const CLI_PACKAGE = { name: "@tsonic/tsonic", version: "latest" };

/**
 * Get type package info based on runtime mode
 *
 * typeRoots: Only ambient globals packages (provide global types without imports)
 * packages: All type packages to install (includes explicit import packages)
 */
const getTypePackageInfo = (runtime: "js" | "dotnet"): TypePackageInfo => {
  if (runtime === "js") {
    // JS mode:
    // - @tsonic/cli: the compiler CLI (provides `tsonic` command)
    // - @tsonic/js-globals: ambient globals (Array, console, etc.) - needs typeRoots
    // - @tsonic/types: explicit imports (int, float, etc.) - just npm dep
    return {
      packages: [
        CLI_PACKAGE,
        { name: "@tsonic/js-globals", version: "latest" },
        { name: "@tsonic/types", version: "latest" },
      ],
      typeRoots: ["node_modules/@tsonic/js-globals"],
    };
  }
  // Dotnet mode:
  // - @tsonic/cli: the compiler CLI (provides `tsonic` command)
  // - @tsonic/dotnet-globals: ambient globals - needs typeRoots
  // - @tsonic/dotnet: explicit imports (System.*, etc.) - just npm dep
  // - @tsonic/types: transitive dep of @tsonic/dotnet
  return {
    packages: [
      CLI_PACKAGE,
      { name: "@tsonic/dotnet-globals", version: "latest" },
      { name: "@tsonic/dotnet", version: "latest" },
    ],
    typeRoots: ["node_modules/@tsonic/dotnet-globals"],
  };
};

/**
 * Generate tsonic.json config
 */
const generateConfig = (
  includeTypeRoots: boolean,
  runtime: "js" | "dotnet"
): string => {
  const config: Record<string, unknown> = {
    $schema: "https://tsonic.dev/schema/v1.json",
    rootNamespace: "MyApp",
    entryPoint: "src/App.ts",
    sourceRoot: "src",
    outputDirectory: "generated",
    outputName: "app",
    runtime: runtime,
    optimize: "speed",
    packages: [],
    buildOptions: {
      stripSymbols: true,
      invariantGlobalization: true,
    },
  };

  if (includeTypeRoots) {
    const typeInfo = getTypePackageInfo(runtime);
    config.dotnet = {
      typeRoots: typeInfo.typeRoots,
    };
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
  const runtime = options.runtime ?? "js";
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

    // Install type declarations based on runtime mode
    const shouldInstallTypes = !options.skipTypes;
    const typeInfo = getTypePackageInfo(runtime);

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

    // Create tsonic.json
    const config = generateConfig(shouldInstallTypes, runtime);
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

    // Create src directory and App.ts with runtime-appropriate code
    if (!existsSync(srcDir)) {
      mkdirSync(srcDir, { recursive: true });
    }
    if (!existsSync(appTsPath)) {
      const sampleCode =
        runtime === "js" ? SAMPLE_MAIN_TS_JS : SAMPLE_MAIN_TS_DOTNET;
      writeFileSync(appTsPath, sampleCode, "utf-8");
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
