import { defaultValueFactKey, fieldFactKey, pointerOperationFactKey, sourceMarkerFactKey, structFactKey } from "@tsonic/tsts";
import type { ExtensionFactKey, ExtensionFactSubject, FieldFact, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceInputFieldMarker, SourceInputMarkerQueries, SourceInputMarkers } from "@tsonic/target-api/host";
import type { SourcePresence } from "@tsonic/target-api/source";

export function createSourceCoreMarkerInput(input: {
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly assertNode: (node: Node) => void;
}): SourceInputMarkerQueries {
  const retained = new WeakMap<Node, SourceInputMarkers>();
  return Object.freeze({ markers(occurrence: Node) {
    input.assertNode(occurrence);
    const previous = retained.get(occurrence);
    if (previous !== undefined) return previous;
    const selected = sourceCoreMarkerFacts(input, [occurrence]);
    retained.set(occurrence, selected);
    return selected;
  } });
}

export function sourceCoreMarkerFacts(input: {
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly assertNode: (node: Node) => void;
}, subjects: readonly ExtensionFactSubject[]): SourceInputMarkers {
  const { sourceFacts, assertNode } = input;
  const none = Object.freeze({ kind: "none" } as const);
  const present = <Value>(value: Value): SourcePresence<Value> => Object.freeze({ kind: "present", value });
  const selected = <Value>(key: ExtensionFactKey<Value>): Value | undefined => {
    let retained: Value | undefined;
    for (const subject of subjects) {
      const actual = sourceFacts.getFact(subject, key);
      if (actual === undefined) continue;
      if (retained !== undefined && !key.equals(retained, actual))
        throw new Error("Original Source marker subjects contain contradictory canonical facts.");
      retained = actual;
    }
    return retained;
  };
  const field = (value: FieldFact): SourceInputFieldMarker => {
    assertNode(value.type);
    return Object.freeze({ name: value.name, typeNode: value.type, readonly: value.readonly === true });
  };
  const struct = selected(structFactKey);
  const originalField = selected(fieldFactKey);
  const originalDefault = selected(defaultValueFactKey);
  const pointer = selected(pointerOperationFactKey);
  if (originalDefault !== undefined) assertNode(originalDefault.type);
  if (pointer !== undefined) for (const node of [...pointer.arguments, ...pointer.typeArguments]) assertNode(node);
  return Object.freeze({
    struct: struct === undefined ? none : present(Object.freeze({ valueType: struct.valueType,
      fields: struct.fields === undefined ? undefined : Object.freeze(struct.fields.map(field)) })),
    field: originalField === undefined ? none : present(field(originalField)),
    defaultValue: originalDefault === undefined ? none : present(Object.freeze({ typeNode: originalDefault.type })),
    jsString: selected(sourceMarkerFactKey)?.marker === "js-string",
    pointer: pointer === undefined ? none : present(Object.freeze({ operation: pointer.operation, exportName: pointer.exportName,
      arguments: Object.freeze([...pointer.arguments]), typeArguments: Object.freeze([...pointer.typeArguments]),
      selection: pointer.selection.kind === "unavailable" ? "unvisited" : pointer.selection.value.kind,
      pointee: pointer.pointee.kind === "available" ? "available" : pointer.pointee.reason })),
  });
}
