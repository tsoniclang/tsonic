/**
 * Golden test harness - Public API
 */

export type { TestEntry, Scenario, DescribeNode } from "./types.js";
export { parseConfigYaml } from "./config-parser.js";
export { discoverScenarios } from "./discovery.js";
export { buildDescribeTree } from "./tree-builder.js";
export { normalizeCs, runScenario } from "./runner.js";
export { registerNode } from "./registration.js";
