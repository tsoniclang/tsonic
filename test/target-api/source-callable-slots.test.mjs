import assert from "node:assert/strict";
import test from "node:test";
import { sourcePrimitive } from "@tsonic/tsts";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

function fixture(text) {
  const target = { id: "csharp", options: { outputType: "Library" } };
  const checked = checkSourceProgramFixture({ project: { entryPoint: "index.ts", rootDir: ".", targets: [target] },
    projectDirectory: "/src", target, targetPack: createCsharpTargetPack(),
    paths: { projectFilePath: "/src/tsonic.json", projectRoot: "/src", outputRoot: "/out",
      targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" },
    selectedCapabilities: [], selectedSurfaces: [], currentDirectory: "/src",
    files: {
      "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
      "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
      "/src/index.ts": `import type { int32, float32 } from "@test/words"; ${text}`,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    targetContributions: base => ({ ...base, semanticsModules: [...base.semanticsModules ?? [], {
      moduleSpecifier: "@test/words", packageName: "@test/words", exports: [
        sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32),
      ],
    }] }),
  });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0);
  const source = checked.value;
  const file = source.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  assert.equal(file !== undefined, true, "the same original project file is required");
  const nodes = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    const children = source.ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] !== undefined) pending.push(children[index]);
  }
  const declaration = name => {
    const node = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    assert.equal(node !== undefined, true, `the original declaration ${name} is required`);
    return node;
  };
  const slot = name => {
    const selected = source.facts.values.declaredSlot(declaration(name));
    assert.equal(selected.kind, "resolved", `the original declared slot ${name} resolves`);
    return selected.value.type;
  };
  return { source, nodes, declaration, slot };
}

test("inferred local-class call results use the solved body and exact call binders before member reads", () => {
  for (const reversed of [false, true]) {
    const wrapper = `function wrap<Outer>(first: Outer) {
      class Local<Inner> { first: Outer; value: Inner;
        constructor(first: Outer, value: Inner) { this.first = first; this.value = value; } }
      return new Local<float32>(first, 1);
    }`;
    const consumer = `function run(first: int32): void {
      const result = wrap(first); const value = result.value; void value;
    }`;
    const current = fixture((reversed ? [consumer, wrapper] : [wrapper, consumer]).join("\n"));
    const { ast, facts } = current.source;
    const wrap = current.nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "wrap");
    const outer = wrap === undefined ? undefined : ast.typeParameters(wrap)[0];
    const call = current.nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node)?.Expression) === "wrap");
    assert.equal(wrap !== undefined && outer !== undefined && call !== undefined, true);
    const head = facts.values.type(wrap);
    assert.equal(head.kind, "resolved");
    const definition = facts.descriptors.definition(head.value);
    assert.equal(definition.kind, "resolved");
    assert.equal(definition.value.type.kind === "shape" || definition.value.type.kind === "callable", true);
    const signatures = definition.value.type.calls.filter(signature => signature.identity.declaration === wrap);
    assert.equal(signatures.length, 1, "the actual original body identity is retained");
    const body = facts.values.callableReturn(signatures[0].identity);
    assert.equal(body.kind, "resolved");
    assert.equal(body.value.type.kind === "declared" && body.value.type.typeArguments[0]?.kind === "parameter" &&
      body.value.type.typeArguments[0].declaration === outer && body.value.type.typeArguments[1]?.kind === "primitive" &&
      body.value.type.typeArguments[1].primitive === "float32", true, `original body template, reversed=${reversed}`);
    const result = facts.values.type(call);
    const application = facts.applications.application(call);
    assert.equal(result.kind === "resolved" && application.kind === "resolved", true);
    assert.equal(result.value.type.kind === "declared" && result.value.type.typeArguments[0]?.kind === "primitive" &&
      result.value.type.typeArguments[0].primitive === "int32" && result.value.type.typeArguments[1]?.kind === "primitive" &&
      result.value.type.typeArguments[1].primitive === "float32" && application.value.result === result.value, true,
    `one actual instantiated result, reversed=${reversed}`);
    const value = current.slot("value");
    assert.equal(value.type.kind === "primitive" && value.type.primitive === "float32", true,
      "dependent member groups consume the solved result, not a final-outcome overwrite");
    assert.equal(facts.refusals().length, 0);
  }
});

test("declared tuples retain every finite position, named origin and optional or rest kind", () => {
  const current = fixture(`declare const one: readonly [int32]; declare const three: [int32, float32, number];
    declare const named: readonly [head: int32, tail?: float32, ...rest: number[]];`);
  const one = current.slot("one").type;
  const three = current.slot("three").type;
  const named = current.slot("named");
  assert.equal(one.kind === "tuple" && one.readonly && one.elements.length === 1 && one.elements[0]?.kind === "required" &&
    one.elements[0].type.kind === "primitive" && one.elements[0].type.primitive === "int32", true);
  assert.equal(three.kind === "tuple" && !three.readonly && three.elements.length === 3 &&
    three.elements.every(element => element.kind === "required") && three.elements[2]?.type.kind === "primitive" &&
    three.elements[2].type.primitive === "float64", true);
  assert.equal(named.type.kind === "tuple" && named.type.readonly && named.type.elements.length === 3 &&
    named.type.elements[0]?.kind === "required" && named.type.elements[1]?.kind === "optional" && named.type.elements[2]?.kind === "rest", true);
  assert.equal(named.type.elements.every(element => element.declaration !== undefined && current.source.ast.is.IsNamedTupleMember(element.declaration)), true,
    "named tuple origins are the actual original member nodes");
  const tail = current.source.facts.descriptors.component(named, { kind: "tuple-element", index: 1 });
  assert.equal(tail.kind === "resolved" && tail.value.type.kind === "optional" && tail.value.type.value.kind === "primitive" &&
    tail.value.type.value.primitive === "float32", true);
  const rest = current.source.facts.descriptors.component(named, { kind: "tuple-element", index: 2 });
  assert.equal(rest.kind === "resolved" && rest.value.type.kind === "array", true,
    "the original rest component is a sequence, not a fabricated scalar parameter");
  const element = current.source.facts.descriptors.component(rest.value, { kind: "array-element" });
  assert.equal(element.kind === "resolved" && element.value.type.kind === "primitive" && element.value.type.primitive === "float64", true);
});

test("ordinary member origins retain fields, methods and read or write accessor declarations", () => {
  const current = fixture(`class Members {
    readonly field: int32 = 1;
    method(value: int32): int32 { return value; }
    get getter(): int32 { return 1; }
    set setter(next: int32) { void next; }
    get paired(): int32 { return 1; }
    set paired(next: int32) { void next; }
  } declare const selected: Members;`);
  const selected = current.slot("selected");
  assert.equal(selected.type.kind, "declared");
  const definition = current.source.facts.descriptors.definition(selected);
  assert.equal(definition.kind === "resolved" && definition.value.type.kind === "shape", true);
  const { ast, facts } = current.source;
  for (const [name, kind] of [["field", "KindPropertyDeclaration"], ["method", "KindMethodDeclaration"],
    ["getter", "KindGetAccessor"], ["setter", "KindSetAccessor"], ["paired", "KindGetAccessor"]]) {
    const member = definition.value.type.members.find(candidate => candidate.name === name);
    const declaration = ast.members(selected.type.declaration).find(candidate => candidate !== undefined &&
      ast.kindName(candidate) === kind && ast.text(ast.name(candidate)) === name);
    assert.equal(declaration !== undefined && member?.origin.kind === "declared" && member.origin.declaration === declaration, true, name);
    const value = facts.descriptors.component(definition.value, { kind: "member", origin: member.origin });
    assert.equal(value.kind, "resolved", name);
    if (name === "method") {
      const head = facts.descriptors.definition(value.value);
      assert.equal(head.kind === "resolved" && (head.value.type.kind === "callable" || head.value.type.kind === "shape") &&
        head.value.type.calls.length === 1 && head.value.type.calls[0]?.result.kind === "primitive" &&
        head.value.type.calls[0].result.primitive === "int32", true, name);
    } else assert.equal(value.value.type.kind === "primitive" && value.value.type.primitive === "int32", true, name);
  }
  const setter = ast.members(selected.type.declaration).find(node => node !== undefined && ast.is.IsSetAccessorDeclaration(node) &&
    ast.text(ast.name(node)) === "paired");
  assert.equal(setter !== undefined, true);
  const write = facts.descriptors.component(definition.value, { kind: "member", origin: { kind: "declared", declaration: setter } });
  assert.equal(write.kind === "resolved" && write.value.type.kind === "primitive" && write.value.type.primitive === "int32", true,
    "the original paired setter retains its independent WRITE child");
  assert.equal(definition.value.type.members.find(member => member.name === "field")?.readonly, true);
  assert.equal(facts.refusals().length, 0);
});
