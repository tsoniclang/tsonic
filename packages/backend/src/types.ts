/**
 * Type definitions for backend build process
 */

/**
 * NuGet package reference
 */
export type NuGetPackage = {
  readonly name: string;
  readonly version: string;
};

/**
 * Build configuration options
 */
export type BuildConfig = {
  readonly rootNamespace: string;
  readonly outputName: string;
  readonly dotnetVersion: string;
  readonly runtimePath?: string;
  readonly packages: readonly NuGetPackage[];
  readonly invariantGlobalization: boolean;
  readonly stripSymbols: boolean;
  readonly optimizationPreference: "Size" | "Speed";
};

/**
 * Entry point information
 */
export type EntryInfo = {
  readonly namespace: string;
  readonly className: string;
  readonly methodName: string;
  readonly isAsync: boolean;
  readonly needsProgram: boolean;
};

/**
 * Build options passed to buildNativeAot
 */
export type BuildOptions = {
  readonly namespace: string;
  readonly outputName?: string;
  readonly dotnetVersion?: string;
  readonly rid?: string;
  readonly keepTemp?: boolean;
  readonly stripSymbols?: boolean;
  readonly optimizationPreference?: "Size" | "Speed";
};

/**
 * Result of the build process
 */
export type BuildResult =
  | {
      readonly ok: true;
      readonly outputPath: string;
      readonly buildDir: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly buildDir?: string;
    };

/**
 * Dotnet execution result
 */
export type DotnetResult =
  | {
      readonly ok: true;
      readonly stdout: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly stdout?: string;
      readonly stderr?: string;
    };
