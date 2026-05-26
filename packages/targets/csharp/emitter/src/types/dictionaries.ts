/**
 * Dictionary type emission
 */

import { IrDictionaryType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import { identifierType } from "../core/format/backend-ast/builders.js";

/**
 * Emit dictionary type as CSharpTypeAst (identifierType node)
 *
 * IrDictionaryType represents dictionary/map intent:
 * - `{ [k: string]: T }` → Dictionary<string, T>
 * - `{ [k: number]: T }` → Dictionary<double, T>
 * - `{ [k: symbol]: T }` → Dictionary<object, T>
 * - `Record<string, T>` → Dictionary<string, T>
 * - `Record<number, T>` → Dictionary<double, T>
 * - `Record<symbol, T>` → Dictionary<object, T>
 * - first-party target dictionaries with nominal/reference-type keys
 *
 * Source structural dictionaries are restricted to JS key domains by frontend
 * validation (TSN7413). Target-backed dictionaries can use any statically
 * emittable key type because the target dictionary owns key equality semantics.
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
    identifierType("global::System.Collections.Generic.Dictionary", [
      keyTypeAst,
      valueTypeAst,
    ]),
    ctx2,
  ];
};

/**
 * Emit dictionary key type as CSharpTypeAst.
 *
 * String, number, and symbol/object preserve JS structural dictionary
 * conventions. Other key types are emitted through the normal type emitter for
 * target-backed dictionaries.
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

  return emitTypeAst(keyType, context);
};
