/**
 * Shared helpers for object and dictionary literal emission.
 */

import { IrClassMember, IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  identifierExpression,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import {
  resolveTypeMemberIndexMap,
  resolveTypeMemberKind,
  typeMemberKindToBucket,
} from "../core/semantic/member-surfaces.js";
import {
  stripNullish,
  resolveTypeAlias,
} from "../core/semantic/type-resolution.js";

export const emitObjectMemberName = (
  receiverType: IrType | undefined,
  memberName: string,
  context: EmitterContext
): string => {
  const kind = resolveTypeMemberKind(receiverType, memberName, context);
  return emitCSharpName(memberName, typeMemberKindToBucket(kind), context);
};

export const getDeterministicObjectKeyName = (
  key: string | IrExpression
): string | undefined => {
  if (typeof key === "string") return key;
  if (key.kind === "literal" && typeof key.value === "string") {
    return key.value;
  }
  return undefined;
};

export const isObjectRootTypeAst = (typeAst: CSharpTypeAst): boolean => {
  if (typeAst.kind === "predefinedType") {
    return typeAst.keyword === "object";
  }
  if (typeAst.kind === "identifierType") {
    const normalized = typeAst.name.replace(/^global::/, "");
    return normalized === "object" || normalized === "System.Object";
  }
  return false;
};

export const isObjectRootType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "referenceType" && resolved.name === "object";
};

export const isDictionaryLikeSpreadType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "dictionaryType" || isObjectRootType(resolved, context)
  );
};

export const createStringLiteralExpression = (
  value: string
): CSharpExpressionAst => stringLiteral(value);

export const createDictionaryElementAccess = (
  targetIdentifier: string,
  key: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "elementAccessExpression",
  expression: identifierExpression(targetIdentifier),
  arguments: [key],
});

/**
 * Get property names from an object-like type.
 */
export const getObjectTypePropertyNames = (
  type: IrType,
  context: EmitterContext
): readonly string[] => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "objectType") {
    return resolved.members
      .filter(
        (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
          m.kind === "propertySignature"
      )
      .map((m) => m.name);
  }

  if (resolved.kind === "referenceType") {
    const localType = context.localTypes?.get(resolved.name);
    if (localType?.kind === "interface") {
      return localType.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map((m) => m.name);
    }

    if (localType?.kind === "class") {
      return localType.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertyDeclaration" }> =>
            m.kind === "propertyDeclaration" && !m.isStatic
        )
        .map((m) => m.name);
    }

    if (
      localType?.kind === "typeAlias" &&
      localType.type.kind === "objectType"
    ) {
      return localType.type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map((m) => m.name);
    }

    const perType = resolveTypeMemberIndexMap(resolved, context);
    if (perType) {
      const names: string[] = [];
      for (const [memberName, kind] of perType.entries()) {
        if (kind === "property" || kind === "field") {
          names.push(memberName);
        }
      }
      return names;
    }
  }

  return [];
};

export const hasMatchingBehaviorMember = (
  candidate: Extract<LocalTypeInfo, { kind: "class" }>,
  member: IrClassMember
): boolean => {
  if (member.kind === "propertyDeclaration") {
    return candidate.members.some(
      (candidateMember) =>
        candidateMember.kind === "propertyDeclaration" &&
        candidateMember.name === member.name &&
        !!candidateMember.getterBody === !!member.getterBody &&
        !!candidateMember.setterBody === !!member.setterBody
    );
  }

  if (member.kind === "methodDeclaration") {
    return candidate.members.some(
      (candidateMember) =>
        candidateMember.kind === "methodDeclaration" &&
        candidateMember.name === member.name
    );
  }

  return false;
};
