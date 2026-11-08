import { functionPointerFactKey, pointerFactKey,
  providerVirtualDeclarationFactKey, rawPointerFactKey, sourceMarkerFactKey } from "@tsonic/tsts";
import type { CheckedSourceProgram, ExtensionFactKey, ExtensionFactSubject, Node, Type } from "@tsonic/tsts";
import type { SourceFactProduction, SourceInputComponent, SourceInputFieldMarker } from "@tsonic/target-api/host";
import type { SourceApplicationFacts, SourceDescriptorView, SourceFieldMarker, SourceMarkerFacts,
  SourceMemoryLayout, SourcePointerFacts, SourcePointerType, SourcePresence, SourceRefusal, SourceResult, SourceTypeEvidence,
  SourceValueFacts, SourceAnalysisFacts } from "@tsonic/target-api/source";
import { tsonicCoreProviderVersion, tsonicCoreTypesModule, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { createSourceCorePointerOperationQuery } from "./pointer-operations.js";
import type { TsonicMemoryLayoutFact } from "../memory-layout/facts.js";
import { sourceCoreMarkerFacts } from "./marker-facts.js";

export interface SourceCorePointerFactsInput {
  readonly checked: CheckedSourceProgram;
  readonly values: SourceValueFacts;
  readonly applications: SourceApplicationFacts;
  readonly view: SourceDescriptorView;
  readonly assertNode: (node: Node) => void;
  readonly originalComponent: SourceFactProduction["originalComponent"];
  readonly sourceOriginSubjects: SourceFactProduction["sourceOriginSubjects"];
  readonly observedComponent: (component: SourceInputComponent) => Type | undefined;
  readonly syntax: (node: Node) => SourceInputComponent;
  readonly publish: (component: SourceInputComponent, receiver?: SourceTypeEvidence) => SourceResult<SourceTypeEvidence>;
  readonly storage: SourceAnalysisFacts["storage"];
  readonly unavailable: (node: Node, reason: string) => SourceRefusal;
}

function resolved<Value>(value: Value): SourceResult<Value> { return Object.freeze({ kind: "resolved", value }); }
function present<Value>(value: Value): SourcePresence<Value> { return Object.freeze({ kind: "present", value }); }
const none = Object.freeze({ kind: "none" } as const);

export function createSourceCorePointerFacts(input: SourceCorePointerFactsInput): SourcePointerFacts & SourceMarkerFacts {
  const { checked, view, assertNode, originalComponent, observedComponent, syntax, publish } = input;
  const { ast, sourceFacts } = checked;
  const types = new WeakMap<SourceTypeEvidence, SourceResult<SourcePresence<SourcePointerType>>>();
  const markers = new WeakMap<SourceTypeEvidence, ReturnType<SourceMarkerFacts["typeMarkers"]>>();
  const declarations = new WeakMap<Node, ReturnType<SourceMarkerFacts["declarationMarkers"]>>();
  const subjects = (value: SourceTypeEvidence): { readonly values: readonly ExtensionFactSubject[]; readonly complete: boolean } => {
    view.assertEvidence(value);
    const origins = input.sourceOriginSubjects(value);
    const selected = new Set<ExtensionFactSubject>();
    if (origins.kind === "complete") for (const node of origins.nodes) { assertNode(node); selected.add(node); }
    const association = originalComponent(value);
    let observed = false;
    if (association.kind === "present") {
      const component = association.value;
      assertNode(component.root);
      const terminal = observedComponent(component);
      if (component.path.length === 0) {
        selected.add(component.root);
        const annotation = ast.typeAnnotation(component.root);
        if (annotation !== undefined) selected.add(annotation);
      }
      if (terminal !== undefined) {
        observed = true;
        const file = ast.getSourceFile(component.root);
        if (file === undefined) throw new Error("Source pointer evidence requires its original checked source file.");
        const { checker } = checked.getSourceFileQueries(file);
        selected.add(terminal);
        for (const symbol of [checker.getTypeAliasSymbol(terminal), checker.getTypeSymbol(terminal)]) {
          if (symbol === undefined) continue;
          selected.add(symbol);
          for (const declaration of checker.getSymbolDeclarations(symbol)) if (declaration !== undefined) {
            assertNode(declaration);
            selected.add(declaration);
            const annotation = ast.typeAnnotation(declaration);
            if (annotation !== undefined) selected.add(annotation);
          }
        }
      }
    }
    return Object.freeze({ values: Object.freeze([...selected]), complete: observed ||
      origins.kind === "complete" && origins.nodes.length === 0 });
  };
  const fact = <Value>(selected: readonly ExtensionFactSubject[], key: ExtensionFactKey<Value>): Value | undefined => {
    let result: Value | undefined;
    for (const subject of selected) {
      const value = sourceFacts.getFact(subject, key);
      if (value === undefined) continue;
      if (result !== undefined && !key.equals(result, value))
        throw new Error("Original Source pointer components contain contradictory canonical facts.");
      result = value;
    }
    return result;
  };
  const field = (value: SourceInputFieldMarker, receiver?: SourceTypeEvidence): SourceResult<SourceFieldMarker> => {
    assertNode(value.typeNode);
    const selected = publish(syntax(value.typeNode), receiver);
    return selected.kind === "refused" ? selected : resolved(Object.freeze({ name: value.name,
      typeNode: value.typeNode, value: selected.value, readonly: value.readonly }));
  };
  const pointerType: SourcePointerFacts["pointerType"] = value => {
    view.assertEvidence(value);
    const existing = types.get(value);
    if (existing !== undefined) return existing;
    const original = subjects(value);
    const selected = original.values;
    const pointer = fact(selected, pointerFactKey);
    const raw = fact(selected, rawPointerFactKey);
    const marker = fact(selected, sourceMarkerFactKey);
    const callable = fact(selected, functionPointerFactKey);
    let nativeDeclaration: Node | undefined;
    for (const subject of selected) {
      const provider = sourceFacts.getFact(subject, providerVirtualDeclarationFactKey);
      if (provider?.providerId !== tsonicCoreVirtualModulesProviderId || provider.providerVersion !== tsonicCoreProviderVersion ||
        provider.moduleSpecifier !== tsonicCoreTypesModule || provider.exportName !== "NativePointer") continue;
      if (value.type.kind !== "declared" || subject !== value.type.declaration) continue;
      if (nativeDeclaration !== undefined && nativeDeclaration !== subject)
        throw new Error("A native pointer requires one exact original provider declaration.");
      nativeDeclaration = value.type.declaration;
    }
    const categories = Number(pointer !== undefined) + Number(raw !== undefined || marker?.marker === "raw-pointer") +
      Number(callable !== undefined) + Number(nativeDeclaration !== undefined);
    if (categories > 1) throw new Error("A Source component cannot carry competing pointer representations.");
    let result: SourceResult<SourcePresence<SourcePointerType>>;
    if (pointer !== undefined) {
      const pointee = publish(syntax(pointer.pointee), value);
      result = pointee.kind === "refused" ? pointee : resolved(present(Object.freeze({ kind: "typed-location", value,
        pointee: pointee.value, mutability: pointer.mutability })));
    } else if (nativeDeclaration !== undefined) {
      const pointee = view.component(value, { kind: "type-argument", declaration: nativeDeclaration, index: 0 });
      result = pointee.kind === "refused" ? pointee : resolved(present(Object.freeze({ kind: "native-pointer", value,
        pointee: pointee.value, mutability: "readwrite" })));
    } else if (raw !== undefined || marker?.marker === "raw-pointer") {
      result = resolved(present(Object.freeze({ kind: "raw-address", value })));
    } else if (callable !== undefined) {
      const parameters: SourceTypeEvidence[] = [];
      for (const parameter of callable.parameters) {
        const selectedParameter = publish(syntax(parameter), value);
        if (selectedParameter.kind === "refused") return selectedParameter;
        parameters.push(selectedParameter.value);
      }
      const completion = publish(syntax(callable.result), value);
      if (completion.kind === "refused") return completion;
      const association = originalComponent(value);
      if (association.kind === "none") return input.unavailable(value.component.root,
        "A function pointer requires its original declared component association.");
      result = resolved(present(Object.freeze({ kind: "function-pointer", value, declaration: association.value.root,
        signature: none, parameters: Object.freeze(parameters), result: completion.value, abi: Object.freeze([...callable.abi]) })));
    } else result = original.complete ? resolved(none) : input.unavailable(value.component.root,
      "Pointer discovery requires complete original Source marker associations.");
    types.set(value, result);
    return result;
  };
  const typeMarkers: SourceMarkerFacts["typeMarkers"] = value => {
    view.assertEvidence(value);
    const existing = markers.get(value);
    if (existing !== undefined) return existing;
    const selected = subjects(value);
    if (!selected.complete) return input.unavailable(value.component.root,
      "Source type markers require complete original factual associations.");
    const original = sourceCoreMarkerFacts({ sourceFacts, assertNode }, selected.values);
    const fields: SourceFieldMarker[] = [];
    for (const item of original.struct.kind === "present" ? original.struct.value.fields ?? [] : []) {
      const selectedField = field(item, value);
      if (selectedField.kind === "refused") return selectedField;
      fields.push(selectedField.value);
    }
    const result = resolved(Object.freeze({ value,
      struct: original.struct.kind === "none" ? none : present(Object.freeze({ valueType: original.struct.value.valueType, fields: Object.freeze(fields) })),
      jsString: original.jsString }));
    markers.set(value, result);
    return result;
  };
  const declarationMarkers: SourceMarkerFacts["declarationMarkers"] = occurrence => {
    assertNode(occurrence);
    const existing = declarations.get(occurrence);
    if (existing !== undefined) return existing;
    const original = sourceCoreMarkerFacts({ sourceFacts, assertNode }, [occurrence]);
    let selectedField: SourcePresence<SourceFieldMarker> = none;
    if (original.field.kind === "present") {
      const published = field(original.field.value);
      if (published.kind === "refused") return published;
      selectedField = present(published.value);
    }
    const originalDefault = original.defaultValue;
    const selectedDefault = originalDefault.kind === "none" ? undefined : publish(syntax(originalDefault.value.typeNode));
    if (selectedDefault?.kind === "refused") return selectedDefault;
    const result = resolved(Object.freeze({ occurrence,
      field: selectedField,
      defaultValue: originalDefault.kind === "none" || selectedDefault === undefined ? none
        : present(Object.freeze({ typeNode: originalDefault.value.typeNode, value: selectedDefault.value })) }));
    declarations.set(occurrence, result);
    return result;
  };
  return Object.freeze({ pointerType, typeMarkers, declarationMarkers,
    pointerOperation: createSourceCorePointerOperationQuery(input) });
}

export function createSourceMemoryLayoutQuery(input: SourceCorePointerFactsInput):
  (layout: TsonicMemoryLayoutFact, source: SourceTypeEvidence) => SourceResult<SourceMemoryLayout> {
  const { checked, view, assertNode, originalComponent, observedComponent, unavailable } = input;
  const retained = new WeakMap<TsonicMemoryLayoutFact, WeakMap<SourceTypeEvidence, SourceResult<SourceMemoryLayout>>>();
  const active = new Set<TsonicMemoryLayoutFact>();
  const select = (layout: TsonicMemoryLayoutFact, source: SourceTypeEvidence): SourceResult<SourceMemoryLayout> => {
    view.assertEvidence(source);
    assertNode(layout.call);
    const association = originalComponent(source);
    const terminal = association.kind === "none" ? undefined : observedComponent(association.value);
    if (terminal === undefined) return unavailable(layout.call, "A finalized memory layout requires its observed original Source component.");
    const file = checked.ast.getSourceFile(layout.call);
    if (file === undefined) throw new Error("A memory layout requires its original checked source file.");
    if (!checked.getSourceFileQueries(file).typeShape.isTypeIdenticalTo(terminal, layout.sourceType))
      throw new Error("A finalized memory layout must describe the exact selected Source component.");
    let bySource = retained.get(layout);
    const existing = bySource?.get(source);
    if (existing !== undefined) return existing;
    if (active.has(layout)) throw new Error("A finalized memory layout cannot contain a recursive physical value.");
    active.add(layout);
    try {
      const base = { occurrence: layout.call, source,
        dataLayout: Object.freeze({ ...layout.dataLayout, providerDeclaration: Object.freeze({ ...layout.dataLayout.providerDeclaration }) }),
        byteSize: layout.byteSize, byteAlignment: layout.byteAlignment, stride: layout.stride };
      let result: SourceResult<SourceMemoryLayout>;
      if (layout.kind === "array") {
        if (source.type.kind !== "declared") return unavailable(layout.call, "A fixed-array layout requires its original declared extent identity.");
        const extent = source.type.extent;
        if (extent === undefined || extent.length !== layout.fixedArray.length || extent.runtimeBase !== layout.fixedArray.lengthRuntimeBase)
          throw new Error("A memory array layout must retain the exact Source extent and runtime base.");
        const element = view.component(source, { kind: "type-argument", declaration: source.type.declaration, index: 0 });
        if (element.kind === "refused") return element;
        const child = select(layout.elementLayout, element.value);
        if (child.kind === "refused") return child;
        result = resolved(Object.freeze({ ...base, kind: "array", extent, element: child.value }));
      } else {
        const fields: Extract<SourceMemoryLayout, { readonly kind: "value" }>["fields"][number][] = [];
        for (const field of layout.fields) {
          assertNode(field.call);
          assertNode(field.selector);
          assertNode(field.selectedDeclaration);
          const selected = view.component(source, { kind: "member", origin: { kind: "declared", declaration: field.selectedDeclaration } });
          if (selected.kind === "refused") return selected;
          const child = select(field.fieldLayout, selected.value);
          if (child.kind === "refused") return child;
          fields.push(Object.freeze({ occurrence: field.call, selector: field.selector, declaration: field.selectedDeclaration,
            value: selected.value, layout: child.value, byteOffset: field.byteOffset, byteAlignment: field.byteAlignment }));
        }
        result = resolved(Object.freeze({ ...base, kind: "value", fields: Object.freeze(fields) }));
      }
      if (bySource === undefined) { bySource = new WeakMap(); retained.set(layout, bySource); }
      bySource.set(source, result);
      return result;
    } finally { active.delete(layout); }
  };
  return select;
}
