import type { MessageArgument, Violation } from "../diag/contract.js";
import type { DefId, MemoryFieldId } from "../ids/contract.js";
import type {
  FactsSite, MemoryField, MemoryLayout, MetadataRule, VerifyMetadata,
} from "./contract.js";
import { validIndex, verifyFactBindings } from "./verify-relations.js";

interface OccupiedField {
  readonly start: bigint;
  readonly end: bigint;
  readonly field: MemoryFieldId;
}

const aligned = (value: bigint): boolean => value > 0n && (value & (value - 1n)) === 0n;

const offsetOrder = (fields: readonly OccupiedField[]): readonly OccupiedField[] => {
  let current = fields;
  for (let shift = 0n; shift < 64n; shift += 8n) {
    const buckets: OccupiedField[][] = Array.from({ length: 256 }, () => []);
    for (const field of current) buckets[Number((field.start >> shift) & 255n)]?.push(field);
    const next: OccupiedField[] = [];
    for (const bucket of buckets) for (const field of bucket) next.push(field);
    current = next;
  }
  return current;
};

export const verifyMetadata: VerifyMetadata = (metadata, context) => {
  const violations: Violation<MetadataRule, FactsSite>[] = [];
  const site: FactsSite = { kind: "metadata", metadata: metadata.key };
  const report = (rule: MetadataRule, text: string): void => {
    const detail: MessageArgument = Object.freeze({ kind: "text", value: text });
    violations.push(Object.freeze({ rule, site, detail: Object.freeze([detail]) }));
  };
  if (!context.definitionExists(metadata.key.definition)) {
    report("definition-resolves", "The metadata declaration must exist in the supplied definition inventory.");
  }
  if (metadata.key.bindings.kind === "instantiated") {
    for (const violation of verifyFactBindings([
      { vector: metadata.key.bindings.bindings, definition: metadata.key.definition, site },
    ], context)) {
      violations.push({ rule: "bindings-complete", site, detail: violation.detail });
    }
  }
  if (metadata.kind === "data-layout") {
    if (!context.nodeExists(metadata.occurrence)) {
      report("occurrence-resolves", "The data-layout occurrence must retain its original qualified source identity.");
    }
    const selected = context.metadataOf(metadata.key);
    if (selected !== null && (selected.kind !== "data-layout" || selected.fingerprint !== metadata.fingerprint ||
      selected.byteOrder !== metadata.byteOrder || selected.addressWidth !== metadata.addressWidth)) {
      report("data-layout-reference-resolves", "The data-layout record must retain its selected ABI identity and descriptor.");
    }
    return Object.freeze(violations);
  }

  const layouts = metadata.layouts;
  const fields = metadata.fields;
  const canonical = context.metadataOf(metadata.key);
  const canonicalLayouts = canonical !== null && canonical.kind !== "data-layout" ? canonical.layouts : null;
  const canonicalFields = canonical !== null && canonical.kind !== "data-layout" ? canonical.fields : null;
  if (canonical !== null && canonical.kind !== metadata.kind) {
    report("cross-owner-qualified", "The metadata kind must belong to the same declaration and complete binding environment.");
  }
  const layoutAt = (id: number): MemoryLayout | undefined => {
    const selected = Number.isSafeInteger(id) && id >= 0 ? layouts[id] : undefined;
    return selected?.id === id ? selected : undefined;
  };
  const fieldAt = (id: number): MemoryField | undefined => {
    const selected = Number.isSafeInteger(id) && id >= 0 ? fields[id] : undefined;
    return selected?.id === id ? selected : undefined;
  };
  const dataLayouts = new Map<DefId, { readonly width: 32 | 64; readonly maximum: bigint } | null>();
  for (let index = 0; index < layouts.length; index += 1) {
    const layout = layouts[index];
    if (layout === undefined) continue;
    if (layout.id !== index) report("layout-id-dense", "Layout IDs must equal their dense arena positions.");
    if (!validIndex(layout.source, context.types.terms.length)) {
      report("type-resolves", "A layout source type must exist in the supplied canonical type table.");
    }
    if (!context.nodeExists(layout.occurrence)) {
      report("occurrence-resolves", "Every layout occurrence must retain its original qualified source identity.");
    }
    if (!dataLayouts.has(layout.dataLayout)) {
      const selected = context.metadataOf({ definition: layout.dataLayout, bindings: { kind: "parametric" } });
      dataLayouts.set(layout.dataLayout, selected !== null && selected.kind === "data-layout"
        ? { width: selected.addressWidth, maximum: (1n << BigInt(selected.addressWidth)) - 1n } : null);
    }
    const abi = dataLayouts.get(layout.dataLayout);
    if (abi === null || abi === undefined) {
      report("data-layout-reference-resolves", "Every layout must name an actual finalized data-layout declaration.");
    }
    if (layout.byteSize < 0n || abi !== null && abi !== undefined && layout.byteSize > abi.maximum) {
      report("layout-size-exact", "The exact layout size must fit the selected ABI address domain.");
    }
    if (!aligned(layout.byteAlignment) || abi !== null && abi !== undefined && layout.byteAlignment > abi.maximum) {
      report("layout-alignment-valid", "Layout alignment must be an exact positive power of two in the selected ABI.");
    }
    if (layout.stride < layout.byteSize || layout.stride < 0n ||
      layout.byteAlignment > 0n && layout.stride % layout.byteAlignment !== 0n ||
      abi !== null && abi !== undefined && layout.stride > abi.maximum) {
      report("layout-stride-exact", "The exact stride must contain the value, preserve alignment and fit the selected ABI.");
    }
    const captured = canonicalLayouts?.[index];
    if (captured !== undefined && captured.id === layout.id) {
      if (captured.source !== layout.source || captured.dataLayout !== layout.dataLayout) {
        report("cross-owner-qualified", "A layout cannot borrow another source type or ABI identity.");
      }
      if (captured.byteSize !== layout.byteSize) report("layout-size-exact", "Layout size must equal its finalized authored value.");
      if (captured.byteAlignment !== layout.byteAlignment) {
        report("layout-alignment-valid", "Layout alignment must equal its finalized authored value.");
      }
      if (captured.stride !== layout.stride) report("layout-stride-exact", "Layout stride must equal its finalized authored value.");
    }
    if (layout.kind === "array") {
      const element = layoutAt(layout.element);
      if (element === undefined || layout.element >= layout.id) {
        report("layout-element-precedes", "An array element must reference an existing earlier layout.");
      }
      const source = context.types.terms[layout.source];
      if (layout.length < 0n || source === undefined || source.kind !== "fixed-array" ||
        source.extent.length !== layout.length || source.extent.runtimeBase !== layout.runtimeBase ||
        element !== undefined && source.element !== element.source) {
        report("array-extent-exact", "An array retains its exact fixed extent, runtime base and selected element type.");
      }
      if (element !== undefined) {
        const occupied = layout.length <= 0n ? 0n : (layout.length - 1n) * element.stride + element.byteSize;
        if (element.dataLayout !== layout.dataLayout) {
          report("data-layout-reference-resolves", "An array and its selected element must retain the same ABI declaration.");
        }
        if (occupied > layout.byteSize || layout.length > 0n &&
          (element.byteAlignment <= 0n || layout.byteAlignment % element.byteAlignment !== 0n)) {
          report("layout-geometry-consistent", "Array size and alignment must contain every selected element at its exact stride.");
        }
      }
    } else {
      const seen = new Set<MemoryFieldId>();
      const declarations = new Set<DefId>();
      const occupied: OccupiedField[] = [];
      for (const id of layout.fields) {
        const field = fieldAt(id);
        if (field === undefined || seen.has(id)) {
          report("layout-fields-resolve", "A value layout must retain each selected physical field exactly once.");
          continue;
        }
        seen.add(id);
        const child = layoutAt(field.layout);
        if (field.owner !== layout.source) {
          report("cross-owner-qualified", "A physical field must retain its actual owner type.");
        }
        if (child === undefined || child.id >= layout.id) {
          report("layout-fields-resolve", "A physical field must name an existing earlier child layout.");
          continue;
        }
        if (child.dataLayout !== layout.dataLayout) {
          report("data-layout-reference-resolves", "A physical field cannot select a child from a different ABI declaration.");
        }
        if (field.primary !== null) {
          if (declarations.has(field.primary)) {
            report("layout-geometry-consistent", "A layout cannot repeat the same selected physical declaration.");
          }
          declarations.add(field.primary);
        }
        if (field.byteOffset < 0n || child.byteSize < 0n || field.byteOffset > layout.byteSize - child.byteSize ||
          field.byteAlignment <= 0n || field.byteAlignment > layout.byteAlignment ||
          layout.byteAlignment % field.byteAlignment !== 0n) {
          report("layout-geometry-consistent", "A field extent and selected alignment must fit the containing layout.");
        }
        if (child.byteSize > 0n && field.byteOffset >= 0n && field.byteOffset < (1n << 64n)) {
          occupied.push({ start: field.byteOffset, end: field.byteOffset + child.byteSize, field: field.id });
        }
      }
      let previousEnd = 0n;
      for (const interval of offsetOrder(occupied)) {
        if (interval.start < previousEnd) {
          report("layout-geometry-consistent", "Distinct nonempty physical fields must not overlap.");
        }
        if (interval.end > previousEnd) previousEnd = interval.end;
      }
    }
  }

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field === undefined) continue;
    if (field.id !== index) report("field-id-dense", "Memory-field IDs must equal their dense arena positions.");
    if (!validIndex(field.owner, context.types.terms.length) || !validIndex(field.value, context.types.terms.length)) {
      report("type-resolves", "A field owner and value must resolve in the supplied canonical type table.");
    }
    if (!context.nodeExists(field.occurrence) || !context.nodeExists(field.selector) || !context.nodeExists(field.selection)) {
      report("occurrence-resolves", "A field retains its actual authored occurrence, selector and selection.");
    }
    if (field.byteOffset < 0n) report("field-offset-exact", "A field offset must be an exact nonnegative integer.");
    if (!aligned(field.byteAlignment) || field.byteAlignment > 0n && field.byteOffset % field.byteAlignment !== 0n) {
      report("field-alignment-valid", "A field offset must preserve its selected positive power-of-two alignment.");
    }
    const child = layoutAt(field.layout);
    if (child === undefined) report("layout-fields-resolve", "Every field must reference an existing selected child layout.");
    else if (child.source !== field.value) {
      report("member-correspondence-exact", "A field's value type must equal its selected child layout source type.");
    }
    const selected = field.member.decision;
    let previous: DefId | undefined;
    for (const declaration of field.selectedDeclarations) {
      if (previous !== undefined && previous >= declaration) {
        report("selected-declarations-order", "Selected field declarations must be distinct and ordered by identity.");
      }
      if (!context.definitionExists(declaration)) {
        report("definition-resolves", "A selected physical declaration must exist in the supplied definition inventory.");
      }
      previous = declaration;
    }
    if (field.selectedDeclarations.length === 0 || selected.primary !== field.primary ||
      selected.selectedDeclarations.length !== field.selectedDeclarations.length ||
      selected.selectedDeclarations.some((declaration, position) => declaration !== field.selectedDeclarations[position]) ||
      field.primary !== null && !field.selectedDeclarations.includes(field.primary) ||
      selected.read !== field.value && selected.write !== field.value) {
      report("member-correspondence-exact", "A field retains its complete selected member group, primary and value correspondence.");
    }
    const captured = canonicalFields?.[index];
    if (captured !== undefined && captured.id === field.id) {
      if (captured.owner !== field.owner || captured.value !== field.value || captured.layout !== field.layout) {
        report("cross-owner-qualified", "A field cannot borrow another owner, value type or selected child layout.");
      }
      if (captured.byteOffset !== field.byteOffset) report("field-offset-exact", "A field offset must equal its finalized authored value.");
      if (captured.byteAlignment !== field.byteAlignment) {
        report("field-alignment-valid", "A field alignment must equal its finalized authored value.");
      }
    }
  }
  if (metadata.kind === "memory-layout" ? layoutAt(metadata.root) === undefined : fieldAt(metadata.root) === undefined) {
    report("root-resolves", "The metadata root must resolve in its own selected layout or field arena.");
  }
  return Object.freeze(violations);
};
