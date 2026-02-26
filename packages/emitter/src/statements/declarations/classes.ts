/**
 * Class declaration emission
 */

import { IrStatement, type IrClassMember, type IrType } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  withClassName,
} from "../../types.js";
import { emitTypeAst, emitTypeParameters } from "../../type-emitter.js";
import {
  printType,
  printAttributes,
} from "../../core/format/backend-ast/printer.js";
import { emitClassMember } from "../classes.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { emitAttributes } from "../../core/format/attributes.js";
import { substituteType } from "../../specialization/substitution.js";
import { statementUsesPointer } from "../../core/semantic/unsafe.js";
import { emitCSharpName } from "../../naming-policy.js";

/**
 * Emit a class declaration
 */
export const emitClassDeclaration = (
  stmt: Extract<IrStatement, { kind: "classDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
  };

  const ind = getIndent(context);
  const parts: string[] = [];
  const needsUnsafe = statementUsesPointer(stmt);

  const hasTypeParameters = (stmt.typeParameters?.length ?? 0) > 0;
  const ctorAttributes = stmt.ctorAttributes ?? [];
  const staticMembers = hasTypeParameters
    ? stmt.members.filter(
        (m) =>
          (m.kind === "methodDeclaration" ||
            m.kind === "propertyDeclaration") &&
          m.isStatic
      )
    : [];
  const instanceMembers: readonly IrClassMember[] = hasTypeParameters
    ? stmt.members.filter(
        (m) =>
          m.kind === "constructorDeclaration" ||
          ((m.kind === "methodDeclaration" ||
            m.kind === "propertyDeclaration") &&
            !m.isStatic)
      )
    : stmt.members;

  const synthesizedConstructors: readonly IrClassMember[] = (() => {
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

  const membersToEmitBase: readonly IrClassMember[] =
    synthesizedConstructors.length > 0
      ? [...synthesizedConstructors, ...instanceMembers]
      : instanceMembers;

  // If ctor attributes were requested but no constructor exists, synthesize a
  // parameterless constructor so the attributes can be emitted deterministically.
  // Note: for classes with a base type that requires forwarding, synthesizedConstructors
  // will be non-empty, so we won't create an invalid parameterless ctor.
  const ensureCtorForAttributes =
    ctorAttributes.length > 0 &&
    !stmt.isStruct &&
    !membersToEmitBase.some((m) => m.kind === "constructorDeclaration");

  const membersToEmitWithCtor: readonly IrClassMember[] =
    ensureCtorForAttributes
      ? [
          {
            kind: "constructorDeclaration",
            accessibility: "public",
            parameters: [],
            body: { kind: "blockStatement", statements: [] },
          } satisfies IrClassMember,
          ...membersToEmitBase,
        ]
      : membersToEmitBase;

  // Apply class-level ctor attributes to all constructors (explicit or synthesized).
  const membersToEmit: readonly IrClassMember[] = membersToEmitWithCtor.map(
    (member): IrClassMember => {
      if (member.kind !== "constructorDeclaration") return member;
      if (ctorAttributes.length === 0) return member;

      const existing = member.attributes ?? [];
      return {
        ...member,
        attributes: [...ctorAttributes, ...existing],
      };
    }
  );

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
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";
  parts.push(accessibility);
  if (needsUnsafe) parts.push("unsafe");

  // Emit struct or class based on isStruct flag (escape C# keywords)
  parts.push(stmt.isStruct ? "struct" : "class");
  const escapedClassName = escapeCSharpIdentifier(stmt.name);
  parts.push(escapedClassName);

  // Type parameters
  const reservedTypeParamNames = new Set<string>();
  for (const member of membersToEmit) {
    if (member.kind === "methodDeclaration") {
      reservedTypeParamNames.add(
        emitCSharpName(member.name, "methods", context)
      );
      continue;
    }
    if (member.kind === "propertyDeclaration") {
      reservedTypeParamNames.add(
        emitCSharpName(member.name, "properties", context)
      );
    }
  }
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext,
    reservedTypeParamNames
  );
  currentContext = typeParamContext;

  // Base class and interfaces
  const heritage: string[] = [];

  // Handle superclass (extends clause)
  if (stmt.superClass) {
    const [superClassTypeAst, newContext] = emitTypeAst(
      stmt.superClass,
      currentContext
    );
    currentContext = newContext;
    heritage.push(printType(superClassTypeAst));
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
    const isLocalCSharpInterface =
      localInfo?.kind === "interface" &&
      localInfo.members.some((m) => m.kind === "methodSignature");

    // For CLR bindings, determine interface-ness from the bindings registry.
    //
    // IMPORTANT: referenceType.name may refer to a tsbindgen companion type
    // (e.g. `Foo_1$instance` or `__Foo$views`) even though the canonical binding
    // key is `Foo_1`. Prefer the canonical `typeId.tsName` when available and
    // fall back to deterministic name normalization.
    const bindingKeyCandidates: string[] = [impl.name];
    if (impl.typeId?.tsName) bindingKeyCandidates.push(impl.typeId.tsName);
    if (impl.name.endsWith("$instance")) {
      bindingKeyCandidates.push(impl.name.slice(0, -"$instance".length));
    }
    if (impl.name.startsWith("__") && impl.name.endsWith("$views")) {
      bindingKeyCandidates.push(impl.name.slice("__".length, -"$views".length));
    }

    const regBinding = bindingKeyCandidates
      .map((k) => context.bindingsRegistry?.get(k))
      .find((b): b is NonNullable<typeof b> => b !== undefined);

    const isClrInterface = regBinding?.kind === "interface";

    if (!isLocalCSharpInterface && !isClrInterface) continue;

    const [implTypeAst, newContext] = emitTypeAst(impl, currentContext);
    currentContext = newContext;
    implementedInterfaces.push(printType(implTypeAst));
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
  const [attrs] = emitAttributes(stmt.attributes, context);

  const signature = parts.join(" ");
  const memberCode = members.join("\n\n");

  // Build final code with attributes (if any)
  const attrPrefix = attrs.length > 0 ? printAttributes(attrs, ind) : "";
  const mainClassCode = `${attrPrefix}${ind}${signature}${typeParamsStr}${heritageStr}${whereClause}\n${ind}{\n${memberCode}\n${ind}}`;

  // TS allows static members on generic classes, but C# requires selecting a concrete arity.
  // Emit static members into a non-generic companion static class (same name, different arity).
  if (staticMembers.length > 0) {
    const staticClassParts: string[] = [];
    staticClassParts.push(accessibility, "static");
    if (needsUnsafe) staticClassParts.push("unsafe");
    staticClassParts.push("class", escapedClassName);

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
      const [memberCode, newContext] = emitClassMember(
        member,
        companionContext
      );
      staticMemberCodes.push(memberCode);
      companionContext = newContext;
    }

    const staticSignature = staticClassParts.join(" ");
    const staticBody = staticMemberCodes.join("\n\n");
    const staticClassCode = `${ind}${staticSignature}\n${ind}{\n${staticBody}\n${ind}}`;

    const code = `${staticClassCode}\n${mainClassCode}`;
    return [code, { ...currentContext, ...savedScoped }];
  }

  const code = mainClassCode;

  return [code, { ...currentContext, ...savedScoped }];
};
