/**
 * Golden test types
 */

export type TestEntry = {
  readonly input: string;
  readonly title: string;
  readonly expectDiagnostics?: readonly string[];
};

export type Scenario = {
  readonly pathParts: readonly string[];
  readonly title: string;
  readonly inputPath: string;
  readonly expectedPath?: string; // Optional when expectDiagnostics is set
  readonly expectDiagnostics?: readonly string[];
};

export type DescribeNode = {
  readonly name: string;
  readonly children: Map<string, DescribeNode>;
  tests: Scenario[];
};
