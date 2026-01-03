/**
 * Class declaration emission
 */

import { IrStatement, type IrType } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  withClassName,
} from "../../types.js";
import { emitType, emitTypeParameters } from "../../type-emitter.js";
import { emitClassMember } from "../classes.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { emitAttributes } from "../../core/attributes.js";
import { substituteType } from "../../specialization/substitution.js";

/**
 * Emit a class declaration
 */
export const emitClassDeclaration = (
  stmt: Extract<IrStatement, { kind: "classDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const parts: string[] = [];

  const hasTypeParameters = (stmt.typeParameters?.length ?? 0) > 0;
  const staticMembers = hasTypeParameters
    ? stmt.members.filter(
        (m) =>
          (m.kind === "methodDeclaration" || m.kind === "propertyDeclaration") &&
          m.isStatic
      )
    : [];
  const instanceMembers = hasTypeParameters
    ? stmt.members.filter(
        (m) =>
          m.kind === "constructorDeclaration" ||
          ((m.kind === "methodDeclaration" || m.kind === "propertyDeclaration") &&
            !m.isStatic)
      )
    : stmt.members;

  const synthesizedConstructors = (() => {
    // If the class extends a base class and does not declare a constructor,
    // TypeScript supplies a default constructor that forwards to `super(...args)`.
    // In C#, we must emit an explicit forwarding constructor when the base has
    // required parameters (otherwise the default parameterless constructor breaks).
    const hasOwnCtor = instanceMembers.some(
      (m) => m.kind === "constructorDeclaration"
    );
    if (hasOwnCtor) return [];
    if (!stmt.superClass || stmt.superClass.kind !== "referenceType") return [];
    if (!context.localTypes) return [];

    const baseName =
      stmt.superClass.name.split(".").pop() ?? stmt.superClass.name;
    const baseInfo = context.localTypes.get(baseName);
    if (!baseInfo || baseInfo.kind !== "class") return [];

    const baseCtors = baseInfo.members.filter(
      (m) => m.kind === "constructorDeclaration"
    );
    if (baseCtors.length === 0) return [];

    const baseTypeArgs = stmt.superClass.typeArguments ?? [];
    const substitutions = new Map<string, IrType>();
    for (let i = 0; i < baseInfo.typeParameters.length; i++) {
      const paramName = baseInfo.typeParameters[i];
      const argType = baseTypeArgs[i];
      if (paramName && argType) {
        substitutions.set(paramName, argType);
      }
    }

    return baseCtors.map((baseCtor) => {
      const forwardedParams = baseCtor.parameters.map((p) => ({
        ...p,
        type: p.type ? substituteType(p.type, substitutions) : undefined,
      }));

      const superArgs = forwardedParams.map((p) => {
        const name =
          p.pattern.kind === "identifierPattern" ? p.pattern.name : "arg";
        return { kind: "identifier" as const, name };
      });

      return {
        kind: "constructorDeclaration" as const,
        accessibility: baseCtor.accessibility ?? "public",
        parameters: forwardedParams,
        body: {
          kind: "blockStatement" as const,
          statements: [
            {
              kind: "expressionStatement" as const,
              expression: {
                kind: "call" as const,
                callee: { kind: "identifier" as const, name: "super" },
                arguments: superArgs,
                isOptional: false,
              },
            },
          ],
        },
      };
    });
  })();

  const membersToEmit =
    synthesizedConstructors.length > 0
      ? [...synthesizedConstructors, ...instanceMembers]
      : instanceMembers;

  // Build type parameter names set FIRST - needed when emitting superclass, implements, and members
  // Type parameters must be in scope before we emit types that reference them
  const classTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Create context with type parameters in scope
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: classTypeParams,
  };

  // Access modifiers
  const accessibility = stmt.isExported ? "public" : "internal";
  parts.push(accessibility);

  // Emit struct or class based on isStruct flag (escape C# keywords)
  parts.push(stmt.isStruct ? "struct" : "class");
  const escapedClassName = escapeCSharpIdentifier(stmt.name);
  parts.push(escapedClassName);

  // Type parameters
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  // Base class and interfaces
  const heritage: string[] = [];

  // Handle superclass (extends clause)
  if (stmt.superClass) {
    const [superClassType, newContext] = emitType(stmt.superClass, currentContext);
    currentContext = newContext;
    heritage.push(superClassType);
  }

  // Handle interfaces (implements clause)
  // In C#, the heritage list allows exactly one base class + any number of interfaces.
  // We only emit `implements` entries when we can confidently treat them as C# interfaces.
  //
  // This is required for generic constraints (e.g., `where T : IFoo`) to type-check,
  // while avoiding invalid/unsafe emission for nominalized "shape" declarations that
  // are emitted as C# classes (property-only TS interfaces, object-alias classes, etc.).
  const implementedInterfaces: string[] = [];
  for (const impl of stmt.implements) {
    if (impl.kind !== "referenceType") continue;

    const localInfo = context.localTypes?.get(impl.name);
    const isEmittedAsCSharpInterface =
      localInfo?.kind === "interface"
        ? localInfo.members.some((m) => m.kind === "methodSignature")
        : impl.resolvedClrType !== undefined;

    if (!isEmittedAsCSharpInterface) {
      continue;
    }

    const [implType, newContext] = emitType(impl, currentContext);
    currentContext = newContext;
    implementedInterfaces.push(implType);
  }
  heritage.push(...implementedInterfaces);

  const heritageStr = heritage.length > 0 ? ` : ${heritage.join(", ")}` : "";
  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";

  // Class body (use escaped class name)
  const baseContext = withClassName(indent(currentContext), escapedClassName);

  // Only set hasSuperClass flag if there's actually a superclass (for inheritance)
  // classTypeParams was already built at the start of this function and is already in currentContext
  const bodyContext: EmitterContext = {
    ...baseContext,
    hasSuperClass: stmt.superClass ? true : undefined,
    // typeParameters is inherited from currentContext via baseContext
  };
  const members: string[] = [];

  for (const member of membersToEmit) {
    const [memberCode, newContext] = emitClassMember(member, bodyContext);
    members.push(memberCode);
    currentContext = newContext;
  }

  // Emit attributes before the class declaration
  // Use original context (not the one after processing members) for correct indentation
  const [attributesCode] = emitAttributes(stmt.attributes, context);

  const signature = parts.join(" ");
  const memberCode = members.join("\n\n");

  // Build final code with attributes (if any)
  const attrPrefix = attributesCode ? attributesCode + "\n" : "";
  const mainClassCode = `${attrPrefix}${ind}${signature}${typeParamsStr}${heritageStr}${whereClause}\n${ind}{\n${memberCode}\n${ind}}`;

  // TS allows static members on generic classes, but C# requires selecting a concrete arity.
  // Emit static members into a non-generic companion static class (same name, different arity).
  if (staticMembers.length > 0) {
    const staticClassParts: string[] = [];
    staticClassParts.push(accessibility, "static class", escapedClassName);

    const companionBaseContext = withClassName(
      indent(context),
      escapedClassName
    );
    const companionBodyContext: EmitterContext = {
      ...companionBaseContext,
      hasSuperClass: undefined,
      // IMPORTANT: do not introduce the generic class type parameters into this scope
    };

    const staticMemberCodes: string[] = [];
    let companionContext = companionBodyContext;
    for (const member of staticMembers) {
      const [memberCode, newContext] = emitClassMember(member, companionContext);
      staticMemberCodes.push(memberCode);
      companionContext = newContext;
    }

    const staticSignature = staticClassParts.join(" ");
    const staticBody = staticMemberCodes.join("\n\n");
    const staticClassCode = `${ind}${staticSignature}\n${ind}{\n${staticBody}\n${ind}}`;

    const code = `${staticClassCode}\n${mainClassCode}`;
    return [code, currentContext];
  }

  const code = mainClassCode;

  return [code, currentContext];
};
