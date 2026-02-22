/**
 * Generate specialized declarations from requests
 */

import {
  IrFunctionDeclaration,
  IrClassDeclaration,
  IrBlockStatement,
  IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitStatement } from "../statement-emitter.js";
import { SpecializationRequest } from "./types.js";
import {
  generateSpecializedFunctionName,
  generateSpecializedClassName,
} from "./naming.js";
import { substituteType, substituteStatement } from "./substitution.js";

/**
 * Generate specialized declarations from requests
 * Returns C# code for the specialized declarations
 */
export const generateSpecializations = (
  requests: readonly SpecializationRequest[],
  context: EmitterContext
): [string, EmitterContext] => {
  if (requests.length === 0) {
    return ["", context];
  }

  const parts: string[] = [];
  let currentContext = context;

  for (const request of requests) {
    if (request.kind === "function") {
      const [code, newContext] = generateSpecializedFunction(
        request,
        currentContext
      );
      parts.push(code);
      currentContext = newContext;
    } else if (request.kind === "class") {
      const [code, newContext] = generateSpecializedClass(
        request,
        currentContext
      );
      parts.push(code);
      currentContext = newContext;
    }
  }

  return [parts.join("\n\n"), currentContext];
};

/**
 * Generate a specialized function by substituting type parameters
 */
const generateSpecializedFunction = (
  request: SpecializationRequest,
  context: EmitterContext
): [string, EmitterContext] => {
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

  // Emit the specialized function using the statement emitter
  return emitStatement(specializedDecl, context);
};

/**
 * Generate a specialized class by substituting type parameters
 */
const generateSpecializedClass = (
  request: SpecializationRequest,
  context: EmitterContext
): [string, EmitterContext] => {
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

  // Emit the specialized class using the statement emitter
  return emitStatement(specializedDecl, context);
};
