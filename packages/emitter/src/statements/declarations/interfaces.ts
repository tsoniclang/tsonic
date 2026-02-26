/**
 * Interface declaration emission — returns CSharpTypeDeclarationAst[]
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../type-emitter.js";
import {
  extractInlineObjectTypes,
  emitExtractedType,
  emitInterfaceMemberAsProperty,
  emitParameters,
} from "../classes.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { statementUsesPointer } from "../../core/semantic/unsafe.js";
import { emitCSharpName } from "../../naming-policy.js";
import type {
  CSharpTypeDeclarationAst,
  CSharpMemberAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";

/**
 * Emit an interface declaration as CSharpTypeDeclarationAst[].
 *
 * May return multiple declarations when the interface has inline object
 * type properties (each extracted as a separate class).
 */
export const emitInterfaceDeclaration = (
  stmt: Extract<IrStatement, { kind: "interfaceDeclaration" }>,
  context: EmitterContext
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
  };

  const hasMethodSignatures = stmt.members.some(
    (m) => m.kind === "methodSignature"
  );

  // Build type parameter names set FIRST
  const ifaceTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Create context with type parameters in scope
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: ifaceTypeParams,
  };

  // Extract inline object types
  const extractedTypes = extractInlineObjectTypes(stmt.members, currentContext);
  const extractedDecls: CSharpTypeDeclarationAst[] = [];
  for (const extracted of extractedTypes) {
    const [declAst, newContext] = emitExtractedType(extracted, currentContext);
    extractedDecls.push(declAst);
    currentContext = newContext;
  }

  const needsUnsafe = statementUsesPointer(stmt);

  // Access modifier
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";

  const modifiers: string[] = [accessibility];
  if (needsUnsafe) modifiers.push("unsafe");

  // Type parameters
  const reservedTypeParamNames = new Set<string>();
  for (const member of stmt.members) {
    if (member.kind === "methodSignature") {
      reservedTypeParamNames.add(
        emitCSharpName(member.name, "methods", context)
      );
      continue;
    }
    if (member.kind === "propertySignature") {
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

  // Extended interfaces/classes
  const interfaces: CSharpTypeAst[] = [];
  if (stmt.extends && stmt.extends.length > 0) {
    for (const ext of stmt.extends) {
      const [extTypeAst, newContext] = emitTypeAst(ext, currentContext);
      currentContext = newContext;
      interfaces.push(extTypeAst);
    }
  }

  // Build members
  const members: CSharpMemberAst[] = [];

  for (const member of stmt.members) {
    if (!hasMethodSignatures) {
      // Property-only interface → class/struct members
      const [memberAst, newContext] = emitInterfaceMemberAsProperty(
        member,
        currentContext
      );
      members.push(memberAst);
      currentContext = newContext;
      continue;
    }

    // C# interface members
    if (member.kind === "propertySignature") {
      const [baseTypeAst, typeContext] = (() => {
        if (member.type) {
          return emitTypeAst(member.type, currentContext);
        }
        const objType: CSharpTypeAst = {
          kind: "identifierType",
          name: "object",
        };
        return [objType, currentContext] as const;
      })();
      currentContext = typeContext;

      const typeAst: CSharpTypeAst = member.isOptional
        ? { kind: "nullableType", underlyingType: baseTypeAst }
        : baseTypeAst;

      members.push({
        kind: "propertyDeclaration",
        attributes: [],
        modifiers: [],
        type: typeAst,
        name: emitCSharpName(member.name, "properties", context),
        hasGetter: true,
        hasSetter: !member.isReadonly,
        isAutoProperty: true,
      });
      continue;
    }

    if (member.kind === "methodSignature") {
      const [returnTypeAst, returnTypeContext] = (() => {
        if (member.returnType) {
          return emitTypeAst(member.returnType, currentContext);
        }
        const voidType: CSharpTypeAst = {
          kind: "identifierType",
          name: "void",
        };
        return [voidType, currentContext] as const;
      })();
      currentContext = returnTypeContext;

      const [paramAsts, paramContext] = emitParameters(
        member.parameters,
        currentContext
      );
      currentContext = paramContext;

      members.push({
        kind: "methodDeclaration",
        attributes: [],
        modifiers: [],
        returnType: returnTypeAst,
        name: emitCSharpName(member.name, "methods", context),
        parameters: paramAsts,
      });
      continue;
    }
  }

  // Determine C# declaration kind
  const mainDecl: CSharpTypeDeclarationAst = hasMethodSignatures
    ? {
        kind: "interfaceDeclaration",
        attributes: [],
        modifiers,
        name: escapeCSharpIdentifier(stmt.name),
        typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
        interfaces,
        members,
        constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
      }
    : stmt.isStruct
      ? {
          kind: "structDeclaration",
          attributes: [],
          modifiers,
          name: escapeCSharpIdentifier(stmt.name),
          typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
          interfaces,
          members,
          constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
        }
      : {
          kind: "classDeclaration",
          attributes: [],
          modifiers,
          name: escapeCSharpIdentifier(stmt.name),
          typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
          interfaces,
          members,
          constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
        };

  // Combine main + extracted types
  const allDecls = [mainDecl, ...extractedDecls];

  return [allDecls, { ...currentContext, ...savedScoped }];
};
