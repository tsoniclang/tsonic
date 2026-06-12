import type { ParameterPassingFact } from "./source-facts.js";

export type IrParameterPassingMode = "value" | "ref" | "out" | "in";

export type IrCallSitePassingModifier = "ref" | "out" | "in";

export const parameterPassingModeFromFact = (
  fact: ParameterPassingFact | undefined
): IrParameterPassingMode | undefined => {
  if (!fact) return undefined;
  switch (fact.mode) {
    case "by-value":
      return "value";
    case "byref-readonly":
      return "in";
    case "byref-readwrite":
      return "ref";
    case "byref-writeonly-must-init":
      return "out";
  }
};

export const callSitePassingModifierFromFact = (
  fact: ParameterPassingFact | undefined
): IrCallSitePassingModifier | undefined => {
  const mode = parameterPassingModeFromFact(fact);
  return mode === "ref" || mode === "out" || mode === "in" ? mode : undefined;
};
