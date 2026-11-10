import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture } from "./fixtures/source-type-flow-fixture.mjs";
import { Node_Expression, Node_Initializer } from "../../packages/target-api/dist/source-navigation/ast.js";
import { AsExpressionWithTypeArguments } from "../../packages/target-api/dist/source-navigation/checked-casts.js";
import { sourceConstructionExpression, sourceInstanceInitializers, sourceSuperConstructor } from "../../packages/target-api/dist/source-navigation/class-initialization.js";

function fixture(body) {
  const { source, nodes } = sourceTypeFlowFixture(`export {};\n${body}`, { imports: "" });
  return { source, nodes, select(predicate, label) {
    const selected = nodes.find(predicate);
    assert.equal(selected !== undefined, true, label);
    return selected;
  } };
}

function resolved(result) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? result.message : "the original query resolves");
  return result.value;
}

const constructionSource = `
class Base { constructor(value = 1) {} }
class Derived extends Base { constructor() { super(2); } }
const instance = new Derived();
function ordinary(): void {}
ordinary();`;

test("checked construction selects only its own new or declared super expression", () => {
  const { source, select } = fixture(constructionSource);
  const allocation = select(node => source.ast.is.IsNewExpression(node), "allocation");
  const superCall = select(node => source.ast.is.IsCallExpression(node) &&
    source.ast.kindName(Node_Expression(source.ast, node)) === "KindSuperKeyword", "super call");
  const ordinary = select(node => source.ast.is.IsCallExpression(node) &&
    source.ast.is.IsIdentifier(Node_Expression(source.ast, node)) &&
    source.ast.text(Node_Expression(source.ast, node)) === "ordinary", "ordinary call");
  assert.equal(resolved(sourceConstructionExpression(allocation, source, () => true)) === Node_Expression(source.ast, allocation), true, "own new expression");
  assert.equal(resolved(sourceConstructionExpression(superCall, source, () => true)) === resolved(sourceSuperConstructor(superCall, source, () => true))?.callee,
    true, "declared super expression");
  assert.equal(resolved(sourceConstructionExpression(ordinary, source, () => true)) === undefined, true, "ordinary call is not construction");
  const foreign = fixture(constructionSource);
  const foreignAllocation = foreign.select(node => foreign.source.ast.is.IsNewExpression(node), "foreign allocation");
  assert.equal(resolved(sourceConstructionExpression(foreignAllocation, source, () => true)) === undefined, true, "foreign allocation identity");
});

test("instance initializers retain authored order and exclude static and type-only fields", () => {
  const { source, select } = fixture("class Fields { first = 1; declare omitted: number; static skipped = 2; second = 3; }");
  const declaration = select(node => source.ast.is.IsClassDeclaration(node), "class declaration");
  const expected = source.ast.members(declaration).filter(member => member !== undefined &&
    source.ast.is.IsPropertyDeclaration(member) && ["first", "second"].includes(source.ast.text(source.ast.name(member))))
    .map(member => Node_Initializer(source.ast, member));
  let steps = 0;
  const selected = sourceInstanceInitializers(declaration, source, () => { steps += 1; return true; });
  assert.equal(selected?.length, 2, "two authored instance values");
  assert.equal(selected?.[0] === expected[0], true, "first initializer identity");
  assert.equal(selected?.[1] === expected[1], true, "second initializer identity");
  assert.equal(steps, source.ast.members(declaration).length, "finite visit includes excluded fields");
  assert.equal(Object.isFrozen(selected), true, "complete immutable initializer list");
});

test("super lookup retains the exact checked heritage and constructor owner", () => {
  const { source, select } = fixture(constructionSource);
  const declaration = select(node => source.ast.is.IsClassDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "Derived", "derived declaration");
  const constructor = source.ast.members(declaration).find(member => member !== undefined && source.ast.is.IsConstructorDeclaration(member));
  const superCall = select(node => source.ast.is.IsCallExpression(node) &&
    source.ast.kindName(Node_Expression(source.ast, node)) === "KindSuperKeyword", "super call");
  const heritage = resolved(source.facts.navigation.declaredHeritage(declaration));
  assert.equal(heritage.kind === "resolved", true, "checked declared heritage");
  if (heritage.kind !== "resolved") return;
  const base = heritage.edges.find(edge => edge.kind === "extends");
  assert.equal(base !== undefined, true, "one declared base");
  const selected = resolved(sourceSuperConstructor(superCall, source, () => true));
  assert.equal(selected?.owner === constructor, true, "original constructor owner");
  assert.equal(selected?.callee === AsExpressionWithTypeArguments(source.ast, base.heritage)?.Expression, true, "original heritage callee");
  const ambiguous = { ...source, facts: { ...source.facts, navigation: { ...source.facts.navigation,
    declaredHeritage: () => ({ kind: "resolved", value: { ...heritage, edges: [...heritage.edges, ...heritage.edges] } }),
  } } };
  assert.equal(resolved(sourceSuperConstructor(superCall, ambiguous, () => true)) === undefined, true, "ambiguous declared base refused");
  const foreign = fixture(constructionSource);
  const foreignSuper = foreign.select(node => foreign.source.ast.is.IsCallExpression(node) &&
    foreign.source.ast.kindName(Node_Expression(foreign.source.ast, node)) === "KindSuperKeyword", "foreign super");
  assert.equal(resolved(sourceSuperConstructor(foreignSuper, source, () => true)) === undefined, true, "foreign checked owner refused");
});

test("finite helper failure cannot publish partial initializer evidence", () => {
  const { source, select } = fixture("class Fields { first = 1; second = 2; third = 3; }");
  const declaration = select(node => source.ast.is.IsClassDeclaration(node), "class declaration");
  let steps = 0;
  const failed = sourceInstanceInitializers(declaration, source, () => { steps += 1; return steps < 2; });
  assert.equal(steps, 2, "failure after one initializer");
  assert.equal(failed === undefined, true, "no partial initializer publication");
  assert.equal(sourceInstanceInitializers(declaration, source, () => true)?.length, 3, "same original complete control");
  const failure = new Error("finite source work exhausted");
  assert.throws(() => sourceInstanceInitializers(declaration, source, () => { throw failure; }),
    thrown => thrown === failure, "caller-owned finite failure retained");
  const construction = fixture(constructionSource);
  const superCall = construction.select(node => construction.source.ast.is.IsCallExpression(node) &&
    construction.source.ast.kindName(Node_Expression(construction.source.ast, node)) === "KindSuperKeyword", "super call");
  assert.equal(resolved(sourceSuperConstructor(superCall, construction.source, () => false)) === undefined, true, "finite heritage walk failure");
});
