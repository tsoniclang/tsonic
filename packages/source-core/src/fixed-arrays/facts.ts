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

export interface TsonicFixedArrayFact {
  readonly sourceType: Type;
  readonly elementSourceType: Type;
  readonly elementType?: Node;
  readonly length: bigint;
  readonly lengthRuntimeBase: "number" | "bigint";
}

export function snapshotFixedArrayFact(value: TsonicFixedArrayFact): TsonicFixedArrayFact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Fixed-array evidence requires a data record.");
  }
  const required = ["sourceType", "elementSourceType", "length", "lengthRuntimeBase"] as const;
  const allowed = new Set<PropertyKey>([...required, "elementType"]);
  const captured: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!allowed.has(key) || descriptor === undefined || !("value" in descriptor)) {
      throw new Error(`Fixed-array evidence contains an unexpected field or accessor: ${String(key)}.`);
    }
    captured[key as string] = descriptor.value;
  }
  for (const key of required) {
    if (captured[key] === undefined) {
      throw new Error(`Fixed-array evidence is missing ${key}.`);
    }
  }
  for (const key of ["sourceType", "elementSourceType", "elementType"] as const) {
    const subject = captured[key];
    if (key === "elementType" && subject === undefined) continue;
    if (subject === null || typeof subject !== "object" || Array.isArray(subject)) {
      throw new Error(`Fixed-array evidence requires an exact compiler subject for ${key}.`);
    }
  }
  if (typeof captured.length !== "bigint" || captured.length < 0n ||
      (captured.lengthRuntimeBase !== "number" && captured.lengthRuntimeBase !== "bigint") ||
      (captured.lengthRuntimeBase === "number" && captured.length > BigInt(Number.MAX_SAFE_INTEGER))) {
    throw new Error("Fixed-array evidence requires an exact non-negative length with its source runtime base.");
  }
  return Object.freeze({
    sourceType: captured.sourceType as Type,
    elementSourceType: captured.elementSourceType as Type,
    ...(captured.elementType === undefined ? {} : { elementType: captured.elementType as Node }),
    length: captured.length,
    lengthRuntimeBase: captured.lengthRuntimeBase,
  });
}

export function fixedArrayFactsEqual(left: TsonicFixedArrayFact, right: TsonicFixedArrayFact): boolean {
  return left.sourceType === right.sourceType && left.elementSourceType === right.elementSourceType &&
    left.elementType === right.elementType && left.length === right.length &&
    left.lengthRuntimeBase === right.lengthRuntimeBase;
}

export const tsonicFixedArrayFactKey = defineExtensionFactKey<TsonicFixedArrayFact>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "fixedArray",
  snapshot: snapshotFixedArrayFact,
  equals: fixedArrayFactsEqual,
});
