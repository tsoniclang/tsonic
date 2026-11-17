import assert from "node:assert/strict";
import test from "node:test";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

function fixture(program) {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const checked = checkSourceProgramFixture({ project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [],
    compilerOptions: { strict: true, noLib: true, target: "es2022", module: "esnext" }, files: { "/src/index.ts": program } });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n"));
  assert.equal(checked.diagnostics.length, 0);
  const source = checked.value;
  const nodes = [];
  function visit(node) {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  }
  source.sourceFiles.forEach(visit);
  function variable(name) {
    const declaration = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    assert.equal(declaration !== undefined, true, name);
    const selected = source.facts.values.declaredSlot(declaration);
    assert.equal(selected.kind, "resolved", name);
    return selected.value.type;
  }
  return { source, variable, nodes };
}

test("method heads and function-type aliases retain callable shape independently of their return annotations", () => {
  const { source, variable } = fixture(`
    interface Methods<T> { choose(value: T): T extends number ? number : string; }
    type Identity<T> = (value: T) => T;
    declare const methods: Methods<number>;
    declare const identity: Identity<number>;
  `);
  const definition = source.facts.descriptors.definition(variable("methods"));
  assert.equal(definition.kind, "resolved");
  assert.equal(definition.value.type.kind, "shape");
  const member = definition.value.type.members.find(member => member.name === "choose");
  assert.equal(member !== undefined, true);
  const callable = source.facts.descriptors.component(definition.value, { kind: "member", origin: member.origin });
  assert.equal(callable.kind === "resolved" && callable.value.type.kind === "callable", true,
    "the method head is not its conditional result");
  const signature = callable.value.type.calls[0];
  assert.equal(signature !== undefined, true);
  assert.equal(signature.parameters.length, 1);
  const result = source.facts.descriptors.component(callable.value, { kind: "result", signature: signature.identity });
  assert.equal(result.kind === "resolved" && result.value.type.kind === "primitive" && result.value.type.primitive === "float64", true);
  const alias = variable("identity");
  assert.equal(alias.type.kind === "callable", true, "a function type is not its return TypeNode");
  assert.equal(alias.type.calls.length, 1);
  assert.equal(alias.type.calls[0].parameters.length, 1);
});

test("inferred results, defaults and member values retain Source completion rather than observed checker carriers", () => {
  const { source, variable } = fixture(`
    export function inferred() { return 7; }
    export function defaulted(value = 8) { return value; }
    export class Values { field = 9; get item() { return 10; } }
    export const result = inferred();
    export const withDefault = defaulted();
    export const field = new Values().field;
    export const item = new Values().item;
  `);
  for (const name of ["result", "withDefault", "field", "item"]) {
    const value = variable(name);
    assert.equal(value.type.kind === "primitive" && value.type.primitive === "int64", true, name);
    assert.equal(value.category.kind === "known" && value.category.category === "number", true, name);
    source.facts.descriptors.assertEvidence(value);
  }
});

test("optional and defaulted formal presence differs from the same original parameter's activation slot", () => {
  const { source, nodes } = fixture(`
    export function optional(value?: number) { return value; }
    export function defaulted(value: number = 1) { return value; }
  `);
  for (const name of ["optional", "defaulted"]) {
    const declaration = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    assert.equal(declaration !== undefined, true);
    const selected = source.facts.values.declaredSlot(declaration);
    assert.equal(selected.kind === "resolved" && selected.value.type.type.kind === "callable", true);
    const head = selected.value.type;
    const signature = head.type.calls[0];
    assert.equal(signature !== undefined && signature.parameters[0].kind === "optional", true);
    const formal = source.facts.descriptors.component(head, { kind: "parameter", signature: signature.identity, index: 0 });
    assert.equal(formal.kind === "resolved" && formal.value.type.kind === "optional", true,
      `${name}: the actual formal accepts absence exactly once`);
    const parameter = source.ast.parameters(declaration)[0];
    const activation = source.facts.values.declaredSlot(parameter);
    assert.equal(activation.kind, "resolved");
    assert.equal(name === "optional" ? activation.value.type.type.kind === "optional"
      : activation.value.type.type.kind === "primitive" && activation.value.type.type.primitive === "float64", true,
    `${name}: the original activation slot keeps its own presence law`);
  }
});
