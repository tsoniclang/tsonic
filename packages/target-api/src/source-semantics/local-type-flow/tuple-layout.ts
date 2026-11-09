import type { SourceComponentSelector, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDescriptorBuilder } from "../descriptor-contracts.js";
import { sourceSemanticRefusal } from "./semantic-production.js";

export interface SourceSequenceSlot {
  readonly kind: "required" | "optional" | "rest";
  readonly type: SourceTypeEvidence;
  readonly element: SourceTypeEvidence | undefined;
  readonly path: readonly SourceComponentSelector[];
  readonly container: { readonly value: SourceTypeEvidence; readonly index: number } | undefined;
}

export interface SourceSequenceSelection {
  readonly receiver: SourceTypeEvidence;
  readonly selector: SourceComponentSelector;
  readonly value: SourceTypeEvidence;
  readonly optional: boolean;
}

export function produceSourceSequenceLayout(builder: SourceDescriptorBuilder, source: SourceTypeEvidence,
  path: readonly SourceComponentSelector[] = []): SourceProductionResult<readonly SourceSequenceSlot[]> {
  const active = new Set<SourceTypeEvidence>();
  function produce(value: SourceTypeEvidence, path: readonly SourceComponentSelector[]): SourceProductionResult<readonly SourceSequenceSlot[]> {
    builder.assertEvidence(value);
    if (active.has(value)) return sourceSemanticRefusal(source.component.root,
      "An original Source tuple rest component depends on its own sequence.", "TSONIC_LOCAL_TYPE_SELF_REFERENCE");
    active.add(value);
    try {
      const definition = builder.produceDefinition(value);
      if (definition.kind !== "resolved") return definition;
      const selected = definition.value;
      if (selected.type.kind === "array") {
        const element = builder.component(selected, { kind: "array-element" });
        return element.kind === "refused" ? element : { kind: "resolved", value: [{ kind: "rest", type: value,
          element: element.value, path: Object.freeze([...path]), container: undefined }] };
      }
      if (selected.type.kind === "tuple") {
        const slots: SourceSequenceSlot[] = [];
        for (const [index, element] of selected.type.elements.entries()) {
          const selector = { kind: "tuple-element" as const, index };
          const child = builder.component(selected, selector);
          if (child.kind === "refused") return child;
          const childPath = [...path, selector];
          if (element.kind === "rest") {
            const nested = produce(child.value, childPath);
            if (nested.kind !== "resolved") return nested;
            slots.push(...nested.value);
          } else slots.push({ kind: element.kind, type: child.value, element: undefined,
            path: Object.freeze(childPath), container: { value: selected, index } });
        }
        return { kind: "resolved", value: Object.freeze(slots) };
      }
      if (selected.type.kind === "parameter" || selected.type.kind === "projection") return { kind: "resolved",
        value: [{ kind: "rest", type: value, element: undefined, path: Object.freeze([...path]), container: undefined }] };
      return sourceSemanticRefusal(source.component.root,
        "An original rest component requires its solved Source sequence or tuple.", "TSONIC_LOCAL_TYPE_GENERIC");
    } finally { active.delete(value); }
  }
  return produce(source, path);
}

export function produceSourceSequenceElements(builder: SourceDescriptorBuilder, source: SourceTypeEvidence,
  ordinal: bigint | undefined): SourceProductionResult<readonly SourceTypeEvidence[]> {
  const selected = produceSourceSequenceSelections(builder, source, ordinal);
  if (selected.kind !== "resolved") return selected;
  const values: SourceTypeEvidence[] = [];
  for (const slot of selected.value) {
    values.push(slot.value);
    if (slot.optional) values.push(builder.evidence({ type: builder.intrinsic("absence"), component: slot.value.component,
      category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
    { kind: "finite", values: [{ kind: "absence" }] },
    { members: { kind: "unavailable" }, origins: builder.sourceOriginSubjects(slot.value) }));
  }
  return { kind: "resolved", value: Object.freeze(values) };
}

export function produceSourceSequenceSelections(builder: SourceDescriptorBuilder, source: SourceTypeEvidence,
  ordinal: bigint | undefined): SourceProductionResult<readonly SourceSequenceSelection[]> {
  if (ordinal !== undefined && ordinal < 0n) return sourceSemanticRefusal(source.component.root,
    "A Source tuple index requires its exact nonnegative ordinal.");
  const layout = produceSourceSequenceLayout(builder, source);
  if (layout.kind !== "resolved") return layout;
  const values: SourceSequenceSelection[] = [];
  let minimum = 0n;
  let maximum: bigint | undefined = 0n;
  for (const slot of layout.value) {
    const selected = ordinal === undefined || ordinal >= minimum && (slot.kind === "rest" || maximum === undefined || ordinal <= maximum);
    if (selected) {
      if (slot.kind === "rest") {
        if (slot.element === undefined) return { kind: "pending", dependencies: [slot.type.component] };
        const receiver = builder.produceDefinition(slot.type);
        if (receiver.kind !== "resolved") return receiver;
        values.push(Object.freeze({ receiver: receiver.value, selector: Object.freeze({ kind: "array-element" as const }),
          value: slot.element, optional: false }));
      } else {
        if (slot.container === undefined) throw new Error("A Source tuple slot retains its exact registered container and selector.");
        values.push(Object.freeze({ receiver: slot.container.value,
          selector: Object.freeze({ kind: "tuple-element" as const, index: slot.container.index }),
          value: slot.type, optional: slot.kind === "optional" }));
      }
    }
    if (slot.kind === "rest") maximum = undefined;
    else {
      minimum += 1n;
      if (maximum !== undefined) maximum += 1n;
    }
  }
  return { kind: "resolved", value: Object.freeze(values) };
}
