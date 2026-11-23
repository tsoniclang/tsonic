import type { Expression, HirNode, IndexSyntaxTree, ParameterSyntaxReceipt, RetainedSyntaxNode, SyntaxStructureReceipt,
  NullableInitializerPhase, ParameterDeclaration, Phase, SyntaxForest, SyntaxNode, SyntaxRootSlot, SyntaxWalkAdmission, UnparenthesizedExpression,
  SyntaxInitializerImage, WalkSyntaxForest, WalkSyntaxTree } from "./contract.js";
import type { BodyId, CandidateListId, DefId, Derivation, ItemNodeRef, LocalId, LocalRef, NodeId, NodeRef, Origin, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { HirResolution } from "./contract.js";
import type { MemberKey } from "../ir-types/contract.js";
import type { CheckerDiagnosticRef } from "../diag/contract.js";
import type { HirBindingTarget } from "./contract.js";
import { iterateSyntaxChildSlots, prepareSyntaxStructure, syntaxChildEdges } from "./children.js";
import type { SyntaxChildSlot } from "./children.js";
import { throwInvariant } from "../diag/index.js";
import { bindSyntaxForest } from "./copy-syntax.js";

export const unparenthesizedExpression: UnparenthesizedExpression = expression => {
  while (expression.kind === "ParenthesizedExpression") expression = expression.expression;
  return expression;
};

type PendingNode<PhaseType extends Phase> = (
  | { readonly kind: "enter"; readonly node: SyntaxNode<PhaseType>; readonly path: HirDataPath }
  | { readonly kind: "leave"; readonly node: SyntaxNode<PhaseType> }
) & { readonly next: PendingNode<PhaseType> | null };

export function hirChildPath(parent: HirDataPath, fields: readonly (string | number)[]): HirDataPath {
  let path = parent;
  for (const field of fields) path = { parent: path, field };
  return path;
}

export const walkSyntaxTree: WalkSyntaxTree = <PhaseType extends NullableInitializerPhase<PhaseType>>(
  root: SyntaxNode<PhaseType>,
  stopBefore: readonly NodeId[],
): readonly SyntaxNode<PhaseType>[] => {
  const stopped = new Set(stopBefore);
  const seen = new Set<SyntaxNode<PhaseType>>();
  const active = new Set<SyntaxNode<PhaseType>>();
  const result: SyntaxNode<PhaseType>[] = [];
  let pending: PendingNode<PhaseType> | null = { kind: "enter", node: root, path: { parent: null, field: "root" }, next: null };
  while (pending !== null) {
    const frame: PendingNode<PhaseType> = pending;
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
  return (result);
};

export const indexSyntaxTree: IndexSyntaxTree = root => walkSyntaxTree(root, []);

export function createSyntaxForest<PhaseType extends NullableInitializerPhase<PhaseType>, Stop>(
  admission: SyntaxWalkAdmission<PhaseType, Stop>,
) {
  interface Path { readonly parent: Path | null; readonly segment: string }
  type ChildSlot = { readonly kind: "child"; readonly value: SyntaxChildSlot<PhaseType> }
    | { readonly kind: "initializer"; readonly parameter: ParameterDeclaration<PhaseType>; readonly field: "initializer" };
  interface FormalOccurrence {
    readonly kind: "parameter";
    readonly ordinal: number;
    readonly initializer: Expression<PhaseType> | null;
    readonly header: ParameterSyntaxReceipt<PhaseType>;
  }
  type Frame =
    | { readonly kind: "root"; readonly iterator: Iterator<SyntaxRootSlot<PhaseType>>; readonly first: boolean }
    | { readonly kind: "first-root-end" }
    | { readonly kind: "enter"; readonly node: SyntaxNode<PhaseType>; readonly path: Path }
    | { readonly kind: "children"; readonly iterator: Iterator<ChildSlot>; readonly path: Path }
    | { readonly kind: "leave"; readonly node: SyntaxNode<PhaseType> };
  const wire = new Map<SyntaxNode<PhaseType>, number | FormalOccurrence | SyntaxStructureReceipt<PhaseType>>();
  const active = new Set<SyntaxNode<PhaseType>>();
  const nodes: SyntaxNode<PhaseType>[] = [];
  const postorder: SyntaxNode<PhaseType>[] = [];
  let firstRootSize = 0;
  let firstRoot = true;
  function append(roots: Iterable<SyntaxRootSlot<PhaseType>>): Stop | null {
    const pending: Frame[] = [{ kind: "root", iterator: roots[Symbol.iterator](), first: firstRoot }];
    for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
      switch (frame.kind) {
        case "root": {
          const slot = frame.iterator.next();
          if (slot.done) break;
          const stop = admission.root();
          if (stop !== null) return stop;
          pending.push({ ...frame, first: false });
          if (frame.first) pending.push({ kind: "first-root-end" });
          pending.push({ kind: "enter", node: slot.value.read(), path: { parent: null, segment: slot.value.path } });
          break;
        }
        case "first-root-end": firstRoot = false; firstRootSize = nodes.length; break;
        case "enter": {
          if (active.has(frame.node)) {
            const segments: string[] = [];
            for (let at: Path | null = frame.path; at !== null; at = at.parent) segments.push(at.segment);
            throw new TypeError("Syntax object cycle at " + segments.reverse().join(""));
          }
          if (wire.has(frame.node)) break;
          const stop = admission.node(frame.node);
          if (stop !== null) return stop;
          const node = frame.node;
          active.add(node);
          const ordinal = nodes.length;
          const prepared = prepareSyntaxStructure<PhaseType, Stop>(node, ordinal, admission.structure, admission.list);
          if (prepared.kind === "refused") return prepared.stop;
          const shape = prepared.value;
          wire.set(node, shape ?? ordinal);
          const slots = shape === null ? iterateSyntaxChildSlots<PhaseType, ChildSlot>(node, value => ({ kind: "child", value }),
            (parameter, field) => [{ kind: "initializer", parameter, field }])
            : structuralSlots(shape.slots, node.kind === "Parameter" ? node : null);
          nodes.push(node);
          pending.push({ kind: "leave", node }, { kind: "children", iterator: slots[Symbol.iterator](), path: frame.path });
          break;
        }
        case "children": {
          const slot = frame.iterator.next();
          if (slot.done) break;
          if (slot.value.kind === "initializer") {
            const { parameter, field } = slot.value;
            const reserved = admission.parameter(parameter);
            if (reserved !== null) return reserved;
            const retained = wire.get(parameter);
            if (retained === undefined || typeof retained === "number" || retained.kind !== "formal-header")
              return throwInvariant({ owner: "ir-hir", query: null, origin: parameter.origin,
              message: "A formal initializer must belong to its one admitted pointer." });
            const initializer = parameter.initializer;
            if (initializer === null) {
              wire.set(parameter, { kind: "parameter", ordinal: retained.ordinal, initializer, header: retained });
              pending.push(frame);
              break;
            }
            const stop = admission.edge();
            if (stop !== null) return stop;
            wire.set(parameter, { kind: "parameter", ordinal: retained.ordinal, initializer, header: retained });
            pending.push(frame, { kind: "enter", node: initializer, path: { parent: frame.path, segment: "." + field } });
            break;
          }
          const stop = admission.edge();
          if (stop !== null) return stop;
          const node = slot.value.value.read();
          let segment = "";
          for (const field of slot.value.value.fields) segment += typeof field === "number" ? "[" + field + "]" : "." + field;
          pending.push(frame, { kind: "enter", node, path: { parent: frame.path, segment } });
          break;
        }
        case "leave": active.delete(frame.node); postorder.push(frame.node); break;
      }
    }
    return null;
  }
  function* structuralSlots(values: Iterable<SyntaxChildSlot<PhaseType>>, formal: ParameterDeclaration<PhaseType> | null): Generator<ChildSlot> {
    for (const value of values) yield { kind: "child", value };
    if (formal !== null) yield { kind: "initializer", parameter: formal, field: "initializer" };
  }
  const wireOf = (node: SyntaxNode<PhaseType>): number | undefined => {
    const entry = wire.get(node);
    return typeof entry === "number" ? entry : entry?.ordinal;
  };
  function structure(node: RetainedSyntaxNode<PhaseType>): SyntaxStructureReceipt<PhaseType> {
    const entry = wire.get(node);
    if (entry !== undefined && typeof entry !== "number") return entry.kind === "parameter" ? entry.header : entry;
    return throwInvariant({ owner: "ir-hir", query: null, origin: node.origin, message: "Syntax requires its exact admitted structural receipt." });
  }
  const copyInitializer: SyntaxInitializerImage<PhaseType, unknown> = (node, expression) => {
    const entry = wire.get(node);
    if (entry !== undefined && typeof entry !== "number" && entry.kind === "parameter")
      return entry.initializer === null ? null : expression(entry.initializer);
    return throwInvariant({ owner: "ir-hir", query: null, origin: node.origin,
      message: "A formal initializer requires the actually admitted syntax pointer." });
  };
  return { append, nodes, postorder, wireOf, structure, copyInitializer,
    firstRootSize: () => firstRootSize,
    hasStructure: (node: SyntaxNode<PhaseType>) => {
      const entry = wire.get(node);
      return entry !== undefined && typeof entry !== "number";
    },
  };
}

export const walkSyntaxForest: WalkSyntaxForest = <PhaseType extends NullableInitializerPhase<PhaseType>, Stop>(
  roots: Iterable<SyntaxRootSlot<PhaseType>>,
  admission: SyntaxWalkAdmission<PhaseType, Stop>,
): { readonly kind: "complete"; readonly value: SyntaxForest<PhaseType> } | Stop => {
  const state = createSyntaxForest<PhaseType, Stop>(admission);
  const stopped = state.append(roots);
  if (stopped !== null) return stopped;
  const copy = bindSyntaxForest<PhaseType>(state.nodes, state.postorder, state.wireOf, state.structure, state.copyInitializer);
  return { kind: "complete", value: {
    nodes: () => state.nodes.values(), firstRootSize: state.firstRootSize(), wireOf: state.wireOf, copy,
  } };
};

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
  | { readonly kind: "HirBindingTarget"; readonly value: HirBindingTarget }
  | { readonly kind: "CheckerDiagnosticRef"; readonly value: CheckerDiagnosticRef }
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

const plainReference: { readonly kind: "plain" } = ({ kind: "plain" });

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

export function hirItemRefData(value: ItemNodeRef): HirDataWork {
  return hirRecordData("ItemNodeRef", value, () => [hirFieldData("owner", hirDefIdData(value.owner)), hirFieldData("node", hirNodeIdData(value.node))],
    { kind: "ItemNodeRef", value });
}

export function hirSourceRefData(value: SourceNodeRef): HirDataWork {
  switch (value.kind) {
    case "body": return hirRecordData(value.kind, value, () => [hirFieldData("value", hirNodeRefData(value.value))], { kind: "SourceNodeRef", value });
    case "item": return hirRecordData(value.kind, value, () => [hirFieldData("value", hirItemRefData(value.value))], { kind: "SourceNodeRef", value });
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
    const frame: PendingField = pending;
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
