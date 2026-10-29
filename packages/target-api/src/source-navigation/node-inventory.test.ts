import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type CheckedSourceProgram, type Node, type SourceFile } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageTransport } from "../target-analysis/source-storage/transport/transport.js";
import { createSourceProgramNavigation } from "./navigation.js";
import { createSourceNodeInventory } from "./node-inventory.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/alpha.ts": `export interface Box { readonly value: number; }
      export function first(input: Box): number {
        const select = (value: number): number => value + 1;
        return select(input.value);
      }
      export declare class Ambient { readonly field: number; read(): number; }`,
    "/src/beta.ts": `export class Second { readonly value = 2; read(): number { return this.value; } }`,
    "/src/native.d.ts": `export interface Native { readonly value: number; }
      export declare function external(): number;`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "inventory controls are real checked source");
  const file = (name: string): SourceFile => {
    const selected = checked.getSourceFile(`/src/${name}`);
    assert.equal(selected !== undefined, true, `${name}: exact checked file exists`);
    if (selected === undefined) throw new Error("Expected an original checked inventory file.");
    return selected;
  };
  return { checked, source: createTargetSourceProgram(checked), alpha: file("alpha.ts"),
    beta: file("beta.ts"), native: file("native.d.ts") };
}

function originalNodes(source: CheckedSourceProgram, root: Node): readonly Node[] {
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(root);
  return nodes;
}

function assertNodes(actual: readonly Node[], expected: readonly Node[], label: string): void {
  assert.equal(actual.length, expected.length, `${label}: complete original-node count`);
  assert.equal(actual.every((node, index) => node === expected[index]), true, `${label}: exact ordered node identities`);
}

test("node inventory publishes original roots and nested syntax once in reverse file and source child order", () => {
  const current = fixture();
  const { navigation } = current.source;
  const expected = [...navigation.sourceFiles].reverse().flatMap(file => originalNodes(current.checked, file));
  assertNodes(navigation.nodes, expected, "default inventory");
  assert.equal(new Set(navigation.nodes).size, navigation.nodes.length, "each original checked node occurs once");
  assert.equal(Object.isFrozen(navigation.nodes), true, "the published default array is immutable");
  assert.equal(navigation.nodes[0] === navigation.sourceFiles[navigation.sourceFiles.length - 1], true, "the last requested file root comes first");
  const positions = new Map(navigation.nodes.map((node, index) => [node, index]));
  for (const node of navigation.nodes) {
    const parent = current.checked.ast.parent(node);
    if (parent !== undefined && positions.has(parent)) {
      assert.equal(positions.get(parent)! < positions.get(node)!, true, "every selected parent precedes its original child");
    }
  }
});

test("node inventory defaults do not widen to target files and exact explicit views include checked declarations", () => {
  const current = fixture();
  const { navigation } = current.source;
  assert.equal(current.source.sourceFiles.includes(current.native), true, "the checked target input retains its declaration file");
  assert.equal(navigation.sourceFiles.includes(current.native), false, "navigation's default file contract excludes declarations");
  assert.equal(navigation.nodes.some(node => current.checked.ast.getSourceFile(node) === current.native), false,
    "the default node inventory does not accidentally include declarations or library nodes");
  const filtered = createSourceProgramNavigation({ ...current.checked, sourceFiles: Object.freeze([current.alpha]) });
  assertNodes(filtered.nodes, originalNodes(current.checked, current.alpha), "filtered default");
  const selected = filtered.nodesForFiles([current.beta, current.native]);
  assertNodes(selected, [...originalNodes(current.checked, current.native), ...originalNodes(current.checked, current.beta)],
    "explicit checked files outside default");
  assert.equal(Object.isFrozen(selected), true, "the explicit array is immutable");
  assert.equal(filtered.sourceFiles.length === 1 && filtered.sourceFiles[0] === current.alpha, true,
    "an explicit view never widens the published default membership");
});

test("node inventory has an empty declaration-only default and an exact explicit declaration view", () => {
  const current = fixture();
  const navigation = createSourceProgramNavigation({ ...current.checked, sourceFiles: Object.freeze([current.native]) });
  assert.equal(navigation.sourceFiles.length, 0, "declaration-only input has no project implementation files");
  assert.equal(navigation.nodes.length, 0, "the default inventory is exactly empty");
  assert.equal(navigation.nodesForFiles([]) === navigation.nodes, true, "the repeated empty default keeps array identity");
  assertNodes(navigation.nodesForFiles([current.native]), originalNodes(current.checked, current.native), "explicit declaration-only view");
});

test("node inventory subset and reordered-file views preserve exact scope and original identities", () => {
  const current = fixture();
  const { navigation } = current.source;
  assertNodes(navigation.nodesForFiles([current.alpha]), originalNodes(current.checked, current.alpha), "exact subset");
  assertNodes(navigation.nodesForFiles([current.beta, current.alpha]),
    [...originalNodes(current.checked, current.alpha), ...originalNodes(current.checked, current.beta)], "reordered request");
  assert.equal(navigation.nodesForFiles([current.alpha]).every(node => navigation.nodes.includes(node)), true,
    "subset views reuse the original default nodes, never cloned syntax");
});

test("node inventory rejects duplicate and foreign checked-file identities before returning a view", () => {
  const current = fixture();
  const foreign = fixture();
  const { navigation } = current.source;
  assert.equal(current.checked.ast.getFileName(current.alpha), foreign.checked.ast.getFileName(foreign.alpha),
    "the foreign file deliberately has the same spelling");
  assert.equal(current.checked.containsSourceFile(foreign.alpha), false, "membership is checked-program identity, not file spelling");
  assert.throws(() => navigation.nodesForFiles([current.alpha, current.alpha]), /distinct source files/u, "duplicate explicit file");
  assert.throws(() => navigation.nodesForFiles([current.alpha, foreign.alpha]), /exact checked source-file ownership/u,
    "a valid prefix cannot conceal a foreign file");
  assert.throws(() => createSourceNodeInventory(current.checked, [current.alpha, current.alpha]), /distinct source files/u,
    "duplicate default file");
  assert.throws(() => createSourceNodeInventory(current.checked, [foreign.alpha]), /exact checked source-file ownership/u,
    "foreign default file");
  assertNodes(navigation.nodesForFiles([current.alpha]), originalNodes(current.checked, current.alpha), "valid view after refusal");
});

test("node inventory caches each original file once and keeps immutable default and node identity", () => {
  const current = fixture();
  const reads = new Map<Node, number>();
  const ast = { ...current.checked.ast, forEachChild(...args: Parameters<typeof current.checked.ast.forEachChild>) {
    const node = args[0];
    if (node !== undefined) reads.set(node, (reads.get(node) ?? 0) + 1);
    return current.checked.ast.forEachChild(...args);
  } };
  const files = [current.alpha, current.beta];
  const inventory = createSourceNodeInventory({ ast, containsSourceFile: current.checked.containsSourceFile }, files);
  const nodes = inventory.nodes;
  assert.equal(nodes.every(node => reads.get(node) === 1), true, "one original tree read per default node");
  assert.equal(inventory.nodesForFiles([...files]) === nodes, true, "a repeated exact default reuses its array");
  inventory.nodesForFiles([current.alpha]);
  inventory.nodesForFiles([current.beta, current.alpha]);
  assert.equal(nodes.every(node => reads.get(node) === 1), true, "overlapping views do not walk cached files again");
  const declared = inventory.nodesForFiles([current.native]);
  inventory.nodesForFiles([current.native, current.alpha]);
  assert.equal(declared.every(node => reads.get(node) === 1), true, "explicit declaration nodes also have one cache owner");
  files.reverse();
  assertNodes(inventory.nodes, nodes, "caller mutation cannot rewrite the default selection");
  assert.equal(inventory.nodesForFiles([current.alpha, current.beta]) === nodes, true, "the original default remains canonical");
  assert.throws(() => Reflect.apply(Array.prototype.push, nodes, [current.alpha]), TypeError, "published arrays cannot grow");
});

test("node inventory needs only original syntax and membership, never type, fact or storage queries", () => {
  const current = fixture();
  const syntax = { ast: current.checked.ast, containsSourceFile: current.checked.containsSourceFile,
    getSourceFileQueries() { throw new Error("The syntax inventory must not query type checking."); },
    get sourceFacts() { throw new Error("The syntax inventory must not query semantic facts."); } };
  const inventory = createSourceNodeInventory(syntax, [current.alpha]);
  assertNodes(inventory.nodes, originalNodes(current.checked, current.alpha), "syntax-only authority");
  assertNodes(inventory.nodesForFiles([current.native]), originalNodes(current.checked, current.native), "explicit syntax-only declaration view");
});

test("node inventory never caches or publishes a partially enumerated file after an exception", () => {
  const current = fixture();
  const failure = new Error("The fixture's original file traversal is unavailable.");
  let blocked = true;
  const ast = { ...current.checked.ast, forEachChild(...args: Parameters<typeof current.checked.ast.forEachChild>) {
    const node = args[0];
    if (blocked && node !== undefined && node !== current.native && current.checked.ast.getSourceFile(node) === current.native) throw failure;
    return current.checked.ast.forEachChild(...args);
  } };
  const inventory = createSourceNodeInventory({ ast, containsSourceFile: current.checked.containsSourceFile }, [current.alpha]);
  const original = inventory.nodes;
  assert.throws(() => inventory.nodesForFiles([current.native]), error => error === failure,
    "an original enumeration failure is not turned into successful partial syntax or a language refusal");
  assert.equal(inventory.nodes === original, true, "a failed explicit request does not alter the default inventory");
  blocked = false;
  assertNodes(inventory.nodesForFiles([current.native]), originalNodes(current.checked, current.native), "complete retry of the same checked file");
});

test("storage transport consumes the canonical selected view and preserves ambient, budget and effect processing", () => {
  const current = fixture();
  const files = Object.freeze([current.alpha, current.native, current.beta]);
  const expected = current.source.navigation.nodesForFiles(files);
  const requests: (readonly SourceFile[])[] = [];
  const calls: Node[] = [];
  const navigation = { ...current.source.navigation, nodesForFiles(selected: readonly SourceFile[]) {
    requests.push(selected);
    return current.source.navigation.nodesForFiles(selected);
  } };
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport({ ...current.source, navigation }, files, budget, {
    call(node) { calls.push(node); return undefined; },
  });
  assert.equal(budget.failure() === undefined, true, "the original bounded transport still completes");
  assert.equal(requests.length === 1 && requests[0] === files, true, "transport requests the exact canonical view once");
  assertNodes(transport.visitedNodes, expected, "transport syntax projection");
  const usage = budget.usage();
  for (const [quantity, expectedCount] of [["nodes", 92], ["edges", 17], ["subjects", 40],
    ["rows", 83], ["peakRows", 132], ["steps", 316]] as const) {
    assert.equal(usage[quantity], expectedCount, `${quantity}: exact original transport accounting, including checked ambient contexts`);
  }
  assertNodes(calls, expected.filter(node => current.checked.ast.is.IsCallExpression(node)), "actual call-effect visit order");
  for (const node of expected) {
    let ambient = current.checked.ast.getSourceFile(node)?.IsDeclarationFile === true;
    for (let owner: Node | undefined = node; owner !== undefined; owner = current.checked.ast.parent(owner)) {
      ambient ||= current.checked.ast.hasModifierKind(owner, "ambient");
    }
    assert.equal(transport.hasNode(node), true, "each selected original node remains admitted");
    assert.equal(transport.declarationIsAmbient(node), ambient, "original declaration ambient inheritance is preserved");
  }
});

test("canonical node inventory stays complete and identical across storage resource failure and effect history", () => {
  const current = fixture();
  const { navigation } = current.source;
  const before = navigation.nodes;
  const limited = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumNodes: 1 });
  let rejectedCalls = 0;
  const failed = createSourceStorageTransport(current.source, [current.alpha, current.beta], limited, {
    call() { rejectedCalls += 1; return undefined; },
  });
  assert.equal(limited.failure(), "Source storage transport exceeds its finite source-node budget.", "the old finite node guard still fails");
  assert.equal(limited.usage().nodes, 2, "both file-root admissions keep the original finite accounting");
  assert.equal(failed.visitedNodes.length, 0, "the failed root admission cannot start semantic visits");
  assert.equal(rejectedCalls, 0, "failed resource admission never executes provider effects");
  assert.equal(navigation.nodes === before && before.length > 2, true, "resource failure does not truncate or invalidate canonical syntax");
  const complete = createSourceStorageBudget(defaultSourceStorageLimits);
  let calls = 0;
  createSourceStorageTransport(current.source, navigation.sourceFiles, complete, { call() { calls += 1; return undefined; } });
  assert.equal(complete.failure() === undefined && calls > 0, true, "the independent ordinary transport still visits real effects");
  assert.equal(navigation.nodes === before, true, "provider history cannot change default inventory identity");
  assertNodes(navigation.nodes, [...navigation.sourceFiles].reverse().flatMap(file => originalNodes(current.checked, file)),
    "full syntax after semantic history");
});

test("explicit checked syntax views never widen storage's selected semantic-file boundary", () => {
  const current = fixture();
  const source = createTargetSourceProgram({ ...current.checked, sourceFiles: Object.freeze([current.alpha]) });
  assert.equal(source.semantics.includes(current.beta), false, "the checked second file is not part of this semantic selection");
  assertNodes(source.navigation.nodesForFiles([current.beta]), originalNodes(current.checked, current.beta), "valid explicit checked syntax");
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, [current.beta], budget);
  assert.equal(budget.failure(), "Source storage transport requires exact checked source-file ownership.",
    "syntax membership does not bypass the existing semantic-file guard");
  assert.equal(transport.visitedNodes.length, 0, "no semantic processing is admitted outside the selected files");
  assertNodes(source.navigation.nodes, originalNodes(current.checked, current.alpha), "unchanged selected default after refusal");
});
