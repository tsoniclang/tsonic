import { defaultSourceDeclarationOwnershipLimits } from "./contracts.js";

import { fixture } from "./generic-adoption-fixtures.js";

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

export { declaredQuery };
