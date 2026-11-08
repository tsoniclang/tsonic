import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { freezeSourceTypeDescriptor, sourceTypeDescriptorDepth, sourceTypeDescriptorsEqual } from "./terms.js";
import type { SourceTypeDescriptor } from "./types.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "function run() { const first = 1; const second = 2; const third = 3; } class Left { value = 1; } class Right {}",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original checked file is required.");
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    if (checked.ast.is.IsVariableDeclaration(node) || checked.ast.is.IsClassDeclaration(node)) nodes.push(node);
    checked.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return { ast: checked.ast, nodes };
}

test("nominal identity includes the original declaration and ordered arguments", () => {
  const current = fixture();
  const integer: SourceTypeDescriptor = { kind: "primitive", primitive: "int32" };
  const floating: SourceTypeDescriptor = { kind: "primitive", primitive: "float64" };
  const first: SourceTypeDescriptor = { kind: "declared", declaration: current.nodes[3]!, typeArguments: [integer, floating] };
  assert.equal(sourceTypeDescriptorsEqual(first, { ...first, declaration: current.nodes[4]! }), false);
  assert.equal(sourceTypeDescriptorsEqual(first, { ...first, typeArguments: [floating, integer] }), false);
  assert.equal(sourceTypeDescriptorsEqual(first, { ...first, typeArguments: [integer, floating] }), true);
});

test("descriptor freezing owns vectors but never freezes checked source nodes", () => {
  const current = fixture(); const declaration = current.nodes[3]!;
  const source: SourceTypeDescriptor = { kind: "declared", declaration, typeArguments: [{ kind: "primitive", primitive: "int32" }] };
  const frozen = freezeSourceTypeDescriptor(source);
  assert.equal(Object.isFrozen(frozen), true);
  assert.equal(frozen.kind === "declared" && Object.isFrozen(frozen.typeArguments), true);
  assert.equal(frozen.kind === "declared" && frozen.declaration === declaration, true);
  assert.equal(Object.isFrozen(source), false);
});

test("descriptor publication freezes each exact object once across every descriptor kind", () => {
  const current = fixture();
  const integer: SourceTypeDescriptor = { kind: "primitive", primitive: "int32" };
  const signature = { typeParameters: [], parameters: [{ kind: "required" as const, type: integer }], result: integer };
  const descriptors: SourceTypeDescriptor[] = [
    integer, { kind: "string" }, { kind: "intrinsic", intrinsic: "absence" },
    { kind: "union", types: [integer, { kind: "string" }] },
    { kind: "callable", calls: [signature], constructs: [] },
    { kind: "array", readonly: false, element: integer },
    { kind: "optional", value: integer },
    { kind: "tuple", readonly: true, elements: [{ kind: "required", type: integer }] },
    { kind: "declared", declaration: current.nodes[3]!, typeArguments: [integer], definition: integer },
    { kind: "shape", members: [{ name: "value", optional: false, type: integer,
      origin: { kind: "declared", declaration: current.ast.members(current.nodes[3]!)[0]! } }],
    indexes: [], calls: [signature], constructs: [] },
  ];
  for (const descriptor of descriptors) {
    const frozen = freezeSourceTypeDescriptor(descriptor);
    assert.equal(freezeSourceTypeDescriptor(descriptor) === frozen, true, `${descriptor.kind}: repeated input identity`);
    assert.equal(freezeSourceTypeDescriptor(frozen) === frozen, true, `${descriptor.kind}: repeated publication identity`);
    assert.equal(Object.isFrozen(frozen), true, `${descriptor.kind}: immutable publication`);
    assert.equal(Object.isFrozen(descriptor), false, `${descriptor.kind}: caller's input remains separate`);
  }
});

test("shared declared definitions retain identity without merging distinct bodies or recursion cuts", () => {
  const current = fixture();
  const definition: SourceTypeDescriptor = { kind: "primitive", primitive: "int32" };
  const first: SourceTypeDescriptor = { kind: "declared", declaration: current.nodes[3]!,
    typeArguments: [{ kind: "string" }], definition };
  const second: SourceTypeDescriptor = { ...first, definition: { kind: "primitive", primitive: "int64" } };
  const frozen = freezeSourceTypeDescriptor(first);
  const shared = freezeSourceTypeDescriptor({ ...first });
  const distinct = freezeSourceTypeDescriptor(second);
  const cut = freezeSourceTypeDescriptor({ kind: "declared", declaration: current.nodes[3]!,
    typeArguments: first.typeArguments, cut: "recursion" });
  assert.equal(frozen.kind === "declared" && shared.kind === "declared" &&
    frozen.definition === shared.definition && frozen.definition === freezeSourceTypeDescriptor(definition), true);
  assert.equal(frozen.kind === "declared" && distinct.kind === "declared" &&
    frozen.definition !== distinct.definition && distinct.definition?.kind === "primitive" &&
    distinct.definition.primitive === "int64", true, "represented arguments cannot merge different published bodies");
  assert.equal(cut.kind === "declared" && cut.definition === undefined && cut.cut === "recursion", true,
    "freezing an identity-only cut never borrows another definition");
});

test("member presence survives freezing and is not inferred from its optional value type", () => {
  const current = fixture();
  const declaration = current.ast.members(current.nodes[3]!)[0]!;
  const value: SourceTypeDescriptor = { kind: "optional", value: { kind: "primitive", primitive: "int32" } };
  const required: SourceTypeDescriptor = { kind: "shape", members: [{ name: "value", optional: false, type: value,
    origin: { kind: "declared", declaration } }], indexes: [], calls: [], constructs: [] };
  const optional: SourceTypeDescriptor = { kind: "shape", members: [{ name: "value", optional: true, type: value,
    origin: { kind: "declared", declaration } }], indexes: [], calls: [], constructs: [] };
  assert.equal(sourceTypeDescriptorsEqual(required, optional), false);
  const frozen = freezeSourceTypeDescriptor(required);
  assert.equal(sourceTypeDescriptorsEqual(required, frozen), true);
  assert.equal(frozen.kind === "shape" && frozen.members[0]?.optional === false &&
    frozen.members[0].type.kind === "optional" && Object.isFrozen(frozen.members[0]), true);
});

test("term depth and declared optional descriptors use the same bounded algebra", () => {
  let type: SourceTypeDescriptor = { kind: "primitive", primitive: "int32" };
  for (let depth = 0; depth < 4; depth += 1) type = { kind: "array", readonly: false, element: type };
  assert.equal(sourceTypeDescriptorDepth(type), 4);
  assert.equal(sourceTypeDescriptorDepth({ kind: "optional", value: type }), 5);
  assert.equal(sourceTypeDescriptorsEqual({ kind: "optional", value: type }, type), false);
});
