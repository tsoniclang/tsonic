import { checkedSourceViews } from "../../../../packages/host/dist/pipeline/checked-inputs.js";

export function checkedDomain(checked, hir) {
  const nodes = hir.indexSyntaxTree(checked.tree);
  const views = checkedSourceViews([{ module: checked, nodes }]);
  return { nodes, nodeOf: views.nodeOf, localExists: views.localExists, bodyOf: views.bodies, sources: views,
    declarationSourceOf: views.declarationSourceOf };
}
