/**
 * Dictionary type emission
 */

import { IrDictionaryType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

/**
 * Emit dictionary type as CSharpTypeAst (identifierType node)
 *
 * IrDictionaryType represents:
 * - `{ [k: string]: T }` → Dictionary<string, T>
 * - `{ [k: number]: T }` → Dictionary<double, T>
 * - `{ [k: symbol]: T }` → Dictionary<object, T>
 * - `Record<string, T>` → Dictionary<string, T>
 * - `Record<number, T>` → Dictionary<double, T>
 * - `Record<symbol, T>` → Dictionary<object, T>
 *
 * Allowed key types: string, number, symbol/object key domain (enforced by TSN7413).
 */
export const emitDictionaryType = (
  type: IrDictionaryType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  // Emit key type
  const [keyTypeAst, ctx1] = emitDictionaryKeyType(type.keyType, context);

  // Emit value type
  const [valueTypeAst, ctx2] = emitTypeAst(type.valueType, ctx1);

  return [
    {
      kind: "identifierType",
      name: "global::System.Collections.Generic.Dictionary",
      typeArguments: [keyTypeAst, valueTypeAst],
    },
    ctx2,
  ];
};

/**
 * Emit dictionary key type as CSharpTypeAst.
 * Allowed: string, number (→ double), symbol/object (→ object).
 * Unsupported keys trigger ICE - validation should have caught them.
 */
const emitDictionaryKeyType = (
  keyType: IrDictionaryType["keyType"],
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  if (keyType.kind === "primitiveType") {
    switch (keyType.name) {
      case "string":
        return [{ kind: "predefinedType", keyword: "string" }, context];
      case "number":
        return [{ kind: "predefinedType", keyword: "double" }, context];
    }
  }

  if (
    keyType.kind === "referenceType" &&
    (keyType.name === "object" ||
      keyType.name === "Symbol" ||
      keyType.name === "symbol")
  ) {
    return [{ kind: "predefinedType", keyword: "object" }, context];
  }

  // ICE: Unsupported key type (should have been caught by TSN7413)
  throw new Error(
    `ICE: Unsupported dictionary key type reached emitter - validation missed TSN7413. Got: ${JSON.stringify(keyType)}`
  );
};
