/**
 * tsonic add package command - Add a CLR package (DLL + types) to the project
 *
 * Usage: tsonic add package /path/to/library.dll @scope/types
 *
 * This command:
 * 1. Copies the DLL to project's lib/ directory
 * 2. Installs the npm types package
 * 3. Updates tsonic.json to register the library
 */

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import type { Result } from "../types.js";

/**
 * Options for add package command
 */
export type AddPackageOptions = {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
};

/**
 * Add a CLR package to the project
 */
export const addPackageCommand = (
  dllPath: string,
  typesPackage: string,
  projectRoot: string,
  options: AddPackageOptions = {}
): Result<{ dllName: string; libPath: string }, string> => {
  const { verbose, quiet } = options;

  // Validate DLL path
  if (!existsSync(dllPath)) {
    return {
      ok: false,
      error: `DLL not found: ${dllPath}`,
    };
  }

  if (!dllPath.endsWith(".dll")) {
    return {
      ok: false,
      error: `Invalid DLL path: ${dllPath} (must end with .dll)`,
    };
  }

  const dllName = basename(dllPath);
  const assemblyName = dllName.replace(/\.dll$/, "");

  // Validate types package format
  if (!typesPackage.startsWith("@") && !typesPackage.includes("/")) {
    // Simple package name is ok
  } else if (!typesPackage.match(/^@[a-z0-9-]+\/[a-z0-9-]+$/i)) {
    return {
      ok: false,
      error: `Invalid types package name: ${typesPackage}`,
    };
  }

  // Step 1: Create lib/ directory and copy DLL
  const libDir = join(projectRoot, "lib");
  const destDllPath = join(libDir, dllName);

  if (!quiet) {
    console.log(`Step 1/3: Copying DLL to lib/...`);
  }

  mkdirSync(libDir, { recursive: true });
  copyFileSync(dllPath, destDllPath);

  if (verbose) {
    console.log(`  Copied: ${dllPath} -> ${destDllPath}`);
  }

  // Step 2: Install npm types package
  if (!quiet) {
    console.log(`Step 2/3: Installing types package...`);
  }

  const npmArgs = ["install", "--save-dev", typesPackage];
  if (quiet) {
    npmArgs.push("--silent");
  }

  const npmResult = spawnSync("npm", npmArgs, {
    cwd: projectRoot,
    stdio: verbose ? "inherit" : "pipe",
    encoding: "utf-8",
  });

  if (npmResult.status !== 0) {
    const errorMsg = npmResult.stderr || npmResult.stdout || "Unknown error";
    return {
      ok: false,
      error: `npm install failed:\n${errorMsg}`,
    };
  }

  if (verbose) {
    console.log(`  Installed: ${typesPackage}`);
  }

  // Step 3: Update tsonic.json to register the library
  if (!quiet) {
    console.log(`Step 3/3: Updating tsonic.json...`);
  }

  const configPath = join(projectRoot, "tsonic.json");
  if (!existsSync(configPath)) {
    return {
      ok: false,
      error: `tsonic.json not found in ${projectRoot}`,
    };
  }

  const configContent = readFileSync(configPath, "utf-8");
  const config = JSON.parse(configContent) as Record<string, unknown>;

  // Ensure dotnet section exists
  const dotnet = (config.dotnet as Record<string, unknown>) ?? {};
  config.dotnet = dotnet;

  // Add to dotnet.libraries array
  const libraries = (dotnet.libraries as string[]) ?? [];
  const libPath = `lib/${dllName}`;

  if (!libraries.includes(libPath)) {
    libraries.push(libPath);
    dotnet.libraries = libraries;
  }

  // Pretty print with 2-space indent
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  if (verbose) {
    console.log(`  Added library: ${libPath}`);
  }

  if (!quiet) {
    console.log(`\n✓ Added package: ${assemblyName}`);
    console.log(`  DLL: lib/${dllName}`);
    console.log(`  Types: ${typesPackage}`);
  }

  return {
    ok: true,
    value: {
      dllName,
      libPath: destDllPath,
    },
  };
};
