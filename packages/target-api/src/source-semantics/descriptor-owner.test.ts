import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../host-input/descriptor-input.js";
import type { SourceInputComponent, SourceInputSignature } from "../host-input/identities.js";
import type { SourceCategoryDomain, SourceRefusal, SourceResult, SourceTypeDescriptor, SourceTypeEvidence } from "../public/source/contracts.js";
import { sourceFiniteLiteralDomain, sourceOpenLiteralDomain, type SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceEvidenceComponent } from "./descriptor-contracts.js";
import type { SourceEvidenceDetails, SourceMemberInventory, SourceMemberInventoryRow } from "./member-inventory.js";
import { createSourceDescriptorOwner } from "./descriptor-owner.js";
import { sourceTypeDescriptorDepth } from "./descriptor-metrics.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "class Left<T> { value!: T; } class Right {} class Access { get item(): string { return ''; } set item(value: number) {} } type Outer<U> = <T extends U = U>(value: T) => T; const constructed = { value: 1 }; function run(value: number): number { return value; }",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The exact original fixture file is required.");
  const originalFile = file;
  const nodes: Node[] = [];
  const originals = new Set<Node>();
  function visit(node: Node): void {
    originals.add(node);
    nodes.push(node);
    checked.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  }
  visit(file);
  function assertNode(node: Node): void {
    if (!originals.has(node)) throw new Error("Foreign original node.");
  }
  function named(name: string, predicate: (node: Node) => boolean): Node {
    const found = nodes.find(node => predicate(node) && checked.ast.text(checked.ast.name(node) ?? node) === name);
    if (found === undefined) throw new Error(`Missing original fixture declaration '${name}'.`);
    return found;
  }
  function createView() {
    const components = new WeakSet<SourceInputComponent>();
    const signatures = new WeakSet<SourceInputSignature>();
    const syntax = new WeakMap<Node, SourceInputComponent>();
    function original(node: Node): SourceInputComponent {
      assertNode(node);
      const previous = syntax.get(node);
      if (previous !== undefined) return previous;
      const value: SourceInputComponent = Object.freeze({ kind: "component", root: node, path: Object.freeze([]) });
      syntax.set(node, value);
      components.add(value);
      return value;
    }
    const unexpected = (): never => { throw new Error("This owner unit did not enroll an input semantic query."); };
    const input: SourceDescriptorInput = {
      ast: checked.ast, assertNode,
      assertComponent(value) { if (!components.has(value)) throw new Error("Foreign component."); },
      assertSignature(value) { if (!signatures.has(value)) throw new Error("Foreign original signature."); },
      syntax: original, describe: unexpected, members: unexpected, describeSignature: unexpected,
      signatureComponent: unexpected, enumDeclaration: unexpected, application: unexpected, constraints: unexpected,
    };
    const owner = createSourceDescriptorOwner({ input, assertNode, members: unexpected, project: unexpected,
      receiverBindings: (_value, direct) => ({ kind: "resolved", value: direct }) });
    function signature(declaration: Node, parameters: readonly Node[] = []) {
      assertNode(declaration);
      const source: SourceInputSignature = Object.freeze({ kind: "signature", owner: declaration,
        signatureKind: "call", declaration, typeParameters: Object.freeze([...parameters]) });
      signatures.add(source);
      return owner.builder.signature(declaration, "call", source, declaration, parameters);
    }
    function evidence(type: SourceTypeDescriptor, category: SourceCategoryDomain, root: Node = originalFile,
      domain: SourceLiteralDomain = sourceOpenLiteralDomain, children: readonly SourceEvidenceComponent[] = [],
      details: SourceEvidenceDetails = { members: { kind: "complete", members: [], indexes: [] }, origins: { kind: "complete", nodes: [] } }): SourceTypeEvidence {
      return owner.builder.evidence({ type, component: owner.builder.componentIdentity(root, []), category,
        numeric: undefined, sum: undefined }, children, undefined, domain, details);
    }
    return { ...owner, evidence, original, signature };
  }
  return { checked, file, nodes, named, createView };
}

function resolved<Value>(value: SourceResult<Value>): Value {
  if (value.kind === "refused") throw new Error(value.message);
  return value.value;
}

test("nominal identity includes the original declaration and ordered arguments", () => {
  const current = fixture(), { builder } = current.createView();
  const left = current.named("Left", current.checked.ast.is.IsClassDeclaration);
  const right = current.named("Right", current.checked.ast.is.IsClassDeclaration);
  const integer = builder.primitive("int32"), floating = builder.primitive("float64");
  const first = builder.declared({ declaration: left, typeArguments: [integer, floating] });
  assert.equal(first === builder.declared({ declaration: right, typeArguments: [integer, floating] }), false);
  assert.equal(first === builder.declared({ declaration: left, typeArguments: [floating, integer] }), false);
  assert.equal(first === builder.declared({ declaration: left, typeArguments: [integer, floating] }), true);
});

test("descriptor publication owns vectors but never freezes checked source nodes", () => {
  const current = fixture(), { builder } = current.createView();
  const declaration = current.named("Left", current.checked.ast.is.IsClassDeclaration);
  const arguments_ = [builder.primitive("int32")];
  const selected = builder.declared({ declaration, typeArguments: arguments_ });
  arguments_.push(builder.string());
  assert.equal(selected.typeArguments.length, 1);
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.typeArguments), true);
  assert.equal(selected.declaration === declaration, true);
  assert.equal(Object.isFrozen(declaration), false);
});

test("publication interns every descriptor kind without accepting copied or foreign descriptors", () => {
  const current = fixture(), local = current.createView(), foreign = current.createView();
  const { builder } = local;
  const declaration = current.named("Left", current.checked.ast.is.IsClassDeclaration);
  const callable = current.named("run", current.checked.ast.is.IsFunctionDeclaration);
  const integer = builder.primitive("int32"), identity = local.signature(callable);
  const signature = { identity, parameters: [{ kind: "required" as const, type: integer }], result: integer };
  const factories = [() => builder.primitive("int32"), () => builder.string(), () => builder.intrinsic("absence"),
    () => builder.union([integer, builder.string()]), () => builder.callable({ calls: [signature], constructs: [] }),
    () => builder.array(integer, false), () => builder.optional(integer),
    () => builder.tuple([{ kind: "required", type: integer }], true),
    () => builder.declared({ declaration, typeArguments: [integer] }),
    () => builder.shape({ members: [{ name: "value", optional: false, readonly: false, type: integer,
      origin: { kind: "declared", declaration } }], indexes: [], calls: [signature], constructs: [] }),
    () => builder.projection(integer, { kind: "awaited" })];
  for (const produce of factories) {
    const value = produce();
    assert.equal(produce() === value && Object.isFrozen(value), true, value.kind);
    assert.throws(() => builder.assertDescriptor({ ...value }), /exact program view/);
    assert.throws(() => foreign.view.assertDescriptor(value), /exact program view/);
  }
  assert.throws(() => builder.array(foreign.builder.primitive("int32"), false), /exact program view/);
});

test("declared definitions preserve original owners, recursion and pending completion", () => {
  const current = fixture(), local = current.createView(), other = current.createView();
  const declaration = current.named("Right", current.checked.ast.is.IsClassDeclaration);
  let complete = false;
  const nominal = local.evidence(local.builder.declared({ declaration, typeArguments: [] }), { kind: "known", category: "object" });
  const component = local.builder.componentIdentity(declaration, []);
  local.builder.define(declaration, [], () => complete ? { kind: "resolved", value: nominal }
    : { kind: "pending", dependencies: [component] }, () => ({ kind: "resolved", value: { kind: "complete", members: [], indexes: [] } }));
  assert.equal(local.builder.produceDefinition(nominal).kind, "pending");
  assert.equal(local.builder.produceDefinition(nominal).kind, "pending");
  complete = true;
  assert.equal(resolved(local.view.definition(nominal)) === nominal, true);
  const separate = other.evidence(other.builder.declared({ declaration, typeArguments: [] }), { kind: "known", category: "object" });
  assert.throws(() => other.view.definition(separate), /register its original definition owner/);
});

test("member presence is independent of optional value geometry", () => {
  const current = fixture(), { builder } = current.createView();
  const declaration = current.named("Left", current.checked.ast.is.IsClassDeclaration);
  const value = builder.optional(builder.primitive("int32"));
  const shape = (optional: boolean) => builder.shape({ members: [{ name: "value", optional, readonly: false, type: value,
    origin: { kind: "declared", declaration } }], indexes: [], calls: [], constructs: [] });
  const required = shape(false), optional = shape(true);
  assert.equal(required === optional, false);
  assert.equal(required.kind === "shape" && required.members[0]?.optional === false &&
    required.members[0].type.kind === "optional" && Object.isFrozen(required.members[0]), true);
});

test("descriptor graph depth retains the original bounded inference purpose", () => {
  const current = fixture(), { builder } = current.createView();
  let type = builder.primitive("int32");
  for (let depth = 0; depth < 4; depth++) type = builder.array(type, false);
  assert.equal(sourceTypeDescriptorDepth(type), 4);
  assert.equal(sourceTypeDescriptorDepth(builder.optional(type)), 5);
  assert.equal(builder.optional(type) === type, false);
});

test("family normalization retains category and literal domain while preserving authored roles", () => {
  const current = fixture(), local = current.createView();
  const component = local.builder.componentIdentity(current.file, []), integer = local.builder.primitive("int64");
  const number = local.evidence(integer, { kind: "known", category: "number" }, current.file,
    sourceFiniteLiteralDomain([{ kind: "number", value: { kind: "integer", value: 5n } }]));
  const bigint = local.evidence(integer, { kind: "known", category: "bigint" }, current.file,
    sourceFiniteLiteralDomain([{ kind: "bigint", value: 5n }]));
  const mixed = resolved(local.builder.join(component, "authored", [number, bigint], undefined));
  assert.equal(mixed.sum?.arms.length, 2);
  assert.equal(mixed.sum?.roles[0]?.value === number && mixed.sum.roles[1]?.value === bigint, true);
  const first = local.evidence(local.builder.string(), { kind: "known", category: "string" }, current.file,
    sourceFiniteLiteralDomain([{ kind: "string", value: "a" }]));
  const second = local.evidence(local.builder.string(), { kind: "known", category: "string" }, current.file,
    sourceFiniteLiteralDomain([{ kind: "string", value: "b" }]));
  assert.equal(resolved(local.builder.join(component, "authored", [first, second], undefined)).sum?.arms.length, 2);
  const duplicate = local.evidence(first.type, first.category, current.file, local.builder.domain(first));
  const collapsed = resolved(local.builder.join(component, "authored", [first, duplicate], undefined));
  assert.equal(collapsed.sum?.arms.length === 1 && collapsed.sum.roles.length === 2, true);
});

test("foreign evidence and copied sums are rejected even after equivalent warm publication", () => {
  const current = fixture(), local = current.createView(), foreign = current.createView();
  const value = local.evidence(local.builder.string(), { kind: "known", category: "string" });
  const remote = foreign.evidence(foreign.builder.string(), { kind: "known", category: "string" });
  const component = local.builder.componentIdentity(current.file, []);
  const first = resolved(local.builder.join(component, "authored", [value, value], undefined));
  assert.equal(local.view.freeParameters(first).length, 0);
  assert.throws(() => local.builder.join(component, "authored", [remote], undefined), /exact descriptor view/);
  assert.throws(() => local.view.scalarLiteral({ ...value }), /exact descriptor view/);
  const sum = first.sum;
  if (sum === undefined) throw new Error("The original family application is required.");
  assert.throws(() => local.builder.applyFamily({ ...sum.family }, []), /exact original descriptor view/);
});

test("constraint-only and default-only captured binders remain lazy through substitution", () => {
  const current = fixture(), local = current.createView();
  const outer = current.named("U", current.checked.ast.is.IsTypeParameterDeclaration);
  const inner = current.named("T", node => current.checked.ast.is.IsTypeParameterDeclaration(node) &&
    current.checked.ast.parent(node) !== current.named("Left", current.checked.ast.is.IsClassDeclaration));
  const owner = current.checked.ast.parent(inner);
  const outerOwner = current.checked.ast.parent(outer);
  if (owner === undefined || outerOwner === undefined) throw new Error("Original binder owners are required.");
  const none = (): SourceResult<{ readonly kind: "none" }> => ({ kind: "resolved", value: { kind: "none" } });
  local.builder.parameter(outer, outerOwner, 0, [], none, none);
  let forced = 0;
  const refusal: SourceRefusal = Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_SOURCE_FORM_UNSUPPORTED",
    site: inner, message: "The authentic unsupported constraint child is forwarded unchanged." });
  const parameter = local.builder.parameter(inner, owner, 0, [outer], () => { forced++; return refusal; }, () => { forced++; return refusal; });
  const value = local.evidence(parameter.type, { kind: "parameter", declaration: inner });
  const identity = local.signature(owner, [inner]);
  const callable = local.evidence(local.builder.callable({ calls: [{ identity, parameters: [{ kind: "required", type: value.type }], result: value.type }], constructs: [] }),
    { kind: "known", category: "object" }, owner, sourceOpenLiteralDomain,
    [{ selector: { kind: "parameter", signature: identity, index: 0 }, value }, { selector: { kind: "result", signature: identity }, value }]);
  assert.equal(local.view.freeParameters(callable).map(value => value.declaration).includes(outer), true);
  assert.throws(() => local.builder.publishFamily(callable.component, "authored", [], [callable]), /every original free binder/);
  assert.equal(forced, 0);
  const actual = local.evidence(local.builder.string(), { kind: "known", category: "string" });
  const applied = resolved(local.view.substitute(callable, [{ declaration: outer, value: actual }]));
  assert.equal(local.view.freeParameters(applied).length, 0);
  assert.equal(forced, 0);
  assert.equal(local.view.constraint(parameter) === refusal && local.view.defaultType(parameter) === refusal, true);
  assert.equal(forced, 2);
  assert.equal(local.refusals().includes(refusal), true);
});

test("construction metadata is registered before child production and retained by exact identity", () => {
  const current = fixture(), local = current.createView();
  const occurrence = current.nodes.find(current.checked.ast.is.IsObjectLiteralExpression);
  if (occurrence === undefined) throw new Error("The original construction is required.");
  const declaration = current.checked.ast.members(occurrence)[0];
  if (declaration === undefined) throw new Error("The original property is required.");
  let forced = 0;
  const row: SourceMemberInventoryRow = { key: { kind: "name", name: "value" }, name: "value", declarations: [declaration],
    origins: [{ kind: "declared", declaration }], readOrigins: [{ kind: "declared", declaration }], writeOrigins: [{ kind: "declared", declaration }],
    getters: [], setters: [], read: "property", optional: false, readonly: false,
    readDomain: () => ({ kind: "none" }),
    readType: () => { forced++; return { kind: "pending", dependencies: [local.builder.componentIdentity(declaration, [])] }; },
    writeType: () => ({ kind: "resolved", value: { kind: "none" } }) };
  const original: SourceMemberInventory = { kind: "complete", members: [row], indexes: [] };
  local.builder.registerConstruction(occurrence, () => ({ kind: "resolved", value: original }));
  const metadata = local.builder.construction(occurrence);
  assert.equal(metadata.kind === "resolved" && metadata.value.kind === "complete", true);
  assert.equal(forced, 0);
  if (metadata.kind !== "resolved") throw new Error("The metadata must be available independently.");
  const value = local.evidence(local.builder.shape({ members: [], indexes: [], calls: [], constructs: [] }), { kind: "known", category: "object" },
    occurrence, sourceOpenLiteralDomain, [], { members: original, origins: { kind: "complete", nodes: [occurrence] } });
  const retained = local.builder.members(value);
  assert.equal(retained.kind === "resolved" && retained.value === metadata.value, true);
  assert.equal(forced, 0);
});

test("authored slot evidence and a receiver application remain distinct from projected reads", () => {
  const current = fixture(), local = current.createView();
  const declaration = current.named("Left", current.checked.ast.is.IsClassDeclaration);
  const binder = current.checked.ast.typeParameters(declaration)[0];
  if (binder === undefined) throw new Error("The original class binder is required.");
  const none = (): SourceResult<{ readonly kind: "none" }> => ({ kind: "resolved", value: { kind: "none" } });
  const parameter = local.builder.parameter(binder, declaration, 0, [], none, none);
  const original = local.evidence(parameter.type, { kind: "parameter", declaration: binder });
  const broad = local.evidence(local.builder.intrinsic("unknown"), { kind: "dynamic" });
  const receiver = local.evidence(local.builder.declared({ declaration, typeArguments: [broad.type] }), { kind: "known", category: "object" }, declaration,
    sourceOpenLiteralDomain, [{ selector: { kind: "type-argument", declaration, index: 0 }, value: broad }]);
  const slot = { origin: { kind: "declaration" as const, declaration }, type: original };
  local.builder.assertDestination({ declaration: slot, applied: resolved(local.view.substitute(original, [{ declaration: binder, value: broad }])),
    application: { kind: "receiver", receiver, bindings: [{ declaration: binder, value: broad }] } });
  assert.throws(() => local.builder.assertDestination({ declaration: slot, applied: broad, application: undefined }), /identical original declared slot evidence/);
  const integer = local.evidence(local.builder.primitive("int32"), { kind: "known", category: "number" });
  assert.throws(() => local.builder.assertDestination({ declaration: slot,
    applied: resolved(local.view.substitute(original, [{ declaration: binder, value: integer }])),
    application: { kind: "receiver", receiver, bindings: [{ declaration: binder, value: integer }] } }), /exact ordered environment/);
});

test("family equivalence retains distinct setter evidence without forcing unrelated member production", () => {
  const current = fixture(), local = current.createView();
  const getter = current.named("item", current.checked.ast.is.IsGetAccessorDeclaration);
  const setter = current.named("item", current.checked.ast.is.IsSetAccessorDeclaration);
  const read = local.evidence(local.builder.string(), { kind: "known", category: "string" });
  const firstWrite = local.evidence(local.builder.primitive("int32"), { kind: "known", category: "number" });
  const secondWrite = local.evidence(local.builder.primitive("int64"), { kind: "known", category: "number" });
  const readOrigin = { kind: "declared" as const, declaration: getter };
  const writeOrigin = { kind: "declared" as const, declaration: setter };
  const shape = local.builder.shape({ members: [{ name: "item", type: read.type, optional: false, readonly: false, origin: readOrigin }],
    indexes: [], calls: [], constructs: [] });
  let forced = 0;
  function object(write: SourceTypeEvidence): SourceTypeEvidence {
    const row: SourceMemberInventoryRow = { key: { kind: "name", name: "item" }, name: "item",
      declarations: [getter, setter], getters: [getter], setters: [setter], origins: [readOrigin, writeOrigin],
      readOrigins: [readOrigin], writeOrigins: [writeOrigin], read: "accessor", optional: false, readonly: false,
      readDomain: () => ({ kind: "present", value: local.builder.domain(read) }),
      readType: () => { forced++; return { kind: "resolved", value: { kind: "present", value: read } }; },
      writeType: () => { forced++; return { kind: "resolved", value: { kind: "present", value: write } }; } };
    return local.evidence(shape, { kind: "known", category: "object" }, getter, sourceOpenLiteralDomain,
      [{ selector: { kind: "member", origin: readOrigin }, value: read }, { selector: { kind: "member", origin: writeOrigin }, value: write }],
      { members: { kind: "complete", members: [row], indexes: [] }, origins: { kind: "complete", nodes: [getter, setter] } });
  }
  const first = object(firstWrite), second = object(secondWrite);
  assert.equal(first.type === second.type, true);
  assert.equal(resolved(local.builder.join(first.component, "authored", [first, second], undefined)).sum?.arms.length, 2);
  assert.equal(forced, 0);
});
