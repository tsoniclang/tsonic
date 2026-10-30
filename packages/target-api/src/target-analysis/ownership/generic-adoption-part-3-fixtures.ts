import { defaultSourceDeclarationOwnershipLimits } from "./contracts.js";

import assert from "node:assert/strict";
import type { Node } from "@tsonic/tsts";
import { fixture, sourceSpan } from "./generic-adoption-fixtures.js";

import { analyzeSourceDeclarationGenericAdoption } from "./generic-adoption.js";

import { createSourceDeclarationOwnershipBudget, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

import type { SourceDeclarationOwnershipLimits } from "./model.js";

function declaredQuery(current: ReturnType<typeof fixture>, limits: SourceDeclarationOwnershipLimits = defaultSourceDeclarationOwnershipLimits) {
  const node = current.nodes[0]!;
  const budget = createSourceDeclarationOwnershipBudget(node, limits);
  return analyzeSourceDeclarationGenericAdoption({ source: current.source, nodes: current.nodes, projectRoot: "/src", budget,
    premises: { completionFor(call, selected) {
      const semantics = current.source.semantics.forNode(call);
      const declaration = semantics.declarations.signatureDeclaration(selected.selectedSignature);
      if (declaration === undefined) return sourceDeclarationOwnershipUnresolved(call, "The unit native contract requires its real selected declaration.");
      const awaited = semantics.types.awaitedType(selected.sourceResultType);
      if (awaited !== undefined && semantics.types.isIdentical(awaited, selected.sourceResultType)) return { kind: "not-async" };
      return { kind: "async", resultPolicy: "must-observe", contract: { kind: "declaration", declaration,
        component: { selectedType: selected.sourceResultType, contextualCall: selected } } };
    } } });
}

export function checkedOperation(current: ReturnType<typeof fixture>, expression: string) {
  const { source } = current;
  const candidates = current.nodes.filter(node =>
    (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node) ||
      source.ast.is.IsPropertyAccessExpression(node)) && current.textFor(node) === expression);
  assert.equal(candidates.length, 1, "the original checked operation remains unique");
  const node = candidates[0]!;
  const semantics = source.semantics.forNode(node);
  const type = semantics.types.expressionType(node);
  assert.equal(type !== undefined, true, "the original operation retains its exact checked result type");
  const selected = source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)
    ? semantics.operations.call(node) : undefined;
  let declaration: Node | undefined;
  if (selected !== undefined) {
    if (selected.sourceSelectedSignatureKind !== "resolved") assert.fail("the same checked call must select its signature");
    declaration = semantics.declarations.signatureDeclaration(selected.selectedSignature);
    assert.equal(declaration !== undefined && current.nodes.includes(declaration), true,
      "the selected declaration belongs to the original checked program");
    assert.equal(type !== undefined && semantics.types.isIdentical(selected.sourceResultType, type), true,
      "the selected native result and original expression keep the same checked component");
    for (const binding of selected.sourceSelectedMethodTypeArguments ?? []) {
      const symbol = semantics.declarations.typeSymbol(binding.typeParameter);
      assert.equal(symbol !== undefined && semantics.declarations.symbolDeclarations(symbol)
        .some(parameter => source.ast.is.IsTypeParameterDeclaration(parameter) && current.nodes.includes(parameter)), true,
      "each selected generic argument retains its real checked formal");
    }
  } else {
    assert.equal(source.ast.is.IsPropertyAccessExpression(node), true,
      "only an original member read has no call signature");
  }
  return { node, type, declaration, typeArgumentCount: selected?.sourceSelectedMethodTypeArguments?.length ?? 0,
    sourceSpan: sourceSpan(source, node) };
}

export { declaredQuery };
