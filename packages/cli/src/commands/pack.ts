/**
 * tsonic pack command - Create NuGet package from library
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ResolvedConfig, Result } from "../types.js";
import { generateCommand } from "./generate.js";
import { resolveNugetConfigFile } from "../dotnet/nuget-config.js";

/**
 * Pack library into NuGet package
 */
export const packCommand = (
  config: ResolvedConfig
): Result<{ outputPath: string }, string> => {
  const { outputDirectory, outputName, quiet, verbose } = config;

  // Verify this is a library project
  if (config.outputConfig.type !== "library") {
    return {
      ok: false,
      error:
        "Pack command can only be used with library projects. Set output.type to 'library' in tsonic.json",
    };
  }

  // Verify packable is enabled
  if (!config.outputConfig.packable) {
    return {
      ok: false,
      error:
        "Library is not packable. Set output.packable to true in tsonic.json",
    };
  }

  // Step 1: Emit C# code
  if (!quiet) {
    console.log("Step 1/2: Generating C# code...");
  }

  const generateResult = generateCommand(config);
  if (!generateResult.ok) {
    return generateResult;
  }

  const generatedDir = generateResult.value.outputDir;
  const csprojPath = join(generatedDir, "tsonic.csproj");

  if (!existsSync(csprojPath)) {
    return {
      ok: false,
      error: `No tsonic.csproj found in ${outputDirectory}/. This should have been created by generate.`,
    };
  }

  // Step 2: Run dotnet pack
  if (!quiet) {
    console.log("Step 2/2: Creating NuGet package...");
  }

  const nugetConfigResult = resolveNugetConfigFile(config.workspaceRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;

  const packArgs = [
    "pack",
    "tsonic.csproj",
    "-c",
    "Release",
    "--nologo",
    "--configfile",
    nugetConfigResult.value,
  ];

  if (quiet) {
    packArgs.push("--verbosity", "quiet");
  } else if (verbose) {
    packArgs.push("--verbosity", "detailed");
  } else {
    packArgs.push("--verbosity", "minimal");
  }

  const packResult = spawnSync("dotnet", packArgs, {
    cwd: generatedDir,
    stdio: verbose ? "inherit" : "pipe",
    encoding: "utf-8",
  });

  if (packResult.status !== 0) {
    const errorMsg = packResult.stderr || packResult.stdout || "Unknown error";
    return {
      ok: false,
      error: `dotnet pack failed:\n${errorMsg}`,
    };
  }

  // Find the generated .nupkg file
  const nupkgDir = join(generatedDir, "bin", "Release");

  // Package metadata
  const packageId = config.outputConfig.package?.id ?? outputName;
  const packageVersion = config.outputConfig.package?.version ?? "1.0.0";
  const nupkgName = `${packageId}.${packageVersion}.nupkg`;
  const nupkgPath = join(nupkgDir, nupkgName);

  if (!existsSync(nupkgPath)) {
    return {
      ok: false,
      error: `NuGet package not found at ${nupkgPath}. Check dotnet pack output for errors.`,
    };
  }

  if (!quiet) {
    console.log(`\n✓ Package created: ${nupkgPath}`);
    console.log(`\nTo publish to NuGet.org:`);
    console.log(
      `  dotnet nuget push ${nupkgPath} --api-key YOUR_API_KEY --source https://api.nuget.org/v3/index.json`
    );
  }

  return {
    ok: true,
    value: { outputPath: nupkgPath },
  };
};
