/**
 * Dictionary type emission
 */

import { IrDictionaryType } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit dictionary type as C# Dictionary<TKey, TValue>
 *
 * IrDictionaryType represents:
 * - `{ [k: string]: T }` → Dictionary<string, T>
 * - `Record<string, T>` → Dictionary<string, T>
 *
 * Note: Only string keys are supported (TSN7413). Number keys are rejected
 * at validation time because TS number keys have string-ish semantics.
 */
export const emitDictionaryType = (
  type: IrDictionaryType,
  context: EmitterContext
): [string, EmitterContext] => {
  // Emit key type
  const [keyTypeStr, ctx1] = emitDictionaryKeyType(type.keyType, context);

  // Emit value type
  const [valueTypeStr, ctx2] = emitType(type.valueType, ctx1);

  // Add using for System.Collections.Generic
  const ctx3 = addUsing(ctx2, "System.Collections.Generic");

  return [`Dictionary<${keyTypeStr}, ${valueTypeStr}>`, ctx3];
};

/**
 * Emit dictionary key type.
 * Only string keys are supported (enforced by TSN7413).
 * Non-string keys trigger ICE - validation should have caught them.
 */
const emitDictionaryKeyType = (
  keyType: IrDictionaryType["keyType"],
  context: EmitterContext
): [string, EmitterContext] => {
  if (keyType.kind === "primitiveType" && keyType.name === "string") {
    return ["string", context];
  }

  // ICE: Only string keys allowed (enforced by TSN7413)
  throw new Error(
    `ICE: Non-string dictionary key type reached emitter - validation missed TSN7413. Got: ${keyType.kind}`
  );
};
