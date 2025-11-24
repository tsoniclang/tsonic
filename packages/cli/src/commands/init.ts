/**
 * tsonic project init command
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { generateCsproj } from "@tsonic/backend";
import type { Result } from "../types.js";
import type { BuildConfig, ExecutableConfig } from "@tsonic/backend";

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

const SAMPLE_MAIN_TS = `import { Console } from "System";
import { File } from "System.IO";

export function main(): void {
  Console.WriteLine("Reading README.md...");
  const content = File.ReadAllText("./README.md");
  Console.WriteLine(content);
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

/**
 * Generate tsonic.json config
 */
const generateConfig = (
  includeTypeRoots: boolean,
  runtime?: "js" | "dotnet"
): string => {
  const config: Record<string, unknown> = {
    $schema: "https://tsonic.dev/schema/v1.json",
    rootNamespace: "MyApp",
    entryPoint: "src/main.ts",
    sourceRoot: "src",
    outputDirectory: "generated",
    outputName: "app",
    runtime: runtime ?? "js",
    optimize: "speed",
    packages: [],
    buildOptions: {
      stripSymbols: true,
      invariantGlobalization: true,
    },
  };

  if (includeTypeRoots) {
    config.dotnet = {
      typeRoots: ["node_modules/@tsonic/dotnet-types/types"],
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
      build: "tsonic build src/main.ts",
      dev: "tsonic run src/main.ts",
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
        build: "tsonic build src/main.ts",
        dev: "tsonic run src/main.ts",
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
  const mainTsPath = join(srcDir, "main.ts");
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

    // Install .NET type declarations
    const shouldInstallTypes = !options.skipTypes;
    const typesVersion = options.typesVersion ?? "10.0.0";

    if (shouldInstallTypes) {
      console.log(
        `Installing .NET type declarations (@tsonic/dotnet-types@${typesVersion})...`
      );
      const installResult = installPackage(
        "@tsonic/dotnet-types",
        typesVersion
      );
      if (!installResult.ok) {
        return installResult;
      }
      console.log("✓ Installed @tsonic/dotnet-types");
    }

    // Create tsonic.json
    const config = generateConfig(shouldInstallTypes, options.runtime);
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

    // Create src directory and main.ts
    if (!existsSync(srcDir)) {
      mkdirSync(srcDir, { recursive: true });
    }
    if (!existsSync(mainTsPath)) {
      writeFileSync(mainTsPath, SAMPLE_MAIN_TS, "utf-8");
      console.log("✓ Created src/main.ts");
    }

    // Create README.md
    if (!existsSync(readmePath)) {
      writeFileSync(readmePath, SAMPLE_README, "utf-8");
      console.log("✓ Created README.md");
    }

    // Create .csproj file
    const csprojPath = join(cwd, "MyApp.csproj");
    if (!existsSync(csprojPath)) {
      const buildConfig: BuildConfig = {
        rootNamespace: "MyApp",
        outputName: "app",
        dotnetVersion: "net10.0",
        packages: [],
        outputConfig: {
          type: "executable",
          nativeAot: true,
          singleFile: true,
          trimmed: true,
          stripSymbols: true,
          optimization: "Speed",
          invariantGlobalization: true,
          selfContained: true,
        } satisfies ExecutableConfig,
      };
      const csprojContent = generateCsproj(buildConfig);
      writeFileSync(csprojPath, csprojContent, "utf-8");
      console.log("✓ Created MyApp.csproj");
    }

    console.log("\n✓ Project initialized successfully!");
    console.log("\nNext steps:");
    console.log("  npm run build   # Build executable");
    console.log("  npm run dev     # Run directly");
    console.log("\nYou can now:");
    console.log("  - Edit MyApp.csproj to add NuGet packages");
    console.log("  - Or run: dotnet add package <PackageName>");

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to initialize project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
