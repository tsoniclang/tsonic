import type { IrType } from "@tsonic/frontend";

type ReferenceIrType = Extract<IrType, { kind: "referenceType" }>;
type PrimitiveIrType = Extract<IrType, { kind: "primitiveType" }>;

const PRIMITIVE_CLR_NAMES: Readonly<Record<string, string | undefined>> = {
  boolean: "System.Boolean",
  char: "System.Char",
  int: "System.Int32",
  number: "System.Double",
  string: "System.String",
};

const REFERENCE_CLR_ALIASES: ReadonlyMap<string, string> = new Map([
  ["object", "System.Object"],
  ["Object", "System.Object"],
  ["bool", "System.Boolean"],
  ["Boolean", "System.Boolean"],
  ["byte", "System.Byte"],
  ["Byte", "System.Byte"],
  ["sbyte", "System.SByte"],
  ["SByte", "System.SByte"],
  ["short", "System.Int16"],
  ["Int16", "System.Int16"],
  ["ushort", "System.UInt16"],
  ["UInt16", "System.UInt16"],
  ["int", "System.Int32"],
  ["Int32", "System.Int32"],
  ["uint", "System.UInt32"],
  ["UInt32", "System.UInt32"],
  ["long", "System.Int64"],
  ["Int64", "System.Int64"],
  ["ulong", "System.UInt64"],
  ["UInt64", "System.UInt64"],
  ["nint", "System.IntPtr"],
  ["IntPtr", "System.IntPtr"],
  ["nuint", "System.UIntPtr"],
  ["UIntPtr", "System.UIntPtr"],
  ["float", "System.Single"],
  ["Single", "System.Single"],
  ["double", "System.Double"],
  ["Double", "System.Double"],
  ["decimal", "System.Decimal"],
  ["Decimal", "System.Decimal"],
  ["char", "System.Char"],
  ["Char", "System.Char"],
]);

export const stripGlobalClrAlias = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

const parseClrIdentity = (
  rawName: string
): { readonly name: string; readonly arity: number | undefined } => {
  const normalizedName = stripGlobalClrAlias(rawName.trim());
  const surfaceGeneric = parseSurfaceGenericIdentity(normalizedName);
  const identityName = surfaceGeneric?.name ?? normalizedName;
  const genericMatch = /^(.*)`([0-9]+)$/.exec(identityName);
  if (!genericMatch) {
    return { name: identityName, arity: surfaceGeneric?.arity };
  }

  return {
    name: genericMatch[1] ?? identityName,
    arity: Number(genericMatch[2]),
  };
};

const parseSurfaceGenericIdentity = (
  rawName: string
): { readonly name: string; readonly arity: number } | undefined => {
  const openIndex = rawName.indexOf("<");
  if (openIndex < 0) {
    return undefined;
  }

  if (!rawName.endsWith(">")) {
    return undefined;
  }

  const argumentList = rawName.slice(openIndex + 1, -1);
  const argumentsCount = countTopLevelGenericArguments(argumentList);
  if (argumentsCount === undefined) {
    return undefined;
  }

  return {
    name: rawName.slice(0, openIndex),
    arity: argumentsCount,
  };
};

const countTopLevelGenericArguments = (
  argumentList: string
): number | undefined => {
  let depth = 0;
  let count = 1;
  let hasContent = false;

  for (const char of argumentList) {
    if (char === "<") {
      depth += 1;
      hasContent = true;
      continue;
    }

    if (char === ">") {
      depth -= 1;
      if (depth < 0) {
        return undefined;
      }
      continue;
    }

    if (char === "," && depth === 0) {
      count += 1;
      continue;
    }

    if (!/\s/.test(char)) {
      hasContent = true;
    }
  }

  return depth === 0 && hasContent ? count : undefined;
};

export const getClrIdentityKey = (
  rawName: string,
  typeArgumentArity = 0
): string => {
  const parsed = parseClrIdentity(rawName);
  const arity = parsed.arity ?? typeArgumentArity;
  return `${parsed.name}/${arity}`;
};

export const getReferenceClrIdentityKey = (
  type: ReferenceIrType
): string | undefined => {
  const rawName =
    type.typeId?.clrName ??
    type.resolvedClrType ??
    REFERENCE_CLR_ALIASES.get(type.name);
  if (!rawName) {
    return undefined;
  }

  return getClrIdentityKey(rawName, type.typeArguments?.length ?? 0);
};

export const getPrimitiveClrIdentityKey = (
  type: PrimitiveIrType
): string | undefined => {
  const rawName = PRIMITIVE_CLR_NAMES[type.name];
  return rawName ? getClrIdentityKey(rawName) : undefined;
};

export const getDirectClrIdentityKey = (
  type: IrType
): string | undefined => {
  if (type.kind === "primitiveType") {
    return getPrimitiveClrIdentityKey(type);
  }

  if (type.kind === "referenceType") {
    return getReferenceClrIdentityKey(type);
  }

  return undefined;
};

export const getReferenceDeterministicIdentityKey = (
  type: ReferenceIrType
): string | undefined => {
  if (type.typeId?.stableId) {
    return `id:${type.typeId.stableId}`;
  }

  const clrKey = getReferenceClrIdentityKey(type);
  return clrKey ? `clr:${clrKey}` : undefined;
};

export const referenceTypesShareClrIdentity = (
  left: ReferenceIrType,
  right: ReferenceIrType
): boolean => {
  const leftStableId = left.typeId?.stableId;
  const rightStableId = right.typeId?.stableId;
  if (leftStableId && rightStableId) {
    return leftStableId === rightStableId;
  }

  const leftKey = getReferenceClrIdentityKey(left);
  const rightKey = getReferenceClrIdentityKey(right);
  return leftKey !== undefined && leftKey === rightKey;
};

export const referenceTypesHaveDeterministicIdentityConflict = (
  left: ReferenceIrType,
  right: ReferenceIrType
): boolean => {
  const leftStableId = left.typeId?.stableId;
  const rightStableId = right.typeId?.stableId;
  if (leftStableId && rightStableId) {
    return leftStableId !== rightStableId;
  }

  const leftKey = getReferenceClrIdentityKey(left);
  const rightKey = getReferenceClrIdentityKey(right);
  return leftKey !== undefined && rightKey !== undefined && leftKey !== rightKey;
};

export const typesShareDirectClrIdentity = (
  left: IrType,
  right: IrType
): boolean => {
  const leftKey = getDirectClrIdentityKey(left);
  const rightKey = getDirectClrIdentityKey(right);
  return leftKey !== undefined && leftKey === rightKey;
};

export const typesHaveDeterministicIdentityConflict = (
  left: IrType,
  right: IrType
): boolean => {
  if (left.kind === "referenceType" && right.kind === "referenceType") {
    if (referenceTypesHaveDeterministicIdentityConflict(left, right)) {
      return true;
    }
  }

  const leftClrKey = getDirectClrIdentityKey(left);
  const rightClrKey = getDirectClrIdentityKey(right);
  if (leftClrKey !== undefined && rightClrKey !== undefined) {
    return leftClrKey !== rightClrKey;
  }

  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "referenceType": {
      const leftArgs = left.typeArguments ?? [];
      const rightArgs = (right as typeof left).typeArguments ?? [];
      return (
        leftArgs.length === rightArgs.length &&
        leftArgs.some((leftArg, index) => {
          const rightArg = rightArgs[index];
          return (
            rightArg !== undefined &&
            typesHaveDeterministicIdentityConflict(leftArg, rightArg)
          );
        })
      );
    }
    case "arrayType":
      return typesHaveDeterministicIdentityConflict(
        left.elementType,
        (right as typeof left).elementType
      );
    case "dictionaryType":
      return (
        typesHaveDeterministicIdentityConflict(
          left.keyType,
          (right as typeof left).keyType
        ) ||
        typesHaveDeterministicIdentityConflict(
          left.valueType,
          (right as typeof left).valueType
        )
      );
    case "tupleType": {
      const rightTuple = right as typeof left;
      return (
        left.elementTypes.length === rightTuple.elementTypes.length &&
        left.elementTypes.some((leftElement, index) => {
          const rightElement = rightTuple.elementTypes[index];
          return (
            rightElement !== undefined &&
            typesHaveDeterministicIdentityConflict(leftElement, rightElement)
          );
        })
      );
    }
    case "functionType": {
      const rightFunction = right as typeof left;
      if (left.parameters.length !== rightFunction.parameters.length) {
        return false;
      }

      return (
        left.parameters.some((leftParameter, index) => {
          const rightParameter = rightFunction.parameters[index];
          return (
            leftParameter.type !== undefined &&
            rightParameter?.type !== undefined &&
            typesHaveDeterministicIdentityConflict(
              leftParameter.type,
              rightParameter.type
            )
          );
        }) ||
        typesHaveDeterministicIdentityConflict(
          left.returnType,
          rightFunction.returnType
        )
      );
    }
    default:
      return false;
  }
};

export const referenceTypesHaveDeterministicIdentity = (
  left: ReferenceIrType,
  right: ReferenceIrType
): boolean =>
  getReferenceDeterministicIdentityKey(left) !== undefined ||
  getReferenceDeterministicIdentityKey(right) !== undefined;

export const referenceTypeHasClrIdentity = (
  type: ReferenceIrType,
  rawNames: Iterable<string>
): boolean => {
  const typeKey = getReferenceClrIdentityKey(type);
  if (!typeKey) {
    return false;
  }

  for (const rawName of rawNames) {
    if (typeKey === getClrIdentityKey(rawName, type.typeArguments?.length ?? 0)) {
      return true;
    }
  }

  return false;
};
