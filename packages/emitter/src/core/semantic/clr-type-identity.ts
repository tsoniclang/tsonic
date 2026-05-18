import type { IrType } from "@tsonic/frontend";
import { getClrIdentityKey } from "../format/backend-ast/clr-identity.js";

export { getClrIdentityKey } from "../format/backend-ast/clr-identity.js";

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
  ["uint8", "System.Byte"],
  ["byte", "System.Byte"],
  ["Byte", "System.Byte"],
  ["int8", "System.SByte"],
  ["sbyte", "System.SByte"],
  ["SByte", "System.SByte"],
  ["int16", "System.Int16"],
  ["short", "System.Int16"],
  ["Int16", "System.Int16"],
  ["uint16", "System.UInt16"],
  ["ushort", "System.UInt16"],
  ["UInt16", "System.UInt16"],
  ["int32", "System.Int32"],
  ["int", "System.Int32"],
  ["Int32", "System.Int32"],
  ["uint32", "System.UInt32"],
  ["uint", "System.UInt32"],
  ["UInt32", "System.UInt32"],
  ["int64", "System.Int64"],
  ["long", "System.Int64"],
  ["Int64", "System.Int64"],
  ["uint64", "System.UInt64"],
  ["ulong", "System.UInt64"],
  ["UInt64", "System.UInt64"],
  ["native-int", "System.IntPtr"],
  ["nint", "System.IntPtr"],
  ["IntPtr", "System.IntPtr"],
  ["native-uint", "System.UIntPtr"],
  ["nuint", "System.UIntPtr"],
  ["UIntPtr", "System.UIntPtr"],
  ["float32", "System.Single"],
  ["float", "System.Single"],
  ["Single", "System.Single"],
  ["float64", "System.Double"],
  ["double", "System.Double"],
  ["Double", "System.Double"],
  ["decimal", "System.Decimal"],
  ["Decimal", "System.Decimal"],
  ["float16", "System.Half"],
  ["half", "System.Half"],
  ["int128", "System.Int128"],
  ["uint128", "System.UInt128"],
  ["char", "System.Char"],
  ["Char", "System.Char"],
]);

const toGlobalClrName = (name: string): string =>
  name.startsWith("global::") ? name : `global::${name}`;

export const getReferenceClrTargetName = (
  type: ReferenceIrType
): string | undefined => {
  const rawName =
    type.typeId?.providerName ??
    type.providerQualifiedName ??
    REFERENCE_CLR_ALIASES.get(type.name);
  return rawName ? toGlobalClrName(rawName) : undefined;
};

export const getReferenceClrIdentityKey = (
  type: ReferenceIrType
): string | undefined => {
  const rawName =
    type.typeId?.providerName ??
    type.providerQualifiedName ??
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

export const getDirectClrIdentityKey = (type: IrType): string | undefined => {
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
  return (
    leftKey !== undefined && rightKey !== undefined && leftKey !== rightKey
  );
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
    if (
      typeKey === getClrIdentityKey(rawName, type.typeArguments?.length ?? 0)
    ) {
      return true;
    }
  }

  return false;
};
