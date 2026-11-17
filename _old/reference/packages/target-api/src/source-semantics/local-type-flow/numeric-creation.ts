import type { SourceLiteralValue } from "../../source-model/literals/value.js";
import { sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";

export type SourceTypeFlowNumericLiteralDecision =
  | { readonly kind: "resolved"; readonly primitive: "int64" | "float64" }
  | { readonly kind: "refused"; readonly reason: string };

export function sourceTypeFlowNumericLiteralKind(literal: SourceLiteralValue): SourceTypeFlowNumericLiteralDecision {
  const numeric = literal.numeric;
  if (numeric?.kind === "checked-float64" || numeric?.kind === "authored" && /[.eE]/u.test(numeric.token.decimalText)) {
    return Object.freeze({ kind: "resolved", primitive: "float64" });
  }
  if (sourcePrimitiveOperatorLiteralFits(literal, "int64")) return Object.freeze({ kind: "resolved", primitive: "int64" });
  return Object.freeze({ kind: "refused",
    reason: "An unbound integer literal is outside the exact 'int64' range. Annotate it with an exact native type or use bigint." });
}
