/**
 * Synthetic Type Generation for Union-of-Object-Literals
 *
 * When a type alias contains a union of object literal types, we generate
 * synthetic nominal interfaces for each object member. This enables:
 * - TSN7403 compliance (object literals have contextual nominal types)
 * - Proper C# emission (nominal types instead of anonymous objects)
 *
 * Example:
 *   type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
 *
 * Generates:
 *   interface Result__0<T, E> { ok: true; value: T }
 *   interface Result__1<T, E> { ok: false; error: E }
 *   type Result<T, E> = Result__0<T, E> | Result__1<T, E>
 */

import {
  IrType,
  IrUnionType,
  IrObjectType,
  IrInterfaceDeclaration,
  IrTypeAliasDeclaration,
  IrTypeParameter,
  IrReferenceType,
} from "../types.js";

/**
 * Result of processing a type alias for synthetic type generation
 */
export type SyntheticTypeResult = {
  /** The (possibly rewritten) type alias declaration */
  readonly typeAlias: IrTypeAliasDeclaration;
  /** Generated synthetic interface declarations (empty if no rewriting needed) */
  readonly syntheticInterfaces: readonly IrInterfaceDeclaration[];
};

/**
 * Check if a type is an object type (inline object literal)
 */
const isObjectType = (type: IrType): type is IrObjectType =>
  type.kind === "objectType";

/**
 * Check if a union type contains any object literal types
 */
const unionContainsObjectTypes = (union: IrUnionType): boolean =>
  union.types.some(isObjectType);

/**
 * Generate a synthetic interface name for a union member
 *
 * Format: {AliasName}__{index}
 * Example: Result__0, Result__1
 */
const generateSyntheticName = (aliasName: string, index: number): string =>
  `${aliasName}__${index}`;

/**
 * Create type arguments from type parameters (for referencing synthetics)
 *
 * Example: [T, E] type params -> [{ kind: "typeParameterType", name: "T" }, ...]
 */
const typeParamsToTypeArgs = (
  typeParams: readonly IrTypeParameter[] | undefined
): readonly IrType[] | undefined => {
  if (!typeParams || typeParams.length === 0) {
    return undefined;
  }

  return typeParams.map(
    (tp): IrType => ({
      kind: "typeParameterType",
      name: tp.name,
    })
  );
};

const collectUsedTypeParameterNames = (
  type: IrType,
  out: Set<string>
): void => {
  switch (type.kind) {
    case "typeParameterType":
      out.add(type.name);
      return;
    case "arrayType":
      collectUsedTypeParameterNames(type.elementType, out);
      return;
    case "tupleType":
      for (const elementType of type.elementTypes) {
        collectUsedTypeParameterNames(elementType, out);
      }
      return;
    case "unionType":
    case "intersectionType":
      for (const member of type.types) {
        collectUsedTypeParameterNames(member, out);
      }
      return;
    case "referenceType":
      for (const typeArgument of type.typeArguments ?? []) {
        collectUsedTypeParameterNames(typeArgument, out);
      }
      return;
    case "functionType":
      for (const parameter of type.parameters) {
        if (parameter.type) {
          collectUsedTypeParameterNames(parameter.type, out);
        }
      }
      collectUsedTypeParameterNames(type.returnType, out);
      return;
    case "objectType":
      for (const member of type.members) {
        if (member.kind === "propertySignature") {
          collectUsedTypeParameterNames(member.type, out);
          continue;
        }
        for (const parameter of member.parameters) {
          if (parameter.type) {
            collectUsedTypeParameterNames(parameter.type, out);
          }
        }
        if (member.returnType) {
          collectUsedTypeParameterNames(member.returnType, out);
        }
      }
      return;
    case "dictionaryType":
      collectUsedTypeParameterNames(type.keyType, out);
      collectUsedTypeParameterNames(type.valueType, out);
      return;
    default:
      return;
  }
};

const filterTypeParametersForObjectType = (
  objectType: IrObjectType,
  typeParameters: readonly IrTypeParameter[] | undefined
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  const used = new Set<string>();
  for (const member of objectType.members) {
    if (member.kind === "propertySignature") {
      collectUsedTypeParameterNames(member.type, used);
      continue;
    }
    for (const parameter of member.parameters) {
      if (parameter.type) {
        collectUsedTypeParameterNames(parameter.type, used);
      }
    }
    if (member.returnType) {
      collectUsedTypeParameterNames(member.returnType, used);
    }
  }

  const filtered = typeParameters.filter((parameter) =>
    used.has(parameter.name)
  );
  return filtered.length > 0 ? filtered : undefined;
};

/**
 * Create a synthetic interface declaration from an object type
 */
const createSyntheticInterface = (
  objectType: IrObjectType,
  name: string,
  typeParameters: readonly IrTypeParameter[] | undefined,
  isExported: boolean
): IrInterfaceDeclaration => ({
  kind: "interfaceDeclaration",
  name,
  typeParameters,
  extends: [],
  members: objectType.members,
  isExported,
  isStruct: false,
});

/**
 * Create a reference type to a synthetic interface
 */
const createSyntheticReference = (
  name: string,
  typeArgs: readonly IrType[] | undefined
): IrReferenceType => ({
  kind: "referenceType",
  name,
  typeArguments: typeArgs,
});

/**
 * Process a type alias declaration and generate synthetic interfaces if needed.
 *
 * If the type alias is a union containing object literal types, this will:
 * 1. Generate a synthetic interface for each object literal member
 * 2. Rewrite the union to use reference types to the synthetics
 * 3. Return both the rewritten alias and the synthetic interfaces
 *
 * If no object literals are found, returns the original alias unchanged.
 */
export const processTypeAliasForSynthetics = (
  typeAlias: IrTypeAliasDeclaration
): SyntheticTypeResult => {
  const { type, name, typeParameters, isExported } = typeAlias;

  // Only process union types
  if (type.kind !== "unionType") {
    return { typeAlias, syntheticInterfaces: [] };
  }

  const union = type as IrUnionType;

  // Check if union contains any object types
  if (!unionContainsObjectTypes(union)) {
    return { typeAlias, syntheticInterfaces: [] };
  }

  // Generate synthetic interfaces and rewrite union members
  const syntheticInterfaces: IrInterfaceDeclaration[] = [];
  const rewrittenUnionTypes: IrType[] = [];
  let objectIndex = 0;
  for (const memberType of union.types) {
    if (isObjectType(memberType)) {
      const memberTypeParameters = filterTypeParametersForObjectType(
        memberType,
        typeParameters
      );
      const memberTypeArgs = typeParamsToTypeArgs(memberTypeParameters);

      // Generate synthetic interface for this object type
      const syntheticName = generateSyntheticName(name, objectIndex);
      const syntheticInterface = createSyntheticInterface(
        memberType,
        syntheticName,
        memberTypeParameters,
        isExported // Synthetic interfaces inherit export status
      );
      syntheticInterfaces.push(syntheticInterface);

      // Replace object type with reference to synthetic
      const reference = createSyntheticReference(syntheticName, memberTypeArgs);
      rewrittenUnionTypes.push(reference);

      objectIndex++;
    } else {
      // Keep non-object types as-is
      rewrittenUnionTypes.push(memberType);
    }
  }

  // Create rewritten type alias with new union
  const rewrittenUnion: IrUnionType = {
    kind: "unionType",
    types: rewrittenUnionTypes,
  };

  const rewrittenAlias: IrTypeAliasDeclaration = {
    ...typeAlias,
    type: rewrittenUnion,
  };

  return {
    typeAlias: rewrittenAlias,
    syntheticInterfaces,
  };
};
