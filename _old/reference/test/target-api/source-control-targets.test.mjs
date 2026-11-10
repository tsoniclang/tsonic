import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, sourceControlTransferTarget, selectSourceNativeGuardResult } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";
import { minimalSourceGlobals } from "../fixtures/minimal-source-globals.mjs";

test("source transfer targets distinguish labeled loops, nested switches and labeled blocks", async () => {
  const checked = await checkedSource("exact-source-control-targets", { "globals.d.ts": minimalSourceGlobals, "src/index.ts": `
export function run(value: number): void {
  outside: while (value > 0) {
    switch (value) {
      case 1: continue outside;
      case 2: break;
      default: break outside;
    }
    break;
  }
  region: { if (value > 0) break region; }
}
` });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.slice(0, 4)).slice(0, 2048));
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const transfers = [];
  const labels = [];
  let loop;
  let selection;
  const visit = node => {
    if (source.ast.is.IsBreakStatement(node) || source.ast.is.IsContinueStatement(node)) transfers.push(node);
    if (source.ast.is.IsLabeledStatement(node)) labels.push(node);
    if (source.ast.is.IsWhileStatement(node)) loop = node;
    if (source.ast.is.IsSwitchStatement(node)) selection = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(transfers.length, 5);
  const expected = [loop, selection, labels[0], loop, labels[1]];
  for (const [index, transfer] of transfers.entries())
    assert.equal(sourceControlTransferTarget(source.ast, transfer) === expected[index], true, `exact transfer ${index}`);
  assert.equal(sourceControlTransferTarget(source.ast, file) === undefined, true, "nontransfer has no target");
});

test("source transfer queries retain callable scope and finite ancestry guards", () => {
  const transfer = {};
  const parent = {};
  const ast = { kindName: node => node === transfer ? "KindBreakStatement" : "KindFunctionDeclaration",
    is: { IsBreakStatement: node => node === transfer, IsContinueStatement: () => false },
    as: { AsBreakStatement: () => ({}) }, parent: () => parent };
  assert.equal(sourceControlTransferTarget(ast, transfer) === undefined, true, "cannot cross a callable boundary");
  assert.equal(sourceControlTransferTarget({ ...ast, kindName: node => node === transfer ? "KindBreakStatement" : "KindBlock" },
    transfer) === undefined, true, "cyclic ancestry exhausts its finite guard");
});

test("native Boolean literal guards share exact truth through transparent syntax and negation", async () => {
  const checked = await checkedSource("native-boolean-literal-guards", { "globals.d.ts": minimalSourceGlobals,
    "src/index.ts": "export function run(flag: boolean): void { if (true) {} if (false) {} if (!(false)) {} if (flag) {} }" });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.slice(0, 4)).slice(0, 2048));
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const conditions = [];
  const visit = node => {
    if (source.ast.is.IsIfStatement(node)) conditions.push(source.ast.as.AsIfStatement(node).Expression);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const context = { ast: source.ast, navigation: source.navigation, semanticsFor: node => source.semantics.forNode(node) };
  const expected = [true, false, true, undefined];
  assert.equal(conditions.length, expected.length);
  for (const [index, condition] of conditions.entries())
    assert.equal(selectSourceNativeGuardResult(context, condition, () => undefined, () => undefined, () => undefined), expected[index]);
});
