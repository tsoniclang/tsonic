/**
 * Test registration for Mocha
 */

import { DescribeNode } from "./types.js";
import { runScenario } from "./runner.js";

/**
 * Register describe blocks recursively
 */
export const registerNode = (node: DescribeNode): void => {
  describe(node.name, () => {
    // Register child describe blocks
    for (const child of node.children.values()) {
      registerNode(child);
    }

    // Register tests at this level
    for (const scenario of node.tests) {
      it(scenario.title, async () => {
        await runScenario(scenario);
      });
    }
  });
};
