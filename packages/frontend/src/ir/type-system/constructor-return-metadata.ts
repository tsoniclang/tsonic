import type { IrType } from "../types/index.js";

export const attachConstructedReferenceMetadata = (
  resolvedReturnType: IrType | undefined,
  constructorType: IrType | undefined
): IrType | undefined => {
  if (!resolvedReturnType || resolvedReturnType.kind !== "referenceType") {
    return resolvedReturnType;
  }

  if (
    !constructorType ||
    constructorType.kind !== "referenceType" ||
    (!constructorType.typeId &&
      !constructorType.targetQualifiedName &&
      !constructorType.structuralMembers)
  ) {
    return resolvedReturnType;
  }

  const needsConstructorIdentity =
    !resolvedReturnType.typeId &&
    !resolvedReturnType.targetQualifiedName &&
    (!!constructorType.typeId || !!constructorType.targetQualifiedName);

  return {
    ...resolvedReturnType,
    ...(needsConstructorIdentity
      ? {
          name: constructorType.name,
          ...(constructorType.typeId ? { typeId: constructorType.typeId } : {}),
          ...(constructorType.targetQualifiedName
            ? { targetQualifiedName: constructorType.targetQualifiedName }
            : {}),
        }
      : {}),
    ...(constructorType.structuralMembers
      ? {
          structuralMembers: constructorType.structuralMembers,
          structuralOrigin: constructorType.structuralOrigin ?? "namedReference",
        }
      : {}),
  };
};
