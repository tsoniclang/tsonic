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
      !constructorType.providerQualifiedName &&
      !constructorType.structuralMembers)
  ) {
    return resolvedReturnType;
  }

  const needsConstructorIdentity =
    !resolvedReturnType.typeId &&
    !resolvedReturnType.providerQualifiedName &&
    (!!constructorType.typeId || !!constructorType.providerQualifiedName);

  return {
    ...resolvedReturnType,
    ...(needsConstructorIdentity
      ? {
          name: constructorType.name,
          ...(constructorType.typeId ? { typeId: constructorType.typeId } : {}),
          ...(constructorType.providerQualifiedName
            ? { providerQualifiedName: constructorType.providerQualifiedName }
            : {}),
        }
      : {}),
    ...(constructorType.structuralMembers
      ? {
          structuralMembers: constructorType.structuralMembers,
          structuralOrigin:
            constructorType.structuralOrigin ?? "namedReference",
        }
      : {}),
  };
};
