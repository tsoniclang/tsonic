/**
 * Structural shape matching and structural-to-nominal type resolution.
 *
 * Extracted from structural-resolution.ts — contains structural shape
 * comparison logic and the normalizeStructuralEmissionType deep walker.
 */

import type {
  IrType,
  IrPropertyDeclaration,
} from "@tsonic/frontend";
import { stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { LocalTypeInfo } from "../../emitter-types/core.js";
import { resolveTypeAlias, stripNullish } from "./nullish-value-helpers.js";
import {
  resolveLocalTypeInfoWithoutBindings,
  resolveBindingBackedReferenceType,
} from "./property-member-lookup.js";

type StructuralShapeMember = {
  readonly name: string;
  readonly isOptional: boolean;
  readonly typeKey: string;
};

const sortStructuralShape = (
  members: readonly StructuralShapeMember[]
): readonly StructuralShapeMember[] =>
  [...members].sort((left, right) => left.name.localeCompare(right.name));

const structuralShapesEqual = (
  left: readonly StructuralShapeMember[],
  right: readonly StructuralShapeMember[]
): boolean =>
  left.length === right.length &&
  left.every(
    (member, index) =>
      member.name === right[index]?.name &&
      member.isOptional === right[index]?.isOptional &&
      member.typeKey === right[index]?.typeKey
  );

const getObjectTypeStructuralShape = (
  type: Extract<IrType, { kind: "objectType" }>
): readonly StructuralShapeMember[] | undefined => {
  if (type.members.some((member) => member.kind === "methodSignature")) {
    return undefined;
  }

  return sortStructuralShape(
    type.members
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        isOptional: member.isOptional,
        typeKey: stableIrTypeKey(member.type),
      }))
  );
};

const getLocalTypeInfoStructuralShape = (
  info: LocalTypeInfo,
  context: EmitterContext
): readonly StructuralShapeMember[] | undefined => {
  switch (info.kind) {
    case "typeAlias": {
      const resolved = resolveTypeAlias(info.type, context);
      if (resolved.kind !== "objectType") {
        return undefined;
      }
      return getObjectTypeStructuralShape(resolved);
    }

    case "interface": {
      if (info.members.some((member) => member.kind === "methodSignature")) {
        return undefined;
      }
      return sortStructuralShape(
        info.members
          .filter(
            (
              member
            ): member is Extract<
              typeof member,
              { kind: "propertySignature" }
            > => member.kind === "propertySignature"
          )
          .map((member) => ({
            name: member.name,
            isOptional: member.isOptional,
            typeKey: stableIrTypeKey(member.type),
          }))
      );
    }

    case "class": {
      if (info.members.some((member) => member.kind === "methodDeclaration")) {
        return undefined;
      }

      const propertyMembers = info.members.filter(
        (member): member is IrPropertyDeclaration & { type: IrType } =>
          member.kind === "propertyDeclaration" && member.type !== undefined
      );

      return sortStructuralShape(
        propertyMembers.map((member) => ({
          name: member.name,
          isOptional: false,
          typeKey: stableIrTypeKey(member.type),
        }))
      );
    }

    case "enum":
      return undefined;
  }
};

type StructuralReferenceCandidate = {
  readonly dedupeKey: string;
  readonly isCurrentLocal: boolean;
  readonly isCurrentNamespace: boolean;
  readonly ref: Extract<IrType, { kind: "referenceType" }>;
};

const isStructurallyEmittedLocalTypeInfo = (
  info: LocalTypeInfo | undefined
): boolean => {
  if (!info) {
    return false;
  }

  switch (info.kind) {
    case "typeAlias":
      return info.type.kind === "objectType";
    case "interface":
      return true;
    case "class":
      return info.members.every(
        (member) => member.kind !== "methodDeclaration"
      );
    case "enum":
      return false;
  }
};

/**
 * Resolve an inline/object structural type to a canonical emitted nominal reference
 * when the current compilation already declares an equivalent structural type.
 *
 * This is used in emitter-side contextual type paths that must emit a CLR type name
 * (for example JSArray<T> wrapper element types or nominal object construction),
 * but sometimes receive an objectType after alias resolution. When we can prove that
 * object shape matches an existing structural alias/interface/class, we preserve the
 * canonical emitted reference instead of letting raw objectType reach type emission.
 */
export const resolveStructuralReferenceType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const stripped = stripNullish(type);

  if (stripped.kind === "referenceType") {
    const directLocalType = resolveLocalTypeInfoWithoutBindings(
      stripped,
      context
    )?.info;
    if (isStructurallyEmittedLocalTypeInfo(directLocalType)) {
      return stripped;
    }

    const rebound = resolveBindingBackedReferenceType(stripped, context);
    const reboundLocalType = rebound
      ? resolveLocalTypeInfoWithoutBindings(rebound, context)?.info
      : undefined;
    if (rebound && isStructurallyEmittedLocalTypeInfo(reboundLocalType)) {
      return rebound;
    }
  }

  const resolved = resolveTypeAlias(stripped, context);
  if (resolved.kind !== "objectType") {
    return undefined;
  }

  const targetShape = getObjectTypeStructuralShape(resolved);
  if (!targetShape || targetShape.length === 0) {
    return undefined;
  }

  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const candidates: StructuralReferenceCandidate[] = [];
  const seenKeys = new Set<string>();

  const pushCandidate = (
    typeName: string,
    namespace: string,
    info: LocalTypeInfo,
    isCurrentLocal: boolean
  ): void => {
    const shape = getLocalTypeInfoStructuralShape(info, context);
    if (!shape || !structuralShapesEqual(shape, targetShape)) {
      return;
    }

    const emittedName =
      info.kind === "typeAlias" ? `${typeName}__Alias` : typeName;
    const resolvedClrType =
      isCurrentLocal && namespace === currentNamespace
        ? undefined
        : `${namespace}.${emittedName}`;
    const dedupeKey = resolvedClrType ?? `${namespace}.${emittedName}`;
    if (seenKeys.has(dedupeKey)) {
      return;
    }
    seenKeys.add(dedupeKey);

    candidates.push({
      dedupeKey,
      isCurrentLocal,
      isCurrentNamespace: namespace === currentNamespace,
      ref: resolvedClrType
        ? {
            kind: "referenceType",
            name: typeName,
            resolvedClrType,
          }
        : {
            kind: "referenceType",
            name: typeName,
          },
    });
  };

  if (context.localTypes) {
    for (const [typeName, info] of context.localTypes.entries()) {
      pushCandidate(typeName, currentNamespace, info, true);
    }
  }

  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (!module.localTypes) continue;
      for (const [typeName, info] of module.localTypes.entries()) {
        pushCandidate(typeName, module.namespace, info, false);
      }
    }
  }

  const currentLocalMatches = candidates.filter(
    (candidate) => candidate.isCurrentLocal
  );
  if (currentLocalMatches.length === 1) {
    return currentLocalMatches[0]?.ref;
  }
  if (currentLocalMatches.length > 1) {
    return undefined;
  }

  const currentNamespaceMatches = candidates.filter(
    (candidate) => candidate.isCurrentNamespace
  );
  if (currentNamespaceMatches.length === 1) {
    return currentNamespaceMatches[0]?.ref;
  }
  if (currentNamespaceMatches.length > 1) {
    return undefined;
  }

  return candidates.length === 1 ? candidates[0]?.ref : undefined;
};

export const normalizeStructuralEmissionType = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const cache = new Map<IrType, IrType>();
  const active = new Set<IrType>();

  const normalize = (current: IrType): IrType => {
    const rebound = resolveStructuralReferenceType(current, context);
    if (rebound) {
      return rebound;
    }

    if (active.has(current)) {
      return current;
    }

    const cached = cache.get(current);
    if (cached) {
      return cached;
    }

    active.add(current);

    const normalized = (() => {
      switch (current.kind) {
        case "referenceType": {
          const typeArguments = current.typeArguments?.map(normalize);
          const hasChanged =
            !!typeArguments &&
            typeArguments.some(
              (argument, index) => argument !== current.typeArguments?.[index]
            );
          return hasChanged
            ? {
                ...current,
                typeArguments,
              }
            : current;
        }
        case "arrayType": {
          const elementType = normalize(current.elementType);
          const tuplePrefixElementTypes =
            current.tuplePrefixElementTypes?.map(normalize);
          const tupleRestElementType = current.tupleRestElementType
            ? normalize(current.tupleRestElementType)
            : undefined;
          const hasChanged =
            elementType !== current.elementType ||
            (!!tuplePrefixElementTypes &&
              tuplePrefixElementTypes.some(
                (element, index) =>
                  element !== current.tuplePrefixElementTypes?.[index]
              )) ||
            tupleRestElementType !== current.tupleRestElementType;
          return hasChanged
            ? {
                ...current,
                elementType,
                ...(tuplePrefixElementTypes ? { tuplePrefixElementTypes } : {}),
                ...(tupleRestElementType ? { tupleRestElementType } : {}),
              }
            : current;
        }
        case "tupleType": {
          const elementTypes = current.elementTypes.map(normalize);
          return elementTypes.some(
            (element, index) => element !== current.elementTypes[index]
          )
            ? { ...current, elementTypes }
            : current;
        }
        case "functionType": {
          const parameters = current.parameters.map((parameter) =>
            parameter.type
              ? {
                  ...parameter,
                  type: normalize(parameter.type),
                }
              : parameter
          );
          const returnType = normalize(current.returnType);
          const hasChanged =
            returnType !== current.returnType ||
            parameters.some(
              (parameter, index) => parameter !== current.parameters[index]
            );
          return hasChanged
            ? {
                ...current,
                parameters,
                returnType,
              }
            : current;
        }
        case "objectType": {
          const members = current.members.map((member) => {
            switch (member.kind) {
              case "propertySignature": {
                const memberType = normalize(member.type);
                return memberType !== member.type
                  ? {
                      ...member,
                      type: memberType,
                    }
                  : member;
              }
              case "methodSignature": {
                const parameters = member.parameters.map((parameter) =>
                  parameter.type
                    ? {
                        ...parameter,
                        type: normalize(parameter.type),
                      }
                    : parameter
                );
                const returnType = member.returnType
                  ? normalize(member.returnType)
                  : undefined;
                const typeParameters = member.typeParameters?.map(
                  (typeParameter) =>
                    typeParameter.constraint || typeParameter.default
                      ? {
                          ...typeParameter,
                          ...(typeParameter.constraint
                            ? {
                                constraint: normalize(typeParameter.constraint),
                              }
                            : {}),
                          ...(typeParameter.default
                            ? {
                                default: normalize(typeParameter.default),
                              }
                            : {}),
                        }
                      : typeParameter
                );
                const hasChanged =
                  parameters.some(
                    (parameter, index) => parameter !== member.parameters[index]
                  ) ||
                  returnType !== member.returnType ||
                  (!!typeParameters &&
                    typeParameters.some(
                      (typeParameter, index) =>
                        typeParameter !== member.typeParameters?.[index]
                    ));
                return hasChanged
                  ? {
                      ...member,
                      parameters,
                      ...(returnType ? { returnType } : {}),
                      ...(typeParameters ? { typeParameters } : {}),
                    }
                  : member;
              }
            }
          });
          return members.some(
            (member, index) => member !== current.members[index]
          )
            ? { ...current, members }
            : current;
        }
        case "dictionaryType": {
          const keyType = normalize(current.keyType);
          const valueType = normalize(current.valueType);
          return keyType !== current.keyType || valueType !== current.valueType
            ? {
                ...current,
                keyType,
                valueType,
              }
            : current;
        }
        case "unionType":
        case "intersectionType": {
          const types = current.types.map(normalize);
          return types.some((member, index) => member !== current.types[index])
            ? {
                ...current,
                types,
              }
            : current;
        }
        case "primitiveType":
        case "typeParameterType":
        case "literalType":
        case "anyType":
        case "unknownType":
        case "voidType":
        case "neverType":
          return current;
      }
    })();

    cache.set(current, normalized);
    active.delete(current);
    return normalized;
  };

  return normalize(type);
};
