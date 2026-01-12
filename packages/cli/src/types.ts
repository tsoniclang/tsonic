/**
 * Type definitions for CLI
 */

import type { OutputType, PackageMetadata } from "@tsonic/backend";

export type NamingPolicy = "clr" | "none";

/**
 * Output configuration in tsonic.json
 */
export type TsonicOutputConfig = {
  readonly type?: OutputType;
  readonly name?: string;
  // Executable options
  readonly nativeAot?: boolean;
  readonly singleFile?: boolean;
  readonly trimmed?: boolean;
  readonly stripSymbols?: boolean;
  readonly optimization?: "size" | "speed";
  readonly invariantGlobalization?: boolean;
  readonly selfContained?: boolean;
  // Library options
  readonly targetFrameworks?: readonly string[];
  readonly generateDocumentation?: boolean;
  readonly includeSymbols?: boolean;
  readonly packable?: boolean;
  readonly package?: PackageMetadata;
};

/**
 * Tsonic configuration file (tsonic.json)
 */
export type TsonicConfig = {
  readonly $schema?: string;
  readonly rootNamespace: string;
  readonly namingPolicy?: {
    /** Force a single naming mode for all buckets. */
    readonly all?: NamingPolicy;
    readonly classes?: NamingPolicy;
    readonly namespaces?: NamingPolicy;
    readonly methods?: NamingPolicy;
    readonly properties?: NamingPolicy;
    readonly fields?: NamingPolicy;
    readonly enumMembers?: NamingPolicy;
  };
  readonly entryPoint?: string;
  readonly sourceRoot?: string;
  readonly outputDirectory?: string;
  readonly outputName?: string;
  readonly rid?: string;
  readonly dotnetVersion?: string;
  readonly optimize?: "size" | "speed";
  readonly output?: TsonicOutputConfig;
  readonly buildOptions?: {
    readonly stripSymbols?: boolean;
    readonly invariantGlobalization?: boolean;
  };
  readonly dotnet?: {
    readonly typeRoots?: readonly string[];
    readonly libraries?: readonly string[]; // External library paths for .NET interop
    /** Additional shared frameworks (FrameworkReference) */
    readonly frameworkReferences?: ReadonlyArray<
      | string
      | {
          readonly id: string;
          /** If provided, bindings are expected from this npm package (no auto-generation). */
          readonly types?: string;
        }
    >;
    /** Additional NuGet packages (PackageReference) */
    readonly packageReferences?: ReadonlyArray<{
      readonly id: string;
      readonly version: string;
      /** If provided, bindings are expected from this npm package (no auto-generation). */
      readonly types?: string;
    }>;
  };
};

/**
 * CLI command options (mutable for parsing)
 */
export type CliOptions = {
  verbose?: boolean;
  quiet?: boolean;
  config?: string;
  src?: string;
  out?: string;
  namespace?: string;
  rid?: string;
  optimize?: "size" | "speed";
  keepTemp?: boolean;
  noStrip?: boolean;
  lib?: string[]; // External library paths for .NET interop
  deps?: string[]; // Additional directories to probe for referenced assemblies/DLLs
  // Project init options
  skipTypes?: boolean;
  typesVersion?: string;
  nodejs?: boolean; // Enable Node.js interop (installs @tsonic/nodejs)
  pure?: boolean; // Use PascalCase .NET bindings (installs @tsonic/globals-pure)
  // Output type options
  type?: OutputType;
  targetFramework?: string;
  noAot?: boolean;
  singleFile?: boolean;
  selfContained?: boolean;
  // Library options
  generateDocs?: boolean;
  includeSymbols?: boolean;
  pack?: boolean;
};

/**
 * Combined configuration (from file + CLI args)
 */
export type ResolvedConfig = {
  readonly rootNamespace: string;
  readonly namingPolicy?: {
    readonly all?: NamingPolicy;
    readonly classes?: NamingPolicy;
    readonly namespaces?: NamingPolicy;
    readonly methods?: NamingPolicy;
    readonly properties?: NamingPolicy;
    readonly fields?: NamingPolicy;
    readonly enumMembers?: NamingPolicy;
  };
  readonly entryPoint: string | undefined;
  readonly projectRoot: string; // Directory containing tsonic.json/package.json
  readonly sourceRoot: string;
  readonly outputDirectory: string;
  readonly outputName: string;
  readonly rid: string;
  readonly dotnetVersion: string;
  readonly optimize: "size" | "speed";
  readonly outputConfig: TsonicOutputConfig;
  readonly stripSymbols: boolean;
  readonly invariantGlobalization: boolean;
  readonly keepTemp: boolean;
  readonly verbose: boolean;
  readonly quiet: boolean;
  readonly typeRoots: readonly string[];
  readonly libraries: readonly string[]; // External library paths for .NET interop
  readonly frameworkReferences: readonly string[];
  readonly packageReferences: ReadonlyArray<{
    readonly id: string;
    readonly version: string;
  }>;
};

/**
 * Result type for operations
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
