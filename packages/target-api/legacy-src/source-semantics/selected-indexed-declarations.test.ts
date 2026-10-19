import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node, type TypeIndexedAccessSelection } from "@tsonic/tsts";
import { createTargetSourceProgram, selectedSourceIndexedDeclarations } from "../public/source.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {};
interface Ordinal { readonly 0: string; [index: number]: string; }
interface Named { value: number; }
declare const values: Ordinal;
declare const named: Named;
declare const position: number;
const exact = values[0]; const dynamic = values[position]; const property = named["value"];
`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const semantics = source.semantics.forFile(file!);
  const selections = new Map<string, TypeIndexedAccessSelection>();
  const visit = (node: Node): void => {
    if (source.ast.is.IsVariableDeclaration(node)) {
      const initializer = source.ast.as.AsVariableDeclaration(node)?.Initializer;
      const access = initializer === undefined ? undefined : semantics.operations.elementAccess(initializer);
      const selected = access === undefined ? undefined : semantics.types.selectIndexedAccess(access.receiver.type, access.argument.type);
      if (selected !== undefined) selections.set(source.ast.text(source.ast.name(node)), selected);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  return { source, semantics, select(name: string) {
    const selection = selections.get(name);
    assert.equal(selection?.kind === "resolved", true, name);
    return selection as Extract<TypeIndexedAccessSelection, { kind: "resolved" }>;
  } };
}

test("named ordinal, ordinary property and index-signature access retain their exact selected declarations", () => {
  const current = fixture();
  for (const [name, kind, readonly] of [
    ["exact", "KindPropertySignature", true], ["property", "KindPropertySignature", false],
    ["dynamic", "KindIndexSignature", false],
  ] as const) {
    const selected = selectedSourceIndexedDeclarations(current.semantics, current.select(name));
    assert.equal(selected !== undefined && selected.declarations.length === 1, true, name);
    assert.equal(current.source.ast.kindName(selected!.declarations[0]), kind, name);
    assert.equal(selected!.readonly, readonly, name);
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected!.declarations), true, name);
  }
});

test("indexed declaration evidence rejects deferred, empty, ambiguous and foreign-symbol selections", () => {
  const current = fixture();
  const exact = current.select("exact");
  const dynamic = current.select("dynamic");
  const property = current.select("property").members[0]!;
  const first = exact.members[0]!;
  const index = dynamic.members[0]!;
  assert.equal(first.kind === "property" && property.kind === "property" && index.kind === "index", true);
  if (first.kind !== "property" || property.kind !== "property" || index.kind !== "index") return;
  for (const selection of [
    undefined, { ...exact, kind: "deferred" as const }, { ...exact, members: [] },
    { ...exact, members: [first, first] },
    { ...exact, members: [{ ...first, property: property.property }] },
    { ...dynamic, members: [{ ...index, index: { ...index.index, declaration: undefined, components: [] } }] },
  ]) assert.equal(selectedSourceIndexedDeclarations(current.semantics, selection) === undefined, true,
    "unproved indexed declarations never acquire source-profile authority");
});
