import assert from "node:assert/strict";
import test from "node:test";
import { sourcePrimitive } from "@tsonic/tsts";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { typescriptNoLibUtilityDeclarations } from "../../packages/target-api/dist/source-profiles/typescript-no-lib-utilities.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";
import { componentEvidenceGlobals, componentEvidenceNativeDeclarations, componentEvidenceProgram } from "./fixtures/source-type-component-evidence-fixtures.mjs";

function resolved(result, label) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? `${label}: ${result.message}` : label);
  return result.value;
}

function fixture(canonicalUtilities = false, extra = {}) {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const outcome = checkSourceProgramFixture({ project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [],
    compilerOptions: { strict: true, noLib: canonicalUtilities, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    targetContributions: base => ({ ...base, semanticsModules: [...base.semanticsModules ?? [], {
      moduleSpecifier: "@test/native/types.js", packageName: "@test/native", subpath: "types.js",
      exports: [sourcePrimitive("word", "int32", "number", true, 32)],
    }] }),
    files: {
      ...(canonicalUtilities ? { "/src/typescript-utilities.d.ts": typescriptNoLibUtilityDeclarations,
        "/src/globals.d.ts": componentEvidenceGlobals } : {}),
      "/src/node_modules/@test/native/package.json": JSON.stringify({ name: "@test/native", version: "1.0.0", type: "module",
        exports: { "./types.js": "./types.d.ts" } }),
      "/src/node_modules/@test/native/types.d.ts": componentEvidenceNativeDeclarations,
      "/src/index.ts": componentEvidenceProgram,
      ...extra,
    } });
  const source = resolved(outcome, "the original program uses the normal Host checking and adjudication route");
  assert.equal(outcome.diagnostics.length, 0, outcome.diagnostics.map(issue => issue.message).join("\n"));
  const { ast, facts } = source;
  const nodes = [];
  const pending = [...source.sourceFiles];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    pending.push(...ast.children(node).filter(child => child !== undefined));
  }
  const file = source.sourceFiles.find(node => ast.getFileName(node) === "/src/index.ts");
  assert.equal(file !== undefined, true);
  const declaration = name => {
    const selected = ast.statements(file).find(node => node !== undefined && ast.text(ast.name(node)) === name);
    assert.equal(selected !== undefined, true, name);
    return selected;
  };
  const alias = name => {
    const annotation = ast.typeNode(declaration(name));
    assert.equal(annotation !== undefined, true, name);
    return annotation;
  };
  const selected = name => resolved(facts.values.declaredSlot(declaration(name)), name).type;
  const component = (value, selector) => {
    const child = resolved(facts.descriptors.component(value, selector), selector.kind);
    facts.descriptors.assertEvidence(child);
    return child;
  };
  const definition = value => resolved(facts.descriptors.definition(value), "canonical original definition");
  const member = (value, name) => {
    const body = definition(value);
    assert.equal(body.type.kind, "shape");
    const metadata = body.type.members.find(candidate => candidate.name === name);
    assert.equal(metadata !== undefined, true, name);
    return { metadata, value: component(body, { kind: "member", origin: metadata.origin }), body };
  };
  return { source, ast, facts, nodes, file, declaration, alias, selected, component, definition, member };
}

function payload(current, value) {
  return value.type.kind === "optional" ? current.component(value, { kind: "optional-value" }) : value;
}

function arms(value) {
  return value.sum?.arms ?? [value];
}

function callable(current, value) {
  const selected = current.definition(value);
  assert.equal(selected.type.kind === "callable" || selected.type.kind === "shape", true);
  assert.equal(selected.type.calls.length, 1, "these original fixtures have exactly one callable head");
  return { value: selected, signature: selected.type.calls[0] };
}

test("transformed components retain ordinary keyword evidence through exact aliases", () => {
  const current = fixture();
  const head = callable(current, current.selected("Indirect"));
  for (const [index, name] of ["Floating", "Wide"].entries()) {
    const value = current.component(head.value, { kind: "parameter", signature: head.signature.identity, index });
    assert.equal(value.type === current.selected(name).type, true, name);
    assert.equal(current.source.documents.includes(current.source.documents.forNode(value.component.root)), true);
    assert.equal(Object.isFrozen(value) && Object.isFrozen(value.component) && Object.isFrozen(value.component.path), true);
  }
});

test("homomorphic utilities preserve exact intrinsic object components without empty structural carriers", () => {
  const current = fixture(true);
  for (const name of ["ReadonlyObject", "PartialObject", "RequiredObject"]) {
    const value = current.definition(current.selected(name));
    assert.equal(value.type.kind === "intrinsic" && value.type.intrinsic === "object", true, name);
    assert.equal(value.category.kind === "known" && value.category.category === "object", true, name);
  }
  const fields = current.definition(current.selected("ReadonlyFields"));
  assert.equal(fields.type.kind === "shape" && fields.type.members.length === 1 && fields.type.members[0].readonly, true);
  const empty = current.definition(current.selected("ReadonlyEmpty"));
  assert.equal(empty.type.kind === "shape" && empty.type.members.length === 0, true,
    "an authored empty shape remains distinct from the broad object intrinsic");
});

test("canonical readonly views retain generic and native components without changing other utilities", () => {
  const current = fixture(true);
  const generic = current.selected("ReadonlyGeneric");
  const parameter = current.ast.typeParameters(current.declaration("ReadonlyGeneric"))[0];
  assert.equal(current.facts.descriptors.freeParameters(generic).some(value => value.declaration === parameter), true);
  const native = current.definition(current.selected("ReadonlyNative"));
  assert.equal(native.type.kind === "shape" && native.type.indexes.length === 1 && native.type.indexes[0].readonly, true);
  const index = native.type.indexes[0];
  const indexed = current.component(native, { kind: "index-value", declaration: index.declaration });
  assert.equal(payload(current, indexed).type === current.selected("Exact").type, true);
  assert.equal(current.member(current.selected("PartialFields"), "value").metadata.optional, true);
  assert.equal(current.member(current.selected("RequiredFields"), "value").metadata.optional, false);
  for (const name of ["PickedFields", "RecordedFields"]) {
    const body = current.definition(current.selected(name));
    assert.equal(body.type.kind === "shape" && body.type.members.length === 1 && body.type.members[0].name === "value", true, name);
  }
});

test("explicit and inferred readonly results retain the same original generic component without invented syntax", () => {
  const current = fixture(true);
  for (const name of ["readonlyExplicit", "readonlyInferred"]) {
    const declaration = current.declaration(name);
    const head = callable(current, resolved(current.facts.values.declaredSlot(declaration), name).type);
    assert.equal(head.signature.identity.declaration === declaration, true);
    const result = current.component(head.value, { kind: "result", signature: head.signature.identity });
    const parameter = current.ast.typeParameters(declaration)[0];
    assert.equal(current.facts.descriptors.freeParameters(result).some(value => value.declaration === parameter), true, name);
    assert.equal(current.ast.typeNode(declaration) === undefined, name === "readonlyInferred");
    const originalCall = current.nodes.find(node => current.ast.is.IsCallExpression(node) &&
      current.ast.parent(node) !== undefined && current.ast.getSourceFile(node) === current.file &&
      current.source.facts.navigation.enclosing(node, "body") === declaration);
    assert.equal(originalCall !== undefined, true);
    const application = resolved(current.facts.applications.application(originalCall), name);
    assert.equal(application.identity.signatureBindings.length, 1);
    assert.equal(application.identity.signatureBindings[0].value.type.kind === "parameter" &&
      application.identity.signatureBindings[0].value.type.declaration === parameter, true);
  }
});

test("native readonly views never erase foreign utilities or mapped key and value transformations", () => {
  const current = fixture(true);
  for (const name of ["ChangedFields", "ReadonlyChanged"]) {
    const body = current.definition(current.selected(name));
    assert.equal(body.type.kind === "shape" && body.type.members.length === 4, true, name);
    for (const metadata of body.type.members) {
      const value = payload(current, current.component(body, { kind: "member", origin: metadata.origin }));
      assert.equal(value.type.kind === "primitive" && value.type.primitive === "bool", true, name);
    }
  }
  const renamed = current.definition(current.selected("RenamedFields"));
  assert.equal(renamed.type.kind === "shape" && renamed.type.members.length === 1 && renamed.type.members[0].name === "renamed", true);
  const ordinary = fixture(false, {
    "/src/foreign.ts": "export type Readonly<Value> = { readonly replacement: boolean };",
    "/src/index.ts": `${componentEvidenceProgram}\nimport type { Readonly as ForeignReadonly } from "./foreign.js";
type ForeignView = ForeignReadonly<{ value: number }>;`,
  });
  const foreign = ordinary.definition(ordinary.selected("ForeignView"));
  assert.equal(foreign.type.kind === "shape" && foreign.type.members.length === 1 && foreign.type.members[0].name === "replacement", true,
    "an independently selected same-spelling utility retains its own authored meaning");
  assert.equal(ordinary.member(foreign, "replacement").value.type.kind === "primitive" &&
    ordinary.member(foreign, "replacement").value.type.primitive === "bool", true);
  assert.throws(() => ordinary.facts.descriptors.assertEvidence(current.selected("ReadonlyFields")), /Source|view|original/);
  assert.equal(current.member(current.selected("PartialFields"), "value").metadata.optional, true);
  assert.equal(current.member(current.selected("RequiredFields"), "value").metadata.optional, false);
});

test("canonical nullish removal retains its exact authored component", () => {
  const current = fixture(true);
  for (const name of ["Present", "PresentAlias", "PresentNested"]) {
    const value = current.definition(current.selected(name));
    assert.equal(value.type === current.selected("Exact").type, true, name);
    assert.equal(arms(value).some(arm => arm.type.kind === "intrinsic" && arm.type.intrinsic === "absence"), false, name);
  }
  const absent = current.definition(current.selected("Absent"));
  assert.equal(absent.type.kind === "intrinsic" && absent.type.intrinsic === "never", true);
  assert.equal(current.selected("TextArray").type === current.selected("Present").type, false,
    "unrelated selected geometry cannot replace an authored payload");
});

test("native primitive aliases never expose their erased implementation keyword", () => {
  const current = fixture();
  const native = current.selected("Exact");
  assert.equal(native.type.kind === "primitive" && native.type.primitive === "int32", true);
  assert.equal(current.ast.is.IsKeywordTypeNode(native.component.root), false);
  assert.equal(current.selected("Floating").type.kind === "primitive" && current.selected("Floating").type.primitive === "float64", true);
});

test("mixed native and ordinary component evidence remains distinguishable", () => {
  const current = fixture();
  const mixed = current.selected("Mixed");
  assert.equal(mixed.type.kind === "tuple" && mixed.type.elements.length === 2, true);
  const native = current.component(mixed, { kind: "tuple-element", index: 0 });
  const ordinary = current.component(mixed, { kind: "tuple-element", index: 1 });
  assert.equal(native.type.kind === "primitive" && native.type.primitive === "int32", true);
  assert.equal(ordinary.type.kind === "primitive" && ordinary.type.primitive === "float64", true);
  assert.equal(native === ordinary, false);
});

test("recursive authored closures terminate and return each evidence component once", () => {
  const current = fixture();
  const selected = current.selected("Recursive");
  const first = current.definition(selected);
  const second = current.definition(selected);
  assert.equal(first === second && Object.isFrozen(first), true);
  const next = payload(current, current.member(selected, "next").value);
  const nested = current.definition(next);
  assert.equal(nested.type === first.type, true, "the recursive edge returns the same original definition rather than expanding syntax");
  assert.equal(current.member(nested, "value").value.type === current.selected("Exact").type, true);
});

test("indexed member evidence retains exact selected declarations, signatures and optionality", () => {
  const current = fixture();
  const fields = current.selected("Fields");
  for (const [name, keys, optional] of [["First", ["first"], false], ["Several", ["first", "second"], false], ["Optional", ["optional"], true]]) {
    const result = current.selected(name);
    for (const key of keys) {
      const selected = current.member(fields, key);
      assert.equal(selected.metadata.optional, optional, key);
      assert.equal(payload(current, result).type === payload(current, selected.value).type, true, name);
      const origin = selected.metadata.origin;
      assert.equal(origin.kind === "declared", true);
      const pair = resolved(current.facts.objects.correspondingMember(fields, fields, origin.declaration, "read"), key);
      assert.equal(pair.kind === "present" && pair.value.kind === "present", true);
      assert.equal(pair.value.source.declarations.includes(origin.declaration) &&
        pair.value.source.readOrigins.some(value => value.kind === "declared" && value.declaration === origin.declaration), true);
      assert.equal(Object.isFrozen(pair.value.source) && Object.isFrozen(pair.value.source.declarations), true);
    }
  }
  const indexed = current.selected("Indexed");
  assert.equal(indexed.type === current.selected("Floating").type, true);
  const deferred = current.selected("Deferred");
  assert.equal(deferred.type.kind === "projection" && current.facts.descriptors.freeParameters(deferred).length > 0, true,
    "an unresolved indexed binder is not fabricated as a selected member");
});

test("indexed member evidence retains cross-file generic readonly declarations and exact read types", () => {
  const current = fixture();
  for (const name of ["ImportedIndexed", "NumberIndexed"]) {
    const syntax = current.alias(name);
    const object = current.ast.as.AsIndexedAccessTypeNode(syntax)?.ObjectType;
    assert.equal(object !== undefined, true);
    const result = current.selected(name);
    assert.equal(payload(current, result).type === current.selected("Exact").type, true, name);
    if (name === "ImportedIndexed") {
      const native = current.definition(current.selected("ReadonlyNative"));
      assert.equal(native.type.kind === "shape" && native.type.indexes.length === 1, true);
      const index = native.type.indexes[0];
      assert.equal(index.readonly, true);
      assert.equal(current.ast.getFileName(current.ast.getSourceFile(index.declaration)), "/src/node_modules/@test/native/types.d.ts");
      assert.equal(payload(current, current.component(native, { kind: "index-value", declaration: index.declaration })).type ===
        payload(current, result).type, true);
    } else assert.equal(result.type.kind === "primitive" && result.type.primitive === "int32", true);
  }
});

test("transformed aliases retain indexed selection syntax without requiring a fact on that syntax", () => {
  const current = fixture();
  const value = current.selected("First");
  assert.equal(value.component.root === current.alias("First"), true);
  assert.equal(value.type === current.selected("Exact").type, true);
  current.facts.descriptors.assertEvidence(value);
  assert.equal(Object.isFrozen(value.component.path), true);
});

test("composed aliases retain container and callable syntax with exact generic arguments", () => {
  const current = fixture();
  const composed = current.selected("Composed");
  assert.equal(composed.sum !== undefined, true);
  for (const name of ["NativeArray", "TextArray", "NativeFactory"]) {
    const expected = current.selected(name);
    const candidates = composed.sum.arms.filter(arm => arm.type === expected.type);
    assert.equal(candidates.length, 1, name);
    const arm = candidates[0];
    current.facts.descriptors.assertEvidence(arm);
    if (name === "NativeFactory") {
      const head = callable(current, arm);
      assert.equal(current.component(head.value, { kind: "result", signature: head.signature.identity }).type === current.selected("Exact").type, true);
    } else assert.equal(current.component(arm, { kind: "array-element" }).type ===
      current.component(expected, { kind: "array-element" }).type, true, name);
  }
  assert.equal(current.selected("NativeArray").type === current.selected("TextArray").type, false);
});

test("bound source correspondence retains generic union members and rejects changed bindings", () => {
  const current = fixture();
  const declaration = current.ast.typeParameters(current.declaration("Bound"))[0];
  const original = current.selected("Bound");
  const applied = resolved(current.facts.descriptors.substitute(original, [{ declaration, value: current.selected("Exact") }]), "bound alias");
  assert.equal(applied.type === current.selected("Applied").type, true);
  assert.equal(applied.type === current.selected("Wrong").type, false);
  assert.equal(applied.sum.family === original.sum.family, true, "substitution keeps the authentic original family");
  assert.equal(current.facts.descriptors.freeParameters(original).some(value => value.declaration === declaration), true);
  const missing = resolved(current.facts.descriptors.substitute(original, []), "missing binding");
  assert.equal(current.facts.descriptors.freeParameters(missing).some(value => value.declaration === declaration), true);
  assert.equal(current.selected("NativeArray").type === current.selected("TextArray").type, false);
});

test("bound union correspondence flattens substituted members without losing canonical absence or binding identity", () => {
  const current = fixture();
  for (const [name, argument, expected, wrong] of [
    ["optional", "Exact", "OptionalValue", "OptionalWrong"],
    ["optional", "OptionalValue", "OptionalValue", "OptionalWrong"],
    ["nullable", "NullableValue", "NullableValue", "NullableWrong"],
    ["mixed", "TextOptionalValue", "TextOptionalValue", "TextOptionalWrong"],
    ["duplicate", "TextValue", "TextValue", "Floating"],
  ]) {
    const declaration = current.declaration(name);
    const parameter = current.ast.typeParameters(declaration)[0];
    const head = callable(current, resolved(current.facts.values.declaredSlot(declaration), name).type);
    const original = current.component(head.value, { kind: "result", signature: head.signature.identity });
    const applied = resolved(current.facts.descriptors.substitute(original, [{ declaration: parameter, value: current.selected(argument) }]), name);
    assert.equal(applied.type === current.selected(expected).type, true, name);
    assert.equal(applied.type === current.selected(wrong).type, false, `${name}: wrong result`);
    const missing = resolved(current.facts.descriptors.substitute(original, []), name);
    assert.equal(current.facts.descriptors.freeParameters(missing).some(value => value.declaration === parameter), true, `${name}: missing binding`);
    const cyclic = current.facts.descriptors.substitute(original, [{ declaration: parameter, value: original }]);
    assert.equal(cyclic.kind === "refused" || current.facts.descriptors.freeParameters(cyclic.value).some(value => value.declaration === parameter), true,
      `${name}: a cyclic application cannot manufacture a closed binding`);
    if (name === "nullable") assert.equal(arms(applied).filter(arm => arm.type.kind === "intrinsic" && arm.type.intrinsic === "absence").length, 1,
      "source null and undefined have the one canonical absence state");
  }
});

test("bound optional invocation results retain exact cross-file substitutions", () => {
  const current = fixture(false, {
    "/src/values.ts": "export function optional<Value>(value: Value): Value | undefined { return value; }",
    "/src/index.ts": `import { optional } from "./values.js";
type Selected = bigint | undefined;
type Wrong = number | undefined;
type WrongAbsence = bigint | null;
export function run(value: Selected): Selected { return optional<Selected>(value); }`,
  });
  const calls = current.nodes.filter(node => current.ast.is.IsCallExpression(node));
  assert.equal(calls.length, 1);
  const application = resolved(current.facts.applications.application(calls[0]), "cross-file application");
  const declaration = application.identity.signature.declaration;
  assert.equal(declaration !== undefined && current.ast.getFileName(current.ast.getSourceFile(declaration)) === "/src/values.ts", true);
  assert.equal(application.identity.signatureBindings.length, 1);
  const head = callable(current, resolved(current.facts.values.declaredSlot(declaration), "original callee").type);
  const original = current.component(head.value, { kind: "result", signature: head.signature.identity });
  const applied = resolved(current.facts.descriptors.substitute(original, application.identity.signatureBindings), "exact callee binding");
  assert.equal(applied.type === application.result.type && applied.type === current.selected("Selected").type, true);
  assert.equal(applied.type === current.selected("Wrong").type, false);
  assert.equal(applied.type === current.selected("WrongAbsence").type, true,
    "the canonical one-state absence contract, not checker null/undefined identity, is authoritative");
});

test("bound source members preserve exact record and callable declarations without carrier reconstruction", () => {
  const current = fixture(false, { "/src/index.ts": `${componentEvidenceProgram}\ntype RequiredOptionalField = { optional: word | undefined };` });
  const parameter = current.ast.typeParameters(current.declaration("RecordUnion"))[0];
  const original = current.selected("RecordUnion");
  const applied = resolved(current.facts.descriptors.substitute(original, [{ declaration: parameter, value: current.selected("Exact") }]), "record union");
  const expected = current.selected("AppliedRecordUnion");
  assert.equal(original.sum.arms.length, 2);
  for (const arm of applied.sum.arms) {
    assert.equal(expected.sum.arms.filter(other => other.type === arm.type).length, 1);
    for (const name of ["WrongRecordUnion", "ForeignAppliedRecordUnion"]) {
      assert.equal(current.selected(name).sum.arms.every(other => other.type !== arm.type), true, name);
    }
    const corresponding = resolved(current.facts.objects.correspondence(arm, arm, "correspondence"), "exact original record");
    assert.equal(corresponding.kind, "available");
    for (const pair of corresponding.members) {
      assert.equal(pair.kind, "present");
      assert.equal(pair.source.optional === pair.destination.optional && pair.source.readonly === pair.destination.readonly, true);
      assert.equal(pair.source.declarations.length > 0 && pair.source.declarations.every(node => pair.destination.declarations.includes(node)), true);
    }
    const body = current.definition(arm);
    const callback = body.type.members.find(member => member.name === "callback");
    if (callback !== undefined) {
      const head = callable(current, current.component(body, { kind: "member", origin: callback.origin }));
      const input = current.component(head.value, { kind: "parameter", signature: head.signature.identity, index: 0 });
      const result = current.component(head.value, { kind: "result", signature: head.signature.identity });
      assert.equal(input.type === current.selected("Exact").type && result.type === input.type, true);
    }
  }
  const optional = current.member(current.selected("Fields"), "optional");
  assert.equal(optional.metadata.optional && optional.value.type.kind === "optional", true,
    "presence metadata remains separate from the retained optional value component");
  const presence = resolved(current.facts.objects.correspondence(current.selected("Fields"), current.selected("RequiredOptionalField"), "correspondence"),
    "genuine optional-presence opposite");
  assert.equal(presence.kind, "available");
  const pair = presence.members.find(member => member.destination.name === "optional");
  assert.equal(pair?.kind === "present", true);
  assert.equal(pair.source.optional && !pair.destination.optional && pair.source.readType.type === pair.destination.readType.type, true,
    "equal optional value carriers do not erase the original required-versus-optional declaration distinction");
});
