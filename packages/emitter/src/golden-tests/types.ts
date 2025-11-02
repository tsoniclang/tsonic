/**
 * Golden test types
 */

export type TestEntry = {
  readonly input: string;
  readonly title: string;
};

export type Scenario = {
  readonly pathParts: readonly string[];
  readonly title: string;
  readonly inputPath: string;
  readonly expectedPath: string;
};

export type DescribeNode = {
  readonly name: string;
  readonly children: Map<string, DescribeNode>;
  tests: Scenario[];
};
