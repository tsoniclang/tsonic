import { describe } from "mocha";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  buildDescribeTree,
  discoverScenarios,
  registerNode,
} from "./golden-tests/index.js";
import type { Scenario } from "./golden-tests/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type GoldenShardConfig = {
  readonly shardIndex: number;
  readonly shardCount: number;
};

const selectShardScenarios = (
  allScenarios: readonly Scenario[],
  cfg: GoldenShardConfig
): readonly Scenario[] => {
  const sorted = [...allScenarios].sort((a, b) =>
    a.inputPath.localeCompare(b.inputPath)
  );
  return sorted.filter((_, i) => i % cfg.shardCount === cfg.shardIndex);
};

export const registerGoldenTestShard = (cfg: GoldenShardConfig): void => {
  if (cfg.shardCount <= 0) {
    throw new Error(`Invalid shardCount: ${cfg.shardCount}`);
  }
  if (cfg.shardIndex < 0 || cfg.shardIndex >= cfg.shardCount) {
    throw new Error(
      `Invalid shardIndex: ${cfg.shardIndex} (count: ${cfg.shardCount})`
    );
  }

  describe(`Golden Tests (shard ${cfg.shardIndex + 1}/${cfg.shardCount})`, function () {
    // Golden tests run the full compiler+emitter pipeline per scenario and can
    // exceed the default timeout on slower machines / CI.
    this.timeout(60_000);

    const testcasesDir = path.join(__dirname, "../testcases");

    const scenarios = discoverScenarios(testcasesDir);
    const sharded = selectShardScenarios(scenarios, cfg);

    if (sharded.length === 0) {
      console.warn(
        `⚠️  No golden test cases found for shard ${cfg.shardIndex + 1}/${cfg.shardCount}`
      );
      return;
    }

    const tree = buildDescribeTree(sharded);
    if (tree) {
      registerNode(tree);
    }
  });
};
