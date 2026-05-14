import { describe, it } from "mocha";
import { expect } from "chai";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type CompletionTracker = {
  readonly schemaVersion: 1;
  readonly policy: {
    readonly statusModel: readonly string[];
    readonly proofRequired: boolean;
    readonly proofTestsMayNotUseCatchAllRegressionFiles: boolean;
    readonly analysisDirectoryMayNotBeProofSource: boolean;
  };
  readonly bannedProductPatterns: readonly string[];
  readonly items: readonly CompletionItem[];
};

type CompletionItem = {
  readonly id: number;
  readonly priority: string;
  readonly title: string;
  readonly status: string;
  readonly proofTests: readonly string[];
  readonly example: {
    readonly source: string;
    readonly semantic: string;
    readonly emitted: string;
    readonly invariant: string;
  };
};

const repoRoot = resolve(process.cwd(), "../..");
const trackerPath = join(repoRoot, "docs/architecture/completion-tracker.json");

const readTracker = (): CompletionTracker =>
  JSON.parse(readFileSync(trackerPath, "utf8")) as CompletionTracker;

const walkFiles = (dir: string): readonly string[] => {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (
      entry === "dist" ||
      entry === "node_modules" ||
      entry === ".temp" ||
      entry === ".tests"
    ) {
      continue;
    }
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      result.push(...walkFiles(fullPath));
      continue;
    }
    result.push(fullPath);
  }
  return result;
};

const productFiles = (): readonly string[] =>
  [
    join(repoRoot, "packages/frontend/src"),
    join(repoRoot, "packages/emitter/src"),
    join(repoRoot, "packages/backend/src"),
    join(repoRoot, "packages/cli/src"),
    join(repoRoot, "test/scripts"),
  ]
    .flatMap((root) => walkFiles(root))
    .filter((file) => !file.endsWith(".test.ts"));

describe("architecture completion tracker", () => {
  it("marks all architecture-review items complete with concrete proof tests and examples", () => {
    const tracker = readTracker();
    expect(tracker.schemaVersion).to.equal(1);
    expect(tracker.policy.statusModel).to.deep.equal(["complete"]);
    expect(tracker.policy.proofRequired).to.equal(true);
    expect(tracker.items).to.have.length(25);

    const ids = tracker.items.map((item) => item.id);
    expect(ids).to.deep.equal(
      Array.from({ length: 25 }, (_, index) => index + 1)
    );

    for (const item of tracker.items) {
      expect(item.status, item.title).to.equal("complete");
      expect(item.proofTests, item.title).to.not.be.empty;
      expect(item.example.source, item.title).to.not.equal("");
      expect(item.example.semantic, item.title).to.not.equal("");
      expect(item.example.emitted, item.title).to.not.equal("");
      expect(item.example.invariant, item.title).to.not.equal("");

      for (const proofTest of item.proofTests) {
        expect(proofTest, item.title).to.not.include(".analysis/");
        expect(proofTest, item.title).to.not.match(
          /regression-coverage-[a-z]\.test\.ts$/
        );
        expect(existsSync(join(repoRoot, proofTest)), item.title).to.equal(
          true
        );
      }
    }
  });

  it("enforces tracker-level migration-debt bans across product code", () => {
    const tracker = readTracker();
    const hits: string[] = [];

    for (const file of productFiles()) {
      const relativeFile = relative(repoRoot, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      for (const bannedPattern of tracker.bannedProductPatterns) {
        if (text.includes(bannedPattern)) {
          hits.push(`${relativeFile}:${bannedPattern}`);
        }
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("keeps greenfield-only artifacts instead of compatibility shims", () => {
    expect(
      existsSync(join(repoRoot, "packages/emitter/src/test-ir-strict.ts"))
    ).to.equal(true);
    expect(
      existsSync(
        join(repoRoot, "packages/emitter/src/test-ir-normalization.ts")
      )
    ).to.equal(false);
    expect(
      existsSync(join(repoRoot, "test/scripts/run-all-serial.sh"))
    ).to.equal(false);

    const runAll = readFileSync(
      join(repoRoot, "test/scripts/run-all.sh"),
      "utf8"
    );
    expect(runAll).to.not.include("--serial-unit");
    expect(runAll).to.not.include("--parallel-unit");
    expect(runAll).to.not.include("TSONIC_PARALLEL_VALIDATE");
    expect(runAll).to.not.include("--no-verify");
  });
});
