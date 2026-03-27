import { IrType } from "@tsonic/frontend";
import {
  resolveTypeAlias,
  stripNullish,
  resolveLocalTypeInfo,
} from "../core/semantic/type-resolution.js";
import type { EmitterContext } from "../types.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";

export const canPreferAnonymousStructuralTarget = (type: IrType): boolean => {
  const stripped = stripNullish(type);
  if (stripped.kind !== "referenceType") {
    return true;
  }

  const simpleName = stripped.name.split(".").pop() ?? stripped.name;
  const clrSimpleName = stripped.resolvedClrType?.split(".").pop();
  const isCompilerGeneratedCarrier = (name: string | undefined): boolean =>
    !!name && (name.startsWith("__Anon_") || name.startsWith("__Rest_"));

  return (
    isCompilerGeneratedCarrier(simpleName) ||
    isCompilerGeneratedCarrier(clrSimpleName)
  );
};

const getNominalReferenceIdentity = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): string => {
  const explicitIdentity =
    type.resolvedClrType ??
    type.typeId?.clrName ??
    (type.name.includes(".") ? type.name : undefined) ??
    (type.typeId?.tsName?.includes(".") ? type.typeId.tsName : undefined);
  if (explicitIdentity) {
    return explicitIdentity;
  }

  const resolvedLocal = resolveLocalTypeInfo(type, context);
  if (resolvedLocal) {
    const localName = type.name.split(".").pop() ?? type.name;
    const emittedLocalName =
      resolvedLocal.info.kind === "typeAlias" &&
      resolvedLocal.info.type.kind === "objectType"
        ? `${localName}__Alias`
        : localName;
    const canonicalTarget = context.options.canonicalLocalTypeTargets?.get(
      `${resolvedLocal.namespace}::${localName}`
    );
    return canonicalTarget ?? `${resolvedLocal.namespace}.${emittedLocalName}`;
  }

  return type.name;
};

export const isSameNominalType = (
  sourceType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!sourceType || !targetType) return false;

  const sourceBase = stripNullish(sourceType);
  const targetBase = stripNullish(targetType);

  if (
    sourceBase.kind === "referenceType" &&
    targetBase.kind === "referenceType"
  ) {
    if (
      getNominalReferenceIdentity(sourceBase, context) ===
      getNominalReferenceIdentity(targetBase, context)
    ) {
      return true;
    }
  }

  const sourceResolved = resolveTypeAlias(sourceBase, context);
  const targetResolved = resolveTypeAlias(targetBase, context);
  if (
    sourceResolved.kind !== "referenceType" ||
    targetResolved.kind !== "referenceType"
  ) {
    return false;
  }

  return (
    sourceResolved.name === targetResolved.name ||
    (sourceResolved.resolvedClrType !== undefined &&
      sourceResolved.resolvedClrType === targetResolved.resolvedClrType)
  );
};

export const getArrayElementType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType") return resolved.elementType;
  if (resolved.kind === "tupleType") {
    if (resolved.elementTypes.length === 1) return resolved.elementTypes[0];
    return undefined;
  }
  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray") &&
    resolved.typeArguments?.length === 1
  ) {
    return resolved.typeArguments[0];
  }
  return undefined;
};

export const isObjectLikeTypeAst = (
  type: CSharpTypeAst | undefined
): boolean => {
  if (!type) return false;
  const concrete = stripNullableTypeAst(type);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }
  const name = getIdentifierTypeName(concrete);
  return (
    name === "object" ||
    name === "System.Object" ||
    name === "global::System.Object"
  );
};

export const getDictionaryValueType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "dictionaryType") return undefined;
  return resolved.valueType;
};
