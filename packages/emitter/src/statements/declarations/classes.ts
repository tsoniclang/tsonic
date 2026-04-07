/**
 * Class declaration emission — returns CSharpTypeDeclarationAst[]
 */

import {
  IrStatement,
  stableIrTypeKey,
  type IrClassMember,
  type IrType,
} from "@tsonic/frontend";
import { EmitterContext, indent, withClassName } from "../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../type-emitter.js";
import { emitClassMember } from "../classes.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { emitAttributes } from "../../core/format/attributes.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { substituteType } from "../../specialization/substitution.js";
import { statementUsesPointer } from "../../core/semantic/unsafe.js";
import { emitCSharpName } from "../../naming-policy.js";
import { resolveCompatibleImplementedInterfaces } from "../../core/semantic/implicit-interfaces.js";
import type {
  CSharpAttributeAst,
  CSharpTypeDeclarationAst,
  CSharpMemberAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  buildHoistedInitializerStatement,
  isInterfaceReference,
  referenceTypeRequiresSetsRequiredMembersCtor,
  shouldHoistInstanceInitializer,
  stripMemberInitializer,
} from "./class-emitter-helpers.js";

/**
 * Emit a class declaration as CSharpTypeDeclarationAst[].
 *
 * May return two declarations when a generic class has static members
 * (companion static class + generic instance class).
 */
export const emitClassDeclaration = (
  stmt: Extract<IrStatement, { kind: "classDeclaration" }>,
  context: EmitterContext
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
    localSemanticTypes: context.localSemanticTypes,
    localValueTypes: context.localValueTypes,
  };

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

  // Apply class-level ctor attributes to all constructors
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

  // Build type parameter names set FIRST
  const classTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  let currentContext: EmitterContext = {
    ...context,
    typeParameters: classTypeParams,
  };

  // Access modifiers
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";

  const modifiers: string[] = [accessibility];
  if (needsUnsafe) modifiers.push("unsafe");

  const escapedClassName = escapeCSharpIdentifier(stmt.name);

  // Type parameters
  const reservedTypeParamNames = new Set<string>();
  for (const member of membersToEmit) {
    if (member.kind === "methodDeclaration") {
      const publicName = member.overloadFamily?.publicName ?? member.name;
      reservedTypeParamNames.add(
        emitCSharpName(publicName, "methods", context)
      );
      continue;
    }
    if (member.kind === "propertyDeclaration") {
      reservedTypeParamNames.add(
        emitCSharpName(member.name, "properties", context)
      );
    }
  }
  const [typeParamAsts, constraintAsts, typeParamContext] =
    emitTypeParametersAst(
      stmt.typeParameters,
      currentContext,
      reservedTypeParamNames
    );
  currentContext = typeParamContext;
  const declaringTypeParameterNames = stmt.typeParameters?.map((tp) => tp.name) ?? [];
  const declaringTypeParameterNameMap = new Map<string, string>();
  for (const name of declaringTypeParameterNames) {
    declaringTypeParameterNameMap.set(
      name,
      currentContext.typeParameterNameMap?.get(name) ?? name
    );
  }

  // Base class (extends clause)
  let baseType: CSharpTypeAst | undefined;
  if (stmt.superClass) {
    const [superClassTypeAst, newContext] = emitTypeAst(
      stmt.superClass,
      currentContext
    );
    currentContext = newContext;
    baseType = superClassTypeAst;
  }

  // Interfaces (implements clause)
  const implementedInterfaces: CSharpTypeAst[] = [];
  const explicitInterfaceRefs = stmt.implements.filter(
    (impl): impl is Extract<IrType, { kind: "referenceType" }> =>
      impl.kind === "referenceType" && isInterfaceReference(impl, currentContext)
  );
  const compatibleInterfaces = resolveCompatibleImplementedInterfaces(
    stmt.name,
    stmt.implements,
    currentContext
  );
  const emittedInterfaceKeys = new Set<string>();
  for (const impl of explicitInterfaceRefs) {
    const implKey = stableIrTypeKey(impl);
    if (emittedInterfaceKeys.has(implKey)) continue;

    const [implTypeAst, newContext] = emitTypeAst(impl, currentContext);
    currentContext = newContext;
    implementedInterfaces.push(implTypeAst);
    emittedInterfaceKeys.add(implKey);
  }
  for (const match of compatibleInterfaces) {
    const impl = match.ref;
    if (impl.kind !== "referenceType") continue;
    const implKey = stableIrTypeKey(impl);
    if (emittedInterfaceKeys.has(implKey)) continue;
    if (!isInterfaceReference(impl, currentContext)) continue;

    const [implTypeAst, newContext] = emitTypeAst(impl, currentContext);
    currentContext = newContext;
    implementedInterfaces.push(implTypeAst);
    emittedInterfaceKeys.add(implKey);
  }

  // Class body
  const baseContext = {
    ...withClassName(indent(currentContext), escapedClassName),
    declaringTypeName: stmt.name,
    declaringTypeParameterNames,
    declaringTypeParameterNameMap:
      declaringTypeParameterNameMap.size > 0
        ? declaringTypeParameterNameMap
        : undefined,
  };
  const bodyContext: EmitterContext = {
    ...baseContext,
    hasSuperClass: stmt.superClass ? true : undefined,
  };

  const memberAsts: CSharpMemberAst[] = [];
  const hoistedInitializerStatements: CSharpStatementAst[] = [];
  for (const member of membersToEmit) {
    const [emittedMembers, newContext] = emitClassMember(member, bodyContext);
    for (const memberAst of emittedMembers) {
      if (
        shouldHoistInstanceInitializer(member) &&
        (memberAst.kind === "fieldDeclaration" ||
          memberAst.kind === "propertyDeclaration") &&
        memberAst.initializer
      ) {
        const hoistedStatement = buildHoistedInitializerStatement(memberAst);
        if (hoistedStatement) {
          hoistedInitializerStatements.push(hoistedStatement);
        }
        memberAsts.push(stripMemberInitializer(memberAst));
      } else {
        memberAsts.push(memberAst);
      }
    }
    currentContext = newContext;
  }

  const memberAstsWithHoistedInitializers = (() => {
    if (hoistedInitializerStatements.length === 0) {
      return memberAsts;
    }

    const updatedMembers = memberAsts.map((memberAst) => {
      if (memberAst.kind !== "constructorDeclaration") {
        return memberAst;
      }

      return {
        ...memberAst,
        body: {
          ...memberAst.body,
          statements: [
            ...hoistedInitializerStatements,
            ...memberAst.body.statements,
          ],
        },
      };
    });

    const hasAnyConstructor = updatedMembers.some(
      (memberAst) => memberAst.kind === "constructorDeclaration"
    );
    if (hasAnyConstructor) {
      return updatedMembers;
    }

    return [
      {
        kind: "constructorDeclaration",
        attributes: [],
        modifiers: ["public"],
        name: escapedClassName,
        parameters: [],
        body: {
          kind: "blockStatement",
          statements: hoistedInitializerStatements,
        },
      } satisfies CSharpMemberAst,
      ...updatedMembers,
    ];
  })();

  const hasRequiredProperties = memberAstsWithHoistedInitializers.some(
    (m) => m.kind === "propertyDeclaration" && m.modifiers.includes("required")
  );
  const baseRequiresSetsRequiredMembersCtor =
    stmt.superClass?.kind === "referenceType"
      ? referenceTypeRequiresSetsRequiredMembersCtor(stmt.superClass, context)
      : false;
  const setsRequiredAttribute: CSharpAttributeAst = {
    type: identifierType(
      "global::System.Diagnostics.CodeAnalysis.SetsRequiredMembersAttribute"
    ),
  };
  const memberAstsWithRequiredCtor = (() => {
    if (
      stmt.isStruct ||
      (!hasRequiredProperties && !baseRequiresSetsRequiredMembersCtor)
    ) {
      return memberAstsWithHoistedInitializers;
    }
    const updatedMembers = memberAstsWithHoistedInitializers.map((m) => {
      if (m.kind !== "constructorDeclaration") return m;
      const hasSetsRequired = m.attributes.some((a) => {
        if (a.type.kind !== "identifierType") return false;
        const name = a.type.name;
        return (
          name ===
            "global::System.Diagnostics.CodeAnalysis.SetsRequiredMembersAttribute" ||
          name.endsWith(".SetsRequiredMembersAttribute")
        );
      });
      if (hasSetsRequired) return m;
      return {
        ...m,
        attributes: [setsRequiredAttribute, ...m.attributes],
      };
    });

    const hasAnyConstructor = updatedMembers.some(
      (m) => m.kind === "constructorDeclaration"
    );
    if (hasAnyConstructor) return updatedMembers;

    const synthesizedCtor: CSharpMemberAst = {
      kind: "constructorDeclaration",
      attributes: [setsRequiredAttribute],
      modifiers: ["public"],
      name: escapedClassName,
      parameters: [],
      body: { kind: "blockStatement", statements: [] },
    };
    return [synthesizedCtor, ...updatedMembers];
  })();

  // Attributes
  const [attrs] = emitAttributes(stmt.attributes, context);

  // Build main class/struct declaration
  const mainDecl: CSharpTypeDeclarationAst = stmt.isStruct
    ? {
        kind: "structDeclaration",
        attributes: attrs,
        modifiers,
        name: escapedClassName,
        typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
        interfaces: implementedInterfaces,
        members: memberAstsWithRequiredCtor,
        constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
      }
    : {
        kind: "classDeclaration",
        attributes: attrs,
        modifiers,
        name: escapedClassName,
        typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
        baseType,
        interfaces: implementedInterfaces,
        members: memberAstsWithRequiredCtor,
        constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
      };

  // Companion static class for generic class static members
  if (staticMembers.length > 0) {
    const staticModifiers = [accessibility, "static"];
    if (needsUnsafe) staticModifiers.push("unsafe");

    const companionBaseContext = withClassName(
      indent(context),
      escapedClassName
    );
    const companionBodyContext: EmitterContext = {
      ...companionBaseContext,
      hasSuperClass: undefined,
    };

    const staticMemberAsts: CSharpMemberAst[] = [];
    let companionContext = companionBodyContext;
    for (const member of staticMembers) {
      const [emittedMembers, newContext] = emitClassMember(
        member,
        companionContext
      );
      staticMemberAsts.push(...emittedMembers);
      companionContext = newContext;
    }

    const companionDecl: CSharpTypeDeclarationAst = {
      kind: "classDeclaration",
      attributes: [],
      modifiers: staticModifiers,
      name: escapedClassName,
      interfaces: [],
      members: staticMemberAsts,
    };

    return [[companionDecl, mainDecl], { ...currentContext, ...savedScoped }];
  }

  return [[mainDecl], { ...currentContext, ...savedScoped }];
};
