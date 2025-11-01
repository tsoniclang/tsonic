/**
 * tsonic project init command
 */

import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "../types.js";

const DEFAULT_CONFIG = `{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "app",
  "optimize": "speed",
  "packages": [],
  "buildOptions": {
    "stripSymbols": true,
    "invariantGlobalization": true
  }
}
`;

const DEFAULT_GITIGNORE = `# .NET build artifacts
generated/bin/
generated/obj/

# Optional: Uncomment to ignore generated C# files
# generated/**/*.cs

# Output executables
*.exe
app
`;

/**
 * Initialize a new Tsonic project
 */
export const initProject = (cwd: string): Result<void, string> => {
  const tsonicJsonPath = join(cwd, "tsonic.json");
  const gitignorePath = join(cwd, ".gitignore");

  // Check if tsonic.json already exists
  if (existsSync(tsonicJsonPath)) {
    return {
      ok: false,
      error: "tsonic.json already exists. Project is already initialized.",
    };
  }

  try {
    // Create tsonic.json
    writeFileSync(tsonicJsonPath, DEFAULT_CONFIG, "utf-8");

    // Create or append to .gitignore
    if (existsSync(gitignorePath)) {
      const existing = readFileSync(gitignorePath, "utf-8");
      if (!existing.includes("generated/")) {
        writeFileSync(
          gitignorePath,
          existing + "\n" + DEFAULT_GITIGNORE,
          "utf-8"
        );
      }
    } else {
      writeFileSync(gitignorePath, DEFAULT_GITIGNORE, "utf-8");
    }

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to initialize project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// Add missing import
import { readFileSync } from "node:fs";
