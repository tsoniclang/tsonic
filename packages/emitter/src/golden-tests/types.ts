/**
 * Golden test types
 */

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
};

export type DescribeNode = {
  readonly name: string;
  readonly children: Map<string, DescribeNode>;
  tests: Scenario[];
};
