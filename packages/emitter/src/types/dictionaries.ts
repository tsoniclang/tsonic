/**
 * Dictionary type emission
 */

import { IrDictionaryType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit dictionary type as global::System.Collections.Generic.Dictionary<TKey, TValue>
 *
 * IrDictionaryType represents:
 * - `{ [k: string]: T }` → Dictionary<string, T>
 * - `{ [k: number]: T }` → Dictionary<double, T>
 * - `Record<string, T>` → Dictionary<string, T>
 * - `Record<number, T>` → Dictionary<double, T>
 *
 * Allowed key types: string, number (enforced by TSN7413).
 */
export const emitDictionaryType = (
  type: IrDictionaryType,
  context: EmitterContext
): [string, EmitterContext] => {
  // Emit key type
  const [keyTypeStr, ctx1] = emitDictionaryKeyType(type.keyType, context);

  // Emit value type
  const [valueTypeStr, ctx2] = emitType(type.valueType, ctx1);

  return [
    `global::System.Collections.Generic.Dictionary<${keyTypeStr}, ${valueTypeStr}>`,
    ctx2,
  ];
};

/**
 * Emit dictionary key type.
 * Allowed: string, number (→ double).
 * Unsupported keys trigger ICE - validation should have caught them.
 */
const emitDictionaryKeyType = (
  keyType: IrDictionaryType["keyType"],
  context: EmitterContext
): [string, EmitterContext] => {
  if (keyType.kind === "primitiveType") {
    switch (keyType.name) {
      case "string":
        return ["string", context];
      case "number":
        return ["double", context];
    }
  }

  // ICE: Unsupported key type (should have been caught by TSN7413)
  throw new Error(
    `ICE: Unsupported dictionary key type reached emitter - validation missed TSN7413. Got: ${JSON.stringify(keyType)}`
  );
};
