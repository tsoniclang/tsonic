/**
 * Main build orchestration - coordinates the entire NativeAOT build process
 */

import { createHash } from "crypto";
import {
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  chmodSync,
  existsSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { BuildOptions, BuildResult, BuildConfig, EntryInfo } from "./types.js";
import { generateCsproj } from "./project-generator.js";
import { generateProgramCs } from "./program-generator.js";
import { checkDotnetInstalled, detectRid, publishNativeAot } from "./dotnet.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create unique build directory
 */
const createBuildDir = (entryFile: string): string => {
  const hash = createHash("md5").update(entryFile).digest("hex").slice(0, 8);
  const buildDir = join(process.cwd(), ".tsonic", "build", hash);
  mkdirSync(buildDir, { recursive: true });
  return buildDir;
};

/**
 * Copy generated C# files to build directory
 */
const copyGeneratedFiles = (
  emittedFiles: Map<string, string>,
  buildDir: string
): void => {
  for (const [tsPath, csContent] of emittedFiles) {
    // src/models/User.ts → <buildDir>/src/models/User.cs
    const csPath = tsPath.replace(/\.ts$/, ".cs");
    const fullPath = join(buildDir, csPath);

    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, csContent, "utf-8");
  }
};

/**
 * Copy runtime file to build directory
 */
const copyRuntime = (buildDir: string): void => {
  // Runtime is in packages/runtime/TsonicRuntime.cs
  // When built, we're in packages/backend/dist
  // So runtime is at ../../runtime/TsonicRuntime.cs
  const runtimePath = join(__dirname, "../../runtime/TsonicRuntime.cs");

  if (!existsSync(runtimePath)) {
    throw new Error(
      `Runtime file not found at ${runtimePath}. Ensure packages/runtime/TsonicRuntime.cs exists.`
    );
  }

  copyFileSync(runtimePath, join(buildDir, "TsonicRuntime.cs"));
};

/**
 * Get output binary name for platform
 */
const getOutputBinaryName = (outputName: string): string => {
  return process.platform === "win32" ? `${outputName}.exe` : outputName;
};

/**
 * Copy output binary to final location
 */
const copyOutputBinary = (
  buildDir: string,
  rid: string,
  outputPath: string,
  outputName: string
): void => {
  const publishDir = join(buildDir, "bin/Release/net8.0", rid, "publish");
  const binaryName = getOutputBinaryName(outputName);
  const binaryPath = join(publishDir, binaryName);

  if (!existsSync(binaryPath)) {
    throw new Error(`Output binary not found at ${binaryPath}`);
  }

  copyFileSync(binaryPath, outputPath);

  // Make executable on Unix
  if (process.platform !== "win32") {
    chmodSync(outputPath, 0o755);
  }
};

/**
 * Clean build directory
 */
const cleanBuild = (buildDir: string, keepTemp: boolean): void => {
  if (!keepTemp) {
    rmSync(buildDir, { recursive: true, force: true });
  }
};

/**
 * Build NativeAOT executable from C# files
 */
export const buildNativeAot = (
  emittedFiles: Map<string, string>,
  entryInfo: EntryInfo,
  options: BuildOptions
): BuildResult => {
  let buildDir: string | undefined;

  try {
    // Check dotnet is installed
    const dotnetCheck = checkDotnetInstalled();
    if (!dotnetCheck.ok) {
      return {
        ok: false,
        error: dotnetCheck.error,
      };
    }

    // Create build directory
    buildDir = createBuildDir(Array.from(emittedFiles.keys())[0] || "main");

    // Copy generated C# files
    copyGeneratedFiles(emittedFiles, buildDir);

    // Copy runtime
    copyRuntime(buildDir);

    // Generate Program.cs if needed
    if (entryInfo.needsProgram) {
      const programCs = generateProgramCs(entryInfo);
      writeFileSync(join(buildDir, "Program.cs"), programCs, "utf-8");
    }

    // Generate .csproj
    const buildConfig: BuildConfig = {
      rootNamespace: options.namespace,
      outputName: options.outputName || "tsonic",
      packages: [], // TODO: Auto-detect from imports
      invariantGlobalization: true,
      stripSymbols: options.stripSymbols ?? true,
      optimizationPreference: options.optimizationPreference || "Speed",
    };

    const csprojContent = generateCsproj(buildConfig);
    writeFileSync(join(buildDir, "tsonic.csproj"), csprojContent, "utf-8");

    // Detect RID
    const rid = options.rid || detectRid();

    // Execute dotnet publish
    const publishResult = publishNativeAot(buildDir, rid);
    if (!publishResult.ok) {
      return {
        ok: false,
        error: publishResult.error,
        buildDir,
      };
    }

    // Copy output binary
    const outputPath = options.outputName
      ? `./${getOutputBinaryName(options.outputName)}`
      : "./tsonic-app";
    copyOutputBinary(buildDir, rid, outputPath, options.outputName || "tsonic");

    // Cleanup if requested
    cleanBuild(buildDir, options.keepTemp ?? false);

    return {
      ok: true,
      outputPath,
      buildDir,
    };
  } catch (error) {
    if (buildDir) {
      cleanBuild(buildDir, false);
    }

    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Unknown build error occurred",
      buildDir,
    };
  }
};
