import * as ts from "typescript";
import { tryResolveDeterministicPropertyName } from "./property-names.js";

export const isOverloadSurfaceDeclaration = (
  decl: ts.Declaration
): decl is ts.SignatureDeclaration =>
  ts.isFunctionLike(decl) &&
  !ts.isConstructSignatureDeclaration(decl) &&
  !ts.isConstructorDeclaration(decl) &&
  (!("body" in decl) || decl.body === undefined);

export const isOverloadStubImplementation = (
  node: ts.FunctionDeclaration | ts.MethodDeclaration
): boolean => {
  if (!node.body) {
    return false;
  }

  if (ts.isFunctionDeclaration(node)) {
    if (!node.name || !node.parent || !ts.isSourceFile(node.parent)) {
      return false;
    }

    return node.parent.statements.some(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement !== node &&
        statement.name?.text === node.name?.text &&
        isOverloadSurfaceDeclaration(statement)
    );
  }

  if (!node.parent || !ts.isClassLike(node.parent)) {
    return false;
  }

  const memberName = tryResolveDeterministicPropertyName(node.name);
  if (!memberName) {
    return false;
  }

  return node.parent.members.some(
    (member) =>
      ts.isMethodDeclaration(member) &&
      member !== node &&
      tryResolveDeterministicPropertyName(member.name) === memberName &&
      isOverloadSurfaceDeclaration(member)
  );
};
