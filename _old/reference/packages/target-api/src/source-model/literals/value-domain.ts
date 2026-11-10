import type { SourceLiteralDomain } from "./domain.js";
import { sourceFiniteLiteralDomain, sourceOpenLiteralDomain, sourcePresentLiteralDomain } from "./domain.js";
import type { SourceLiteralValue } from "./value.js";

export function sourceLiteralValueDomain(value: SourceLiteralValue | undefined,
  category: "number" | "bigint" | "boolean" | "string" | "symbol" | "object" | "function" | "absence" | "dynamic",
  presence: "present" | "dynamic"): SourceLiteralDomain {
  const open = presence === "present" ? sourcePresentLiteralDomain : sourceOpenLiteralDomain;
  if (value === undefined) return open;
  if (value.form === "true" || value.form === "false") {
    return category === "boolean" ? sourceFiniteLiteralDomain([{ kind: "boolean", value: value.form === "true" }]) : open;
  }
  if (value.form === "string" || value.form === "template") {
    return category === "string" ? sourceFiniteLiteralDomain([{ kind: "string", value: value.text }]) : open;
  }
  if (value.form === "array") return open;
  const integer = value.integerConstant ?? value.integer;
  if (category === "bigint") return integer === undefined ? open : sourceFiniteLiteralDomain([{ kind: "bigint", value: integer }]);
  if (category !== "number") return open;
  if (value.numeric !== undefined) return sourceFiniteLiteralDomain([{ kind: "number", value: value.numeric }]);
  return integer === undefined ? open : sourceFiniteLiteralDomain([{ kind: "number", value: { kind: "integer", value: integer } }]);
}
