/**
 * Type definitions for CLI
 */

import type { NuGetPackage } from "@tsonic/backend";

/**
 * Tsonic configuration file (tsonic.json)
 */
export type TsonicConfig = {
  readonly $schema?: string;
  readonly rootNamespace: string;
  readonly entryPoint?: string;
  readonly sourceRoot?: string;
  readonly outputDirectory?: string;
  readonly outputName?: string;
  readonly rid?: string;
  readonly optimize?: "size" | "speed";
  readonly packages?: readonly NuGetPackage[];
  readonly buildOptions?: {
    readonly stripSymbols?: boolean;
    readonly invariantGlobalization?: boolean;
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
  packages?: string;
};

/**
 * Combined configuration (from file + CLI args)
 */
export type ResolvedConfig = {
  readonly rootNamespace: string;
  readonly entryPoint: string;
  readonly sourceRoot: string;
  readonly outputDirectory: string;
  readonly outputName: string;
  readonly rid: string;
  readonly optimize: "size" | "speed";
  readonly packages: readonly NuGetPackage[];
  readonly stripSymbols: boolean;
  readonly invariantGlobalization: boolean;
  readonly keepTemp: boolean;
  readonly verbose: boolean;
  readonly quiet: boolean;
};

/**
 * Result type for operations
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
