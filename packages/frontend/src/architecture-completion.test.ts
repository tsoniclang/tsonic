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

const frontendProductFiles = (): readonly string[] =>
  walkFiles(join(repoRoot, "packages/frontend/src")).filter((file) => {
    const relativeFile = relative(repoRoot, file).replace(/\\/g, "/");
    return (
      !file.endsWith(".test.ts") &&
      !relativeFile.includes("-cases/") &&
      !relativeFile.includes("/test-fixtures/")
    );
  });

const frontendTargetLeakPatterns: readonly RegExp[] = [
  /\bCLR\b/,
  /\bclr\b/,
  /\bCSharp\b/,
  /C#/,
  /\.NET/,
  /\bdotnet\b/,
  /\bNativeAOT\b/,
  /\bSystem\./,
  /\bMicrosoft\./,
  /\bBigInteger\b/,
  /global::System/,
  /\bSystem\.Private\.CoreLib\b/,
  /\bSystem\.Runtime\b/,
  /\bCoreLib\b/,
  /\bmscorlib\b/,
  /\bIEnumerable\b/,
  /\bIAsyncEnumerable\b/,
  /\bIEnumerator\b/,
  /\bIDisposable\b/,
  /\bValueTask\b/,
  /\bTask</,
  /\bFunc</,
  /\bAction</,
  /Expression\s*<\s*Func\b/,
  /\bLINQ\b/,
  /\bBCL\b/,
  /\bEF Core\b/,
  /\bdeclaringClrType\b/,
  /\bdeclaringAssemblyName\b/,
  /\bclrName\b/,
  /\bassemblyName\b/,
  /\bemittedCLRName\b/,
  /\bemittedClrName\b/,
];

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

  it("keeps frontend product code free of target-mechanism vocabulary", () => {
    const hits: string[] = [];

    for (const file of frontendProductFiles()) {
      const relativeFile = relative(repoRoot, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      for (const pattern of frontendTargetLeakPatterns) {
        if (pattern.test(text)) {
          hits.push(`${relativeFile}:${pattern.source}`);
        }
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("keeps frontend symbol handles stable-id routed instead of render-name constructed", () => {
    const hits: string[] = [];

    for (const file of frontendProductFiles()) {
      const relativeFile = relative(repoRoot, file).replace(/\\/g, "/");
      if (relativeFile === "packages/frontend/src/symbols/symbol-ids.ts") {
        continue;
      }
      if (
        relativeFile.startsWith(
          "packages/frontend/src/ir/type-system/internal/universe/"
        )
      ) {
        continue;
      }

      const text = readFileSync(file, "utf8");
      if (
        /\bcreate(Type|Member|Module)SymbolId\b/.test(text) ||
        /typeId\??\.targetName/.test(text) ||
        /\btargetQualifiedName\b/.test(text)
      ) {
        hits.push(relativeFile);
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("keeps external provider keys separate from target rendering", () => {
    const expressions = readFileSync(
      join(repoRoot, "packages/frontend/src/ir/types/expressions-core.ts"),
      "utf8"
    );
    expect(expressions).to.include(
      "Provider-local binding keys for externally-owned global/module values"
    );
    expect(expressions).to.include(
      "target render table"
    );

    const virtualMarking = readFileSync(
      join(repoRoot, "packages/frontend/src/ir/validation/virtual-marking-pass.ts"),
      "utf8"
    );
    expect(virtualMarking).to.include(
      "source-owned class hierarchy semantics only"
    );
    expect(virtualMarking).to.not.include("emitted native target name");
    expect(virtualMarking).to.not.include("emitted CLR");
  });

  it("wires the target surface provider instead of leaving the interface dormant", () => {
    const providerFile = join(
      repoRoot,
      "packages/frontend/src/program/binding-target-surface-provider.ts"
    );
    expect(existsSync(providerFile)).to.equal(true);

    const provider = readFileSync(providerFile, "utf8");
    expect(provider).to.include("createBindingTargetSurfaceProvider");
    expect(provider).to.include("TargetSurfaceProvider");

    const programAssembly = readFileSync(
      join(repoRoot, "packages/frontend/src/program/program-assembly.ts"),
      "utf8"
    );
    expect(programAssembly).to.include("createBindingTargetSurfaceProvider");
    expect(programAssembly).to.include("targetSurfaceProvider");

    const dependencyGraph = readFileSync(
      join(repoRoot, "packages/frontend/src/program/dependency-graph.ts"),
      "utf8"
    );
    expect(dependencyGraph).to.include(
      "targetSurfaceProvider?.getArtifacts().renderTable"
    );
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

  it("keeps emittable IR target-branded before backend emission", () => {
    const phases = readFileSync(
      join(repoRoot, "packages/frontend/src/ir/types/phases.ts"),
      "utf8"
    );
    expect(phases).to.include("declare const backendTargetBrand: unique symbol");
    expect(phases).to.include("defineBackendTargetId");
    expect(phases).to.include("declare const irTargetBrand: unique symbol");
    expect(phases).to.include("export type EmittableIrModule<");

    const pipeline = readFileSync(
      join(repoRoot, "packages/frontend/src/program/ir-processing-pipeline.ts"),
      "utf8"
    );
    expect(pipeline).to.include("backendTargetId?: Target");
    expect(pipeline).to.include("options.backendTargetId");

    const emitter = readFileSync(
      join(repoRoot, "packages/emitter/src/emitter.ts"),
      "utf8"
    );
    expect(emitter).to.include("CSharpEmittableIrModule");
    expect(emitter).to.not.match(/readonly EmittableIrModule\[\]/);

    const cliGenerate = readFileSync(
      join(repoRoot, "packages/cli/src/commands/generate/index.ts"),
      "utf8"
    );
    expect(cliGenerate).to.include("backendTargetId: CSHARP_BACKEND_TARGET_ID");
  });
});
