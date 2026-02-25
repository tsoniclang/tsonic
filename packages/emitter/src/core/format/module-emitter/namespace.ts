/**
 * Namespace-level declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, indent } from "../../../types.js";
import { emitClassDeclarationAst } from "./class-ast.js";
import { emitEnumDeclarationAst } from "./enum-ast.js";
import { emitInterfaceDeclarationAst } from "./interface-ast.js";
import { emitTypeAliasDeclarationAst } from "./type-alias-ast.js";
import { type CSharpNamespaceMemberAst } from "../backend-ast/index.js";

export type NamespaceEmissionResult = {
  readonly members: readonly CSharpNamespaceMemberAst[];
  readonly context: EmitterContext;
};

/**
 * Emit namespace-level declarations (classes, interfaces)
 */
export const emitNamespaceDeclarations = (
  declarations: readonly IrStatement[],
  baseContext: EmitterContext,
  hasInheritance: boolean
): NamespaceEmissionResult => {
  const members: CSharpNamespaceMemberAst[] = [];
  const namespaceContext = { ...indent(baseContext), hasInheritance };
  let currentContext = namespaceContext;

  for (const decl of declarations) {
    if (decl.kind === "classDeclaration") {
      const [classMembers, newContext] = emitClassDeclarationAst(
        decl,
        namespaceContext,
        1
      );
      for (let index = 0; index < classMembers.length; index++) {
        if (members.length > 0) members.push({ kind: "blankLine" });
        const classMember = classMembers[index];
        if (classMember) members.push(classMember);
      }
      currentContext = { ...newContext, hasInheritance };
      continue;
    }
    if (decl.kind === "enumDeclaration") {
      const [enumMember, newContext] = emitEnumDeclarationAst(
        decl,
        namespaceContext,
        1
      );
      members.push(enumMember);
      currentContext = { ...newContext, hasInheritance };
      continue;
    }
    if (decl.kind === "typeAliasDeclaration") {
      const [typeAliasMember, newContext] = emitTypeAliasDeclarationAst(
        decl,
        namespaceContext,
        1
      );
      if (typeAliasMember) {
        members.push(typeAliasMember);
        currentContext = { ...newContext, hasInheritance };
        continue;
      }
    }
    if (decl.kind === "interfaceDeclaration") {
      const [interfaceMember, newContext] = emitInterfaceDeclarationAst(
        decl,
        namespaceContext,
        1
      );
      if (interfaceMember) {
        members.push(interfaceMember);
        currentContext = { ...newContext, hasInheritance };
        continue;
      }
    }
    throw new Error(
      `ICE: Unhandled namespace declaration kind in AST emitter: ${decl.kind}`
    );
  }

  return {
    members,
    context: currentContext,
  };
};
