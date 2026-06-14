import {
  getTstsBodyNode,
  getTstsNodeNameText,
  getTstsStatementNodes,
  isTstsFunctionLikeDeclaration,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import { tryResolveDeterministicPropertyName } from "./property-names.js";

export const isOverloadSurfaceDeclaration = (
  decl: TstsNode
): boolean =>
  isTstsFunctionLikeDeclaration(decl) &&
  decl.Kind !== TstsSyntax.KindConstructSignature &&
  decl.Kind !== TstsSyntax.KindConstructor &&
  getTstsBodyNode(decl) === undefined;

export const isOverloadStubImplementation = (
  node: TstsNode
): boolean => {
  if (getTstsBodyNode(node) === undefined) {
    return false;
  }

  if (node.Kind === TstsSyntax.KindFunctionDeclaration) {
    const functionName = getTstsNodeNameText(node);
    if (!functionName || node.Parent?.Kind !== TstsSyntax.KindSourceFile) {
      return false;
    }

    return getTstsStatementNodes(node.Parent).some(
      (statement) =>
        statement?.Kind === TstsSyntax.KindFunctionDeclaration &&
        statement !== node &&
        getTstsNodeNameText(statement) === functionName &&
        isOverloadSurfaceDeclaration(statement)
    );
  }

  const parent = node.Parent;
  if (
    !parent ||
    (parent.Kind !== TstsSyntax.KindClassDeclaration &&
      parent.Kind !== TstsSyntax.KindClassExpression)
  ) {
    return false;
  }

  const memberName = tryResolveDeterministicPropertyName(
    TstsSyntax.Node_PropertyNameOrName(node)
  );
  if (!memberName) {
    return false;
  }

  return (TstsSyntax.Node_Members(parent) ?? []).some(
    (member) =>
      member?.Kind === TstsSyntax.KindMethodDeclaration &&
      member !== node &&
      tryResolveDeterministicPropertyName(
        TstsSyntax.Node_PropertyNameOrName(member)
      ) === memberName &&
      isOverloadSurfaceDeclaration(member)
  );
};
