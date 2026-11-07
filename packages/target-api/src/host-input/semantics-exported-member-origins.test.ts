import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, sourcePrimitive, type Node } from "@tsonic/tsts";
import { selectedSourcePropertyDeclarations } from "./semantics-selected-property-declarations.js";
import { sourceTypeDescriptorStructure } from "../source-semantics/local-type-flow/terms.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/node_modules/@test/words/package.json": JSON.stringify({
        name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" },
      }),
      "/src/node_modules/@test/words/index.d.ts": "export type NativeWord = number;",
      "/src/native.ts": [
        'import type { NativeWord } from "@test/words";',
        "export declare const value: NativeWord;",
        "export declare const absent: NativeWord | undefined;",
        "export declare function read(value: NativeWord): NativeWord;",
        "export declare function read(value: string): string;",
      ].join("\n"),
      "/src/relay.ts": 'export { value as renamed, absent, read as evaluate } from "./native.js";',
      "/src/foreign.ts": "export declare const renamed: number;",
      "/src/index.ts": [
        'import * as relay from "./relay.js";',
        'import * as foreign from "./foreign.js";',
        'import { renamed as direct } from "./relay.js";',
        "export function run(): void {",
        "  const shadow: { renamed: number } = { renamed: 1.5 };",
        "  void relay.renamed; void relay.absent; void relay.evaluate;",
        "  void foreign.renamed; void shadow.renamed; void direct;",
        "}",
      ].join("\n"),
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{
      moduleSpecifier: "@test/words", packageName: "@test/words",
      exports: [sourcePrimitive("NativeWord", "int32", "number", true, 32)],
    }] })] },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createHostSourceProgramFixture(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original Source file is required.");
  const properties = new Map<string, Node>();
  const pending: Node[] = [file];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsPropertyAccessExpression(node)) {
      const text = source.ast.getSourceText(file).slice(source.ast.pos(node), source.ast.end(node)).trim();
      properties.set(text, node);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const property = (name: string): Node => {
    const node = properties.get(name);
    if (node === undefined) throw new Error("The original property occurrence is required.");
    return node;
  };
  return { source, property };
}

test("exported aliases retain the checked native member declaration and the public export symbol", () => {
  const { source, property } = fixture();
  const node = property("relay.renamed");
  const queries = source.semantics.forNode(node);
  const access = queries.operations.propertyAccess(node);
  assert.equal(access !== undefined && access.selectedDeclaration !== undefined, true);
  if (access === undefined || access.selectedDeclaration === undefined) throw new Error("The selected declaration is required.");
  const receiver = source.facts.values.type(access.receiver.expression);
  assert.equal(receiver?.kind === "resolved", true);
  if (receiver?.kind !== "resolved") throw new Error("The canonical receiver publication is required.");
  const structure = sourceTypeDescriptorStructure(receiver.type);
  const member = structure.kind === "shape" ? structure.members.find(member => member.name === "renamed") : undefined;
  assert.equal(member?.origin.kind === "declared" && member.origin.declaration === access.selectedDeclaration, true,
    "the member keeps the actual checked target declaration, not the export specifier");
  assert.equal(member?.type.kind === "primitive" && member.type.primitive === "int32", true);
  const checkedType = queries.types.expressionType(access.receiver.expression);
  if (checkedType === undefined) throw new Error("The checked receiver type is required.");
  const publicMember = queries.types.propertyInfos(checkedType).find(member => member.name === "renamed");
  if (publicMember === undefined) throw new Error("The public property symbol is required.");
  assert.equal(queries.declarations.symbolDeclarations(publicMember.symbol)
    .some(declaration => source.ast.is.IsExportSpecifier(declaration)), true,
  "the public export symbol and its original relation remain unchanged");
  const selected = selectedSourcePropertyDeclarations(queries, undefined, publicMember.symbol, [checkedType]);
  assert.equal(selected?.length === 1 && selected[0] === access.selectedDeclaration, true);
  const outcome = source.facts.values.type(node);
  assert.equal(outcome?.kind === "resolved" && outcome.type.kind === "primitive" && outcome.type.primitive === "int32", true);
});

test("exported aliases preserve absence and complete overloaded callable inventories", () => {
  const { source, property } = fixture();
  const absent = source.facts.values.type(property("relay.absent"));
  assert.equal(absent?.kind === "resolved" && absent.type.kind === "optional" &&
    absent.type.value.kind === "primitive" && absent.type.value.primitive === "int32", true);
  const selected = source.facts.values.type(property("relay.evaluate"));
  const callable = selected?.kind === "resolved" ? sourceTypeDescriptorStructure(selected.type) : undefined;
  assert.equal(callable?.kind === "callable" && callable.calls.length === 2, true,
    "an exported function's return annotation is not its member value type");
  if (callable?.kind !== "callable") throw new Error("The finite callable publication is required.");
  assert.equal(callable.calls.some(signature => signature.result.kind === "primitive" && signature.result.primitive === "int32"), true);
  assert.equal(callable.calls.some(signature => signature.result.kind === "string"), true);
});

test("foreign and shadowed member spellings cannot borrow an exported alias's native evidence", () => {
  const { source, property } = fixture();
  const original = property("relay.renamed");
  const queries = source.semantics.forNode(original);
  const selected = queries.operations.propertyAccess(original);
  if (selected?.selectedSymbol === undefined) throw new Error("The selected original symbol is required.");
  for (const name of ["foreign.renamed", "shadow.renamed"]) {
    const node = property(name);
    const outcome = source.facts.values.type(node);
    assert.equal(outcome?.kind === "resolved" && outcome.type.kind === "primitive" && outcome.type.primitive === "float64", true, name);
    const receiver = queries.operations.propertyAccess(node)?.receiver.type;
    if (receiver === undefined) throw new Error("The exact foreign receiver is required.");
    assert.equal(selectedSourcePropertyDeclarations(queries, undefined, selected.selectedSymbol, [receiver]) === undefined, true,
      "declaration selection requires checked symbol identity, not a member spelling");
  }
});
