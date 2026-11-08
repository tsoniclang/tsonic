import type { Node } from "@tsonic/tsts";
import type { SourceInputMemberUseSelection } from "../host-input/member-input.js";
import type { SourceIndexSelection } from "../source-model/member-use.js";
import type { SourceDescriptorView, SourceMemberOrigin, SourcePresence, SourceRefusal, SourceResult, SourceTypeEvidence,
  SourceUseDestination, SourceValueOperand } from "../public/source/contracts.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceMemberInventoryQueries, SourceMemberInventoryRow } from "./member-inventory.js";
import type { SourceCorrespondenceMember, SourceMemberCorrespondenceProduction } from "./member-correspondence.js";

export interface SourcePropertyUseArm {
  readonly kind: "member";
  readonly receiver: SourceTypeEvidence;
  readonly origins: readonly SourceMemberOrigin[];
  readonly readOrigins: readonly SourceMemberOrigin[];
  readonly writeOrigins: readonly SourceMemberOrigin[];
  readonly declarations: readonly Node[];
  readonly readDeclarations: readonly Node[];
  readonly writeDeclarations: readonly Node[];
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly writeDestination: SourceUseDestination | undefined;
}

export interface SourceIndexUseArm {
  readonly kind: "index";
  readonly receiver: SourceTypeEvidence;
  readonly selection: SourceIndexSelection;
  readonly key: SourceTypeEvidence;
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly readonly: boolean;
}

export type SourceMemberUseArm = SourcePropertyUseArm | SourceIndexUseArm;

export interface SourceMemberUse {
  readonly occurrence: Node;
  readonly receiver: { readonly occurrence: Node; readonly value: SourceTypeEvidence };
  readonly key: SourcePresence<SourceValueOperand>;
  readonly access: "read" | "write" | "read-write" | "delete";
  readonly callCallee: boolean;
  readonly optionalChain: boolean;
  readonly chainContinuation: boolean;
  readonly selectedDeclaration: SourcePresence<Node>;
  readonly selectedDeclarations: readonly Node[];
  readonly readDeclarations: readonly Node[];
  readonly writeDeclarations: readonly Node[];
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly arms: readonly SourceMemberUseArm[];
}

export interface SourceObjectProduction extends SourceMemberCorrespondenceProduction {
  use(occurrence: Node): SourceProductionResult<SourceMemberUse>;
}

export interface SourceMemberUseProduction {
  use(occurrence: Node): SourceProductionResult<SourceMemberUse>;
  place(occurrence: Node): SourceProductionResult<SourceMemberUse>;
}

export function createSourceMemberUseQueries(input: {
  readonly view: SourceDescriptorView;
  readonly inventory: SourceMemberInventoryQueries;
  readonly assertNode: (node: Node) => void;
  readonly select: (occurrence: Node) => SourceInputMemberUseSelection;
  readonly value: (occurrence: Node) => SourceProductionResult<SourceTypeEvidence>;
  readonly compose: (occurrence: Node, receiver: SourceTypeEvidence, purpose: "read" | "write",
    values: readonly SourceTypeEvidence[], optionalChain: boolean) => SourceProductionResult<SourceTypeEvidence>;
  readonly destination: (occurrence: Node, receiver: SourceTypeEvidence,
    member: SourceCorrespondenceMember) => SourceProductionResult<SourceUseDestination>;
  readonly unavailable: (occurrence: Node,
    reason: Extract<SourceInputMemberUseSelection, { readonly kind: "unavailable" }>["reason"]) => SourceRefusal;
}): SourceMemberUseProduction {
  const { view, inventory, assertNode, select, value, compose, destination, unavailable } = input;
  const retained = { use: new WeakMap<Node, SourceResult<SourceMemberUse>>(), place: new WeakMap<Node, SourceResult<SourceMemberUse>>() };
  const resolved = <Value>(selected: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value: selected });
  const optionalEvidence = (produce: () => SourceProductionResult<SourcePresence<SourceTypeEvidence>>):
    SourceProductionResult<SourceTypeEvidence | undefined> => {
    const selected = produce();
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "none") return resolved(undefined);
    view.assertEvidence(selected.value.value);
    return resolved(selected.value.value);
  };
  const memberTypes = (row: SourceMemberInventoryRow, reads: boolean, writes: boolean) => {
    const read = reads ? optionalEvidence(() => row.readType()) : resolved(undefined);
    if (read.kind !== "resolved") return read;
    const write = writes ? optionalEvidence(() => row.writeType()) : resolved(undefined);
    return write.kind !== "resolved" ? write : resolved({ readType: read.value, writeType: write.value });
  };
  const build = (occurrence: Node, purpose: "use" | "place"): SourceProductionResult<SourceMemberUse> => {
    const original = select(occurrence);
    if (original.kind === "unavailable") return unavailable(occurrence, original.reason);
    if (original.occurrence !== occurrence) throw new Error("A selected member use requires its exact original occurrence.");
    assertNode(original.receiver.occurrence);
    if (original.selectedDeclaration !== undefined) {
      assertNode(original.selectedDeclaration);
      if (!original.selectedDeclarations.includes(original.selectedDeclaration))
        throw new Error("A selected member declaration must belong to the complete original member-use inventory.");
    }
    const receiver = value(original.receiver.occurrence);
    if (receiver.kind !== "resolved") return receiver;
    view.assertEvidence(receiver.value);
    let key: SourcePresence<SourceValueOperand> = Object.freeze({ kind: "none" });
    if (original.key !== undefined) {
      assertNode(original.key);
      const selected = value(original.key);
      if (selected.kind !== "resolved") return selected;
      view.assertEvidence(selected.value);
      key = Object.freeze({ kind: "present", value: Object.freeze({ occurrence: original.key, value: selected.value }) });
    }
    const reads = purpose === "place" || original.access === "read" || original.access === "read-write";
    const writes = purpose === "place" || original.access === "write" || original.access === "read-write";
    const chain = original.optionalChain || original.chainContinuation;
    const arms: SourceMemberUseArm[] = [];
    const readTypes: SourceTypeEvidence[] = [];
    const writeTypes: SourceTypeEvidence[] = [];
    for (const arm of receiver.value.sum?.arms ?? [receiver.value]) {
      view.assertEvidence(arm);
      if (arm.type.kind === "intrinsic" && arm.type.intrinsic === "absence" && chain) continue;
      if (arm.type.kind === "intrinsic" && arm.type.intrinsic === "any" && original.arms.length === 0) continue;
      const selected = inventory.members(arm);
      if (selected.kind !== "resolved") return selected;
      if (selected.value.kind !== "complete") return unavailable(occurrence, "missing-selected-member");
      const properties = selected.value.members.filter(row => row.declarations.some(declaration => original.selectedDeclarations.includes(declaration)));
      if (properties.length > 1) return unavailable(occurrence, "inconsistent-original-origins");
      if (properties.length === 1) {
        const row = properties[0]!;
        for (const declaration of row.declarations) assertNode(declaration);
        const types = memberTypes(row, reads, writes);
        if (types.kind !== "resolved") return types;
        const member: SourceCorrespondenceMember = Object.freeze({ receiver: arm, key: row.key, name: row.name,
          declarations: row.declarations, origins: row.origins, readOrigins: row.readOrigins, writeOrigins: row.writeOrigins,
          getters: row.getters, setters: row.setters, read: row.read, optional: row.optional, readonly: row.readonly,
          readType: types.value.readType, writeType: types.value.writeType });
        let writeDestination: SourceUseDestination | undefined;
        if (types.value.writeType !== undefined && purpose === "use") {
          const selectedDestination = destination(occurrence, arm, member);
          if (selectedDestination.kind !== "resolved") return selectedDestination;
          view.assertEvidence(selectedDestination.value.declaration.type);
          view.assertEvidence(selectedDestination.value.applied);
          if (selectedDestination.value.applied !== types.value.writeType)
            throw new Error("A member write destination must retain its exact canonical applied write evidence.");
          writeDestination = selectedDestination.value;
        }
        if (types.value.writeType !== undefined) writeTypes.push(types.value.writeType);
        if (types.value.readType !== undefined) readTypes.push(types.value.readType);
        arms.push(Object.freeze({ kind: "member", receiver: arm, origins: row.origins, readOrigins: row.readOrigins,
          writeOrigins: row.writeOrigins, declarations: row.declarations,
          readDeclarations: Object.freeze(row.declarations.filter(declaration => original.readDeclarations.includes(declaration))),
          writeDeclarations: Object.freeze(row.declarations.filter(declaration => original.writeDeclarations.includes(declaration))),
          readType: types.value.readType, writeType: types.value.writeType, writeDestination }));
        continue;
      }
      if (key.kind !== "present") return unavailable(occurrence, "missing-selected-member");
      const selectedIndexes = original.arms.filter(item => item.kind === "index");
      const selections = selectedIndexes.map(item => item.selection).filter(item => {
        if (item.kind === "array-element") return arm.type.kind === "array";
        if (item.kind === "tuple-element") return arm.type.kind === "tuple";
        if (item.kind === "string-character") return arm.type.kind === "string";
        return selected.value.kind === "complete" && selected.value.indexes.some(index =>
          index.declarations.some(declaration => item.declarations.includes(declaration)));
      });
      if (selections.length === 0) return unavailable(occurrence, "missing-selected-member");
      const selection = selections[0]!;
      if (!selections.every(item => item.kind === selection.kind &&
        (item.kind !== "tuple-element" || selection.kind === "tuple-element" && item.index === selection.index) &&
        item.declarations.length === selection.declarations.length && item.declarations.every(declaration => selection.declarations.includes(declaration))))
        return unavailable(occurrence, "inconsistent-original-origins");
      let readType: SourceTypeEvidence | undefined;
      let writeType: SourceTypeEvidence | undefined;
      let readonly: boolean;
      if (selection.kind === "array-element" || selection.kind === "tuple-element") {
        const element = view.component(arm, selection.kind === "tuple-element"
          ? { kind: "tuple-element", index: selection.index } : { kind: "array-element" });
        if (element.kind === "refused") return element;
        readonly = arm.type.kind === "array" || arm.type.kind === "tuple" ? arm.type.readonly : true;
        readType = reads ? element.value : undefined;
        writeType = writes && !readonly ? element.value : undefined;
      } else {
        const indexes = selected.value.indexes.filter(index => index.declarations.some(declaration => selection.declarations.includes(declaration)));
        if (indexes.length !== 1) return unavailable(occurrence, "inconsistent-original-origins");
        const index = indexes[0]!;
        const read = reads ? optionalEvidence(() => index.readType()) : resolved(undefined);
        if (read.kind !== "resolved") return read;
        const write = writes ? optionalEvidence(() => index.writeType()) : resolved(undefined);
        if (write.kind !== "resolved") return write;
        readType = read.value;
        writeType = write.value;
        readonly = index.readonly;
      }
      if (readType !== undefined) readTypes.push(readType);
      if (writeType !== undefined) writeTypes.push(writeType);
      arms.push(Object.freeze({ kind: "index", receiver: arm, selection, key: key.value.value, readType, writeType, readonly }));
    }
    const read = reads && (purpose === "use" || readTypes.length === arms.length)
      ? compose(occurrence, receiver.value, "read", Object.freeze(readTypes), chain) : resolved(undefined);
    if (read.kind !== "resolved") return read;
    const write = writes && (purpose === "use" || writeTypes.length === arms.length)
      ? compose(occurrence, receiver.value, "write", Object.freeze(writeTypes), chain) : resolved(undefined);
    if (write.kind !== "resolved") return write;
    if (read.value !== undefined) view.assertEvidence(read.value);
    if (write.value !== undefined) view.assertEvidence(write.value);
    return resolved(Object.freeze({ occurrence, receiver: Object.freeze({ occurrence: original.receiver.occurrence, value: receiver.value }),
      key, access: original.access, callCallee: original.callCallee, optionalChain: original.optionalChain,
      chainContinuation: original.chainContinuation,
      selectedDeclaration: original.selectedDeclaration === undefined ? Object.freeze({ kind: "none" })
        : Object.freeze({ kind: "present", value: original.selectedDeclaration }),
      selectedDeclarations: original.selectedDeclarations, readDeclarations: original.readDeclarations,
      writeDeclarations: original.writeDeclarations, readType: read.value, writeType: write.value, arms: Object.freeze(arms) }));
  };
  const query = (occurrence: Node, purpose: "use" | "place"): SourceProductionResult<SourceMemberUse> => {
    assertNode(occurrence);
    const cache = retained[purpose];
    const existing = cache.get(occurrence);
    if (existing !== undefined) return existing;
    const selected = build(occurrence, purpose);
    if (selected.kind !== "pending") cache.set(occurrence, selected);
    return selected;
  };
  return Object.freeze({ use: (occurrence: Node) => query(occurrence, "use"),
    place: (occurrence: Node) => query(occurrence, "place") });
}
