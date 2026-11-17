import assert from "node:assert/strict";
import test from "node:test";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

function fixture(program) {
  const target = { id: "csharp", options: { outputType: "Library" } };
  const checked = checkSourceProgramFixture({
    project: { entryPoint: "index.ts", rootDir: ".", targets: [target] },
    projectDirectory: "/src", target, targetPack: createCsharpTargetPack(),
    paths: { projectFilePath: "/src/tsonic.json", projectRoot: "/src", outputRoot: "/out",
      targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" },
    selectedCapabilities: [], selectedSurfaces: [], currentDirectory: "/src", files: { "/src/index.ts": program },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0, "the original complete program has no diagnostics");
  const source = checked.value;
  const file = source.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  assert.equal(file !== undefined, true);
  return { source, statements: source.ast.statements(file).filter(node => node !== undefined) };
}

function resolved(result, label) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? `${label}: ${result.message}` : label);
  return result.value;
}

function declared(source, declaration) {
  const slot = resolved(source.facts.values.declaredSlot(declaration), source.ast.text(source.ast.name(declaration)));
  assert.equal(slot.origin.kind === "declaration" && slot.origin.declaration === declaration, true);
  return slot.type;
}

test("present callable selection retains exact declarations and quantified binders", () => {
  const { source, statements } = fixture(`
      type RequiredCallable = <Value>(value: Value) => Value;
      type Optional = RequiredCallable | null | undefined;
      type Noncallable = number | undefined;
      type Ambiguous = RequiredCallable | ((value: number) => string) | undefined;
      type Absent = null | undefined;
      interface Owner { identity?<Value>(value: Value): Value; }
  `);
  const { ast, facts } = source;
  assert.equal(statements.length, 6, "all original aliases and the original generic optional member remain");
  const values = statements.map(declaration => declared(source, declaration));
  const required = resolved(facts.descriptors.definition(values[0]), "the required callable");
  assert.equal(required.type.kind, "callable");
  assert.equal(required.type.calls.length, 1);
  const original = required.type.calls[0];
  assert.equal(original.identity.declaration === ast.typeNode(statements[0]), true);
  assert.equal(original.identity.typeParameters.length, 1);
  assert.equal(original.identity.typeParameters[0] === ast.typeParameters(ast.typeNode(statements[0]))[0], true);
  assert.equal(original.parameters[0].type.kind === "parameter" &&
    original.parameters[0].type.declaration === original.identity.typeParameters[0], true);
  assert.equal(original.result === original.parameters[0].type, true);
  assert.equal(values[1].type.kind, "optional");
  const payload = resolved(facts.descriptors.component(values[1], { kind: "optional-value" }), "the authenticated present component");
  const optional = resolved(facts.descriptors.definition(payload), "the optional callable's present definition");
  assert.equal(optional.type === required.type, true);
  assert.equal(optional.type.calls[0].identity === original.identity, true,
    "absence does not replace or select another quantified signature");
  assert.equal(values[1].sum !== undefined && values[1].sum.arms.some(arm => arm.type.kind === "intrinsic" &&
    arm.type.intrinsic === "absence"), true, "the original absence role remains in the authenticated family");
  assert.equal(values[2].type.kind, "optional");
  const noncallable = resolved(facts.descriptors.component(values[2], { kind: "optional-value" }), "the present noncallable");
  assert.equal(noncallable.type.kind === "primitive" && noncallable.type.primitive === "float64", true,
    "a present scalar does not acquire a callable signature");
  assert.equal(values[3].type.kind, "optional");
  const ambiguous = resolved(facts.descriptors.component(values[3], { kind: "optional-value" }), "the present ambiguous family");
  assert.equal(ambiguous.type.kind, "union");
  assert.equal(ambiguous.sum !== undefined && ambiguous.sum.arms.length === 2, true,
    "two present callables remain two authenticated arms, not one selected callable");
  const alternatives = ambiguous.sum.arms.map(arm => resolved(facts.descriptors.definition(arm), "the original callable alternative"));
  assert.equal(alternatives.every(value => value.type.kind === "callable" && value.type.calls.length === 1), true);
  assert.equal(alternatives[0].type.calls[0].identity === original.identity &&
    alternatives[1].type.calls[0].identity !== original.identity, true);
  assert.equal(values[4].type.kind === "intrinsic" && values[4].type.intrinsic === "absence", true,
    "an absence-only family has no present callable");
  const owner = resolved(facts.descriptors.definition(values[5]), "the original owner");
  assert.equal(owner.type.kind, "shape");
  assert.equal(owner.type.members.length, 1);
  const member = owner.type.members[0];
  assert.equal(member.optional && member.origin.kind === "declared" && member.origin.declaration === ast.members(statements[5])[0], true);
  const property = resolved(facts.descriptors.component(owner, { kind: "member", origin: member.origin }), "the original optional member");
  assert.equal(property.type.kind, "optional");
  const present = resolved(facts.descriptors.component(property, { kind: "optional-value" }), "the original present method");
  const method = resolved(facts.descriptors.definition(present), "the generic method definition");
  assert.equal(method.type.kind === "callable" && method.type.calls.length === 1, true);
  const signature = method.type.calls[0];
  assert.equal(signature.identity.declaration === ast.members(statements[5])[0], true);
  assert.equal(signature.identity.typeParameters.length, 1);
  assert.equal(signature.identity.typeParameters[0] === ast.typeParameters(signature.identity.declaration)[0], true);
  assert.throws(() => facts.descriptors.definition(undefined), /Source type evidence must belong to this exact descriptor view/,
    "unavailable evidence cannot fabricate a present signature");
});

test("present callable selection retains every exact overload without inventing a selected signature", () => {
  const { source, statements } = fixture(`
      interface Overloaded { (value: string): unknown; (value: number): number; }
      type Optional = Overloaded | null | undefined;
      type Ambiguous = Overloaded | ((value: boolean) => boolean) | undefined;
      type Absent = null | undefined;
      interface Owner { read?(value: string): unknown; read?(value: number): number; }
  `);
  const { ast, facts } = source;
  assert.equal(statements.length, 5);
  const values = statements.map(declaration => declared(source, declaration));
  const overloaded = resolved(facts.descriptors.definition(values[0]), "the declared overload inventory");
  assert.equal(overloaded.type.kind, "callable");
  assert.equal(overloaded.type.calls.length, 2, "the inventory must not invent a single selected signature");
  assert.equal(overloaded.type.calls.every((signature, index) => signature.identity.declaration === ast.members(statements[0])[index]), true,
    "both advertised overloads retain their exact original declarations in order");
  assert.equal(values[1].type.kind, "optional");
  const present = resolved(facts.descriptors.component(values[1], { kind: "optional-value" }), "the original present overload family");
  assert.equal(present.type === values[0].type, true, "absence elimination retains the same original declared callable");
  const optional = resolved(facts.descriptors.definition(present), "the complete present overload inventory");
  assert.equal(optional.type === overloaded.type, true);
  assert.equal(optional.type.calls.length, 2);
  assert.equal(optional.type.calls.every((signature, index) => signature.identity === overloaded.type.calls[index].identity), true);
  assert.equal(values[2].type.kind, "optional");
  const ambiguous = resolved(facts.descriptors.component(values[2], { kind: "optional-value" }), "the ambiguous present callable family");
  assert.equal(ambiguous.type.kind, "union");
  assert.equal(ambiguous.sum !== undefined && ambiguous.sum.arms.length === 2, true);
  const alternatives = ambiguous.sum.arms.map(arm => resolved(facts.descriptors.definition(arm), "the original overloaded alternative"));
  assert.equal(alternatives.every(value => value.type.kind === "callable"), true);
  assert.deepEqual(alternatives.map(value => value.type.calls.length), [2, 1],
    "the overloaded arm and the other callable cannot become a unique present selection");
  assert.equal(alternatives[0].type === overloaded.type, true);
  assert.equal(values[3].type.kind === "intrinsic" && values[3].type.intrinsic === "absence", true);
  const owner = resolved(facts.descriptors.definition(values[4]), "the original method owner");
  assert.equal(owner.type.kind === "shape" && owner.type.members.length === 1, true);
  const member = owner.type.members[0];
  assert.equal(member.optional, true);
  const property = resolved(facts.descriptors.component(owner, { kind: "member", origin: member.origin }), "the optional overloaded method");
  assert.equal(property.type.kind, "optional");
  const methodValue = resolved(facts.descriptors.component(property, { kind: "optional-value" }), "the present overloaded method");
  const method = resolved(facts.descriptors.definition(methodValue), "the full overloaded method inventory");
  assert.equal(method.type.kind === "callable" && method.type.calls.length === 2, true);
  assert.equal(method.type.calls.every((signature, index) => signature.identity.declaration === ast.members(statements[4])[index]), true,
    "every method overload keeps the exact original member, not an invented selected signature");
});
