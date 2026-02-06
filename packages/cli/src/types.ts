/**
 * Type definitions for CLI
 */

import type { OutputType, PackageMetadata } from "@tsonic/backend";

/**
 * Output configuration in tsonic.json
 */
export type TsonicOutputConfig = {
  readonly type?: OutputType;
  readonly name?: string;
  // Executable options
  readonly nativeAot?: boolean;
  /**
   * Native library kind when building `output.type = "library"` with NativeAOT.
   * - "shared": OS-level dynamic library (.so/.dylib/.dll)
   * - "static": OS-level static library (.a/.lib)
   */
  readonly nativeLib?: "shared" | "static";
  readonly singleFile?: boolean;
  readonly trimmed?: boolean;
  readonly stripSymbols?: boolean;
  readonly optimization?: "size" | "speed";
  readonly invariantGlobalization?: boolean;
  readonly selfContained?: boolean;
  // Console app (non-NativeAOT) options
  readonly targetFramework?: string;
  // Library options
  readonly targetFrameworks?: readonly string[];
  readonly generateDocumentation?: boolean;
  readonly includeSymbols?: boolean;
  readonly packable?: boolean;
  readonly package?: PackageMetadata;
};

/**
 * Tsonic project configuration file (packages/<project>/tsonic.json)
 */
export type TsonicProjectConfig = {
  readonly $schema?: string;
  readonly rootNamespace: string;
  readonly entryPoint?: string;
  readonly sourceRoot?: string;
  readonly outputDirectory?: string;
  readonly outputName?: string;
  readonly optimize?: "size" | "speed";
  readonly output?: TsonicOutputConfig;
  /**
   * Optional unit test build configuration.
   *
   * Used by `tsonic test` to generate a non-NativeAOT test assembly and run
   * `dotnet test` (xUnit/NUnit/MSTest, etc).
   */
  readonly tests?: {
    /** Entry point that imports/includes all test files. */
    readonly entryPoint: string;
    /**
     * Output directory for test generation/build (separate from the main build).
     * Resolved relative to the project root.
     */
    readonly outputDirectory?: string;
    /** Assembly name for the test project. */
    readonly outputName?: string;
  };
  readonly buildOptions?: {
    readonly stripSymbols?: boolean;
    readonly invariantGlobalization?: boolean;
  };
  /**
   * Project-scoped CLR assembly references (workspace-internal).
   *
   * Use this for referencing sibling Tsonic-built libraries (DLL outputs)
   * inside the same workspace (e.g., an API project referencing a domain DLL).
   *
   * Paths are resolved relative to the project root.
   */
  readonly references?: {
    readonly libraries?: readonly string[];
  };
};

export type LibraryReferenceConfig =
  | string
  | {
      /** Path to a DLL or a TypeScript type root. Resolved relative to the workspace root. */
      readonly path: string;
      /**
       * Bindings ownership for this reference:
       * - string: bindings are expected from this npm package (no auto-generation)
       * - false: no bindings are required (csproj-only dependency; skip generation)
       */
      readonly types?: string | false;
    };

export type FrameworkReferenceConfig =
  | string
  | {
      readonly id: string;
      /** If provided, bindings are expected from this npm package (no auto-generation). */
      readonly types?: string | false;
    };

export type PackageReferenceConfig = {
  readonly id: string;
  readonly version: string;
  /** If provided, bindings are expected from this npm package (no auto-generation). */
  readonly types?: string | false;
};

/**
 * Tsonic workspace configuration file (tsonic.workspace.json)
 *
 * Airplane-grade rule: all external dependencies are workspace-scoped.
 * Projects do not own separate dependency graphs.
 */
export type TsonicWorkspaceConfig = {
  readonly $schema?: string;
  /**
   * Target framework moniker for the workspace (e.g. "net10.0").
   * Applies to all projects.
   */
  readonly dotnetVersion: string;
  /**
   * Default Runtime Identifier (RID) for native builds. Optional.
   */
  readonly rid?: string;
  readonly optimize?: "size" | "speed";
  readonly buildOptions?: {
    readonly stripSymbols?: boolean;
    readonly invariantGlobalization?: boolean;
  };
  readonly dotnet?: {
    /**
     * Ambient type roots for TypeScript compilation (globals, etc).
     * Defaults to ["node_modules/@tsonic/globals"] when omitted.
     */
    readonly typeRoots?: readonly string[];
    /**
     * Workspace-scoped DLL references. Paths are relative to the workspace root.
     * Recommended location is ./libs/*.dll.
     */
    readonly libraries?: readonly LibraryReferenceConfig[];
    /** Additional shared frameworks (FrameworkReference) */
    readonly frameworkReferences?: ReadonlyArray<FrameworkReferenceConfig>;
    /** Additional NuGet packages (PackageReference) */
    readonly packageReferences?: ReadonlyArray<PackageReferenceConfig>;
    /**
     * Optional MSBuild properties injected into the generated tsonic.csproj.
     *
     * This is an explicit escape hatch mirroring .csproj authoring in .NET.
     * Example (EF Core precompiled queries / interceptors):
     * {
     *   "InterceptorsNamespaces": "$(InterceptorsNamespaces);Microsoft.EntityFrameworkCore.GeneratedInterceptors"
     * }
     */
    readonly msbuildProperties?: Readonly<Record<string, string>>;
  };
  /**
   * Test-only .NET dependencies.
   *
   * These are included when running `tsonic test`, but are not injected into
   * production builds.
   */
  readonly testDotnet?: {
    /** Additional shared frameworks (FrameworkReference) for tests */
    readonly frameworkReferences?: ReadonlyArray<FrameworkReferenceConfig>;
    /** Additional NuGet packages (PackageReference) for tests */
    readonly packageReferences?: ReadonlyArray<PackageReferenceConfig>;
    /** Optional MSBuild properties injected into the generated test csproj. */
    readonly msbuildProperties?: Readonly<Record<string, string>>;
  };
};

/**
 * CLI command options (mutable for parsing)
 */
export type CliOptions = {
  verbose?: boolean;
  quiet?: boolean;
  /**
   * Strict bindings generation.
   * When enabled, `tsonic restore` / `tsonic add ...` will not relax any tsbindgen
   * validation rules (including constructor constraint loss).
   */
  strict?: boolean;
  config?: string;
  project?: string;
  src?: string;
  out?: string;
  namespace?: string;
  rid?: string;
  optimize?: "size" | "speed";
  keepTemp?: boolean;
  /**
   * Build/run from an existing generated output directory without re-running
   * `tsonic generate` (and therefore without wiping the output directory).
   *
   * Required for workflows where external tools generate additional C# sources
   * into the generated directory (e.g. EF Core compiled models / interceptors).
   */
  noGenerate?: boolean;
  noStrip?: boolean;
  lib?: string[]; // External library paths for .NET interop
  deps?: string[]; // Additional directories to probe for referenced assemblies/DLLs
  // Project init options
  skipTypes?: boolean;
  typesVersion?: string;
  js?: boolean; // Enable JSRuntime interop (installs @tsonic/js)
  nodejs?: boolean; // Enable Node.js interop (installs @tsonic/nodejs)
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
  readonly workspaceRoot: string;
  readonly rootNamespace: string;
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
  /**
   * When true, `tsonic build/run` will reuse the existing generated output
   * directory instead of re-generating C#.
   */
  readonly noGenerate: boolean;
  readonly verbose: boolean;
  readonly quiet: boolean;
  readonly typeRoots: readonly string[];
  readonly libraries: readonly string[]; // External library paths for .NET interop
  readonly frameworkReferences: readonly string[];
  readonly packageReferences: ReadonlyArray<{
    readonly id: string;
    readonly version: string;
  }>;
  readonly msbuildProperties?: Readonly<Record<string, string>>;
};

/**
 * Result type for operations
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
