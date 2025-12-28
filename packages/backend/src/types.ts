/**
 * Type definitions for backend build process
 */

/**
 * Output type taxonomy
 */
export type OutputType = "executable" | "library" | "console-app";

/**
 * NuGet package metadata for libraries
 */
export type PackageMetadata = {
  readonly id: string;
  readonly version: string;
  readonly authors: readonly string[];
  readonly description: string;
  readonly projectUrl?: string;
  readonly license?: string;
  readonly tags?: readonly string[];
};

/**
 * Executable-specific configuration
 */
export type ExecutableConfig = {
  readonly type: "executable";
  readonly nativeAot: boolean;
  readonly singleFile: boolean;
  readonly trimmed: boolean;
  readonly stripSymbols: boolean;
  readonly optimization: "Size" | "Speed";
  readonly invariantGlobalization: boolean;
  readonly selfContained: boolean;
};

/**
 * Library-specific configuration
 */
export type LibraryConfig = {
  readonly type: "library";
  readonly targetFrameworks: readonly string[];
  readonly generateDocumentation: boolean;
  readonly includeSymbols: boolean;
  readonly packable: boolean;
  readonly packageMetadata?: PackageMetadata;
};

/**
 * Console app configuration (non-NativeAOT)
 */
export type ConsoleAppConfig = {
  readonly type: "console-app";
  readonly selfContained: boolean;
  readonly singleFile: boolean;
  readonly targetFramework: string;
};

/**
 * Output configuration union type
 */
export type OutputConfig = ExecutableConfig | LibraryConfig | ConsoleAppConfig;

/**
 * Assembly reference (for DLL files)
 */
export type AssemblyReference = {
  readonly name: string;
  readonly hintPath: string;
};

/**
 * Build configuration options
 */
export type BuildConfig = {
  readonly rootNamespace: string;
  readonly outputName: string;
  readonly dotnetVersion: string;
  readonly runtimePath?: string;
  readonly assemblyReferences?: readonly AssemblyReference[];
  readonly outputConfig: OutputConfig;
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
