import {
  defineExtensionFactKey,
} from "@tsonic/tsts";
import type {
  Node,
} from "@tsonic/tsts";
import {
  tsonicCoreSourceExtensionId,
} from "../identity.js";

export interface TsonicFixedArrayFact {
  readonly elementType: Node;
  readonly length: number;
}

export const tsonicFixedArrayFactKey = defineExtensionFactKey<TsonicFixedArrayFact>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "fixedArray",
  snapshot: (value) => Object.freeze({ ...value }),
  equals: (left, right) =>
    left.elementType === right.elementType && left.length === right.length,
});
