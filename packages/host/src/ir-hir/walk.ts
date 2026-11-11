import type { HirNode, IndexSyntaxTree, Phase, SyntaxNode, WalkSyntaxTree } from "./contract.js";
import type { BodyId, CandidateListId, DefId, Derivation, ItemNodeRef, LocalId, LocalRef, NodeId, NodeRef, Origin, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { HirResolution } from "./contract.js";
import type { MemberKey } from "../ir-types/contract.js";
import { syntaxChildEdges } from "./children.js";

type PendingNode<PhaseType extends Phase> = (
  | { readonly kind: "enter"; readonly node: SyntaxNode<PhaseType>; readonly path: HirDataPath }
  | { readonly kind: "leave"; readonly node: SyntaxNode<PhaseType> }
) & { readonly next: PendingNode<PhaseType> | null };

export function hirChildPath(parent: HirDataPath, fields: readonly (string | number)[]): HirDataPath {
  let path = parent;
  for (const field of fields) path = { parent: path, field };
  return path;
}

export const walkSyntaxTree: WalkSyntaxTree = <PhaseType extends Phase>(
  root: SyntaxNode<PhaseType>,
  stopBefore: readonly NodeId[],
): readonly SyntaxNode<PhaseType>[] => {
  const stopped = new Set(stopBefore);
  const seen = new Set<SyntaxNode<PhaseType>>();
  const active = new Set<SyntaxNode<PhaseType>>();
  const result: SyntaxNode<PhaseType>[] = [];
  let pending: PendingNode<PhaseType> | null = { kind: "enter", node: root, path: { parent: null, field: "root" }, next: null };
  while (pending !== null) {
    const frame = pending;
    pending = pending.next;
    const current = frame.node;
    if (frame.kind === "leave") { active.delete(current); continue; }
    if (active.has(current)) throw new TypeError(`Syntax child cycle at ${hirDataPathText(frame.path)}`);
    if (stopped.has(current.id) || seen.has(current)) continue;
    seen.add(current);
    active.add(current);
    result.push(current);
    pending = syntaxChildEdges(current).reduceRight<PendingNode<PhaseType> | null>(
      (next, child) => ({ kind: "enter", node: child.node, path: hirChildPath(frame.path, child.fields), next }),
      { kind: "leave", node: current, next: pending },
    );
  }
  return Object.freeze(result);
};

export const indexSyntaxTree: IndexSyntaxTree = root => walkSyntaxTree(root, []);

export interface HirDataPath {
  readonly parent: HirDataPath | null;
  readonly field: string | number;
}

export type HirDataReference =
  | { readonly kind: "plain" }
  | { readonly kind: "NodeId"; readonly value: NodeId }
  | { readonly kind: "CandidateListId"; readonly value: CandidateListId }
  | { readonly kind: "TyId"; readonly value: TyId }
  | { readonly kind: "SigId"; readonly value: SigId }
  | { readonly kind: "DefId"; readonly value: DefId }
  | { readonly kind: "BodyId"; readonly value: BodyId }
  | { readonly kind: "NodeRef"; readonly value: NodeRef }
  | { readonly kind: "ItemNodeRef"; readonly value: ItemNodeRef }
  | { readonly kind: "SourceNodeRef"; readonly value: SourceNodeRef }
  | { readonly kind: "LocalRef"; readonly value: LocalRef }
  | { readonly kind: "HirResolution"; readonly value: HirResolution }
  | { readonly kind: "MemberKey"; readonly value: MemberKey };

export type HirScalar = string | number | bigint | boolean | null;

export interface HirDataField {
  readonly name: string;
  readonly work: HirDataWork;
}

export interface HirRecordView {
  readonly kind: "record";
  readonly label: string;
  readonly syntax: HirNode | null;
  readonly owner: object;
  readonly fields: readonly HirDataField[];
}

export type HirDataView =
  | { readonly kind: "scalar"; readonly value: HirScalar }
  | { readonly kind: "identity"; readonly prefix: string; readonly value: string | number }
  | { readonly kind: "array"; readonly value: readonly HirDataWork[]; readonly owner: object }
  | HirRecordView;

export interface HirDataWork {
  readonly reference: HirDataReference;
  readonly read: () => HirDataView;
}

export interface HirRecordWork extends HirDataWork {
  readonly read: () => HirRecordView;
}

const plainReference: HirDataReference = Object.freeze({ kind: "plain" });

export function hirScalarData(value: HirScalar): HirDataWork {
  return { reference: plainReference, read: () => ({ kind: "scalar", value }) };
}

export function hirIdentityData(prefix: string, value: string | number, reference: HirDataReference = plainReference): HirDataWork {
  return { reference, read: () => ({ kind: "identity", prefix, value }) };
}

export function hirNodeIdData(value: NodeId): HirDataWork { return hirIdentityData("n", value, { kind: "NodeId", value }); }
export function hirLocalIdData(value: LocalId): HirDataWork { return hirIdentityData("l", value); }
export function hirCandidateIdData(value: CandidateListId): HirDataWork { return hirIdentityData("cand", value, { kind: "CandidateListId", value }); }
export function hirTyIdData(value: TyId): HirDataWork { return hirIdentityData("t", value, { kind: "TyId", value }); }
export function hirSigIdData(value: SigId): HirDataWork { return hirIdentityData("sig", value, { kind: "SigId", value }); }
export function hirDefIdData(value: DefId): HirDataWork { return hirIdentityData("def", value, { kind: "DefId", value }); }
export function hirBodyIdData(value: BodyId): HirDataWork { return hirIdentityData("body", value, { kind: "BodyId", value }); }

export function hirNullableData<Value>(value: Value | null, read: (value: Value) => HirDataWork): HirDataWork {
  return value === null ? hirScalarData(null) : read(value);
}

export function hirArrayData<Value>(value: readonly Value[], read: (value: Value) => HirDataWork): HirDataWork {
  return { reference: plainReference, read: () => ({ kind: "array", owner: value, value: value.map(read) }) };
}

export function hirFieldData(name: string, work: HirDataWork): HirDataField {
  return { name, work };
}

export function hirRecordData(label: string, owner: object, fields: () => readonly HirDataField[],
  reference: HirDataReference = plainReference, syntax: HirNode | null = null): HirRecordWork {
  return { reference, read: () => ({ kind: "record", label, owner, syntax, fields: fields() }) };
}

export function hirOriginData(value: Origin): HirDataWork {
  return hirRecordData("Origin", value, () => [
    hirFieldData("module", hirIdentityData("mod", value.module)), hirFieldData("start", hirScalarData(value.start)),
    hirFieldData("length", hirScalarData(value.length)), hirFieldData("derived", hirArrayData(value.derived, derivationData)),
  ]);
}

function derivationData(value: Derivation): HirDataWork {
  switch (value.kind) {
    case "lowering": return hirRecordData(value.kind, value, () => [hirFieldData("pass", hirScalarData(value.pass))]);
    case "expansion": return hirRecordData(value.kind, value, () => [hirFieldData("expansion", hirIdentityData("exp", value.expansion))]);
  }
}

export function hirRangeData(value: { readonly pos: number; readonly end: number }): HirDataWork {
  return hirRecordData("TextRange", value, () => [hirFieldData("pos", hirScalarData(value.pos)), hirFieldData("end", hirScalarData(value.end))]);
}

export function hirNodeRefData(value: NodeRef): HirDataWork {
  return hirRecordData("NodeRef", value, () => [hirFieldData("body", hirBodyIdData(value.body)), hirFieldData("node", hirNodeIdData(value.node))],
    { kind: "NodeRef", value });
}

export function hirSourceRefData(value: SourceNodeRef): HirDataWork {
  switch (value.kind) {
    case "body": return hirRecordData(value.kind, value, () => [hirFieldData("value", hirNodeRefData(value.value))], { kind: "SourceNodeRef", value });
    case "item": return hirRecordData(value.kind, value, () => [hirFieldData("value", hirRecordData("ItemNodeRef", value.value,
      () => [hirFieldData("owner", hirDefIdData(value.value.owner)), hirFieldData("node", hirNodeIdData(value.value.node))],
      { kind: "ItemNodeRef", value: value.value }))], { kind: "SourceNodeRef", value });
  }
}

export function hirLocalRefData(value: LocalRef): HirDataWork {
  return hirRecordData("LocalRef", value, () => [hirFieldData("body", hirBodyIdData(value.body)), hirFieldData("local", hirLocalIdData(value.local))],
    { kind: "LocalRef", value });
}

export interface HirFieldVisit {
  readonly reference: HirDataReference;
  readonly parent: HirDataReference;
  readonly field: string | null;
}

type PendingField = (
  | { readonly kind: "value"; readonly work: HirDataWork; readonly parent: HirDataReference;
      readonly field: string | null; readonly path: HirDataPath | null }
  | { readonly kind: "leave"; readonly owner: object }
) & { readonly next: PendingField | null };

export function walkHirFields(work: HirDataWork, visit: (value: HirFieldVisit) => void): void {
  let pending: PendingField | null = { kind: "value", work, parent: plainReference, field: null, path: null, next: null };
  const onPath = new Set<object>();
  while (pending !== null) {
    const frame = pending;
    pending = frame.next;
    if (frame.kind === "leave") { onPath.delete(frame.owner); continue; }
    visit({ reference: frame.work.reference, parent: frame.parent, field: frame.field });
    const view = frame.work.read();
    switch (view.kind) {
      case "scalar": case "identity": break;
      case "array":
      case "record": {
        if (view.kind === "record" && view.syntax !== null && frame.path !== null) break;
        if (onPath.has(view.owner)) throw new TypeError(`Inline value cycle at ${hirDataPathText(frame.path)}`);
        onPath.add(view.owner);
        pending = { kind: "leave", owner: view.owner, next: pending };
        if (view.kind === "array") {
          pending = view.value.reduceRight<PendingField | null>((next, value, ordinal) => ({
            kind: "value", work: value, parent: plainReference, field: frame.field,
            path: { parent: frame.path, field: ordinal }, next,
          }), pending);
        } else {
          pending = view.fields.reduceRight<PendingField | null>((next, field) => ({
            kind: "value", work: field.work, parent: frame.work.reference, field: field.name,
            path: { parent: frame.path, field: field.name }, next,
          }), pending);
        }
      }
    }
  }
}

export function hirDataPathText(path: HirDataPath | null): string {
  const fields: (string | number)[] = [];
  for (let current = path; current !== null; current = current.parent) fields.push(current.field);
  const pieces: string[] = ["$"];
  for (const field of fields.reverse()) pieces.push(typeof field === "number" ? `[${field}]` : `.${field}`);
  return pieces.join("");
}
