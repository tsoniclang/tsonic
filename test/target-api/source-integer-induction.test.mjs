import assert from "node:assert/strict";
import test from "node:test";
import { createSourceProgramNavigation, sourceIntegerInduction } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";

test("bounded induction proves only unchanged zero-based counters with representation-independent uses", async () => {
  const source = await checkedSource("integer-induction", { "src/index.ts": `
    declare function consume(value: number): void;
    function loops(values: { length: number; [index: number]: number }) {
      for (let index = 0; index < values.length; index++) consume(values[index]);
      for (let index = 0; index < values.length; index++) { consume(values[index]); values.length++; }
      for (let index: number = 0; index < values.length; index++) consume(values[index]);
      for (let index = 0; index <= values.length; index++) consume(values[index]);
      for (let index = 0.5; index < values.length; index++) consume(values[index]);
      for (let index = 0; index < values.length; index++) { index += 0.5; consume(values[index]); }
      for (let index = 0; index < values.length; index++) consume(index / 2);
      for (let index = 0; index < values.length; index++) { const alias = index; consume(alias / 2); }
      for (let index = 0; index < values.length; index++) { const captured = () => index; consume(captured()); }
    }
  ` });
  const navigation = createSourceProgramNavigation(source);
  const file = projectSourceFile(source, "src/index.ts");
  const declarations = [];
  const visit = node => {
    if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "index") declarations.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.deepEqual(declarations.map(declaration => sourceIntegerInduction(declaration, source.ast, navigation) !== undefined),
    [true, true, false, false, false, false, false, false, false]);
});
