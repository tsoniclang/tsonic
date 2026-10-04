import assert from "node:assert/strict";
import test from "node:test";
import { sourceConstructorParametersMatch } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, projectSourceFile } from "../fixtures/source-navigation.mjs";

test("constructor correspondence requires exact ordered declarations, omissions and rest evidence", async () => {
  const source = await checkedSource("constructor-parameter-correspondence", { "src/index.ts": `
    export class Box { constructor(readonly value: string, count: number = 1) {} }
    export class Other { constructor(readonly value: string, count: number = 1) {} }
  ` });
  const file = projectSourceFile(source, "src/index.ts");
  const parametersFor = name => {
    const constructor = source.ast.members(namedDeclaration(source.ast, file, name))
      .find(member => source.ast.kindName(member) === "KindConstructor");
    assert.equal(constructor !== undefined, true, `${name} constructor`);
    return source.ast.parameters(constructor).map((parameterDeclaration, index) =>
      Object.freeze({ parameterDeclaration, acceptsOmission: index === 1, rest: false }));
  };
  const declared = parametersFor("Box");
  const selected = declared.map(parameter => ({ ...parameter }));
  assert.equal(sourceConstructorParametersMatch(declared, selected), true);
  assert.equal(sourceConstructorParametersMatch([], []), true);
  for (const [label, invalid] of [
    ["foreign declaration", parametersFor("Other")],
    ["missing declaration", [{ ...selected[0], parameterDeclaration: undefined }, selected[1]]],
    ["order", [selected[1], selected[0]]],
    ["omission", [selected[0], { ...selected[1], acceptsOmission: false }]],
    ["rest", [{ ...selected[0], rest: true }, selected[1]]],
    ["arity", [selected[0]]],
  ]) assert.equal(sourceConstructorParametersMatch(declared, invalid), false, label);
});
