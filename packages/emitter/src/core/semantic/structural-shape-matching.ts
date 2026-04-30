/**
 * Structural shape matching and structural-to-nominal type resolution.
 *
 * Extracted from structural-resolution.ts — contains structural shape
 * comparison logic and the normalizeStructuralEmissionType deep walker.
 */

import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveTypeAlias, stripNullish } from "./nullish-value-helpers.js";
import { getReferenceNominalIdentityKey } from "./reference-type-identity.js";
import { rebuildUnionTypePreservingCarrierFamily } from "./runtime-union-family-preservation.js";

const isCompilerGeneratedStructuralName = (name: string | undefined): boolean =>
  !!name && (name.startsWith("__Anon_") || name.startsWith("__Rest_"));

export const isCompilerGeneratedStructuralReferenceType = (
  type: Extract<IrType, { kind: "referenceType" }>
): boolean => {
  const simpleName = type.name.split(".").pop() ?? type.name;
  const clrSimpleName = type.resolvedClrType?.split(".").pop();
  return (
    isCompilerGeneratedStructuralName(simpleName) ||
    isCompilerGeneratedStructuralName(clrSimpleName)
  );
};

const buildReferenceType = (
  name: string,
  resolvedClrType: string | undefined,
  typeArguments: readonly IrType[] | undefined
): Extract<IrType, { kind: "referenceType" }> => ({
  kind: "referenceType",
  name,
  ...(resolvedClrType ? { resolvedClrType } : {}),
  ...(typeArguments ? { typeArguments: [...typeArguments] } : {}),
});

type IteratorResultVariant = {
  readonly done: boolean;
  readonly valueType: IrType;
};

type IteratorResultResolutionState = {
  readonly activeReferenceKeys: Set<string>;
};

const getIteratorResultReferenceKey = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): string =>
  getReferenceNominalIdentityKey(type, context) ??
  type.typeId?.stableId ??
  type.resolvedClrType ??
  type.name;

const tryResolveIteratorResultVariant = (
  type: IrType,
  context: EmitterContext
): IteratorResultVariant | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  const members =
    resolved.kind === "objectType"
      ? resolved.members
      : resolved.kind === "referenceType"
        ? resolved.structuralMembers
        : undefined;
  if (!members || members.length !== 2) {
    return undefined;
  }

  const properties = members.filter(
    (member): member is Extract<typeof member, { kind: "propertySignature" }> =>
      member.kind === "propertySignature"
  );
  if (properties.length !== 2) {
    return undefined;
  }

  const doneProperty = properties.find((member) => member.name === "done");
  const valueProperty = properties.find((member) => member.name === "value");
  if (
    !doneProperty ||
    !valueProperty ||
    doneProperty.isOptional ||
    valueProperty.isOptional
  ) {
    return undefined;
  }

  if (
    doneProperty.type.kind !== "literalType" ||
    typeof doneProperty.type.value !== "boolean"
  ) {
    return undefined;
  }

  return {
    done: doneProperty.type.value,
    valueType: valueProperty.type,
  };
};

export const resolveIteratorResultReferenceType = (
  type: IrType,
  context: EmitterContext,
  state: IteratorResultResolutionState = { activeReferenceKeys: new Set() }
): Extract<IrType, { kind: "referenceType" }> | undefined => {
  const stripped = stripNullish(type);
  if (stripped.kind === "referenceType") {
    const key = getIteratorResultReferenceKey(stripped, context);
    if (state.activeReferenceKeys.has(key)) {
      return undefined;
    }

    state.activeReferenceKeys.add(key);
    try {
      const resolved = resolveTypeAlias(stripped, context);
      if (resolved === stripped || resolved.kind !== "unionType") {
        return undefined;
      }
      return resolveIteratorResultReferenceType(resolved, context, state);
    } finally {
      state.activeReferenceKeys.delete(key);
    }
  }

  if (stripped.kind !== "unionType") {
    return undefined;
  }

  if (stripped.types.length !== 2) {
    return undefined;
  }

  const variants = stripped.types
    .map((member) => tryResolveIteratorResultVariant(member, context))
    .filter(
      (variant): variant is IteratorResultVariant => variant !== undefined
    );
  if (variants.length !== 2) {
    return undefined;
  }

  const doneFalseVariant = variants.find((variant) => variant.done === false);
  const doneTrueVariant = variants.find((variant) => variant.done === true);
  if (!doneFalseVariant || !doneTrueVariant) {
    return undefined;
  }

  return buildReferenceType(
    "IteratorResult",
    "global::Tsonic.Runtime.IteratorResult",
    [doneFalseVariant.valueType]
  );
};

/**
 * Resolve structural emission-only helpers that already have an explicit reference
 * representation. Inline structural object types intentionally stay compiler-owned
 * and must not be rebound to authored aliases or classes here.
 */
export const resolveStructuralReferenceType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const stripped = stripNullish(type);
  const iteratorResultReference = resolveIteratorResultReferenceType(
    stripped,
    context
  );
  if (iteratorResultReference) {
    return iteratorResultReference;
  }
  if (stripped.kind === "referenceType") {
    return stripped;
  }
  return undefined;
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
          if (!types.some((member, index) => member !== current.types[index])) {
            return current;
          }

          return current.kind === "unionType"
            ? rebuildUnionTypePreservingCarrierFamily(current, types)
            : {
                ...current,
                types,
              };
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
