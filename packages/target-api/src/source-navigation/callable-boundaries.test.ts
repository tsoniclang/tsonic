import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { isSourceCallableBodyBoundary } from "./callable-boundaries.js";

const sourceText = `
function declared(): number { return 1; }
const expression = function (): number { return 2; };
const arrow = (): number => 3;
const literal = { method(): number { return 4; }, get value(): number { return 5; }, set value(next: number) {} };
class Owner {
  static { const inside = 6; }
  constructor() {}
  method(): number { return 7; }
  get current(): number { return 8; }
  set current(next: number) {}
}
const Local = class {};
interface Shape { method(): number; }
export { declared, expression, arrow, literal, Owner, Local };
export type { Shape };
`;

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": sourceText },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
  const { ast } = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const byKind = new Map<string, Node[]>();
  const visit = (node: Node): void => {
    const kind = ast.kindName(node);
    byKind.set(kind, [...(byKind.get(kind) ?? []), node]);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  return { ast, byKind };
}

test("callable body boundaries are exactly the seven callable declaration and expression kinds", () => {
  const { ast, byKind } = fixture();
  const boundaries = [...byKind].filter(([, nodes]) => nodes.every(node => isSourceCallableBodyBoundary(ast, node)))
    .map(([kind]) => kind).sort();
  assert.deepEqual(boundaries, [
    "KindArrowFunction", "KindConstructor", "KindFunctionDeclaration", "KindFunctionExpression",
    "KindGetAccessor", "KindMethodDeclaration", "KindSetAccessor",
  ]);
  for (const [kind, nodes] of byKind) {
    assert.equal(nodes.every(node => isSourceCallableBodyBoundary(ast, node)) ||
      nodes.every(node => !isSourceCallableBodyBoundary(ast, node)), true, kind);
  }
  assert.equal(byKind.get("KindMethodDeclaration")?.length, 2, "object-literal and class methods are both boundaries");
  assert.equal(byKind.get("KindGetAccessor")?.length, 2);
  for (const kind of ["KindClassStaticBlockDeclaration", "KindClassDeclaration", "KindClassExpression", "KindMethodSignature", "KindBlock"]) {
    assert.equal((byKind.get(kind)?.length ?? 0) > 0, true, `${kind} occurs in the fixture`);
    assert.equal(byKind.get(kind)!.some(node => isSourceCallableBodyBoundary(ast, node)), false, kind);
  }
});
