import {
  defineExtensionFactKey,
} from "@tsonic/tsts";
import type {
  Node,
  Type,
} from "@tsonic/tsts";
import {
  tsonicCoreSourceExtensionId,
} from "../identity.js";

interface TsonicNativePointerOperationBase {
  readonly pointerExpression: Node;
  readonly pointerType: Type;
  readonly pointeeType: Type;
  readonly explicitPointeeTypeNode?: Node;
  readonly resultType: Type;
}

export type TsonicNativePointerOperationFact =
  | TsonicNativePointerOperationBase & {
      readonly operation: "load";
    }
  | TsonicNativePointerOperationBase & {
      readonly operation: "store";
      readonly valueExpression: Node;
      readonly valueType: Type;
    }
  | TsonicNativePointerOperationBase & {
      readonly operation: "offset";
      readonly offsetExpression: Node;
      readonly offsetType: Type;
    };

export const tsonicNativePointerOperationFactKey =
  defineExtensionFactKey<TsonicNativePointerOperationFact>({
    extensionId: tsonicCoreSourceExtensionId,
    name: "nativePointerOperation",
    snapshot: (value) => Object.freeze({ ...value }),
    equals: nativePointerOperationFactsEqual,
  });

function nativePointerOperationFactsEqual(
  left: TsonicNativePointerOperationFact,
  right: TsonicNativePointerOperationFact,
): boolean {
  if (
    left.operation !== right.operation ||
    left.pointerExpression !== right.pointerExpression ||
    left.pointerType !== right.pointerType ||
    left.pointeeType !== right.pointeeType ||
    left.explicitPointeeTypeNode !== right.explicitPointeeTypeNode ||
    left.resultType !== right.resultType
  ) {
    return false;
  }
  if (left.operation === "store" && right.operation === "store") {
    return left.valueExpression === right.valueExpression &&
      left.valueType === right.valueType;
  }
  if (left.operation === "offset" && right.operation === "offset") {
    return left.offsetExpression === right.offsetExpression &&
      left.offsetType === right.offsetType;
  }
  return left.operation === "load" && right.operation === "load";
}
