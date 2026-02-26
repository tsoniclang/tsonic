/**
 * Generate specialized declarations from requests
 *
 * Calls AST declaration emitters directly, returns CSharpTypeDeclarationAst[].
 * Function specializations are wrapped in a static helper class.
 */

import {
  IrFunctionDeclaration,
  IrClassDeclaration,
  IrBlockStatement,
  IrType,
} from "@tsonic/frontend";
import { EmitterContext, withStatic } from "../types.js";
import {
  emitClassDeclaration,
  emitFunctionDeclaration,
} from "../statements/declarations.js";
import type { CSharpTypeDeclarationAst } from "../core/format/backend-ast/types.js";
import { SpecializationRequest } from "./types.js";
import {
  generateSpecializedFunctionName,
  generateSpecializedClassName,
} from "./naming.js";
import { substituteType, substituteStatement } from "./substitution.js";

/**
 * Generate specialized declarations from requests.
 * Returns AST type declarations for all specializations.
 */
export const generateSpecializations = (
  requests: readonly SpecializationRequest[],
  context: EmitterContext
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  if (requests.length === 0) {
    return [[], context];
  }

  const decls: CSharpTypeDeclarationAst[] = [];
  let currentContext = context;

  for (const request of requests) {
    if (request.kind === "function") {
      const [funcDecls, newContext] = generateSpecializedFunction(
        request,
        currentContext
      );
      decls.push(...funcDecls);
      currentContext = newContext;
    } else if (request.kind === "class") {
      const [classDecls, newContext] = generateSpecializedClass(
        request,
        currentContext
      );
      decls.push(...classDecls);
      currentContext = newContext;
    }
  }

  return [decls, currentContext];
};

/**
 * Generate a specialized function by substituting type parameters.
 * Wraps the specialized methods in a static class for namespace-level placement.
 */
const generateSpecializedFunction = (
  request: SpecializationRequest,
  context: EmitterContext
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  const funcDecl = request.declaration as IrFunctionDeclaration;

  // Create type substitution map
  const substitutions = new Map<string, IrType>();
  if (funcDecl.typeParameters) {
    funcDecl.typeParameters.forEach((tp, index) => {
      const typeArg = request.typeArguments[index];
      if (typeArg) {
        substitutions.set(tp.name, typeArg);
      }
    });
  }

  // Substitute types in the function declaration
  const specializedDecl: IrFunctionDeclaration = {
    ...funcDecl,
    name: generateSpecializedFunctionName(funcDecl.name, request.typeArguments),
    typeParameters: undefined, // Remove type parameters
    parameters: funcDecl.parameters.map((param) => ({
      ...param,
      type: param.type ? substituteType(param.type, substitutions) : undefined,
    })),
    returnType: funcDecl.returnType
      ? substituteType(funcDecl.returnType, substitutions)
      : undefined,
    body: substituteStatement(funcDecl.body, substitutions) as IrBlockStatement,
  };

  // Emit the specialized function as static method members
  const staticContext = withStatic(context, true);
  const [funcMembers, funcCtx] = emitFunctionDeclaration(
    specializedDecl,
    staticContext
  );

  // Wrap in a static class for namespace-level placement
  const classDecl: CSharpTypeDeclarationAst = {
    kind: "classDeclaration",
    attributes: [],
    modifiers: ["public", "static"],
    name: `${specializedDecl.name}__Specialized`,
    interfaces: [],
    members: funcMembers,
  };

  return [[classDecl], funcCtx];
};

/**
 * Generate a specialized class by substituting type parameters
 */
const generateSpecializedClass = (
  request: SpecializationRequest,
  context: EmitterContext
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  const classDecl = request.declaration as IrClassDeclaration;

  // Create type substitution map
  const substitutions = new Map<string, IrType>();
  if (classDecl.typeParameters) {
    classDecl.typeParameters.forEach((tp, index) => {
      const typeArg = request.typeArguments[index];
      if (typeArg) {
        substitutions.set(tp.name, typeArg);
      }
    });
  }

  // Generate specialized class name
  const specializedName = generateSpecializedClassName(
    classDecl.name,
    request.typeArguments
  );

  // Substitute types in class members
  const specializedMembers = classDecl.members.map((member) => {
    if (member.kind === "propertyDeclaration") {
      return {
        ...member,
        type: member.type
          ? substituteType(member.type, substitutions)
          : undefined,
      };
    } else if (member.kind === "methodDeclaration") {
      return {
        ...member,
        parameters: member.parameters.map((param) => ({
          ...param,
          type: param.type
            ? substituteType(param.type, substitutions)
            : undefined,
        })),
        returnType: member.returnType
          ? substituteType(member.returnType, substitutions)
          : undefined,
        body: member.body
          ? (substituteStatement(
              member.body,
              substitutions
            ) as IrBlockStatement)
          : undefined,
      };
    } else if (member.kind === "constructorDeclaration") {
      return {
        ...member,
        parameters: member.parameters.map((param) => ({
          ...param,
          type: param.type
            ? substituteType(param.type, substitutions)
            : undefined,
        })),
        body: member.body
          ? (substituteStatement(
              member.body,
              substitutions
            ) as IrBlockStatement)
          : undefined,
      };
    }
    return member;
  });

  // Create specialized class declaration
  const specializedDecl: IrClassDeclaration = {
    ...classDecl,
    name: specializedName,
    typeParameters: undefined, // Remove type parameters
    members: specializedMembers,
    superClass: classDecl.superClass
      ? substituteType(classDecl.superClass, substitutions)
      : undefined,
    implements: classDecl.implements.map((iface) =>
      substituteType(iface, substitutions)
    ),
  };

  // Emit the specialized class as type declarations
  return emitClassDeclaration(specializedDecl, context);
};
