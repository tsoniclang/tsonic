import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../host-input/descriptor-input.js";
import type { SourceInputComponent, SourceInputSignature } from "../host-input/identities.js";
import type { SourceCategoryDomain, SourceMemberKey, SourceRefusal, SourceResult, SourceSignatureIdentity, SourceTypeDescriptor, SourceTypeEvidence } from "../public/source/contracts.js";
import { sourceFiniteLiteralDomain, sourceOpenLiteralDomain, type SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceEvidenceComponent } from "./descriptor-contracts.js";
import type { SourceEvidenceDetails, SourceMemberInventory, SourceMemberInventoryRow } from "./member-inventory.js";
import { createSourceDescriptorOwner } from "./descriptor-owner.js";
import { sourceTypeDescriptorDepth } from "./descriptor-metrics.js";
import { createSourceMemberCorrespondenceQueries } from "./member-correspondence.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "class Left<T> { value!: T; } class Right {} class Access { get item(): string { return ''; } set item(value: number) {} } interface TaggedLeft { tag: 'a'; x: number; lazy: string; } interface TaggedRight { tag: 'b'; x: number; lazy: string; } type Outer<U> = <T extends U = U>(value: T) => T; const constructed = { value: 1 }; function run(value: number): number { return value; }",
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
    const originalSignatures = new WeakMap<SourceSignatureIdentity, SourceInputSignature>();
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
      syntax: original, describe: unexpected, members: unexpected, markers: unexpected, describeSignature: unexpected,
      signatureComponent: unexpected, enumDeclaration: unexpected, application: unexpected, constraints: unexpected,
    };
    const owner = createSourceDescriptorOwner({ input, assertNode, members: unexpected, project: unexpected,
      receiverBindings: (_value, direct) => ({ kind: "resolved", value: direct }) });
    function signature(declaration: Node, parameters: readonly Node[] = []) {
      assertNode(declaration);
      const source: SourceInputSignature = Object.freeze({ kind: "signature", owner: declaration,
        signatureKind: "call", declaration, typeParameters: Object.freeze([...parameters]), composition: undefined });
      signatures.add(source);
      const selected = owner.builder.signature(declaration, "call", source, declaration, parameters);
      originalSignatures.set(selected, source);
      return selected;
    }
    function composite(parts: readonly SourceSignatureIdentity[]): SourceSignatureIdentity {
      const originals = parts.map(part => {
        const original = originalSignatures.get(part);
        if (original === undefined) throw new Error("A composite requires exact signatures from this view.");
        return original;
      });
      const parameters = Object.freeze([...new Set(originals.flatMap(part => part.typeParameters))]);
      const original: SourceInputSignature = Object.freeze({ kind: "signature", owner: undefined, signatureKind: "call",
        declaration: undefined, typeParameters: parameters, composition: Object.freeze({ kind: "union", signatures: Object.freeze(originals) }) });
      signatures.add(original);
      return owner.builder.signature(undefined, "call", original, undefined, parameters);
    }
    function evidence(type: SourceTypeDescriptor, category: SourceCategoryDomain, root: Node = originalFile,
      domain: SourceLiteralDomain = sourceOpenLiteralDomain, children: readonly SourceEvidenceComponent[] = [],
      details: SourceEvidenceDetails = { members: { kind: "complete", members: [], indexes: [] }, origins: { kind: "complete", nodes: [] } }): SourceTypeEvidence {
      return owner.builder.evidence({ type, component: owner.builder.componentIdentity(root, []), category,
        numeric: undefined, sum: undefined }, children, undefined, domain, details);
    }
    return { ...owner, evidence, original, signature, composite, assertNode };
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
    () => builder.shape({ members: [{ name: "value", key: { kind: "string", value: "value" }, optional: false, readonly: false, type: integer,
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
  const shape = (optional: boolean) => builder.shape({ members: [{ name: "value", key: { kind: "string", value: "value" }, optional, readonly: false, type: value,
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
    readDomain: () => ({ kind: "resolved", value: sourceOpenLiteralDomain }),
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
  local.builder.define(declaration, [binder], () => ({ kind: "resolved", value: receiver }),
    () => ({ kind: "resolved", value: { kind: "complete", members: [], indexes: [] } }));
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
  const shape = local.builder.shape({ members: [{ name: "item", key: { kind: "string", value: "item" }, type: read.type, optional: false, readonly: false, origin: readOrigin }],
    indexes: [], calls: [], constructs: [] });
  let forced = 0;
  function object(write: SourceTypeEvidence): SourceTypeEvidence {
    const row: SourceMemberInventoryRow = { key: { kind: "name", name: "item" }, name: "item",
      declarations: [getter, setter], getters: [getter], setters: [setter], origins: [readOrigin, writeOrigin],
      readOrigins: [readOrigin], writeOrigins: [writeOrigin], read: "accessor", optional: false, readonly: false,
      readDomain: () => ({ kind: "resolved", value: local.builder.domain(read) }),
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

function literalCorrespondenceFixture(options: { readonly equalTags?: boolean; readonly refuseLazy?: boolean; readonly domainPending?: boolean } = {}) {
  const current = fixture(), local = current.createView();
  const left = current.named("TaggedLeft", current.checked.ast.is.IsInterfaceDeclaration);
  const right = current.named("TaggedRight", current.checked.ast.is.IsInterfaceDeclaration);
  const forced = { tag: 0, x: 0, lazy: 0 };
  let ready = options.domainPending !== true;
  const refusal: SourceRefusal = Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_SOURCE_FORM_UNSUPPORTED",
    site: left, message: "The unrelated original lazy member is unsupported." });
  function object(declaration: Node, tag: string): SourceTypeEvidence {
    const rows: SourceMemberInventoryRow[] = [];
    const children: SourceEvidenceComponent[] = [];
    const members: Extract<SourceTypeDescriptor, { readonly kind: "shape" }>["members"][number][] = [];
    for (const member of current.checked.ast.members(declaration)) {
      if (member === undefined) throw new Error("Original member metadata must be complete.");
      const name = current.checked.ast.text(current.checked.ast.name(member) ?? member);
      if (name !== "tag" && name !== "x" && name !== "lazy") throw new Error("Unexpected original member.");
      const value = local.evidence(name === "x" ? local.builder.primitive("int32") : local.builder.string(),
        { kind: "known", category: name === "x" ? "number" : "string" }, member,
        name === "tag" ? sourceFiniteLiteralDomain([{ kind: "string", value: tag }]) : sourceOpenLiteralDomain);
      const origin = { kind: "declared" as const, declaration: member };
      members.push({ name, key: { kind: "string", value: name }, origin, optional: false, readonly: false, type: value.type });
      children.push({ selector: { kind: "member", origin }, value });
      rows.push({ key: { kind: "name", name }, name, declarations: [member], getters: [], setters: [],
        origins: [origin], readOrigins: [origin], writeOrigins: [origin], read: "property", optional: false, readonly: false,
        readDomain: () => name === "tag" && !ready ? { kind: "pending", dependencies: [value.component] }
          : { kind: "resolved", value: local.builder.domain(value) },
        readType: () => {
          forced[name]++;
          return name === "lazy" && options.refuseLazy ? refusal : { kind: "resolved", value: { kind: "present", value } };
        }, writeType: () => ({ kind: "resolved", value: { kind: "present", value } }) });
    }
    return local.evidence(local.builder.shape({ members, indexes: [], calls: [], constructs: [] }),
      { kind: "known", category: "object" }, declaration, sourceOpenLiteralDomain, children,
      { members: { kind: "complete", members: rows, indexes: [] }, origins: { kind: "complete", nodes: [declaration] } });
  }
  const source = object(left, "a"), destination = object(right, options.equalTags ? "a" : "b");
  const selectedDeclaration = current.checked.ast.members(right).find(member => member !== undefined &&
    current.checked.ast.text(current.checked.ast.name(member) ?? member) === "x");
  if (selectedDeclaration === undefined) throw new Error("The exact selected original declaration is required.");
  const queries = createSourceMemberCorrespondenceQueries({ view: local.view, assertNode: local.assertNode,
    inventory: { members: local.builder.members, construction: local.builder.construction }, domain: local.builder.domain });
  return { forced, refusal, ready: () => { ready = true; },
    selected: () => queries.correspondingMember(source, destination, selectedDeclaration, "read", () => ({ kind: "resolved", value: "no" })),
    full: () => queries.correspondence(source, destination, "read", () => ({ kind: "resolved", value: "no" })) };
}

test("required literal disjointness is stable before and after unrelated member reads in either query order", () => {
  for (const first of ["selected", "full"] as const) {
    const current = literalCorrespondenceFixture();
    if (first === "full") {
      const full = current.full();
      assert.equal(full.kind === "resolved" && full.value.kind === "unavailable" && full.value.reason === "disjoint-shape", true);
    }
    const before = current.selected();
    assert.equal(before.kind === "resolved" && before.value.kind === "none", true, first);
    if (first === "selected") assert.equal(current.forced.tag + current.forced.x + current.forced.lazy, 0);
    const full = current.full();
    assert.equal(full.kind === "resolved" && full.value.kind === "unavailable" && full.value.reason === "disjoint-shape", true);
    const after = current.selected();
    assert.equal(after.kind === "resolved" && after.value.kind === "none", true, first);
  }
});

test("unresolved literal metadata stays pending and selected reads never force unrelated refused children", () => {
  const pending = literalCorrespondenceFixture({ domainPending: true });
  assert.equal(pending.selected().kind, "pending");
  assert.equal(pending.forced.tag + pending.forced.x + pending.forced.lazy, 0);
  pending.ready();
  const disjoint = pending.selected();
  assert.equal(disjoint.kind === "resolved" && disjoint.value.kind === "none", true);
  const current = literalCorrespondenceFixture({ equalTags: true, refuseLazy: true });
  const before = current.selected();
  assert.equal(before.kind === "resolved" && before.value.kind === "present", true);
  assert.equal(current.forced.tag + current.forced.lazy, 0);
  assert.equal(current.full() === current.refusal, true);
  const after = current.selected();
  assert.equal(after.kind === "resolved" && after.value.kind === "present", true);
});

test("member domains substitute original binders before any read child is produced", () => {
  const current = fixture(), local = current.createView();
  const declaration = current.named("Left", current.checked.ast.is.IsClassDeclaration);
  const binder = current.checked.ast.typeParameters(declaration)[0];
  const member = current.checked.ast.members(declaration)[0];
  if (binder === undefined || member === undefined) throw new Error("The original class binder and member are required.");
  const none = (): SourceResult<{ readonly kind: "none" }> => ({ kind: "resolved", value: { kind: "none" } });
  const parameter = local.builder.parameter(binder, declaration, 0, [], none, none);
  const template = local.evidence(parameter.type, { kind: "parameter", declaration: binder });
  const actual = local.evidence(local.builder.string(), { kind: "known", category: "string" }, member,
    sourceFiniteLiteralDomain([{ kind: "string", value: "a" }]));
  let forced = 0;
  const origin = { kind: "declared" as const, declaration: member };
  const row: SourceMemberInventoryRow = { key: { kind: "name", name: "value" }, name: "value", declarations: [member], getters: [], setters: [],
    origins: [origin], readOrigins: [origin], writeOrigins: [origin], read: "property", optional: false, readonly: false,
    readDomain: bindings => ({ kind: "resolved", value: local.builder.domain(bindings.find(binding => binding.declaration === binder)?.value ?? template) }),
    readType: () => { forced++; return { kind: "resolved", value: { kind: "present", value: template } }; },
    writeType: () => ({ kind: "resolved", value: { kind: "present", value: template } }) };
  local.builder.define(declaration, [binder], () => ({ kind: "resolved", value: template }),
    () => ({ kind: "resolved", value: { kind: "complete", members: [row], indexes: [] } }));
  const receiver = local.evidence(local.builder.declared({ declaration, typeArguments: [actual.type] }),
    { kind: "known", category: "object" }, declaration, sourceOpenLiteralDomain,
    [{ selector: { kind: "type-argument", declaration, index: 0 }, value: actual }]);
  const inventory = local.builder.members(receiver);
  if (inventory.kind !== "resolved" || inventory.value.kind !== "complete") throw new Error("The original member inventory must resolve.");
  const selected = inventory.value.members[0];
  if (selected === undefined) throw new Error("The original member row is required.");
  const domain = selected.readDomain([]);
  assert.equal(domain.kind === "resolved" && domain.value.kind === "finite" && domain.value.values[0]?.kind === "string" &&
    domain.value.values[0].value === "a", true);
  assert.equal(forced, 0);
  const read = selected.readType();
  assert.equal(read.kind === "resolved" && read.value.kind === "present" &&
    read.value.value === resolved(local.view.substitute(template, [{ declaration: binder, value: actual }])), true);
  assert.equal(forced, 1);
});

test("lazy member production retries pending and unavailable but snapshots only complete metadata", () => {
  const current = fixture(), local = current.createView();
  let attempts = 0;
  const complete: SourceMemberInventory = { kind: "complete", members: [], indexes: [] };
  const value = local.evidence(local.builder.shape({ members: [], indexes: [], calls: [], constructs: [] }),
    { kind: "known", category: "object" }, current.file, sourceOpenLiteralDomain, [],
    { members: { kind: "production", produce: () => {
      attempts++;
      return attempts === 1 ? { kind: "pending", dependencies: [local.builder.componentIdentity(current.file, [])] }
        : { kind: "resolved", value: attempts === 2 ? { kind: "unavailable" } : complete };
    } }, origins: { kind: "complete", nodes: [] } });
  assert.equal(local.builder.members(value).kind, "pending");
  const unavailable = local.builder.members(value);
  assert.equal(unavailable.kind === "resolved" && unavailable.value.kind === "unavailable", true);
  const first = local.builder.members(value), again = local.builder.members(value);
  assert.equal(first.kind === "resolved" && first.value.kind === "complete" && again.kind === "resolved" && again.value === first.value, true);
  assert.equal(attempts, 3);
});

test("composite identities retain exact constituents and binder inventory without a first owner", () => {
  const current = fixture(), local = current.createView();
  const declaration = current.named("Outer", current.checked.ast.is.IsTypeAliasDeclaration);
  const outer = current.checked.ast.typeParameters(declaration)[0];
  const inner = current.nodes.find(node => current.checked.ast.is.IsTypeParameterDeclaration(node) &&
    current.checked.ast.text(current.checked.ast.name(node) ?? node) === "T" && current.checked.ast.parent(node) !==
      current.named("Left", current.checked.ast.is.IsClassDeclaration));
  if (outer === undefined || inner === undefined) throw new Error("Both distinct original binders are required.");
  const first = local.signature(declaration, [outer]), second = local.signature(declaration, [inner]);
  const selected = local.composite([first, second]);
  assert.equal(selected.owner === undefined && selected.composition.kind === "present", true);
  assert.equal(selected.typeParameters.length, 2);
  assert.equal(selected.composition.kind === "present" && selected.composition.value.signatures[0] === first &&
    selected.composition.value.signatures[1] === second, true);
  assert.equal(first.typeParameters.length === 1 && second.typeParameters.length === 1, true);
  assert.equal(Object.isFrozen(selected) && selected.composition.kind === "present" &&
    Object.isFrozen(selected.composition.value.signatures), true);
  const result = local.builder.primitive("int32");
  assert.throws(() => local.builder.callable({ calls: [{ identity: { ...selected }, parameters: [], result }], constructs: [] }), /exact program view/);
  const foreign = current.createView();
  assert.throws(() => foreign.builder.callable({ calls: [{ identity: selected, parameters: [], result: foreign.builder.primitive("int32") }], constructs: [] }), /exact program view/);
});

test("declared member keys preserve original numeric category, signed zero and exact immutable payload", () => {
  const current = fixture(), local = current.createView();
  const declaration = current.named("Left", current.checked.ast.is.IsClassDeclaration);
  const primitive = local.builder.primitive("int32");
  const shape = (key: SourceMemberKey) => local.builder.shape({ members: [{ name: "0", key,
    origin: { kind: "declared", declaration }, optional: false, readonly: false, type: primitive }], indexes: [], calls: [], constructs: [] });
  const positive = shape({ kind: "number", value: { kind: "checked-float64", value: 0 } });
  assert.equal(positive === shape({ kind: "number", value: { kind: "checked-float64", value: -0 } }), false);
  assert.equal(positive === shape({ kind: "string", value: "0" }), false);
  const token = { coefficient: 9007199254740993n, exponent: 0n, negative: false, decimalText: "9007199254740993" };
  const exact = shape({ kind: "number", value: { kind: "authored", token } });
  token.coefficient = 0n;
  const key = exact.kind === "shape" ? exact.members[0]?.key : undefined;
  assert.equal(key?.kind === "number" && key.value.kind === "authored" && key.value.token.coefficient === 9007199254740993n &&
    Object.isFrozen(key.value.token), true);
});
