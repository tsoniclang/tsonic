/**
 * Golden test types
 */

/**
 * Runtime mode for golden tests:
 * - "dotnet": uses @tsonic/globals only (native .NET APIs)
 * - "js": uses @tsonic/globals + @tsonic/js-globals (JSRuntime APIs)
 */
export type RuntimeMode = "dotnet" | "js";

/**
 * Diagnostics matching mode:
 * - "contains": expected codes must be present, extra codes allowed (default)
 * - "exact": actual codes must exactly match expected codes
 */
export type DiagnosticsMode = "contains" | "exact";

export type TestEntry = {
  readonly input: string;
  readonly title: string;
  readonly expectDiagnostics?: readonly string[];
  readonly expectDiagnosticsMode?: DiagnosticsMode;
};

export type Scenario = {
  readonly pathParts: readonly string[];
  readonly title: string;
  readonly inputPath: string;
  readonly expectedPath?: string; // Optional when expectDiagnostics is set
  readonly expectDiagnostics?: readonly string[];
  readonly expectDiagnosticsMode?: DiagnosticsMode;
  readonly runtimeMode: RuntimeMode;
};

export type DescribeNode = {
  readonly name: string;
  readonly children: Map<string, DescribeNode>;
  tests: Scenario[];
};
