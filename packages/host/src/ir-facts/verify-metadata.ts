import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { admitArtifactIdentity, admitStorageIdentity, recordFinding } from "./verification.js";
import type { Violation } from "../diag/contract.js";
import type { DefId, MemoryFieldId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import { memberStorageData } from "../ir-types/index.js";
import type {
  FactsRule, FactsSite, FactsVerification, MemoryField, MemoryLayout, MetadataRule, VerifyMetadata,
} from "./contract.js";
import { collectStorageChecks, sameBindings, validIndex } from "./verify-relations.js";
import { metadataBindingInputs } from "./binding-inputs.js";
import { verifyFactBindings } from "./verify-bindings.js";

interface OccupiedField {
  readonly start: bigint;
  readonly end: bigint;
  readonly field: MemoryFieldId;
}

const aligned = (value: bigint): boolean => value > 0n && (value & (value - 1n)) === 0n;

const offsetOrder = (fields: readonly OccupiedField[], account: DataflowAccount): DataflowResult<readonly OccupiedField[]> => {
  let current = fields;
  for (let shift = 0n; shift < 64n; shift += 8n) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const buckets = new Map<number, OccupiedField[]>();
    for (const field of current) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      const index = Number((field.start >> shift) & 255n);
      const admission = chargeResultEntries(account, 2);
      if (admission !== null) return admission;
      const bucket = buckets.get(index);
      if (bucket === undefined) buckets.set(index, [field]); else bucket.push(field);
    }
    const next: OccupiedField[] = [];
    for (let index = 0; index < 256; index += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      const bucket = buckets.get(index);
      if (bucket !== undefined) for (const field of bucket) {
        const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (stop !== null) return stop;
        next.push(field);
      }
    }
    current = next;
  }
  return { kind: "complete", value: current };
};

export const verifyMetadata: VerifyMetadata = (metadata, context, account) => {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
  if (initial !== null) return initial;
  const identity = admitArtifactIdentity(metadata.key.bindings, account);
  if (identity !== null) return identity;
  const violations: Violation<MetadataRule, FactsSite>[] = [];
  const site: FactsSite = { kind: "metadata", metadata: metadata.key };
  const report = (rule: MetadataRule, text: string): DataflowStop | null =>
    recordFinding(account, violations, "last", rule, site, text);
  const memberViolations: Violation<FactsRule, FactsSite>[] = [];
  const finish = (): FactsVerification<MetadataRule> => {
    const bindings = verifyFactBindings(metadataBindingInputs(metadata), { kind: "metadata", metadata: metadata.key }, site, context, account);
    if (bindings.kind !== "complete") return bindings;
    for (const violation of bindings.violations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
      memberViolations.push(violation);
    }
    for (const violation of memberViolations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
      violations.push({ rule: violation.rule === "type-resolves" ? "type-resolves"
      : violation.rule === "bindings-complete" ? "bindings-complete" : "member-correspondence-exact", site, detail: violation.detail });
    }
    return { kind: "complete", violations };
  };
  if (!context.definitionExists(metadata.key.definition)) {
    { const stop = report("definition-resolves", "The metadata declaration must exist in the supplied definition inventory."); if (stop !== null) return stop; }
  }
  if (metadata.kind === "data-layout") {
    if (!context.nodeExists(metadata.occurrence)) {
      { const stop = report("occurrence-resolves", "The data-layout occurrence must retain its original qualified source identity."); if (stop !== null) return stop; }
    }
    const selected = context.metadataOf(metadata.key);
    const selectedIdentity = selected === null ? null : admitArtifactIdentity(selected.key.bindings, account);
    if (selectedIdentity !== null) return selectedIdentity;
    if (selected === null || selected.kind !== "data-layout" || selected.key.definition !== metadata.key.definition ||
      !sameBindings(selected.key.bindings, metadata.key.bindings) || selected.fingerprint !== metadata.fingerprint ||
      selected.byteOrder !== metadata.byteOrder || selected.addressWidth !== metadata.addressWidth) {
      { const stop = report("data-layout-reference-resolves", "The data-layout record must retain its selected ABI identity and descriptor."); if (stop !== null) return stop; }
    }
    return finish();
  }

  const layouts = metadata.layouts;
  const fields = metadata.fields;
  const canonical = context.metadataOf(metadata.key);
  const canonicalLayouts = canonical !== null && canonical.kind !== "data-layout" ? canonical.layouts : null;
  const canonicalFields = canonical !== null && canonical.kind !== "data-layout" ? canonical.fields : null;
  const canonicalIdentity = canonical === null ? null : admitArtifactIdentity(canonical.key.bindings, account);
  if (canonicalIdentity !== null) return canonicalIdentity;
  if (canonical === null || canonical.kind !== metadata.kind || canonical.key.definition !== metadata.key.definition ||
    !sameBindings(canonical.key.bindings, metadata.key.bindings)) {
    { const stop = report("cross-owner-qualified", "The metadata kind must belong to the same declaration and complete binding environment."); if (stop !== null) return stop; }
  }
  const layoutAt = (id: number): MemoryLayout | undefined => {
    const selected = validIndex(id, layouts.length) ? layouts[id] : undefined;
    return Object.is(selected?.id, id) ? selected : undefined;
  };
  const fieldAt = (id: number): MemoryField | undefined => {
    const selected = validIndex(id, fields.length) ? fields[id] : undefined;
    return Object.is(selected?.id, id) ? selected : undefined;
  };
  const dataLayouts = new Map<DefId, { readonly width: 32 | 64; readonly maximum: bigint } | null>();
  for (const [index, layout] of layouts.entries()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (layout.id !== index || !validIndex(layout.id, layouts.length)) { const stop = report("layout-id-dense", "Layout IDs must equal their dense arena positions."); if (stop !== null) return stop; }
    if (!validIndex(layout.source, context.types.terms.length) || context.types.terms[layout.source] === undefined) {
      { const stop = report("type-resolves", "A layout source type must exist in the supplied canonical type table."); if (stop !== null) return stop; }
    }
    if (!context.nodeExists(layout.occurrence)) {
      { const stop = report("occurrence-resolves", "Every layout occurrence must retain its original qualified source identity."); if (stop !== null) return stop; }
    }
    let abi = dataLayouts.get(layout.dataLayout);
    if (abi === undefined) {
      const selected = context.metadataOf({ definition: layout.dataLayout, bindings: { kind: "parametric" } });
      abi = selected !== null && selected.kind === "data-layout"
        ? { width: selected.addressWidth, maximum: (1n << BigInt(selected.addressWidth)) - 1n } : null;
      const growth = chargeResultEntries(account, 2);
      if (growth !== null) return growth;
      dataLayouts.set(layout.dataLayout, abi);
    }
    if (abi === null) {
      { const stop = report("data-layout-reference-resolves", "Every layout must name an actual finalized data-layout declaration."); if (stop !== null) return stop; }
    }
    if (layout.byteSize < 0n || abi !== null && layout.byteSize > abi.maximum) {
      { const stop = report("layout-size-exact", "The exact layout size must fit the selected ABI address domain."); if (stop !== null) return stop; }
    }
    if (!aligned(layout.byteAlignment) || abi !== null && layout.byteAlignment > abi.maximum) {
      { const stop = report("layout-alignment-valid", "Layout alignment must be an exact positive power of two in the selected ABI."); if (stop !== null) return stop; }
    }
    if (layout.stride < layout.byteSize || layout.stride < 0n ||
      layout.byteAlignment > 0n && layout.stride % layout.byteAlignment !== 0n ||
      abi !== null && layout.stride > abi.maximum) {
      { const stop = report("layout-stride-exact", "The exact stride must contain the value, preserve alignment and fit the selected ABI."); if (stop !== null) return stop; }
    }
    const captured = canonicalLayouts?.[index];
    if (canonicalLayouts !== null && (captured === undefined || !Object.is(captured.id, layout.id))) {
      { const stop = report("cross-owner-qualified", "A layout retains its actual finalized row and local identity in the selected metadata."); if (stop !== null) return stop; }
    }
    if (captured !== undefined && Object.is(captured.id, layout.id)) {
      if (captured.source !== layout.source || captured.dataLayout !== layout.dataLayout) {
        { const stop = report("cross-owner-qualified", "A layout cannot borrow another source type or ABI identity."); if (stop !== null) return stop; }
      }
      if (captured.byteSize !== layout.byteSize) { const stop = report("layout-size-exact", "Layout size must equal its finalized authored value."); if (stop !== null) return stop; }
      if (captured.byteAlignment !== layout.byteAlignment) {
        { const stop = report("layout-alignment-valid", "Layout alignment must equal its finalized authored value."); if (stop !== null) return stop; }
      }
      if (captured.stride !== layout.stride) { const stop = report("layout-stride-exact", "Layout stride must equal its finalized authored value."); if (stop !== null) return stop; }
      if (captured.kind !== layout.kind) {
        { const stop = report("layout-geometry-consistent", "A layout retains its actual finalized value or array shape."); if (stop !== null) return stop; }
      }
      let sameFields = true;
      if (captured.kind === "value" && layout.kind === "value") {
        sameFields = captured.fields.length === layout.fields.length;
        for (let position = 0; position < captured.fields.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
          const stop = chargeWork(account, 1);
          if (stop !== null) return stop;
          if (!Object.is(captured.fields[position], layout.fields[position])) sameFields = false;
        }
      }
      if (!sameFields) {
        { const stop = report("layout-fields-resolve", "A value layout retains its complete finalized physical field vector in authored order."); if (stop !== null) return stop; }
      }
    }
    if (layout.kind === "array") {
      const element = layoutAt(layout.element);
      if (element === undefined || layout.element >= layout.id) {
        { const stop = report("layout-element-precedes", "An array element must reference an existing earlier layout."); if (stop !== null) return stop; }
      }
      const source = context.types.terms[layout.source];
      if (layout.length < 0n || source === undefined || source.kind !== "fixed-array" ||
        source.extent.length !== layout.length || source.extent.runtimeBase !== layout.runtimeBase ||
        element !== undefined && source.element !== element.source) {
        { const stop = report("array-extent-exact", "An array retains its exact fixed extent, runtime base and selected element type."); if (stop !== null) return stop; }
      }
      if (element !== undefined) {
        const occupied = layout.length <= 0n ? 0n : (layout.length - 1n) * element.stride + element.byteSize;
        if (element.dataLayout !== layout.dataLayout) {
          { const stop = report("data-layout-reference-resolves", "An array and its selected element must retain the same ABI declaration."); if (stop !== null) return stop; }
        }
        if (occupied > layout.byteSize || layout.length > 0n &&
          (element.byteAlignment <= 0n || layout.byteAlignment % element.byteAlignment !== 0n)) {
          { const stop = report("layout-geometry-consistent", "Array size and alignment must contain every selected element at its exact stride."); if (stop !== null) return stop; }
        }
      }
    } else {
      const seen = new Set<MemoryFieldId>();
      const declarations = new Set<DefId>();
      const occupied: OccupiedField[] = [];
      for (const id of layout.fields) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
        const field = fieldAt(id);
        if (field === undefined || seen.has(id)) {
          { const stop = report("layout-fields-resolve", "A value layout must retain each selected physical field exactly once."); if (stop !== null) return stop; }
          continue;
        }
        const growth = chargeResultEntries(account, 1);
        if (growth !== null) return growth;
        seen.add(id);
        const child = layoutAt(field.layout);
        if (field.owner !== layout.source) {
          { const stop = report("cross-owner-qualified", "A physical field must retain its actual owner type."); if (stop !== null) return stop; }
        }
        if (child === undefined || child.id >= layout.id) {
          { const stop = report("layout-fields-resolve", "A physical field must name an existing earlier child layout."); if (stop !== null) return stop; }
          continue;
        }
        if (child.dataLayout !== layout.dataLayout) {
          { const stop = report("data-layout-reference-resolves", "A physical field cannot select a child from a different ABI declaration."); if (stop !== null) return stop; }
        }
        if (field.member.primary !== null) {
          if (declarations.has(field.member.primary)) {
            { const stop = report("layout-geometry-consistent", "A layout cannot repeat the same selected physical declaration."); if (stop !== null) return stop; }
          }
          const growth = chargeResultEntries(account, 1);
          if (growth !== null) return growth;
          declarations.add(field.member.primary);
        }
        if (field.byteOffset < 0n || child.byteSize < 0n || field.byteOffset > layout.byteSize - child.byteSize ||
          field.byteAlignment <= 0n || field.byteAlignment > layout.byteAlignment ||
          layout.byteAlignment % field.byteAlignment !== 0n) {
          { const stop = report("layout-geometry-consistent", "A field extent and selected alignment must fit the containing layout."); if (stop !== null) return stop; }
        }
        if (child.byteSize > 0n && field.byteOffset >= 0n && field.byteOffset < (1n << 64n)) {
          const growth = chargeResultEntries(account, 2);
          if (growth !== null) return growth;
          occupied.push({ start: field.byteOffset, end: field.byteOffset + child.byteSize, field: field.id });
        }
      }
      let previousEnd = 0n;
      const ordered = offsetOrder(occupied, account);
      if (ordered.kind !== "complete") return ordered;
      for (const interval of ordered.value) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
        if (interval.start < previousEnd) {
          { const stop = report("layout-geometry-consistent", "Distinct nonempty physical fields must not overlap."); if (stop !== null) return stop; }
        }
        if (interval.end > previousEnd) previousEnd = interval.end;
      }
    }
  }

  for (const [index, field] of fields.entries()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (field.id !== index || !validIndex(field.id, fields.length)) { const stop = report("field-id-dense", "Memory-field IDs must equal their dense arena positions."); if (stop !== null) return stop; }
    if (!validIndex(field.owner, context.types.terms.length) || context.types.terms[field.owner] === undefined ||
      !validIndex(field.value, context.types.terms.length) || context.types.terms[field.value] === undefined) {
      { const stop = report("type-resolves", "A field owner and value must resolve in the supplied canonical type table."); if (stop !== null) return stop; }
    }
    if (!context.nodeExists(field.occurrence) || !context.nodeExists(field.selector) || !context.nodeExists(field.selection)) {
      { const stop = report("occurrence-resolves", "A field retains its actual authored occurrence, selector and selection."); if (stop !== null) return stop; }
    }
    if (field.byteOffset < 0n) { const stop = report("field-offset-exact", "A field offset must be an exact nonnegative integer."); if (stop !== null) return stop; }
    if (!aligned(field.byteAlignment) || field.byteAlignment > 0n && field.byteOffset % field.byteAlignment !== 0n) {
      { const stop = report("field-alignment-valid", "A field offset must preserve its selected positive power-of-two alignment."); if (stop !== null) return stop; }
    }
    const child = layoutAt(field.layout);
    if (child === undefined) { const stop = report("layout-fields-resolve", "Every field must reference an existing selected child layout."); if (stop !== null) return stop; }
    else if (child.source !== field.value) {
      { const stop = report("member-correspondence-exact", "A field's value type must equal its selected child layout source type."); if (stop !== null) return stop; }
    }
    const checks = collectStorageChecks(field.member, site, context, memberViolations, account);
    if (checks !== null) return checks;
    const identity = admitStorageIdentity(field.member, account)
      ?? (canonicalFields?.[index] === undefined ? null : admitStorageIdentity(canonicalFields[index].member, account));
    if (identity !== null) return identity;
    let primaryPresent = field.member.primary === null;
    let previous: DefId | undefined;
    for (const declaration of field.member.selectedDeclarations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      if (declaration === field.member.primary) primaryPresent = true;
      if (previous !== undefined && previous >= declaration) {
        { const stop = report("selected-declarations-order", "Selected field declarations must be distinct and ordered by identity."); if (stop !== null) return stop; }
      }
      if (!context.definitionExists(declaration)) {
        { const stop = report("definition-resolves", "A selected physical declaration must exist in the supplied definition inventory."); if (stop !== null) return stop; }
      }
      previous = declaration;
    }
    const captured = canonicalFields?.[index];
    if (canonicalFields !== null && (captured === undefined || !Object.is(captured.id, field.id))) {
      { const stop = report("cross-owner-qualified", "A field retains its actual finalized row and local identity in the selected metadata."); if (stop !== null) return stop; }
    }
    if (!primaryPresent ||
      captured !== undefined && Object.is(captured.id, field.id) && encodeKey(memberStorageData(captured.member)) !== encodeKey(memberStorageData(field.member))) {
      { const stop = report("member-correspondence-exact", "A field retains its complete selected member group, primary and value correspondence."); if (stop !== null) return stop; }
    }
    if (captured !== undefined && Object.is(captured.id, field.id)) {
      if (captured.owner !== field.owner || captured.value !== field.value || captured.layout !== field.layout) {
        { const stop = report("cross-owner-qualified", "A field cannot borrow another owner, value type or selected child layout."); if (stop !== null) return stop; }
      }
      if (captured.byteOffset !== field.byteOffset) { const stop = report("field-offset-exact", "A field offset must equal its finalized authored value."); if (stop !== null) return stop; }
      if (captured.byteAlignment !== field.byteAlignment) {
        { const stop = report("field-alignment-valid", "A field alignment must equal its finalized authored value."); if (stop !== null) return stop; }
      }
    }
  }
  if (metadata.kind === "memory-layout" ? layoutAt(metadata.root) === undefined : fieldAt(metadata.root) === undefined) {
    { const stop = report("root-resolves", "The metadata root must resolve in its own selected layout or field arena."); if (stop !== null) return stop; }
  }
  return finish();
};
