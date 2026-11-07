import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createHostSourceProgram, selectSourceNativeValueGuard } from "../../packages/target-api/dist/public/host.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

test("native absence guards classify their references by Host value facts", async () => {
  const source = createHostSourceProgram(await checkedSource("native-value-guard-owners", {
    "src/absence.ts": "export const absent: undefined = undefined; export const present = 3;",
    "src/index.ts": `
import { absent as imported, present } from "./absence.js";
const local: null = null;
let mutable: number | undefined;
export function global(value: number | undefined) { return value !== undefined; }
export function alias(value: number | undefined) { return value === imported; }
export function reversed(value: number | null) { return local !== value; }
export function shadowed(value: number | undefined, undefined: number) { return value === undefined; }
export function numeric(value: number | undefined) { return value === present; }
export function mixed(value: number | undefined) { return value === mutable; }
export function narrowed(value: number | undefined) {
  mutable = undefined;
  return value === mutable;
}
export function nominal(value: number | undefined) { return value === 3; }
`,
  }), { profile: createJsSourceApiFacts });
  const file = projectSourceFile(source, "src/index.ts");
  for (const [name, kind, negated] of [
    ["global", "absence", true], ["alias", "absence", false], ["reversed", "absence", true],
    ["shadowed", undefined, undefined], ["numeric", undefined, undefined],
    ["mixed", undefined, undefined], ["narrowed", undefined, undefined], ["nominal", "literal", false],
  ]) {
    const expression = requiredNode(source.ast, namedDeclaration(source.ast, file, name),
      node => source.ast.is.IsBinaryExpression(node));
    const queried = [];
    // Guard operands are classified by the Host descriptor of the reference (R3), never a checked type.
    const values = { type(node) {
      queried.push(node);
      assert.equal(source.ast.is.IsIdentifier(node), true, `${name}: query the reference, not its declaration`);
      assert.equal(source.ast.getSourceFile(node) === file, true, `${name}: exact source owner`);
      return source.facts.values.type(node);
    } };
    const guard = selectSourceNativeValueGuard({ ast: source.ast, navigation: source.navigation, values }, expression);
    assert.equal(guard?.kind, kind, name);
    assert.equal(guard?.negated, negated, name);
    assert.equal(queried.length > 0, true, name);
    if (guard !== undefined) assert.equal(Object.isFrozen(guard), true, name);
  }
  const foreign = createHostSourceProgram(await checkedSource("foreign-native-value-guard", {
    "src/index.ts": "export const value = 1;",
  }), { profile: createJsSourceApiFacts });
  const foreignFile = projectSourceFile(foreign, "src/index.ts");
  const foreignValue = namedVariable(foreign.ast, foreignFile, "value");
  assert.throws(() => source.facts.values.type(foreignValue), /Source value facts/u,
    "a node of another program has no Host value fact in this program");
});
