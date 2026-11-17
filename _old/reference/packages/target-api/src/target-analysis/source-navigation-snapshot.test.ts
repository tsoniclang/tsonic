import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";
import { snapshotTargetPlanningSourceNavigation } from "../public/analysis.js";

test("the planning snapshot classifies every type-literal member once, whatever its name form", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      const key = "c";
      type Keys = { [1]: number; ["a"]: number; [key]: number; 2: number; "b": number; d: number; ["m"](): number };
      export function first(value: { [3]: number; ["e"]: string }): number { return 1; }
      export function second(): { ["h"]: number } { return { h: 1 }; }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const members: Node[] = [];
  const visit = (node: Node): void => {
    const parent = source.ast.parent(node);
    if (parent !== undefined && source.ast.kindName(parent) === "KindTypeLiteral") members.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(members.length, 10, "the fixture has ten type-literal members");
  const reads = new Map<Node, number>();
  let sealed = false;
  const snapshot = snapshotTargetPlanningSourceNavigation({
    ...source,
    navigation: {
      ...source.navigation,
      declarationUseSummary(declaration) {
        assert.equal(sealed, false, "snapshot reads never query live declaration summaries");
        reads.set(declaration, (reads.get(declaration) ?? 0) + 1);
        return source.navigation.declarationUseSummary(declaration);
      },
    },
  });
  sealed = true;
  members.forEach((member, index) => {
    const label = `type-literal member ${index} (${source.ast.kindName(member)})`;
    const expected = source.navigation.declarationUseSummary(member);
    assert.equal(snapshot.declarationUseSummary(member) === expected, true, `${label}: exact checked summary`);
    assert.equal(snapshot.declarationUseSummary(member) === expected, true, `${label}: stable sealed lookup`);
    assert.equal(reads.get(member), 1, `${label}: selected exactly once before sealing`);
  });
});

test("the planning snapshot seals destructuring declaration roots as well as their exact binding elements", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `const [key] = [9007199254740993] as const;
      const { value: objectKey } = { value: "field" } as const;
      const [unused] = [1] as const;
      export const first = { [key]: 1 }; export const second = { [objectKey]: 2 };`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the const destructuring program checks");
  const source = createTargetSourceProgram(checked);
  const declarations: Node[] = [];
  const pending: Node[] = [...source.navigation.sourceFiles];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsBindingElement(node)) declarations.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const reads = new Map<Node, number>();
  let sealed = false;
  const snapshot = snapshotTargetPlanningSourceNavigation({ ...source, navigation: {
    ...source.navigation, declarationUseSummary(declaration) {
      assert.equal(sealed, false, "a sealed declaration summary never queries source navigation");
      reads.set(declaration, (reads.get(declaration) ?? 0) + 1);
      return source.navigation.declarationUseSummary(declaration);
    },
  } });
  sealed = true;
  assert.equal(declarations.length, 8, "five variable roots and three exact binding elements are present");
  for (const [index, declaration] of declarations.entries()) {
    const expected = source.navigation.declarationUseSummary(declaration);
    assert.equal(snapshot.declarationUseSummary(declaration) === expected, true, `binding declaration ${index}: exact sealed identity`);
    assert.equal(reads.get(declaration), 1, `binding declaration ${index}: one producer read`);
  }
});
