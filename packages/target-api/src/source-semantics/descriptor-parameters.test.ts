import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { TargetCompilerResourceLimitFailure } from "../artifacts.js";
import type { SourceInputSignature } from "../host-input/identities.js";
import type { SourceCategoryDomain, SourceResult, SourceTypeBinding, SourceTypeDescriptor, SourceTypeEvidence } from "../public/source/contracts.js";
import { sourceOpenLiteralDomain } from "../source-model/literals/domain.js";
import { createSourceComponentOwner } from "./descriptor-components.js";
import type { SourceEvidenceComponent } from "./descriptor-contracts.js";
import { createSourceEvidenceOwner } from "./descriptor-evidence.js";
import { createSourceDescriptorInterner } from "./descriptor-interner.js";
import { createSourceParameterOwner } from "./descriptor-parameters.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "type Outer<U> = <T extends U>(value: T) => T;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original binder fixture file is required.");
  const originals = new Set<Node>();
  const nodes: Node[] = [];
  function visit(node: Node): void {
    originals.add(node);
    nodes.push(node);
    checked.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  }
  visit(file);
  function assertNode(node: Node): void {
    if (!originals.has(node)) throw new Error("Foreign original node.");
  }
  function binder(name: string): Node {
    const selected = nodes.find(node => checked.ast.is.IsTypeParameterDeclaration(node) &&
      checked.ast.text(checked.ast.name(node) ?? node) === name);
    if (selected === undefined) throw new Error("The complete original binder domain is required.");
    return selected;
  }
  const components = createSourceComponentOwner({ assertNode,
    assertSignature: signature => interner.assertSignature(signature),
    assertFamily: () => { throw new Error("This binder owner unit publishes no sum family."); },
    assertConstruction: definition => interner.assertConstruction(definition) });
  const originalSignatures = new WeakSet<SourceInputSignature>();
  const interner = createSourceDescriptorInterner({ assertNode, assertComponent: components.assert,
    assertSignature(signature) { if (!originalSignatures.has(signature)) throw new Error("Foreign original signature."); } });
  const evidence = createSourceEvidenceOwner({ components, assertNode, assertDescriptor: interner.assertDescriptor,
    assertOriginal: () => { throw new Error("This binder owner unit publishes canonical children without observed components."); },
    assertSum: () => { throw new Error("This binder owner unit publishes no sum application."); } });
  let reads = 0;
  const parameters = createSourceParameterOwner({ assertNode, interner, objectKey: components.objectKey,
    evidence: { ...evidence, record(value) { reads++; return evidence.record(value); } },
    observe: <Value>(value: SourceResult<Value>): SourceResult<Value> => value });
  let forced = 0;
  const none = (): SourceResult<{ readonly kind: "none" }> => { forced++; return { kind: "resolved", value: { kind: "none" } }; };
  const outer = binder("U"), inner = binder("T");
  for (const [declaration, captures] of [[outer, []], [inner, [outer]]] as const) {
    const owner = checked.ast.parent(declaration);
    if (owner === undefined) throw new Error("The exact original binder owner is required.");
    parameters.register(declaration, owner, 0, captures, none, none);
  }
  function publish(type: SourceTypeDescriptor, category: SourceCategoryDomain, children: readonly SourceEvidenceComponent[] = [],
    bindings: readonly SourceTypeBinding[] = []): SourceTypeEvidence {
    return evidence.create({ type, component: components.identity(file, []), category, numeric: undefined, sum: undefined },
      children, undefined, sourceOpenLiteralDomain, bindings,
      { members: { kind: "complete", members: [], indexes: [] }, origins: { kind: "complete", nodes: [file] } });
  }
  const leaf = publish(interner.parameter(inner), { kind: "parameter", declaration: inner });
  function pair(child: SourceTypeEvidence, bindings: readonly SourceTypeBinding[] = []): SourceTypeEvidence {
    return publish(interner.tuple([{ kind: "required", type: child.type }, { kind: "required", type: child.type }], false),
      { kind: "known", category: "object" },
      [{ selector: { kind: "tuple-element", index: 0 }, value: child }, { selector: { kind: "tuple-element", index: 1 }, value: child }], bindings);
  }
  function callable(child: SourceTypeEvidence): SourceTypeEvidence {
    const declaration = checked.ast.parent(inner);
    if (declaration === undefined) throw new Error("The original callable declaration is required.");
    const original: SourceInputSignature = Object.freeze({ kind: "signature", owner: declaration, signatureKind: "call",
      declaration, typeParameters: Object.freeze([inner]), composition: undefined });
    originalSignatures.add(original);
    const identity = interner.signature(declaration, "call", original, declaration, [inner]);
    return publish(interner.callable({ calls: [{ identity, parameters: [], result: child.type }], constructs: [] }),
      { kind: "known", category: "object" }, [{ selector: { kind: "result", signature: identity }, value: child }]);
  }
  return { file, inner, outer, parameters, interner, publish, pair, callable, leaf,
    reads: () => reads, forced: () => forced };
}

test("canonical free binders reuse each completed shared child and repeat query", () => {
  const current = fixture();
  let value = current.leaf;
  for (let index = 0; index < 60; index++) value = current.pair(value);
  const before = current.reads();
  const result = current.parameters.free(value);
  assert.deepEqual(result.map(parameter => parameter.declaration === current.inner ? "T" : parameter.declaration === current.outer ? "U" : "foreign"), ["T", "U"]);
  assert.equal(current.reads() - before, 61);
  assert.equal(Object.isFrozen(result), true);
  const complete = current.reads();
  assert.equal(current.parameters.free(value) === result, true);
  assert.equal(current.reads(), complete);
  let closed = current.publish(current.interner.string(), { kind: "known", category: "string" });
  for (let index = 0; index < 60; index++) closed = current.pair(closed);
  const beforeClosed = current.reads();
  const closedDomain = current.parameters.free(closed);
  assert.deepEqual(closedDomain.map(parameter => parameter.declaration === current.inner ? "T" : "unexpected"), []);
  assert.equal(current.reads() - beforeClosed, 61);
  const afterClosed = current.reads();
  assert.equal(current.parameters.free(closed) === closedDomain, true);
  assert.equal(current.reads(), afterClosed);
  assert.equal(current.forced(), 0);
});

test("completed child summaries keep independent bound, capture and requirement environments", () => {
  const current = fixture();
  const bound = current.callable(current.leaf);
  const text = current.publish(current.interner.string(), { kind: "known", category: "string" });
  const closed = current.pair(current.leaf, [{ declaration: current.inner, value: text }]);
  const self = current.pair(current.leaf, [{ declaration: current.inner, value: current.leaf }]);
  const captured = current.pair(bound, [{ declaration: current.outer, value: text }]);
  const domain = (value: SourceTypeEvidence): readonly string[] => current.parameters.free(value).map(parameter =>
    parameter.declaration === current.inner ? "T" : parameter.declaration === current.outer ? "U" : "foreign");
  assert.deepEqual(domain(bound), ["U"]);
  assert.deepEqual(domain(current.leaf), ["T", "U"]);
  assert.deepEqual(domain(closed), []);
  assert.deepEqual(domain(captured), []);
  assert.deepEqual(domain(self), ["T", "U"]);
  assert.deepEqual(domain(bound), ["U"]);
  assert.deepEqual(domain(current.leaf), ["T", "U"]);
  assert.equal(current.forced(), 0);
  const foreign = fixture();
  assert.throws(() => current.parameters.free(foreign.leaf), /exact descriptor view/);
});

test("canonical binder expansion keeps the original resource owner, site and finite depth", () => {
  const current = fixture();
  let value = current.leaf;
  for (let index = 0; index < 130; index++) value = current.pair(value);
  let failure: TargetCompilerResourceLimitFailure | undefined;
  try { current.parameters.free(value); } catch (error) {
    if (!(error instanceof TargetCompilerResourceLimitFailure)) throw error;
    failure = error;
  }
  assert.equal(failure !== undefined, true);
  if (failure === undefined) throw new Error("The genuine demanded expansion must retain its resource failure.");
  assert.equal(failure.diagnostic.code, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(failure.diagnostic.sourceNode === current.file, true);
  assert.equal(failure.diagnostic.source, "tsonic");
  assert.deepEqual(failure.diagnostic.evidence, ["depth=128"]);
  assert.equal(current.forced(), 0);
});
