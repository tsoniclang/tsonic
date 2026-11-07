// Legacy-extension witnesses of raw-memory operations: selected operand nodes and exact integer/ABI values only.
// No checker Type (I1): the Host publishes the descriptors (`TsonicCoreSourceAnalyses.memory`, host-records.ts).
import { defineExtensionFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../identity.js";
import { exactRecord, opaqueSubject, recordsEqual } from "../../memory-layout/snapshots.js";

interface RawMemoryBase {
  readonly call: Node;
}

export type TsonicAddressIntegerDomain =
  | { readonly addressWidth: 32; readonly addressRuntimeBase: "number"; readonly addressSignedness: "unsigned" }
  | { readonly addressWidth: 64; readonly addressRuntimeBase: "bigint"; readonly addressSignedness: "unsigned" };

export type TsonicRawMemoryOperationFact = RawMemoryBase & (
  | {
      readonly operation: "to-raw";
      readonly pointerExpression: Node;
      readonly layoutExpression: Node;
    }
  | {
      readonly operation: "reinterpret";
      readonly rawExpression: Node;
      readonly explicitPointeeTypeNode?: Node;
      readonly layoutExpression: Node;
    }
  | {
      readonly operation: "byte-offset";
      readonly rawExpression: Node;
      readonly offsetExpression: Node;
      readonly offsetRuntimeBase: "number" | "bigint";
      readonly offsetSignedness: "signed" | "unsigned";
      readonly offsetWidth: 8 | 16 | 32 | 64 | 128;
      readonly dataLayoutExpression: Node;
    }
  | (TsonicAddressIntegerDomain & {
      readonly operation: "raw-to-address-integer";
      readonly rawExpression: Node;
      readonly dataLayoutExpression: Node;
    })
  | (TsonicAddressIntegerDomain & {
      readonly operation: "address-integer-to-raw";
      readonly addressExpression: Node;
      readonly dataLayoutExpression: Node;
    })
);

export interface TsonicKeepAliveFact extends RawMemoryBase {
  readonly valueExpression: Node;
}

const valueFields: ReadonlySet<string> = new Set([
  "operation", "offsetRuntimeBase", "offsetSignedness", "offsetWidth", "addressWidth", "addressRuntimeBase", "addressSignedness",
]);

function snapshotRawMemory<T extends TsonicRawMemoryOperationFact>(value: T): T {
  const discriminator = Object.getOwnPropertyDescriptor(value, "operation");
  if (discriminator === undefined || !("value" in discriminator)) {
    throw new Error("Raw-memory evidence requires a data operation discriminator.");
  }
  const base = ["operation", "call"];
  const fields: readonly string[] = (() => {
    switch (discriminator.value) {
      case "to-raw": return ["pointerExpression", "layoutExpression"];
      case "reinterpret": return ["rawExpression", "layoutExpression"];
      case "byte-offset": return ["rawExpression", "offsetExpression", "offsetRuntimeBase", "offsetSignedness", "offsetWidth", "dataLayoutExpression"];
      case "raw-to-address-integer": return ["rawExpression", "dataLayoutExpression", "addressWidth", "addressRuntimeBase", "addressSignedness"];
      case "address-integer-to-raw": return ["addressExpression", "dataLayoutExpression", "addressWidth", "addressRuntimeBase", "addressSignedness"];
      default: throw new Error("Unknown raw-memory operation.");
    }
  })();
  const result = exactRecord(value, [...base, ...fields] as (keyof T)[],
    discriminator.value === "reinterpret" ? ["explicitPointeeTypeNode"] as (keyof T)[] : []);
  for (const [key, subject] of Object.entries(result)) {
    if (!valueFields.has(key) && subject !== undefined) opaqueSubject(subject);
  }
  if (result.operation === "byte-offset" && (
    ![8, 16, 32, 64, 128].includes(result.offsetWidth) ||
    (result.offsetRuntimeBase !== "number" && result.offsetRuntimeBase !== "bigint") ||
    (result.offsetSignedness !== "signed" && result.offsetSignedness !== "unsigned")
  )) throw new Error("Raw byte offsets require exact integer evidence.");
  if ((result.operation === "raw-to-address-integer" || result.operation === "address-integer-to-raw") && (
    result.addressSignedness !== "unsigned" || !(
      (result.addressWidth === 32 && result.addressRuntimeBase === "number") ||
      (result.addressWidth === 64 && result.addressRuntimeBase === "bigint")
    )
  )) throw new Error("Address integers require an exact unsigned 32-bit number or 64-bit bigint domain.");
  return result;
}

export const tsonicRawMemoryOperationFactKey = defineExtensionFactKey<TsonicRawMemoryOperationFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "rawMemoryOperation",
  snapshot: snapshotRawMemory, equals: recordsEqual,
});

export const tsonicKeepAliveFactKey = defineExtensionFactKey<TsonicKeepAliveFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "keepAlive",
  snapshot(value) {
    const result = exactRecord(value, ["call", "valueExpression"]);
    for (const subject of Object.values(result)) opaqueSubject(subject);
    return result;
  },
  equals: recordsEqual,
});
