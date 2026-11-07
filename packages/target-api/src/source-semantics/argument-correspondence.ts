// The one projection of a call witness argument binding into the published SourceArgumentCorrespondence record
// (R4: one record and one builder per fact). Pure and checker-free: the binding is the Node-only call witness row
// (source-model/navigation-records.ts), the argument its authored argument expression.
import type { Node } from "@tsonic/tsts";
import type { SourceArgumentCorrespondence } from "../public/source/selections.js";
import type { SourceNavigationCallBinding } from "../source-model/navigation-records.js";

export function sourceArgumentCorrespondence(binding: SourceNavigationCallBinding, argument: Node): SourceArgumentCorrespondence {
  const mode = binding.sourceForm === "spread-sequence" ? "spread" as const
    : binding.sourceParameterForm === "parameter" ? "positional" as const : "rest-element" as const;
  return Object.freeze({
    argument, argumentIndex: binding.sourceArgumentIndex, effectiveIndex: binding.effectiveArgumentIndex,
    parameterIndex: binding.sourceParameterIndex, mode, form: binding.sourceForm,
    ...(binding.sourceForm === "spread-element" && binding.spreadElementIndex !== undefined
      ? { spreadElement: binding.spreadElementIndex } : {}),
  });
}

/** Two correspondence rows name the same binding of the same call. */
export function sourceArgumentCorrespondencesEqual(left: SourceArgumentCorrespondence, right: SourceArgumentCorrespondence): boolean {
  return left.argument === right.argument && left.argumentIndex === right.argumentIndex &&
    left.effectiveIndex === right.effectiveIndex && left.parameterIndex === right.parameterIndex &&
    left.mode === right.mode && left.form === right.form && left.spreadElement === right.spreadElement;
}
