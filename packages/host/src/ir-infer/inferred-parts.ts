import type { DefId } from "../ids/contract.js";
import type { CheckedPhase, HirNode, NodeList, ParameterDeclaration } from "../ir-hir/contract.js";
import type { InferredSignaturePart } from "./contract.js";
import { encodeKey } from "../ids/index.js";

export function inferredPartKey(value: InferredSignaturePart): string {
  return encodeKey([value.definition, value.part.kind, value.part.kind === "parameter-initializer" ? value.part.index : null]);
}

export function inferredPartsOf(definition: DefId, declaration: HirNode): readonly InferredSignaturePart[] {
  const parameters = (list: NodeList<ParameterDeclaration<CheckedPhase>>): InferredSignaturePart[] => {
    const [first] = list.nodes;
    const receiver = first !== undefined && first.name.kind === "Identifier" && first.name.text === "this" ? 1 : 0;
    const parts: InferredSignaturePart[] = [];
    for (const [position, parameter] of list.nodes.entries())
      if (parameter.type === null && parameter.initializer !== null)
        parts.push({ definition, part: { kind: "parameter-initializer", index: position - receiver } });
    return parts;
  };
  switch (declaration.kind) {
    case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunction": case "MethodDeclaration": case "GetAccessor": {
      if (declaration.body === null) return [];
      const result: InferredSignaturePart[] = declaration.type !== null ? []
        : declaration.asteriskToken === null ? [{ definition, part: { kind: "return" } }]
        : [{ definition, part: { kind: "return" } }, { definition, part: { kind: "yield" } }];
      return [...result, ...parameters(declaration.parameters)];
    }
    case "Constructor": case "SetAccessor":
      return declaration.body === null ? [] : parameters(declaration.parameters);
    case "VariableDeclaration":
      return declaration.type === null && declaration.initializer !== null ? [{ definition, part: { kind: "variable" } }] : [];
    case "PropertyDeclaration":
      return declaration.type === null && declaration.initializer !== null ? [{ definition, part: { kind: "field" } }] : [];
    default:
      return [];
  }
}
