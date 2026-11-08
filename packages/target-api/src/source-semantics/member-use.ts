import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent } from "../host-input/identities.js";
import type { SourceInputCorrespondenceMember, SourceInputMemberUseSelection } from "../host-input/member-input.js";
import type { SourceIndexSelection } from "../source-model/member-use.js";
import type { SourceDescriptorView, SourceMemberOrigin, SourceRefusal, SourceResult, SourceTypeEvidence,
  SourceUseDestination } from "../public/source/contracts.js";

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
  readonly access: "read" | "write" | "read-write" | "delete";
  readonly callCallee: boolean;
  readonly optionalChain: boolean;
  readonly selectedDeclarations: readonly Node[];
  readonly readDeclarations: readonly Node[];
  readonly writeDeclarations: readonly Node[];
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly arms: readonly SourceMemberUseArm[];
}

export function createSourceMemberUseQuery(input: {
  readonly view: SourceDescriptorView;
  readonly assertNode: (node: Node) => void;
  readonly select: (occurrence: Node) => SourceInputMemberUseSelection;
  readonly originalComponent: (evidence: SourceTypeEvidence) => SourceInputComponent;
  readonly publish: (component: SourceInputComponent, receiver?: SourceTypeEvidence) => SourceResult<SourceTypeEvidence>;
  readonly origins: (receiver: SourceTypeEvidence, member: SourceInputCorrespondenceMember,
    role: "selected" | "read" | "write") => SourceResult<readonly SourceMemberOrigin[]>;
  readonly destination: (occurrence: Node, receiver: SourceTypeEvidence,
    member: SourceInputCorrespondenceMember) => SourceResult<SourceUseDestination>;
  readonly unavailable: (occurrence: Node,
    reason: Extract<SourceInputMemberUseSelection, { readonly kind: "unavailable" }>["reason"]) => SourceRefusal;
}): (occurrence: Node) => SourceResult<SourceMemberUse> {
  const { view, assertNode, select, originalComponent, publish, origins, destination, unavailable } = input;
  const retained = new WeakMap<Node, SourceResult<SourceMemberUse>>();
  const evidence = (component: SourceInputComponent, receiver?: SourceTypeEvidence): SourceResult<SourceTypeEvidence> => {
    const selected = publish(component, receiver);
    if (selected.kind === "refused") return selected;
    view.assertEvidence(selected.value);
    if (originalComponent(selected.value) !== component)
      throw new Error("A member-use publication must retain its exact original component handle.");
    return selected;
  };
  const optionalEvidence = (component: SourceInputComponent | undefined,
    receiver?: SourceTypeEvidence): SourceResult<SourceTypeEvidence | undefined> => component === undefined
    ? Object.freeze({ kind: "resolved", value: undefined }) : evidence(component, receiver);
  const build = (occurrence: Node): SourceResult<SourceMemberUse> => {
    const original = select(occurrence);
    if (original.kind === "unavailable") return unavailable(occurrence, original.reason);
    if (original.occurrence !== occurrence) throw new Error("A selected member use requires its exact original occurrence.");
    const receiver = evidence(original.receiver.value);
    if (receiver.kind === "refused") return receiver;
    const read = optionalEvidence(original.read, receiver.value);
    if (read.kind === "refused") return read;
    const write = optionalEvidence(original.write, receiver.value);
    if (write.kind === "refused") return write;
    const arms: SourceMemberUseArm[] = [];
    for (const arm of original.arms) {
      const value = evidence(arm.kind === "index" ? arm.receiver : arm.member.receiver, receiver.value);
      if (value.kind === "refused") return value;
      if (arm.kind === "index") {
        const key = evidence(arm.key);
        if (key.kind === "refused") return key;
        const readType = optionalEvidence(arm.read, value.value);
        if (readType.kind === "refused") return readType;
        const writeType = optionalEvidence(arm.write, value.value);
        if (writeType.kind === "refused") return writeType;
        arms.push(Object.freeze({ kind: "index", receiver: value.value, selection: arm.selection, key: key.value,
          readType: readType.value, writeType: writeType.value, readonly: arm.readonly }));
        continue;
      }
      const selectedOrigins = origins(value.value, arm.member, "selected");
      if (selectedOrigins.kind === "refused") return selectedOrigins;
      const readOrigins = original.read === undefined ? Object.freeze({ kind: "resolved", value: Object.freeze([]) } as const)
        : origins(value.value, arm.member, "read");
      if (readOrigins.kind === "refused") return readOrigins;
      const writeOrigins = original.write === undefined ? Object.freeze({ kind: "resolved", value: Object.freeze([]) } as const)
        : origins(value.value, arm.member, "write");
      if (writeOrigins.kind === "refused") return writeOrigins;
      const readType = optionalEvidence(original.read === undefined ? undefined : arm.member.read, value.value);
      if (readType.kind === "refused") return readType;
      const writeType = optionalEvidence(original.write === undefined ? undefined : arm.member.write, value.value);
      if (writeType.kind === "refused") return writeType;
      let writeDestination: SourceUseDestination | undefined;
      if (writeType.value !== undefined) {
        const selected = destination(occurrence, value.value, arm.member);
        if (selected.kind === "refused") return selected;
        view.assertEvidence(selected.value.declaration.type);
        view.assertEvidence(selected.value.applied);
        if (originalComponent(selected.value.applied) !== arm.member.write)
          throw new Error("A selected member write destination must retain its exact applied write component.");
        writeDestination = selected.value;
      }
      arms.push(Object.freeze({ kind: "member", receiver: value.value, origins: selectedOrigins.value,
        readOrigins: readOrigins.value, writeOrigins: writeOrigins.value,
        declarations: arm.member.declarations, readDeclarations: arm.readDeclarations, writeDeclarations: arm.writeDeclarations,
        readType: readType.value, writeType: writeType.value, writeDestination }));
    }
    return Object.freeze({ kind: "resolved", value: Object.freeze({ occurrence,
      receiver: Object.freeze({ occurrence: original.receiver.occurrence, value: receiver.value }),
      access: original.access, callCallee: original.callCallee, optionalChain: original.optionalChain,
      selectedDeclarations: original.selectedDeclarations, readDeclarations: original.readDeclarations,
      writeDeclarations: original.writeDeclarations, readType: read.value, writeType: write.value, arms: Object.freeze(arms) }) });
  };
  return occurrence => {
    assertNode(occurrence);
    const existing = retained.get(occurrence);
    if (existing !== undefined) return existing;
    const selected = build(occurrence);
    retained.set(occurrence, selected);
    return selected;
  };
}
