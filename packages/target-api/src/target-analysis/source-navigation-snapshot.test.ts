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
