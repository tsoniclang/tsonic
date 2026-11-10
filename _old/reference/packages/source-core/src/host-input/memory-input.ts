import type { CheckedSourceProgram, Node, ResolvedCallApplicationEvidence,
  ResolvedCheckedComponentEvidence, Type } from "@tsonic/tsts";
import type { SourceInputApplication, SourceInputComponent, SourceInputLayoutIdentity,
  SourceInputMemoryField, SourceInputMemoryFieldBinding, SourceInputMemoryFieldIdentity,
  SourceInputMemoryLayout, SourceInputMemoryMetadata, SourceInputMemoryQueries,
  SourceInputMemoryObservation, SourceInputMemoryRecordBinding, SourceInputMemorySelection, SourceInputMemorySource } from "@tsonic/target-api/host";
import type { SourcePresence } from "@tsonic/target-api/source";
import { selectInlineSourceMember } from "./selected-source-member.js";
import { memoryLayoutsEqual, tsonicMemoryFieldLayoutFactKey } from "./memory-layout-facts.js";
import type { TsonicMemoryFieldLayoutFact, TsonicMemoryLayoutFact } from "./memory-layout-facts.js";
import { isFinalizedMemoryLayoutFacts, readTsonicDataLayout, readTsonicMemoryFieldLayout,
  readTsonicMemoryLayout, readTsonicMemoryLayoutQuery, readTsonicRawMemoryOperation } from "./memory-readers.js";
import { readMemoryPublicationSources } from "./memory-publications.js";
import type { MemorySourceProvenance, MemoryTypePublicationSources } from "./memory-provenance.js";
import { selectTsonicMemoryFieldBindingFacts, selectTsonicMemoryRecordBindingFacts } from "./memory-binding-selection.js";
import { tsonicMemoryFieldBindingFactKey, tsonicMemoryRecordBindingFactKey } from "./memory-binding-facts.js";

export interface SourceCoreOriginalCallInput {
  originalApplication(application: ResolvedCallApplicationEvidence): SourceInputApplication;
  originalComponent(component: ResolvedCheckedComponentEvidence): SourceInputComponent;
}

export function createSourceCoreMemoryInput(input: SourceCoreOriginalCallInput & {
  readonly checked: CheckedSourceProgram;
  readonly assertNode: (node: Node) => void;
  readonly observedComponent: (component: SourceInputComponent) => Type | undefined;
}) {
  const { checked, assertNode, observedComponent } = input;
  const { ast, sourceFacts } = checked;
  const none = Object.freeze({ kind: "none" } as const);
  const present = <Value>(value: Value): SourcePresence<Value> => Object.freeze({ kind: "present", value });
  const available = <Value>(value: Value): SourceInputMemorySelection<Value> => Object.freeze({ kind: "available", value });
  const unavailable = (occurrence: Node, reason: string) => Object.freeze({ kind: "unavailable" as const, occurrence, reason });
  const layouts = new Map<Node, { readonly identity: SourceInputLayoutIdentity; readonly original: TsonicMemoryLayoutFact }>();
  const originalLayouts = new WeakMap<SourceInputLayoutIdentity, TsonicMemoryLayoutFact>();
  const fields = new Map<Node, { readonly identity: SourceInputMemoryFieldIdentity; readonly original: TsonicMemoryFieldLayoutFact }>();
  const originalFields = new WeakMap<SourceInputMemoryFieldIdentity, TsonicMemoryFieldLayoutFact>();
  const capturedLayouts = new WeakMap<SourceInputLayoutIdentity, SourceInputMemoryLayout>();
  const capturedFields = new WeakMap<SourceInputMemoryFieldIdentity, SourceInputMemoryField>();
  const capturedMetadata = new WeakMap<Node, SourceInputMemorySelection<SourceInputMemoryMetadata>>();
  const capturedObservations = new WeakMap<Node, SourceInputMemoryObservation>();
  const capturedFieldBindings = new WeakMap<Node, SourceInputMemorySelection<SourceInputMemoryFieldBinding>>();
  const capturedRecordBindings = new WeakMap<Node, SourceInputMemorySelection<SourceInputMemoryRecordBinding>>();
  const sources = (occurrence: Node): MemoryTypePublicationSources | undefined => {
    assertNode(occurrence);
    return readMemoryPublicationSources(checked, sourceFacts, occurrence);
  };
  const source = (original: MemorySourceProvenance): SourceInputMemorySource | undefined => {
    assertNode(original.application.invocation);
    const application = input.originalApplication(original.application);
    if (original.kind === "binding") {
      assertNode(original.declaration);
      const index = original.application.signatureTypeArguments.indexOf(original.argument);
      const selected = application.signatureArguments[index];
      if (index < 0 || selected?.declaration !== original.declaration || selected.argument === undefined) return undefined;
      if (observedComponent(selected.argument) !== original.sourceType)
        throw new Error("Memory binding transport must preserve its exact observed original argument.");
      return Object.freeze({ kind: "binding", application, declaration: original.declaration, component: selected.argument });
    }
    const component = input.originalComponent(original.component);
    if (observedComponent(component) !== original.component.type)
      throw new Error("Memory result transport must preserve its exact observed original component.");
    return Object.freeze({ kind: "result", application, component, path: component.path });
  };
  const layoutIdentity = (original: TsonicMemoryLayoutFact): SourceInputLayoutIdentity => {
    assertNode(original.call);
    const previous = layouts.get(original.call);
    if (previous !== undefined) {
      if (!memoryLayoutsEqual(previous.original, original))
        throw new Error("A memory-layout occurrence cannot acquire competing finalized snapshots.");
      return previous.identity;
    }
    const identity: SourceInputLayoutIdentity = Object.freeze({ kind: "memory-layout", occurrence: original.call });
    layouts.set(original.call, Object.freeze({ identity, original }));
    originalLayouts.set(identity, original);
    return identity;
  };
  const fieldIdentity = (original: TsonicMemoryFieldLayoutFact): SourceInputMemoryFieldIdentity => {
    assertNode(original.call);
    const previous = fields.get(original.call);
    if (previous !== undefined) {
      if (!tsonicMemoryFieldLayoutFactKey.equals(previous.original, original))
        throw new Error("A memory-field occurrence cannot acquire competing finalized snapshots.");
      return previous.identity;
    }
    const identity: SourceInputMemoryFieldIdentity = Object.freeze({ kind: "memory-field", occurrence: original.call });
    fields.set(original.call, Object.freeze({ identity, original }));
    originalFields.set(identity, original);
    return identity;
  };
  const layout: SourceInputMemoryQueries["layout"] = identity => {
    assertNode(identity.occurrence);
    const original = originalLayouts.get(identity);
    if (original === undefined) throw new Error("Memory layout identities belong to their one original Core input.");
    const previous = capturedLayouts.get(identity);
    if (previous !== undefined) return available(previous);
    if (!isFinalizedMemoryLayoutFacts(sourceFacts, original))
      return unavailable(original.call, "A memory layout requires its exact finalized original child inventory.");
    const origins = sources(original.call);
    const selected = origins === undefined ? undefined : source(origins.source);
    if (selected === undefined) return unavailable(original.call, "A finalized memory layout has no observed original binding or result component.");
    const base = { occurrence: original.call, source: selected,
      dataLayout: Object.freeze({ ...original.dataLayout, providerDeclaration: Object.freeze({ ...original.dataLayout.providerDeclaration }) }),
      byteSize: original.byteSize, byteAlignment: original.byteAlignment, stride: original.stride };
    const result: SourceInputMemoryLayout = original.kind === "array"
      ? Object.freeze({ ...base, kind: "array", extent: Object.freeze({ length: original.fixedArray.length,
          runtimeBase: original.fixedArray.lengthRuntimeBase }), element: layoutIdentity(original.elementLayout) })
      : Object.freeze({ ...base, kind: "value", fields: Object.freeze(original.fields.map(fieldIdentity)) });
    capturedLayouts.set(identity, result);
    return available(result);
  };
  const field: SourceInputMemoryQueries["field"] = identity => {
    assertNode(identity.occurrence);
    const original = originalFields.get(identity);
    if (original === undefined) throw new Error("Memory field identities belong to their one original Core input.");
    const previous = capturedFields.get(identity);
    if (previous !== undefined) return available(previous);
    const finalized = readTsonicMemoryFieldLayout(sourceFacts, original.call);
    if (finalized === undefined || !tsonicMemoryFieldLayoutFactKey.equals(finalized, original) ||
      !isFinalizedMemoryLayoutFacts(sourceFacts, original.fieldLayout))
      return unavailable(original.call, "A memory field requires its exact finalized original layout.");
    const origins = sources(original.call);
    const owner = origins?.owner === undefined ? undefined : source(origins.owner);
    const value = origins === undefined ? undefined : source(origins.source);
    if (owner === undefined || value === undefined)
      return unavailable(original.call, "A finalized memory field has no original owner and child binding components.");
    assertNode(original.selector);
    const file = ast.getSourceFile(original.selector);
    if (file === undefined) throw new Error("A memory selector requires its original source file.");
    const selected = selectInlineSourceMember(original.selector, checked.getSourceFileQueries(file));
    if (selected.kind !== "selected" || selected.selectedDeclaration !== original.selectedDeclaration ||
      !selected.selectedDeclarations.includes(original.selectedDeclaration))
      return unavailable(original.call, "A memory field requires the same complete original selected member inventory.");
    assertNode(selected.expression);
    selected.selectedDeclarations.forEach(assertNode);
    const result: SourceInputMemoryField = Object.freeze({ identity, owner, value,
      selector: original.selector, selection: selected.expression,
      primary: selected.selectedDeclaration === undefined ? none : present(selected.selectedDeclaration),
      selectedDeclarations: Object.freeze([...selected.selectedDeclarations]), layout: layoutIdentity(original.fieldLayout),
      byteOffset: original.byteOffset, byteAlignment: original.byteAlignment });
    capturedFields.set(identity, result);
    return available(result);
  };
  const metadata: SourceInputMemoryQueries["metadata"] = occurrence => {
    assertNode(occurrence);
    const previous = capturedMetadata.get(occurrence);
    if (previous !== undefined) return previous;
    const data = readTsonicDataLayout(sourceFacts, occurrence);
    const originalLayout = readTsonicMemoryLayout(sourceFacts, occurrence);
    const originalField = readTsonicMemoryFieldLayout(sourceFacts, occurrence);
    if (Number(data !== undefined) + Number(originalLayout !== undefined) + Number(originalField !== undefined) > 1)
      throw new Error("A memory metadata occurrence requires one finalized original domain.");
    let result: SourceInputMemorySelection<SourceInputMemoryMetadata>;
    if (data !== undefined) result = available(Object.freeze({ kind: "data-layout", occurrence,
      dataLayout: Object.freeze({ ...data, providerDeclaration: Object.freeze({ ...data.providerDeclaration }) }) }));
    else if (originalLayout !== undefined) {
      const identity = layoutIdentity(originalLayout);
      const selected = layout(identity);
      result = selected.kind !== "available" ? selected : available(Object.freeze({ kind: "memory-layout", identity }));
    } else if (originalField !== undefined) {
      const identity = fieldIdentity(originalField);
      const selected = field(identity);
      result = selected.kind !== "available" ? selected : available(Object.freeze({ kind: "memory-field", identity }));
    } else result = none;
    if (result.kind !== "unavailable") capturedMetadata.set(occurrence, result);
    return result;
  };
  const fieldBinding: SourceInputMemoryQueries["fieldBinding"] = occurrence => {
    assertNode(occurrence);
    const previous = capturedFieldBindings.get(occurrence);
    if (previous !== undefined) return previous;
    const original = selectTsonicMemoryFieldBindingFacts(ast, sourceFacts, occurrence);
    if (original === undefined) return none;
    if (original.kind === "rejected") return unavailable(occurrence, original.reason);
    const fact = original.operation;
    const origins = sources(fact.call);
    const owner = origins?.owner === undefined ? undefined : source(origins.owner);
    const pointee = origins === undefined ? undefined : source(origins.source);
    if (owner === undefined || pointee === undefined)
      return unavailable(occurrence, "A memory field binding requires its original owner and pointee binding components.");
    assertNode(fact.fieldExpression); assertNode(fact.pointerExpression);
    const result = available<SourceInputMemoryFieldBinding>(Object.freeze({ occurrence,
      application: pointee.application, owner, pointee, fieldExpression: fact.fieldExpression,
      field: fieldIdentity(fact.field), pointerExpression: fact.pointerExpression }));
    capturedFieldBindings.set(occurrence, result);
    return result;
  };
  const recordBinding: SourceInputMemoryQueries["recordBinding"] = occurrence => {
    assertNode(occurrence);
    const previous = capturedRecordBindings.get(occurrence);
    if (previous !== undefined) return previous;
    const original = selectTsonicMemoryRecordBindingFacts(ast, sourceFacts, occurrence);
    if (original === undefined) return none;
    if (original.kind === "rejected") return unavailable(occurrence, original.reason);
    const fact = original.operation;
    const origins = sources(fact.call);
    const selected = origins === undefined ? undefined : source(origins.source);
    if (selected === undefined) return unavailable(occurrence, "A memory record binding requires its original selected source component.");
    assertNode(fact.layoutExpression);
    const result = available<SourceInputMemoryRecordBinding>(Object.freeze({ occurrence,
      application: selected.application, source: selected, layoutExpression: fact.layoutExpression,
      layout: layoutIdentity(fact.layout), fields: Object.freeze(fact.fields.map(entry => {
        assertNode(entry.expression); assertNode(entry.binding.call);
        return Object.freeze({ expression: entry.expression, binding: entry.binding.call });
      })) }));
    capturedRecordBindings.set(occurrence, result);
    return result;
  };
  const observation: SourceInputMemoryQueries["observation"] = occurrence => {
    assertNode(occurrence);
    const previous = capturedObservations.get(occurrence);
    if (previous !== undefined) return available(previous);
    const query = readTsonicMemoryLayoutQuery(sourceFacts, occurrence);
    if (query === undefined) return none;
    if (query.call !== occurrence) throw new Error("A layout observation retains its exact original query occurrence.");
    assertNode(query.layoutExpression);
    const finalized = readTsonicMemoryLayout(sourceFacts, query.layoutExpression);
    if (finalized === undefined || !isFinalizedMemoryLayoutFacts(sourceFacts, finalized))
      return unavailable(occurrence, "A layout observation requires its exact finalized original descriptor.");
    const origins = sources(occurrence);
    const component = origins === undefined ? undefined : source(origins.source);
    if (component === undefined)
      return unavailable(occurrence, "A layout observation requires its genuine original application and source component.");
    const base = { occurrence, source: component, layoutExpression: query.layoutExpression, layout: layoutIdentity(finalized) };
    let result: SourceInputMemoryObservation;
    if (query.operation === "field-offset") {
      const selector = ast.arguments(occurrence)[1];
      const file = ast.getSourceFile(occurrence);
      if (selector === undefined || file === undefined)
        return unavailable(occurrence, "A field observation requires its original selected field argument.");
      const selected = selectInlineSourceMember(selector, checked.getSourceFileQueries(file));
      if (selected.kind !== "selected" || selected.selectedDeclaration !== query.selectedFieldDeclaration ||
        selected.selectedDeclarations.length === 0 || selected.selectedDeclaration !== undefined &&
          !selected.selectedDeclarations.includes(selected.selectedDeclaration))
        return unavailable(occurrence, "A field observation requires its complete original selected declaration group.");
      assertNode(selector); assertNode(selected.expression);
      selected.selectedDeclarations.forEach(assertNode);
      result = Object.freeze({ ...base, operation: "field-offset", selector, selection: selected.expression,
        primary: selected.selectedDeclaration === undefined ? none : present(selected.selectedDeclaration),
        selectedDeclarations: Object.freeze([...selected.selectedDeclarations]) });
    } else result = Object.freeze({ ...base, operation: query.operation });
    capturedObservations.set(occurrence, result);
    return available(result);
  };
  const compileTimeUse: SourceInputMemoryQueries["compileTimeUse"] = occurrence => {
    assertNode(occurrence);
    const ownLayout = readTsonicMemoryLayout(sourceFacts, occurrence);
    const ownField = readTsonicMemoryFieldLayout(sourceFacts, occurrence);
    if (ownLayout?.call === occurrence || ownField?.call === occurrence)
      return present(Object.freeze({ operation: occurrence, operand: occurrence, role: "descriptor" }));
    const parent = ast.parent(occurrence);
    if (parent === undefined || !ast.is.IsCallExpression(parent)) return none;
    assertNode(parent);
    const query = readTsonicMemoryLayoutQuery(sourceFacts, parent);
    if (query?.call === parent && ast.arguments(parent).includes(occurrence))
      return present(Object.freeze({ operation: parent, operand: occurrence,
        role: occurrence === query.layoutExpression ? "descriptor" : "selector" }));
    const boundField = sourceFacts.getFact(parent, tsonicMemoryFieldBindingFactKey);
    if (boundField?.call === parent && boundField.fieldExpression === occurrence)
      return present(Object.freeze({ operation: parent, operand: occurrence, role: "field-layout" }));
    const record = sourceFacts.getFact(parent, tsonicMemoryRecordBindingFactKey);
    if (record?.call === parent && record.layoutExpression === occurrence)
      return present(Object.freeze({ operation: parent, operand: occurrence, role: "record-layout" }));
    const raw = readTsonicRawMemoryOperation(sourceFacts, parent);
    if (raw?.call !== parent) return none;
    if (raw.operation === "reinterpret" || raw.operation === "to-raw")
      return raw.layoutExpression === occurrence
        ? present(Object.freeze({ operation: parent, operand: occurrence, role: "raw-layout" })) : none;
    return raw.dataLayoutExpression === occurrence
      ? present(Object.freeze({ operation: parent, operand: occurrence, role: "data-layout" })) : none;
  };
  const memory: SourceInputMemoryQueries = Object.freeze({ observation, metadata, layout, field, fieldBinding, recordBinding, compileTimeUse });
  return Object.freeze({ memory });
}
