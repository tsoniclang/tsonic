// Legacy-extension witness of a native pointer operation (loadnativeptr / storenativeptr / offsetnativeptr): the
// selected operand nodes only. Types are published by the Host (`TsonicNativePointerRecord`, I1); no checker Type here.
import { defineExtensionFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../identity.js";

interface TsonicNativePointerOperationBase {
  readonly pointerExpression: Node;
  readonly explicitPointeeTypeNode?: Node;
}

export type TsonicNativePointerOperationFact =
  | TsonicNativePointerOperationBase & { readonly operation: "load" }
  | TsonicNativePointerOperationBase & { readonly operation: "store"; readonly valueExpression: Node }
  | TsonicNativePointerOperationBase & { readonly operation: "offset"; readonly offsetExpression: Node };

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
  if (left.operation !== right.operation || left.pointerExpression !== right.pointerExpression ||
    left.explicitPointeeTypeNode !== right.explicitPointeeTypeNode) return false;
  if (left.operation === "store" && right.operation === "store") return left.valueExpression === right.valueExpression;
  if (left.operation === "offset" && right.operation === "offset") return left.offsetExpression === right.offsetExpression;
  return left.operation === "load" && right.operation === "load";
}
