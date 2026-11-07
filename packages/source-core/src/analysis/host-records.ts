// Host records of the source-core memory and pointer facts (I1, I2; K-2662). The Legacy extension publishes check-time
// witnesses (selected operand nodes, ABI identities, exact dimensions and the memory type identity proof). This module
// translates each witness into one checker-free record: operand nodes keep their role, every type is a Host descriptor
// (`facts.values.type` for operands, `facts.instantiations.at(call)` for the selected marker type arguments), and every
// value is exact. Targets read only these records, through `facts.analyses.extension(tsonicCoreAnalysisKey)`.
//
// A Host refusal of an operand or instantiation makes the record `rejected` with the refusal message (the refusal itself
// is reported by the Host). A generic marker call without a published instantiation is a missing Host fact for a
// supported form: an invariant failure, never a retry.
import type { Node } from "@tsonic/tsts";
import { failTargetAnalysisInvariant } from "@tsonic/target-api/artifacts";
import type { HostSourceProgram } from "@tsonic/target-api/host";
import type { SourceTypeDescriptor } from "@tsonic/target-api/source";
import type { TsonicAddressIntegerDomain } from "../pointers/raw-memory/facts.js";
import type { TsonicDataLayoutFact, TsonicMemoryFieldLayoutFact, TsonicMemoryLayoutFact } from "../memory-layout/facts.js";
import { readTsonicDataLayout, readTsonicKeepAlive, readTsonicRawMemoryOperation, resolveTsonicMemoryLayoutObservation } from "../memory-layout/readers.js";
import { selectTsonicRawLocationOperation } from "../pointers/raw-memory/selection.js";
import { selectTsonicPointerView } from "../pointers/views/selection.js";
import { tsonicNativePointerOperationFactKey, type TsonicNativePointerOperationFact } from "../pointers/facts.js";
import { selectTsonicMemoryFieldBinding, selectTsonicMemoryRecordBinding } from "../memory-layout/bindings/selection.js";
import type { TsonicMemoryFieldBindingFact } from "../memory-layout/bindings/facts.js";

/** A record whose witness or Host facts do not prove the operation; `reason` names what is missing. */
export interface TsonicRejectedRecord {
  readonly kind: "rejected";
  readonly reason: string;
}

/** One operand of a memory or pointer operation in its role, with its Host descriptor. */
export interface TsonicTypedOperand {
  readonly expression: Node;
  readonly type: SourceTypeDescriptor;
}

// ---- memory layouts ---------------------------------------------------------------------------------------------------

/** FixedArray<T, N> of an array layout: the Host element descriptor, its authored node and the exact extent. */
export interface TsonicMemoryFixedArrayRecord {
  readonly element: SourceTypeDescriptor;
  readonly elementTypeNode?: Node;
  readonly length: bigint;
  readonly lengthRuntimeBase: "number" | "bigint";
}

export interface TsonicMemoryFieldRecord {
  readonly call: Node;
  readonly selector: Node;
  /** The selected field declaration. */
  readonly declaration: Node;
  /** T of memoryfield<T, TField>: the record type that owns the field. */
  readonly owner: SourceTypeDescriptor;
  /** TField of memoryfield<T, TField>. */
  readonly type: SourceTypeDescriptor;
  readonly layoutExpression: Node;
  readonly layout: TsonicMemoryLayoutRecord;
  readonly byteOffset: bigint;
  readonly byteAlignment: bigint;
}

interface TsonicMemoryLayoutRecordBase {
  readonly call: Node;
  /** The laid-out type: T of the call's MemoryLayout<T> result. */
  readonly type: SourceTypeDescriptor;
  readonly explicitTypeNode?: Node;
  readonly dataLayoutExpression: Node;
  readonly dataLayout: TsonicDataLayoutFact;
  readonly byteSize: bigint;
  readonly byteAlignment: bigint;
  readonly stride: bigint;
}

export interface TsonicValueMemoryLayoutRecord extends TsonicMemoryLayoutRecordBase {
  readonly kind: "value";
  readonly fields: readonly TsonicMemoryFieldRecord[];
}

export interface TsonicArrayMemoryLayoutRecord extends TsonicMemoryLayoutRecordBase {
  readonly kind: "array";
  readonly fixedArray: TsonicMemoryFixedArrayRecord;
  readonly elementLayoutExpression: Node;
  readonly elementLayout: TsonicMemoryLayoutRecord;
}

export type TsonicMemoryLayoutRecord = TsonicValueMemoryLayoutRecord | TsonicArrayMemoryLayoutRecord;

// ---- raw memory -------------------------------------------------------------------------------------------------------

/** torawptr<T>(pointer, layout) and reinterpretrawptr<T>(raw, layout): a typed location crossing the raw boundary. */
export interface TsonicRawLocationRecord {
  readonly kind: "resolved";
  readonly call: Node;
  readonly operation: "to-raw" | "reinterpret";
  /** to-raw: the typed location; reinterpret: the raw address. */
  readonly operand: TsonicTypedOperand;
  /** T of the call. */
  readonly pointee: SourceTypeDescriptor;
  readonly explicitPointeeTypeNode?: Node;
  readonly layoutExpression: Node;
  readonly layout: TsonicMemoryLayoutRecord;
  /** The call's Host result: RawPointer (to-raw) or Pointer<T> (reinterpret). */
  readonly result: SourceTypeDescriptor;
}

/** A reinterpretation as a physical pointer backing origin. */
export type TsonicReinterpretRecord = TsonicRawLocationRecord & { readonly operation: "reinterpret" };

interface TsonicRawAddressRecordBase {
  readonly kind: "resolved";
  readonly call: Node;
  readonly dataLayoutExpression: Node;
  /** The finalized registered ABI of the operation. */
  readonly dataLayout: TsonicDataLayoutFact;
  readonly result: SourceTypeDescriptor;
}

export type TsonicRawAddressRecord = TsonicRawAddressRecordBase & (
  | {
      readonly operation: "byte-offset";
      readonly raw: TsonicTypedOperand;
      readonly offset: TsonicTypedOperand;
      readonly offsetRuntimeBase: "number" | "bigint";
      readonly offsetSignedness: "signed" | "unsigned";
      readonly offsetWidth: 8 | 16 | 32 | 64 | 128;
    }
  | (TsonicAddressIntegerDomain & { readonly operation: "raw-to-address-integer"; readonly raw: TsonicTypedOperand })
  | (TsonicAddressIntegerDomain & { readonly operation: "address-integer-to-raw"; readonly address: TsonicTypedOperand })
);

/** sizeof / alignof / strideof / fieldoffsetof over a finalized layout: the exact observed value. */
export interface TsonicLayoutObservationRecord {
  readonly kind: "resolved";
  readonly call: Node;
  readonly operation: "size" | "alignment" | "stride" | "field-offset";
  readonly layoutExpression: Node;
  readonly value: bigint;
}

export interface TsonicKeepAliveRecord {
  readonly call: Node;
  readonly value: TsonicTypedOperand;
}

/** A rejected raw address operation keeps its operation for the target diagnostic. */
export type TsonicRawAddressRejection = TsonicRejectedRecord & { readonly operation: TsonicRawAddressRecord["operation"] };

export interface TsonicMemoryFacts {
  rawLocation(call: Node): TsonicRawLocationRecord | TsonicRejectedRecord | undefined;
  rawAddress(call: Node): TsonicRawAddressRecord | TsonicRawAddressRejection | undefined;
  observation(call: Node): TsonicLayoutObservationRecord | TsonicRejectedRecord | undefined;
  keepAlive(call: Node): TsonicKeepAliveRecord | undefined;
}

// ---- memory bindings --------------------------------------------------------------------------------------------------

export interface TsonicMemoryFieldBindingRecord {
  readonly kind: "resolved";
  readonly call: Node;
  readonly fieldExpression: Node;
  readonly field: TsonicMemoryFieldRecord;
  readonly pointer: TsonicTypedOperand;
  /** T of bindmemoryfield<T, TField>. */
  readonly owner: SourceTypeDescriptor;
  /** TField of bindmemoryfield<T, TField>: the bound location's pointee. */
  readonly pointee: SourceTypeDescriptor;
}

export interface TsonicMemoryRecordBindingRecord {
  readonly kind: "resolved";
  readonly call: Node;
  /** T of bindmemoryrecord<T>. */
  readonly type: SourceTypeDescriptor;
  readonly layoutExpression: Node;
  readonly layout: TsonicValueMemoryLayoutRecord;
  readonly fields: readonly { readonly expression: Node; readonly binding: TsonicMemoryFieldBindingRecord }[];
}

export interface TsonicMemoryBindings {
  /** Rejected record bindings of the program, with the reason (reported as refusals by the target). */
  readonly issues: readonly { readonly node: Node; readonly reason: string }[];
  /** Whether one of the declarations is a field bound by a resolved record binding. */
  hasBoundField(declarations: readonly Node[]): boolean;
  field(call: Node): TsonicMemoryFieldBindingRecord | TsonicRejectedRecord | undefined;
  record(call: Node): TsonicMemoryRecordBindingRecord | TsonicRejectedRecord | undefined;
}

// ---- pointers ---------------------------------------------------------------------------------------------------------

/** viewptr<F, T>(pointer, read, write): a logical location over accessor callbacks. */
export interface TsonicPointerViewRecord {
  readonly kind: "resolved";
  readonly call: Node;
  /** F: the pointee of the base pointer. */
  readonly source: SourceTypeDescriptor;
  /** T: the pointee of the view. */
  readonly pointee: SourceTypeDescriptor;
  readonly explicitPointeeTypeNode?: Node;
  readonly pointer: TsonicTypedOperand;
  readonly read: TsonicTypedOperand;
  readonly write: TsonicTypedOperand;
  /** The selected overload admits an absent base pointer. */
  readonly optional: boolean;
  readonly result: SourceTypeDescriptor;
}

interface TsonicNativePointerRecordBase {
  readonly kind: "resolved";
  readonly call: Node;
  readonly pointer: TsonicTypedOperand;
  /** T of the native pointer operation. */
  readonly pointee: SourceTypeDescriptor;
  readonly explicitPointeeTypeNode?: Node;
  readonly result: SourceTypeDescriptor;
}

/** loadnativeptr / storenativeptr / offsetnativeptr. */
export type TsonicNativePointerRecord = TsonicNativePointerRecordBase & (
  | { readonly operation: "load" }
  | { readonly operation: "store"; readonly value: TsonicTypedOperand }
  | { readonly operation: "offset"; readonly offset: TsonicTypedOperand }
);

/** A rejected native pointer operation keeps its operation for the target diagnostic. */
export type TsonicNativePointerRejection = TsonicRejectedRecord & { readonly operation: TsonicNativePointerRecord["operation"] };

export interface TsonicPointerFacts {
  view(call: Node): TsonicPointerViewRecord | TsonicRejectedRecord | undefined;
  native(call: Node): TsonicNativePointerRecord | TsonicNativePointerRejection | undefined;
}

// ---- translation ------------------------------------------------------------------------------------------------------

type Outcome<T> = T | TsonicRejectedRecord;
const rejected = (reason: string): TsonicRejectedRecord => Object.freeze({ kind: "rejected", reason });
const isRejected = (value: unknown): value is TsonicRejectedRecord =>
  typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "rejected";

export interface TsonicHostRecords {
  readonly memory: TsonicMemoryFacts;
  readonly memoryBindings: TsonicMemoryBindings;
  readonly pointers: TsonicPointerFacts;
  /** A reinterpretation backing origin of the program (pointer backing and storage relations). */
  reinterpret(call: Node): TsonicReinterpretRecord | TsonicRejectedRecord | undefined;
}

/** The records of one Host program view. Every table lives in this closure (I5: per program, no module state). */
export function createTsonicHostRecords(source: HostSourceProgram): TsonicHostRecords {
  const { ast, facts, sourceFacts } = source;
  const layouts = new Map<TsonicMemoryLayoutFact, Outcome<TsonicMemoryLayoutRecord>>();
  const fields = new Map<TsonicMemoryFieldLayoutFact, Outcome<TsonicMemoryFieldRecord>>();
  const rawLocations = new Map<Node, Outcome<TsonicRawLocationRecord> | undefined>();
  const fieldBindings = new Map<Node, Outcome<TsonicMemoryFieldBindingRecord> | undefined>();
  const recordBindings = new Map<Node, Outcome<TsonicMemoryRecordBindingRecord> | undefined>();
  const views = new Map<Node, Outcome<TsonicPointerViewRecord> | undefined>();
  const natives = new Map<Node, TsonicNativePointerRecord | TsonicNativePointerRejection | undefined>();
  const rawAddresses = new Map<Node, TsonicRawAddressRecord | TsonicRawAddressRejection | undefined>();

  const memo = <K, V>(table: Map<K, V>, key: K, compute: () => V): V => {
    if (table.has(key)) return table.get(key) as V;
    const value = compute();
    table.set(key, value);
    return value;
  };

  function operand(expression: Node): Outcome<TsonicTypedOperand> {
    const outcome = facts.values.type(expression);
    return outcome.kind === "refused" ? rejected(outcome.reason) : Object.freeze({ expression, type: outcome.type });
  }

  function valueType(node: Node): Outcome<SourceTypeDescriptor> {
    const outcome = facts.values.type(node);
    return outcome.kind === "refused" ? rejected(outcome.reason) : outcome.type;
  }

  /** The selected marker type arguments of a generic source-core call (signature binders in declaration order). */
  function typeArguments(call: Node, count: number): Outcome<readonly SourceTypeDescriptor[]> {
    const instantiation = facts.instantiations.at(call);
    if (instantiation === undefined) return failTargetAnalysisInvariant("tsonic",
      "A generic source-core memory or pointer call has no published Host instantiation.", call);
    if (instantiation.kind === "refused") return rejected(instantiation.message);
    if (instantiation.method.length < count) return failTargetAnalysisInvariant("tsonic",
      `A source-core memory or pointer call publishes ${instantiation.method.length} of its ${count} type arguments.`, call);
    return instantiation.method.slice(0, count).map(argument => argument.type);
  }

  /** T of the call's MemoryLayout<T> result. */
  function laidOutType(call: Node): Outcome<SourceTypeDescriptor> {
    const result = valueType(call);
    if (isRejected(result)) return result;
    const argument = result.kind === "declared" ? result.typeArguments[0] : undefined;
    return argument ?? failTargetAnalysisInvariant("tsonic",
      "A memory layout call has no MemoryLayout<T> Host result descriptor.", call);
  }

  function layout(fact: TsonicMemoryLayoutFact): Outcome<TsonicMemoryLayoutRecord> {
    return memo(layouts, fact, () => {
      // A recursive layout is refused by the Legacy snapshot; the provisional entry only guards re-entry.
      layouts.set(fact, rejected("A memory layout cannot contain itself."));
      const type = laidOutType(fact.call);
      if (isRejected(type)) return type;
      const base = {
        call: fact.call, type,
        ...(fact.explicitTypeNode === undefined ? {} : { explicitTypeNode: fact.explicitTypeNode }),
        dataLayoutExpression: fact.dataLayoutExpression, dataLayout: fact.dataLayout,
        byteSize: fact.byteSize, byteAlignment: fact.byteAlignment, stride: fact.stride,
      };
      if (fact.kind === "array") {
        const selected = typeArguments(fact.call, 1);
        if (isRejected(selected)) return selected;
        const element = layout(fact.elementLayout);
        if (isRejected(element)) return element;
        return Object.freeze({ ...base, kind: "array" as const,
          fixedArray: Object.freeze({ element: selected[0]!,
            ...(fact.fixedArray.elementType === undefined ? {} : { elementTypeNode: fact.fixedArray.elementType }),
            length: fact.fixedArray.length, lengthRuntimeBase: fact.fixedArray.lengthRuntimeBase }),
          elementLayoutExpression: fact.elementLayoutExpression, elementLayout: element });
      }
      const selectedFields: TsonicMemoryFieldRecord[] = [];
      for (const entry of fact.fields) {
        const selected = field(entry);
        if (isRejected(selected)) return selected;
        selectedFields.push(selected);
      }
      return Object.freeze({ ...base, kind: "value" as const, fields: Object.freeze(selectedFields) });
    });
  }

  function field(fact: TsonicMemoryFieldLayoutFact): Outcome<TsonicMemoryFieldRecord> {
    return memo(fields, fact, () => {
      const selected = typeArguments(fact.call, 2);
      if (isRejected(selected)) return selected;
      const child = layout(fact.fieldLayout);
      if (isRejected(child)) return child;
      return Object.freeze({ call: fact.call, selector: fact.selector, declaration: fact.selectedDeclaration,
        owner: selected[0]!, type: selected[1]!, layoutExpression: fact.fieldLayoutExpression, layout: child,
        byteOffset: fact.byteOffset, byteAlignment: fact.byteAlignment });
    });
  }

  function rawLocation(call: Node): Outcome<TsonicRawLocationRecord> | undefined {
    return memo(rawLocations, call, () => {
      const selected = selectTsonicRawLocationOperation(ast, sourceFacts, call);
      if (selected === undefined) return undefined;
      if (selected.kind === "rejected") return rejected(selected.reason);
      const { operation } = selected;
      const typed = operand(selected.expression);
      const pointee = typeArguments(call, 1);
      const record = layout(selected.layout);
      const result = valueType(call);
      if (isRejected(typed)) return typed;
      if (isRejected(pointee)) return pointee;
      if (isRejected(record)) return record;
      if (isRejected(result)) return result;
      return Object.freeze({ kind: "resolved" as const, call, operation: operation.operation, operand: typed, pointee: pointee[0]!,
        ...(operation.operation === "reinterpret" && operation.explicitPointeeTypeNode !== undefined
          ? { explicitPointeeTypeNode: operation.explicitPointeeTypeNode } : {}),
        layoutExpression: operation.layoutExpression, layout: record, result });
    });
  }

  function rawAddress(call: Node): TsonicRawAddressRecord | TsonicRawAddressRejection | undefined {
    return memo(rawAddresses, call, () => {
      const fact = readTsonicRawMemoryOperation(sourceFacts, call);
      if (fact?.operation !== "byte-offset" && fact?.operation !== "raw-to-address-integer" &&
        fact?.operation !== "address-integer-to-raw") return undefined;
      const selected = rawAddressRecord(call, fact);
      return isRejected(selected) ? Object.freeze({ ...selected, operation: fact.operation }) : selected;
    });
  }

  function rawAddressRecord(call: Node, fact: Extract<NonNullable<ReturnType<typeof readTsonicRawMemoryOperation>>,
    { readonly operation: TsonicRawAddressRecord["operation"] }>): Outcome<TsonicRawAddressRecord> {
    const operands = fact.operation === "byte-offset" ? [fact.rawExpression, fact.offsetExpression]
      : fact.operation === "raw-to-address-integer" ? [fact.rawExpression] : [fact.addressExpression];
    const arguments_ = ast.arguments(call);
    const dataLayout = readTsonicDataLayout(sourceFacts, fact.dataLayoutExpression);
    if (fact.call !== call || arguments_.length !== operands.length + 1 ||
      operands.some((expression, index) => expression !== arguments_[index]) ||
      arguments_[arguments_.length - 1] !== fact.dataLayoutExpression || dataLayout === undefined ||
      fact.operation !== "byte-offset" && fact.addressWidth !== dataLayout.addressWidth) {
      return rejected("Raw address arithmetic requires exact operand bindings and the finalized registered address ABI.");
    }
    const typed = operands.map(operand);
    const failed = typed.find(isRejected);
    if (failed !== undefined) return failed;
    const result = valueType(call);
    if (isRejected(result)) return result;
    const [first, second] = typed as readonly TsonicTypedOperand[];
    const base = { kind: "resolved" as const, call, dataLayoutExpression: fact.dataLayoutExpression, dataLayout, result };
    switch (fact.operation) {
      case "byte-offset":
        return Object.freeze({ ...base, operation: fact.operation, raw: first!, offset: second!,
          offsetRuntimeBase: fact.offsetRuntimeBase, offsetSignedness: fact.offsetSignedness, offsetWidth: fact.offsetWidth });
      case "raw-to-address-integer":
        return Object.freeze({ ...base, operation: fact.operation, raw: first!, addressWidth: fact.addressWidth,
          addressRuntimeBase: fact.addressRuntimeBase, addressSignedness: fact.addressSignedness } as TsonicRawAddressRecord);
      case "address-integer-to-raw":
        return Object.freeze({ ...base, operation: fact.operation, address: first!, addressWidth: fact.addressWidth,
          addressRuntimeBase: fact.addressRuntimeBase, addressSignedness: fact.addressSignedness } as TsonicRawAddressRecord);
    }
  }

  function observation(call: Node): Outcome<TsonicLayoutObservationRecord> | undefined {
    const selected = resolveTsonicMemoryLayoutObservation(sourceFacts, call);
    if (selected === undefined) return undefined;
    if (selected.kind === "rejected") return rejected(selected.reason);
    return Object.freeze({ kind: "resolved", call, operation: selected.query.operation,
      layoutExpression: selected.query.layoutExpression, value: selected.value });
  }

  function keepAlive(call: Node): TsonicKeepAliveRecord | undefined {
    const fact = readTsonicKeepAlive(sourceFacts, call);
    if (fact === undefined || fact.call !== call) return undefined;
    const value = operand(fact.valueExpression);
    // keepalive admits every value; a refused operand is reported by the Host and keeps no record.
    return isRejected(value) ? undefined : Object.freeze({ call, value });
  }

  function fieldBindingRecord(fact: TsonicMemoryFieldBindingFact): Outcome<TsonicMemoryFieldBindingRecord> {
    const selected = typeArguments(fact.call, 2);
    if (isRejected(selected)) return selected;
    const record = field(fact.field);
    if (isRejected(record)) return record;
    const pointer = operand(fact.pointerExpression);
    if (isRejected(pointer)) return pointer;
    return Object.freeze({ kind: "resolved", call: fact.call, fieldExpression: fact.fieldExpression, field: record,
      pointer, owner: selected[0]!, pointee: selected[1]! });
  }

  function fieldBinding(call: Node): Outcome<TsonicMemoryFieldBindingRecord> | undefined {
    return memo(fieldBindings, call, () => {
      const selected = selectTsonicMemoryFieldBinding(ast, sourceFacts, call);
      if (selected === undefined) return undefined;
      return selected.kind === "rejected" ? rejected(selected.reason) : fieldBindingRecord(selected.operation);
    });
  }

  function recordBinding(call: Node): Outcome<TsonicMemoryRecordBindingRecord> | undefined {
    return memo(recordBindings, call, () => {
      const selected = selectTsonicMemoryRecordBinding(ast, sourceFacts, call);
      if (selected === undefined) return undefined;
      if (selected.kind === "rejected") return rejected(selected.reason);
      const { operation } = selected;
      const type = typeArguments(call, 1);
      if (isRejected(type)) return type;
      const record = layout(operation.layout);
      if (isRejected(record)) return record;
      if (record.kind !== "value") return failTargetAnalysisInvariant("tsonic",
        "A record memory binding selected an array layout.", call);
      const entries: { readonly expression: Node; readonly binding: TsonicMemoryFieldBindingRecord }[] = [];
      for (const entry of operation.fields) {
        const binding = fieldBindingRecord(entry.binding);
        if (isRejected(binding)) return binding;
        entries.push(Object.freeze({ expression: entry.expression, binding }));
      }
      return Object.freeze({ kind: "resolved", call, type: type[0]!, layoutExpression: operation.layoutExpression,
        layout: record, fields: Object.freeze(entries) });
    });
  }

  let bindingIndex: TsonicMemoryBindings | undefined;
  function memoryBindings(): TsonicMemoryBindings {
    if (bindingIndex !== undefined) return bindingIndex;
    const bound = new Set<Node>();
    const issues: { readonly node: Node; readonly reason: string }[] = [];
    for (const file of source.sourceFiles) {
      if (ast.isDeclarationFile(file)) continue;
      const pending: Node[] = [file];
      while (pending.length !== 0) {
        const node = pending.pop()!;
        if (ast.is.IsCallExpression(node)) {
          const selected = recordBinding(node);
          if (selected?.kind === "rejected") issues.push(Object.freeze({ node, reason: selected.reason }));
          else if (selected !== undefined) for (const { binding } of selected.fields) bound.add(binding.field.declaration);
        }
        ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
      }
    }
    bindingIndex = Object.freeze({
      issues: Object.freeze(issues),
      hasBoundField: (declarations: readonly Node[]) => declarations.some(declaration => bound.has(declaration)),
      field: fieldBinding,
      record: recordBinding,
    });
    return bindingIndex;
  }

  function view(call: Node): Outcome<TsonicPointerViewRecord> | undefined {
    return memo(views, call, () => {
      const selected = selectTsonicPointerView(ast, sourceFacts, call);
      if (selected === undefined) return undefined;
      if (selected.kind === "rejected") return rejected(selected.reason);
      const fact = selected.operation;
      const types = typeArguments(call, 2);
      if (isRejected(types)) return types;
      const pointer = operand(fact.pointerExpression);
      const read = operand(fact.readExpression);
      const write = operand(fact.writeExpression);
      const result = valueType(call);
      for (const value of [pointer, read, write, result]) if (isRejected(value)) return value;
      return Object.freeze({ kind: "resolved" as const, call, source: types[0]!, pointee: types[1]!,
        ...(fact.explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode: fact.explicitPointeeTypeNode }),
        pointer: pointer as TsonicTypedOperand, read: read as TsonicTypedOperand, write: write as TsonicTypedOperand,
        optional: fact.optional, result: result as SourceTypeDescriptor });
    });
  }

  function native(call: Node): TsonicNativePointerRecord | TsonicNativePointerRejection | undefined {
    return memo(natives, call, () => {
      const fact = sourceFacts.getFact(call, tsonicNativePointerOperationFactKey);
      if (fact === undefined) return undefined;
      const selected = nativeRecord(call, fact);
      return isRejected(selected) ? Object.freeze({ ...selected, operation: fact.operation }) : selected;
    });
  }

  function nativeRecord(call: Node, fact: TsonicNativePointerOperationFact): Outcome<TsonicNativePointerRecord> {
    {
      const operands = [fact.pointerExpression, ...(fact.operation === "store" ? [fact.valueExpression]
        : fact.operation === "offset" ? [fact.offsetExpression] : [])];
      const arguments_ = ast.arguments(call);
      if (arguments_.length !== operands.length || operands.some((expression, index) => arguments_[index] !== expression)) {
        return rejected("A native pointer operation requires its exact selected operands.");
      }
      const types = typeArguments(call, 1);
      if (isRejected(types)) return types;
      const typed = operands.map(operand);
      const failed = typed.find(isRejected);
      if (failed !== undefined) return failed;
      const result = valueType(call);
      if (isRejected(result)) return result;
      const [pointer, second] = typed as readonly TsonicTypedOperand[];
      const base = { kind: "resolved" as const, call, pointer: pointer!, pointee: types[0]!,
        ...(fact.explicitPointeeTypeNode === undefined ? {} : { explicitPointeeTypeNode: fact.explicitPointeeTypeNode }), result };
      switch (fact.operation) {
        case "load": return Object.freeze({ ...base, operation: fact.operation });
        case "store": return Object.freeze({ ...base, operation: fact.operation, value: second! });
        case "offset": return Object.freeze({ ...base, operation: fact.operation, offset: second! });
      }
    }
  }

  function reinterpret(call: Node): TsonicReinterpretRecord | TsonicRejectedRecord | undefined {
    const selected = rawLocation(call);
    return selected === undefined || selected.kind === "rejected" ? selected
      : selected.operation === "reinterpret" ? selected as TsonicReinterpretRecord : undefined;
  }

  const memory: TsonicMemoryFacts = Object.freeze({
    rawLocation,
    rawAddress,
    observation,
    keepAlive,
  });
  return Object.freeze({
    memory,
    get memoryBindings() { return memoryBindings(); },
    pointers: Object.freeze({ view, native }),
    reinterpret,
  });
}

/** The number of distinct layout records reachable from `root`, or undefined when it exceeds `maximum` (a target budget). */
export function countTsonicMemoryLayoutRecordValues(root: TsonicMemoryLayoutRecord, maximum: number): number | undefined {
  if (!Number.isSafeInteger(maximum) || maximum < 1) return undefined;
  const counts = new Map<TsonicMemoryLayoutRecord, number | undefined>();
  function count(layout: TsonicMemoryLayoutRecord): number | undefined {
    if (counts.has(layout)) return counts.get(layout);
    counts.set(layout, undefined);
    let total = 1;
    const children = layout.kind === "array" ? [layout.elementLayout] : layout.fields.map(field => field.layout);
    for (const element of children) {
      const child = count(element);
      if (child === undefined || child > maximum - total) return undefined;
      total += child;
    }
    counts.set(layout, total);
    return total;
  }
  return count(root);
}
