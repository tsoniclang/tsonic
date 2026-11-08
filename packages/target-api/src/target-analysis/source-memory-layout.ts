import type { SourceInputLayoutIdentity } from "../host-input/core-input.js";
import type { SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceMemoryLayout } from "../source-model/pointers.js";
import type { SourcePointerProductionInput } from "./source-pointer-input.js";

function resolved<Value>(value: Value): SourceResult<Value> { return Object.freeze({ kind: "resolved", value }); }

export function createSourceMemoryLayoutQuery(input: SourcePointerProductionInput):
  (identity: SourceInputLayoutIdentity, source: SourceTypeEvidence) => SourceResult<SourceMemoryLayout> {
  const { core, view, assertNode, originalComponent, unavailable } = input;
  const retained = new WeakMap<SourceInputLayoutIdentity, WeakMap<SourceTypeEvidence, SourceResult<SourceMemoryLayout>>>();
  const active = new Set<SourceInputLayoutIdentity>();
  const select = (identity: SourceInputLayoutIdentity, source: SourceTypeEvidence): SourceResult<SourceMemoryLayout> => {
    view.assertEvidence(source);
    assertNode(identity.occurrence);
    const association = originalComponent(source);
    if (association.kind === "none") return unavailable(identity.occurrence,
      "A finalized memory layout requires its observed original Source component.");
    const original = core.layout(identity, association.value);
    if (original.kind === "unavailable") return unavailable(identity.occurrence,
      "A finalized memory layout requires its observed original Source component.");
    let bySource = retained.get(identity);
    const previous = bySource?.get(source);
    if (previous !== undefined) return previous;
    if (active.has(identity)) throw new Error("A finalized memory layout cannot contain a recursive physical value.");
    active.add(identity);
    try {
      const layout = original.value;
      const base = { occurrence: layout.occurrence, source, dataLayout: layout.dataLayout,
        byteSize: layout.byteSize, byteAlignment: layout.byteAlignment, stride: layout.stride };
      let result: SourceResult<SourceMemoryLayout>;
      if (layout.kind === "array") {
        if (source.type.kind !== "declared") return unavailable(layout.occurrence,
          "A fixed-array layout requires its original declared extent identity.");
        const extent = source.type.extent;
        if (extent === undefined || extent.length !== layout.extent.length || extent.runtimeBase !== layout.extent.runtimeBase)
          throw new Error("A memory array layout must retain the exact Source extent and runtime base.");
        const element = view.component(source, { kind: "type-argument", declaration: source.type.declaration, index: 0 });
        if (element.kind === "refused") return element;
        const child = select(layout.element, element.value);
        if (child.kind === "refused") return child;
        result = resolved(Object.freeze({ ...base, kind: "array", extent, element: child.value }));
      } else {
        const fields: Extract<SourceMemoryLayout, { readonly kind: "value" }>["fields"][number][] = [];
        for (const field of layout.fields) {
          assertNode(field.occurrence); assertNode(field.selector); assertNode(field.declaration);
          const selected = view.component(source, { kind: "member", origin: { kind: "declared", declaration: field.declaration } });
          if (selected.kind === "refused") return selected;
          const child = select(field.layout, selected.value);
          if (child.kind === "refused") return child;
          fields.push(Object.freeze({ occurrence: field.occurrence, selector: field.selector, declaration: field.declaration,
            value: selected.value, layout: child.value, byteOffset: field.byteOffset, byteAlignment: field.byteAlignment }));
        }
        result = resolved(Object.freeze({ ...base, kind: "value", fields: Object.freeze(fields) }));
      }
      if (bySource === undefined) { bySource = new WeakMap(); retained.set(identity, bySource); }
      bySource.set(source, result);
      return result;
    } finally { active.delete(identity); }
  };
  return select;
}
