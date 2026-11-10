import type { Node } from "@tsonic/tsts";
import type { SourceInputOriginalSubjects } from "../host-input/core-input.js";
import type { SourceInputFieldMarker } from "../host-input/marker-input.js";
import type { SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceFieldMarker, SourceMarkerFacts } from "../source-model/markers.js";
import type { SourcePointerFacts, SourcePointerType } from "../source-model/pointers.js";
import type { SourcePointerProductionInput } from "./source-pointer-input.js";
import { createSourcePointerOperationQuery } from "./source-pointer-operations.js";


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
