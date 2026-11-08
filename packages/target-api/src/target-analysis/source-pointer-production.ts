import type { Node } from "@tsonic/tsts";
import type { SourceInputCoreQueries, SourceInputLayoutIdentity, SourceInputOriginalSubjects } from "../host-input/core-input.js";
import type { SourceInputComponent } from "../host-input/identities.js";
import type { SourceInputFieldMarker } from "../host-input/marker-input.js";
import type { SourceApplicationFacts, SourceDescriptorView, SourcePresence, SourceRefusal, SourceResult,
  SourceTypeEvidence, SourceValueFacts } from "../public/source/contracts.js";
import type { SourceFieldMarker, SourceMarkerFacts } from "./source-markers.js";
import type { SourceMemoryLayout, SourcePointerFacts, SourcePointerType } from "./source-pointers.js";
import type { SourceAnalysisFacts } from "./source-protocols.js";
import { createSourcePointerOperationQuery } from "./source-pointer-operations.js";

export interface SourcePointerProductionInput {
  readonly core: SourceInputCoreQueries;
  readonly applications: SourceApplicationFacts;
  readonly values: SourceValueFacts;
  readonly view: SourceDescriptorView;
  readonly assertNode: (node: Node) => void;
  readonly originalComponent: (value: SourceTypeEvidence) => SourcePresence<SourceInputComponent>;
  readonly sourceOriginSubjects: (value: SourceTypeEvidence) => SourceInputOriginalSubjects["origins"];
  readonly syntax: (node: Node) => SourceInputComponent;
  readonly publish: (component: SourceInputComponent, receiver?: SourceTypeEvidence) => SourceResult<SourceTypeEvidence>;
  readonly storage: SourceAnalysisFacts["storage"];
  readonly unavailable: (node: Node, reason: string) => SourceRefusal;
}

function resolved<Value>(value: Value): SourceResult<Value> { return Object.freeze({ kind: "resolved", value }); }
function present<Value>(value: Value): SourcePresence<Value> { return Object.freeze({ kind: "present", value }); }
const none = Object.freeze({ kind: "none" } as const);

export function createSourcePointerFacts(input: SourcePointerProductionInput): SourcePointerFacts & SourceMarkerFacts {
  const { core, view, assertNode, syntax, publish, unavailable } = input;
  const types = new WeakMap<SourceTypeEvidence, ReturnType<SourcePointerFacts["pointerType"]>>();
  const markers = new WeakMap<SourceTypeEvidence, ReturnType<SourceMarkerFacts["typeMarkers"]>>();
  const declarations = new WeakMap<Node, ReturnType<SourceMarkerFacts["declarationMarkers"]>>();
  const subjects = (value: SourceTypeEvidence): SourceInputOriginalSubjects => {
    view.assertEvidence(value);
    return Object.freeze({ component: input.originalComponent(value), origins: input.sourceOriginSubjects(value) });
  };
  const field = (value: SourceInputFieldMarker, receiver?: SourceTypeEvidence): SourceResult<SourceFieldMarker> => {
    assertNode(value.typeNode);
    const selected = publish(syntax(value.typeNode), receiver);
    return selected.kind === "refused" ? selected : resolved(Object.freeze({ name: value.name,
      typeNode: value.typeNode, value: selected.value, readonly: value.readonly }));
  };
  const pointerType: SourcePointerFacts["pointerType"] = value => {
    view.assertEvidence(value);
    const previous = types.get(value);
    if (previous !== undefined) return previous;
    const original = core.pointerType(subjects(value));
    let result: ReturnType<SourcePointerFacts["pointerType"]>;
    if (original.kind === "unavailable") return unavailable(value.component.root,
      "Pointer discovery requires complete original Source marker associations.");
    if (original.kind === "none") result = resolved(none);
    else if (original.kind === "raw-address") result = resolved(present(Object.freeze({ kind: "raw-address", value })));
    else if (original.kind === "native-pointer") {
      assertNode(original.declaration);
      if (value.type.kind !== "declared" || value.type.declaration !== original.declaration)
        throw new Error("A native pointer requires its exact original declared Source identity.");
      const pointee = view.component(value, { kind: "type-argument", declaration: original.declaration, index: 0 });
      result = pointee.kind === "refused" ? pointee : resolved(present(Object.freeze({ kind: "native-pointer", value,
        pointee: pointee.value, mutability: "readwrite" })));
    } else if (original.kind === "typed-location") {
      const pointee = publish(original.pointee, value);
      result = pointee.kind === "refused" ? pointee : resolved(present(Object.freeze({ kind: "typed-location", value,
        pointee: pointee.value, mutability: original.mutability })));
    } else if (original.kind === "function-pointer") {
      assertNode(original.declaration);
      const parameters: SourceTypeEvidence[] = [];
      for (const parameter of original.parameters) {
        const selected = publish(parameter, value);
        if (selected.kind === "refused") return selected;
        parameters.push(selected.value);
      }
      const completion = publish(original.result, value);
      if (completion.kind === "refused") return completion;
      const pointer: SourcePointerType = Object.freeze({ kind: "function-pointer", value,
        declaration: original.declaration, signature: none, parameters: Object.freeze(parameters),
        result: completion.value, abi: original.abi });
      result = resolved(present(pointer));
    } else throw new Error("A Source pointer type requires one canonical original representation.");
    types.set(value, result);
    return result;
  };
  const typeMarkers: SourceMarkerFacts["typeMarkers"] = value => {
    view.assertEvidence(value);
    const previous = markers.get(value);
    if (previous !== undefined) return previous;
    const original = core.typeMarkers(subjects(value));
    if (original.kind === "unavailable") return unavailable(value.component.root,
      "Source type markers require complete original factual associations.");
    const fields: SourceFieldMarker[] = [];
    if (original.value.struct.kind === "present") {
      const selectedFields = original.value.struct.value.fields;
      if (selectedFields === undefined) return unavailable(value.component.root,
        "A Source struct requires its complete original field inventory.");
      for (const item of selectedFields) {
        const selected = field(item, value);
        if (selected.kind === "refused") return selected;
        fields.push(selected.value);
      }
    }
    const result = resolved(Object.freeze({ value, struct: original.value.struct.kind === "none" ? none
      : present(Object.freeze({ valueType: original.value.struct.value.valueType, fields: Object.freeze(fields) })),
      jsString: original.value.jsString }));
    markers.set(value, result);
    return result;
  };
  const declarationMarkers: SourceMarkerFacts["declarationMarkers"] = occurrence => {
    assertNode(occurrence);
    const previous = declarations.get(occurrence);
    if (previous !== undefined) return previous;
    const original = core.markers(occurrence);
    let selectedField: SourcePresence<SourceFieldMarker> = none;
    if (original.field.kind === "present") {
      const selected = field(original.field.value);
      if (selected.kind === "refused") return selected;
      selectedField = present(selected.value);
    }
    let selectedDefault: SourcePresence<{ readonly typeNode: Node; readonly value: SourceTypeEvidence }> = none;
    if (original.defaultValue.kind === "present") {
      const selected = publish(syntax(original.defaultValue.value.typeNode));
      if (selected.kind === "refused") return selected;
      selectedDefault = present(Object.freeze({ typeNode: original.defaultValue.value.typeNode, value: selected.value }));
    }
    const result = resolved(Object.freeze({ occurrence, field: selectedField, defaultValue: selectedDefault }));
    declarations.set(occurrence, result);
    return result;
  };
  return Object.freeze({ pointerType, typeMarkers, declarationMarkers, pointerOperation: createSourcePointerOperationQuery(input) });
}

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
