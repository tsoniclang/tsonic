import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram, sourceObjectLiteralDestinationMember } from "../public/source.js";

test("optional union literal members retain exact selected destination declarations", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
    interface Count { readonly count: number; readonly note?: string; }
    declare function accept(value: Count | { text: string } | undefined): void;
    declare function requireCount(value: Count): void;
    accept({ note: "first", count: 7 });
    accept({ text: "other" });
    const sample: Count = { count: 1 };
    requireCount(sample);
  ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const declarations = source.ast.statements(file).filter(node => source.ast.is.IsInterfaceDeclaration(node));
  assert.equal(declarations.length, 1);
  const destination = semantics.declarations.declaredType(declarations[0]!);
  assert.ok(destination);
  const pending: Node[] = [file];
  let count = 0;
  let unrelated = 0;
  while (pending.length > 0) {
    const node = pending.pop()!;
    pending.push(...source.ast.children(node).filter((child): child is Node => child !== undefined));
    if (!source.ast.is.IsPropertyAssignment(node)) continue;
    const element = semantics.operations.objectLiteralElement(node);
    assert.ok(element);
    const selected = sourceObjectLiteralDestinationMember(element, destination, semantics);
    const name = source.ast.text(source.ast.name(node));
    if (name === "text") {
      assert.equal(selected === undefined, true, "a missing required destination member rejects");
      unrelated++;
      continue;
    }
    assert.equal(selected !== undefined, true, "every present destination member is exact");
    assert.ok(selected);
    assert.equal(selected.declarations.length, 1);
    assert.equal(source.ast.parent(selected.declarations[0]!) === declarations[0], true, "destination belongs to its exact interface");
    assert.equal(Object.isFrozen(selected), true);
    const correspondence = semantics.types.structuralMembers(element.objectLiteralType, destination);
    assert.ok(correspondence.kind === "available");
    const selectedPair = correspondence.members.find(pair => pair.kind === "present" && pair.destination === selected);
    assert.ok(selectedPair);
    const ambiguous = { types: { ...semantics.types, structuralMembers: () => ({ ...correspondence,
      members: [...correspondence.members, selectedPair] }) } };
    assert.equal(sourceObjectLiteralDestinationMember(element, destination, ambiguous), undefined);
    assert.equal(sourceObjectLiteralDestinationMember({ ...element, element: file, sourceElementSymbol: undefined }, destination, semantics), undefined);
    count++;
  }
  assert.equal(count, 3);
  assert.equal(unrelated, 1);
});
