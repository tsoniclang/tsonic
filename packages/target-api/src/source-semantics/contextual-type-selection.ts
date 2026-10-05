import type {
  AstReader,
  Node,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import { Node_Initializer } from "../source-navigation/ast.js";

export type SourceContextualValueTypeSelection =
  | { readonly kind: "selected"; readonly type: Type }
  | { readonly kind: "ambiguous"; readonly types: readonly Type[] }
  | { readonly kind: "unavailable" };

export function selectSourceContextualValueType(
  ast: AstReader,
  types: TypeShapeQueries,
  checker: TypeCheckerQueries,
  node: Node,
): SourceContextualValueTypeSelection {
  let expression = node;
  let owner = ast.parent(expression);
  while (owner !== undefined && ast.is.IsParenthesizedExpression(owner)) {
    expression = owner;
    owner = ast.parent(expression);
  }
  if (owner !== undefined && (ast.is.IsVariableDeclaration(owner) || ast.is.IsParameterDeclaration(owner)) &&
    ast.typeNode(owner) === undefined && Node_Initializer(ast, owner) === expression) {
    const name = ast.name(owner);
    if (name !== undefined && (ast.is.IsObjectBindingPattern(name) || ast.is.IsArrayBindingPattern(name))) {
      return { kind: "unavailable" };
    }
  }
  const contextualType = checker.getContextualType(node);
  if (contextualType === undefined) {
    return { kind: "unavailable" };
  }
  const rawCandidates = types.isUnion(contextualType)
    ? types.getUnionOrIntersectionTypes(contextualType)
    : [contextualType];
  if (rawCandidates.some((candidate) => candidate === undefined)) {
    return { kind: "unavailable" };
  }
  const candidates = rawCandidates.filter(
    (candidate): candidate is Type =>
      candidate !== undefined && !types.isNullish(candidate),
  );
  if (candidates.length === 1) {
    return { kind: "selected", type: candidates[0]! };
  }
  return candidates.length === 0
    ? { kind: "unavailable" }
    : { kind: "ambiguous", types: Object.freeze(candidates) };
}
