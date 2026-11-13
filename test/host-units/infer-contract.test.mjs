import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test, { before } from "node:test";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const emittedRoot = resolve(repository, "packages/host/dist");
let evidenceDirectory;

before(() => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    true, "all owner tests and compiler children require the admitted aggregate process-group guard");
  const parent = resolve(repository, ".temp/host-infer-contract");
  mkdirSync(parent, { recursive: true });
  evidenceDirectory = mkdtempSync(resolve(parent, "proof-"));
});

test("the emitted Infer contract takes the rule table through InferDeps and refuses each earlier positional form exactly", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  cpSync(emittedRoot, stage, { recursive: true, filter: source => !source.endsWith(".js") && !source.endsWith(".map") });
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const imports = 'import type { Result } from "./diag/contract.js";\n' +
    'import type { AtomicContribution, ConstraintSet, RuleTable, Solution } from "./ir-infer/contract.js";\n' +
    'import type { EnumerateContributions, InferDeps, SolveGroup } from "./infer/contract.js";\n';
  const same = 'type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;\n';
  const positive = imports + same +
    'export const rules: Same<InferDeps["rules"], RuleTable> = true;\n' +
    'export const enumerateParameters: Same<Parameters<EnumerateContributions>, [deps: InferDeps, constraints: readonly ConstraintSet[]]> = true;\n' +
    'export const solveParameters: Same<Parameters<SolveGroup>, [deps: InferDeps, constraints: readonly ConstraintSet[]]> = true;\n' +
    'export const enumerateResult: Same<ReturnType<EnumerateContributions>, Result<readonly AtomicContribution[]>> = true;\n' +
    'export const solveResult: Same<ReturnType<SolveGroup>, Result<Solution>> = true;\n' +
    'export function table(deps: InferDeps): RuleTable { return deps.rules; }\n' +
    'export function solve(operation: SolveGroup, deps: InferDeps, constraints: readonly ConstraintSet[]): Result<Solution> { return operation(deps, constraints); }\n';
  writeFileSync(resolve(stage, "consumer.ts"), positive);
  const compiler = resolve(tooling, "node_modules/@typescript/native-preview/bin/tsgo.js");
  const configuration = files => ({ compilerOptions: {
    strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true,
    noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true,
    skipLibCheck: false, noEmit: true, target: "ES2022", lib: ["ES2022"], types: [],
    module: "NodeNext", moduleResolution: "NodeNext", verbatimModuleSyntax: true,
  }, files });
  const run = (name, files) => {
    writeFileSync(resolve(stage, name), JSON.stringify(configuration(files)));
    const result = spawnSync(process.execPath, [compiler, "--project", resolve(stage, name), "--pretty", "false", "--listFiles"], {
      cwd: stage, encoding: "utf8", maxBuffer: 4_194_304, timeout: 120_000,
    });
    assert.equal(result.error === undefined, true, "the real consumer compiler completes without application error");
    assert.equal(result.signal, null);
    const text = `${result.stdout}${result.stderr}`;
    writeFileSync(resolve(stage, `${name}.log`), text);
    return { status: result.status, text };
  };
  const accepted = run("positive.json", ["consumer.ts"]);
  assert.equal(accepted.status, 0, accepted.text);
  const loaded = accepted.text.split(/\r?\n/u).filter(path => path.startsWith(stage))
    .map(path => relative(stage, path).split(sep).join("/"));
  for (const required of ["consumer.ts", "infer/contract.d.ts", "ir-infer/contract.d.ts", "diag/contract.d.ts"])
    assert.equal(loaded.includes(required), true, `${required} is loaded`);
  // 2322: an implementation that still takes the table as its second parameter is not the operation.
  // 2554: a call that still passes the table beside deps has one argument too many.
  // 2741: a dependency record without the table is not InferDeps.
  const negatives = [
    ["old-enumerate-implementation.ts", `${imports}declare const old: (deps: InferDeps, rules: RuleTable, constraints: readonly ConstraintSet[]) => Result<readonly AtomicContribution[]>;\nexport const enumerate: EnumerateContributions = old;\nexport type Kept = Solution | SolveGroup;`, 2322],
    ["old-solve-implementation.ts", `${imports}declare const old: (deps: InferDeps, rules: RuleTable, constraints: readonly ConstraintSet[]) => Result<Solution>;\nexport const solve: SolveGroup = old;\nexport type Kept = AtomicContribution | EnumerateContributions;`, 2322],
    ["old-enumerate-call.ts", `${imports}export function call(operation: EnumerateContributions, deps: InferDeps, rules: RuleTable, constraints: readonly ConstraintSet[]): Result<readonly AtomicContribution[]> { return operation(deps, rules, constraints); }\nexport type Kept = Solution | SolveGroup;`, 2554],
    ["old-solve-call.ts", `${imports}export function call(operation: SolveGroup, deps: InferDeps, rules: RuleTable, constraints: readonly ConstraintSet[]): Result<Solution> { return operation(deps, rules, constraints); }\nexport type Kept = AtomicContribution | EnumerateContributions;`, 2554],
    ["deps-without-rules.ts", `${imports}export function build(deps: Omit<InferDeps, "rules">): InferDeps { return deps; }\nexport type Kept = Result<null> | AtomicContribution | ConstraintSet | RuleTable | Solution | EnumerateContributions | SolveGroup;`, 2741],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negatives.map(([name]) => name));
  assert.equal(refused.status, 1, refused.text);
  const actual = [...refused.text.matchAll(/^(.+)\(\d+,\d+\): error TS(\d+):/gmu)]
    .map(match => [basename(match[1]), Number(match[2])]).sort(([left], [right]) => left.localeCompare(right));
  assert.equal([...refused.text.matchAll(/error TS\d+:/gu)].length, actual.length, refused.text);
  const expected = negatives.map(([name, , code]) => [name, code]).sort(([left], [right]) => left.localeCompare(right));
  assert.deepEqual(actual, expected, refused.text);
});
