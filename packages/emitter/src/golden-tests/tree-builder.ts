/**
 * Build describe tree structure for nested tests
 */

import { Scenario, DescribeNode } from "./types.js";

/**
 * Build a tree structure for nested describe blocks
 */
export const buildDescribeTree = (
  scenarios: readonly Scenario[]
): DescribeNode | null => {
  if (scenarios.length === 0) return null;

  const root: DescribeNode = {
    name: "Golden Tests",
    children: new Map(),
    tests: [],
  };

  for (const scenario of scenarios) {
    let current = root;

    // Navigate/create tree nodes for each path part
    for (const part of scenario.pathParts) {
      let node = current.children.get(part);
      if (!node) {
        node = {
          name: part,
          children: new Map(),
          tests: [],
        };
        current.children.set(part, node);
      }
      current = node;
    }

    // Add test to the leaf node
    current.tests.push(scenario);
  }

  return root;
};
