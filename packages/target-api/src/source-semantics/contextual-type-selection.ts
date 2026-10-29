import { ContextFlagsSkipBindingPatterns, type AstReader, type Node, type Type, type TypeCheckerQueries, type TypeShapeQueries } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer, Node_Type } from "../source-navigation/ast.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "./types.js";

export type SourceContextualValueTypeSelection =
  | { readonly kind: "selected"; readonly component: SourceTypeComponentEvidence }
  | { readonly kind: "ambiguous"; readonly types: readonly Type[] }
  | { readonly kind: "unavailable" };

export function selectSourceContextualValueType(
  ast: AstReader,
  types: TypeShapeQueries,
  checker: TypeCheckerQueries,
  semantics: SourceFileSemantics,
  node: Node,
): SourceContextualValueTypeSelection {
  const contextualType = checker.getContextualType(node, ContextFlagsSkipBindingPatterns);
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
    return { kind: "selected", component: contextualComponent(ast, semantics, node, candidates[0]!) };
  }
  return candidates.length === 0
    ? { kind: "unavailable" }
    : { kind: "ambiguous", types: Object.freeze(candidates) };
}

export function selectSourceContextualType(
  ast: AstReader,
  checker: TypeCheckerQueries,
  semantics: SourceFileSemantics,
  node: Node,
): SourceTypeComponentEvidence | undefined {
  const selected = checker.getContextualType(node);
  return selected === undefined ? undefined : contextualComponent(ast, semantics, node, selected);
}

function contextualComponent(
  ast: AstReader,
  semantics: SourceFileSemantics,
  node: Node,
  selectedType: Type,
): SourceTypeComponentEvidence {
  let current = node;
  for (let parent = ast.parent(current); parent !== undefined; parent = ast.parent(current)) {
    const assertion = ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent) || ast.is.IsSatisfiesExpression(parent);
    if (assertion && Node_Expression(ast, parent) === current && !ast.isConstAssertion(parent) ||
      (ast.is.IsVariableDeclaration(parent) || ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) &&
      Node_Initializer(ast, parent) === current) {
      const authoredTypeNode = Node_Type(ast, parent);
      return Object.freeze({ selectedType, ...(authoredTypeNode === undefined ||
        semantics.types.authoredSelection(authoredTypeNode, selectedType).kind === "unrelated" ? {}
        : { declaration: parent, authoredTypeNode }) });
    }
    if (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) {
      const call = semantics.operations.call(parent);
      const bindings = call?.sourceArgumentBindings.filter(binding =>
        binding.sourceForm === "value" && call.sourceArguments[binding.sourceArgumentIndex]?.expression === current);
      return Object.freeze({ selectedType, ...(call?.sourceSelectedSignatureKind === "resolved" && bindings?.length === 1 &&
        call.sourceSelectedSignatureParameters[bindings[0]!.sourceParameterIndex]?.parameterDeclaration !== undefined
        ? { contextualCall: call } : {}) });
    }
    if (Node_Expression(ast, parent) !== current || !(ast.is.IsParenthesizedExpression(parent) ||
      ast.is.IsNonNullExpression(parent) || ast.isConstAssertion(parent))) break;
    current = parent;
  }
  return Object.freeze({ selectedType });
}
