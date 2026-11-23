import type { TyId, SigId } from "../ids/contract.js";
import type { TypeInterner, TypeTerm, Signature, SignatureInput } from "./contract.js";
import type { LimitStop } from "./work.js";
import { TypeArena } from "./arena.js";
import type { GraphIdentity } from "./arena.js";
import { remapTerm, remapSignature, orderedSignature, normalizeType, inspectGraphValue, stagedEquivalences } from "./canonical.js";
import type { DescribedGraphRow, GraphValue } from "./canonical.js";
import { typeIdentifier, signatureIdentifier, required } from "./value.js";
import { typeText, signatureText } from "./print.js";

export interface GraphStageAccounting<Stop extends LimitStop> {
  readonly step: (count?: number) => Stop | null;
  readonly growth: (count: number) => Stop | null;
  readonly type: (value: TypeTerm) => Stop | null;
  readonly signature: (value: SignatureInput) => Stop | null;
  readonly commitType?: (value: TypeTerm) => Stop | null;
  readonly commitSignature?: (value: SignatureInput) => Stop | null;
  readonly project?: true;
  readonly beforeMember: ((kind: "union" | "intersection", count: number) => Stop | null) | null;
}
export interface GraphStageMapping {
  readonly types: ReadonlyMap<number, TyId>;
  readonly signatures: ReadonlyMap<number, SigId>;
}

interface StageBase {
  readonly id: number;
  readonly parents: Map<string, Stage>;
  readonly children: Map<string, Stage>;
  key: string | null;
  queued: boolean;
}
interface TypeStage extends StageBase { readonly kind: "type"; value: TypeTerm }
interface SignatureStage extends StageBase { readonly kind: "signature"; value: SignatureInput }
type Stage = TypeStage | SignatureStage;


function stageKey(value: Stage): string { return `${value.kind}:${value.id}`; }

function rowAt<Row>(rows: readonly Row[], position: number): Row {
  const row = rows[position];
  if (row === undefined) throw new TypeError("A closed graph retains the actual referenced row.");
  return row;
}
export function stageGraph<Stop extends LimitStop>(storage: TypeInterner, typeRows: ReadonlyMap<number, TypeTerm>,
  signatureRows: ReadonlyMap<number, SignatureInput>, accounting: GraphStageAccounting<Stop>):
  { readonly kind: "complete"; readonly value: GraphStageMapping } | Stop {
  const typeBase = TypeArena.terms(storage).length;
  const signatureBase = TypeArena.signatures(storage).length;
  let nextType = typeBase + typeRows.size;
  let failure: Stop | null = accounting.growth(8 + typeRows.size * 5 + signatureRows.size * 5);
  if (failure !== null) return failure;
  const grow = (count: number): boolean => {
    if (failure === null) failure = accounting.growth(count);
    return failure === null;
  };
  const typeAliases = new Map<number, number>();
  const signatureAliases = new Map<number, number>();
  const resolve = (value: number, aliases: Map<number, number>): number => {
    let selected = value;
    for (let next = aliases.get(selected); next !== undefined; next = aliases.get(selected)) selected = next;
    let current = value;
    for (let next = aliases.get(current); next !== undefined && next !== selected; next = aliases.get(current)) {
      aliases.set(current, selected); current = next;
    }
    return selected;
  };
  const resolveType = (value: TyId): TyId => typeIdentifier(resolve(value, typeAliases));
  const resolveSignature = (value: SigId): SigId => signatureIdentifier(resolve(value, signatureAliases));
  const types = new Map<number, TypeStage>();
  const signatures = new Map<number, SignatureStage>();
  for (const [id, value] of typeRows) types.set(id, { kind: "type", id, value, key: null,
    parents: new Map(), children: new Map(), queued: false });
  for (const [id, value] of signatureRows) signatures.set(id, { kind: "signature", id, value, key: null,
    parents: new Map(), children: new Map(), queued: false });
  const keys = new Map<string, number>();
  const signatureKeys = new Map<string, number>();
  const tasks: Stage[] = [];
  const schedule = (stage: Stage): void => {
    if (!stage.queued && grow(1)) { stage.queued = true; tasks.push(stage); }
  };
  const invalidate = (stage: Stage): void => {
    const index = stage.kind === "type" ? keys : signatureKeys;
    if (stage.key !== null && index.get(stage.key) === stage.id) index.delete(stage.key);
  };
  const notify = (stage: Stage): void => {
    for (const parent of stage.parents.values()) { invalidate(parent); schedule(parent); }
  };
  const refresh = (stage: Stage): boolean => {
    failure = stage.kind === "type" ? accounting.type(stage.value) : accounting.signature(stage.value);
    if (failure !== null) return false;
    for (const child of stage.children.values()) child.parents.delete(stageKey(stage));
    stage.children.clear();
    const typeOf = (value: TyId): TyId => {
      const selected = resolveType(value);
      if (selected >= typeBase) {
        const child = required(types, selected);
        child.parents.set(stageKey(stage), stage); stage.children.set(stageKey(child), child);
      }
      return selected;
    };
    const signatureOf = (value: SigId): SigId => {
      const selected = resolveSignature(value);
      if (selected >= signatureBase) {
        const child = required(signatures, selected);
        child.parents.set(stageKey(stage), stage); stage.children.set(stageKey(child), child);
      }
      return selected;
    };
    const old = stage.key;
    invalidate(stage);
    if (stage.kind === "type") stage.value = remapTerm(stage.value, typeOf, signatureOf);
    else stage.value = orderedSignature(remapSignature(stage.value, typeOf, signatureOf));
    const key = stage.kind === "type" ? typeText(stage.value) : signatureText(stage.value);
    const index = stage.kind === "type" ? keys : signatureKeys;
    if (!index.has(key)) index.set(key, stage.id);
    stage.key = key;
    return old !== key;
  };
  const redirect = (stage: Stage, selected: number): void => {
    invalidate(stage);
    for (const child of stage.children.values()) child.parents.delete(stageKey(stage));
    stage.children.clear();
    const aliases = stage.kind === "type" ? typeAliases : signatureAliases;
    aliases.set(stage.id, selected);
    const target = stage.kind === "type" ? types.get(selected) : signatures.get(selected);
    for (const parent of stage.parents.values()) {
      if (target !== undefined) target.parents.set(stageKey(parent), parent);
      invalidate(parent); schedule(parent);
    }
    stage.parents.clear();
  };
  const read = (value: TyId): TypeTerm | Stop => {
    const before = accounting.growth(1);
    if (before !== null) return before;
    const selected = resolveType(value);
    if (selected < typeBase) {
      const value = rowAt(TypeArena.terms(storage), selected);
      const admitted = accounting.type(value);
      return admitted ?? value;
    }
    const staged = required(types, selected);
    const admitted = accounting.type(staged.value);
    if (admitted !== null) return admitted;
    return remapTerm(staged.value, resolveType, resolveSignature);
  };
  for (const stage of types.values()) {
    refresh(stage);
    if (failure !== null) return failure;
    schedule(stage);
    if (failure !== null) return failure;
  }
  for (const stage of signatures.values()) {
    refresh(stage);
    if (failure !== null) return failure;
    schedule(stage);
    if (failure !== null) return failure;
  }
  let cursor = 0;
  const drain = (): Stop | null => {
    while (cursor < tasks.length) {
      const next = accounting.step();
      if (next !== null) return next;
      const stage = rowAt(tasks, cursor++);
      stage.queued = false;
      if (stage.kind === "type" ? typeAliases.has(stage.id) : signatureAliases.has(stage.id)) continue;
      const changed = refresh(stage);
      if (failure !== null) return failure;
      if (stage.kind === "type") {
        const emit = (value: TypeTerm): TyId | Stop => {
          const admitted = accounting.type(value);
          if (admitted !== null) return admitted;
          const key = typeText(value);
          const existing = TypeArena.typeKeys(storage).get(key);
          if (existing !== undefined) return existing;
          const previous = keys.get(key);
          if (previous !== undefined) return typeIdentifier(resolve(previous, typeAliases));
          const id = typeIdentifier(nextType++);
          const created: TypeStage = { kind: "type", id, value, key: null, parents: new Map(), children: new Map(), queued: false };
          types.set(id, created); refresh(created);
          if (failure !== null) return failure;
          schedule(created);
          return failure ?? id;
        };
        const selected = normalizeType(stage.value, read, emit, accounting.beforeMember);
        if (typeof selected !== "number") return selected;
        if (selected !== stage.id) redirect(stage, selected);
        else if (changed) notify(stage);
      } else {
        const key = signatureText(stage.value);
        const existing = TypeArena.signatureKeys(storage).get(key);
        let selected = stage.id;
        if (existing !== undefined) {
          selected = existing;
        } else {
          const previous = signatureKeys.get(key);
          if (previous !== undefined) selected = resolve(previous, signatureAliases);
        }
        signatureKeys.set(key, selected);
        if (selected !== stage.id) redirect(stage, selected);
        else if (changed) notify(stage);
      }
    }
    tasks.length = 0;
    cursor = 0;
    return null;
  };
  const committed = (value: GraphIdentity): boolean =>
    value.identity < (value.kind === "type" ? typeBase : signatureBase);
  const pendingStages = (): readonly Stage[] => [...types.values(), ...signatures.values()];
  const isRepresentative = (stage: Stage): boolean =>
    !(stage.kind === "type" ? typeAliases : signatureAliases).has(stage.id);
  const typesByReference = new Map<number, DescribedGraphRow>();
  const signaturesByReference = new Map<number, DescribedGraphRow>();
  for (;;) {
    const stopped = drain();
    if (stopped !== null) return stopped;
    const inventoryStop = accounting.growth(4 + types.size + signatures.size);
    if (inventoryStop !== null) return inventoryStop;
    const unresolved = new Map<Stage, number>();
    const leaves: Stage[] = [];
    const stages = pendingStages();
    for (const stage of stages) {
      const stop = accounting.growth(1);
      if (stop !== null) return stop;
      if (!isRepresentative(stage)) continue;
      unresolved.set(stage, stage.children.size);
      if (stage.children.size === 0) leaves.push(stage);
    }
    for (const leaf of leaves) {
      const stop = accounting.growth(1);
      if (stop !== null) return stop;
      unresolved.delete(leaf);
      for (const parent of leaf.parents.values()) {
        const stop = accounting.growth(1);
        if (stop !== null) return stop;
        const count = unresolved.get(parent);
        if (count === undefined) continue;
        unresolved.set(parent, count - 1);
        if (count === 1) leaves.push(parent);
      }
    }
    if (unresolved.size === 0) break;
    const read = (identity: GraphIdentity): DescribedGraphRow | Stop => {
      const stable = committed(identity);
      const seen = identity.kind === "type" ? typesByReference : signaturesByReference;
      const retained = stable ? seen.get(identity.identity) : undefined;
      if (retained !== undefined) return retained;
      const value: GraphValue = identity.kind === "type" ? {
        kind: "type", value: stable ? rowAt(TypeArena.terms(storage), identity.identity)
          : required(types, identity.identity).value,
      } : {
        kind: "signature", value: stable ? rowAt(TypeArena.signatures(storage), identity.identity)
          : required(signatures, identity.identity).value,
      };
      const admitted = value.kind === "type" ? accounting.type(value.value) : accounting.signature(value.value);
      if (admitted !== null) return admitted;
      const allocation = accounting.growth(stable ? 2 : 1);
      if (allocation !== null) return allocation;
      const row = { data: value, description: inspectGraphValue(value) };
      if (stable) seen.set(identity.identity, row);
      return row;
    };
    const rootGrowth = accounting.growth(unresolved.size + 1);
    if (rootGrowth !== null) return rootGrowth;
    const roots = [...unresolved.keys()].map(stage => ({ kind: stage.kind, identity: stage.id }));
    const equivalent = stagedEquivalences(roots, read, label => TypeArena.candidates(storage, label), committed, accounting.growth);
    if (equivalent.kind !== "complete") return equivalent;
    if (equivalent.value.length === 0) break;
    for (const { from, to } of equivalent.value) {
      const stop = accounting.growth(1);
      if (stop !== null) return stop;
      redirect(from.kind === "type" ? required(types, from.identity) : required(signatures, from.identity), to.identity);
      if (failure !== null) return failure;
    }
  }
  if (accounting.project === true) {
    const admitted = accounting.growth(2 + typeRows.size + signatureRows.size);
    if (admitted !== null) return admitted;
    const types = new Map<number, TyId>();
    const signatures = new Map<number, SigId>();
    for (const id of typeRows.keys()) {
      const selected = resolveType(typeIdentifier(id));
      if (selected < typeBase) types.set(id, selected);
    }
    for (const id of signatureRows.keys()) {
      const selected = resolveSignature(signatureIdentifier(id));
      if (selected < signatureBase) signatures.set(id, selected);
    }
    return { kind: "complete", value: { types, signatures } };
  }
  const mappingStop = accounting.growth(4 + typeRows.size + signatureRows.size + types.size + signatures.size);
  if (mappingStop !== null) return mappingStop;
  const typeIds = new Map<number, TyId>();
  const signatureIds = new Map<number, SigId>();
  for (const id of types.keys()) if (!typeAliases.has(id)) typeIds.set(id, typeIdentifier(typeBase + typeIds.size));
  for (const id of signatures.keys()) if (!signatureAliases.has(id)) signatureIds.set(id, signatureIdentifier(signatureBase + signatureIds.size));
  const compactType = (value: TyId): TyId => {
    const selected = resolveType(value);
    if (selected < typeBase) return selected;
    return required(typeIds, selected);
  };
  const compactSignature = (value: SigId): SigId => {
    const selected = resolveSignature(value);
    if (selected < signatureBase) return selected;
    return required(signatureIds, selected);
  };
  for (const id of typeRows.keys()) typeIds.set(id, compactType(typeIdentifier(id)));
  for (const id of signatureRows.keys()) signatureIds.set(id, compactSignature(signatureIdentifier(id)));
  const finalTypes: TypeTerm[] = [];
  const finalSignatures: Signature[] = [];
  for (const [id, stage] of types) if (!typeAliases.has(id)) {
    const admitted = accounting.type(stage.value) ?? accounting.commitType?.(stage.value) ?? null;
    if (admitted !== null) return admitted;
    finalTypes.push(remapTerm(stage.value, compactType, compactSignature));
  }
  for (const [id, stage] of signatures) if (!signatureAliases.has(id)) {
    const admitted = accounting.signature(stage.value) ?? accounting.commitSignature?.(stage.value) ?? null;
    if (admitted !== null) return admitted;
    finalSignatures.push({ id: compactSignature(signatureIdentifier(id)),
      ...orderedSignature(remapSignature(stage.value, compactType, compactSignature)) });
  }
  const commitStop = accounting.growth(finalTypes.length * 2 + finalSignatures.length * 2 + 1);
  if (commitStop !== null) return commitStop;
  const typeCommits = finalTypes.map(value => ({ value, key: typeText(value), label: inspectGraphValue({ kind: "type", value }).label }));
  const signatureCommits = finalSignatures.map(value => ({ value,
    key: signatureText(remapSignature(value, type => type, signature => signature)),
    label: inspectGraphValue({ kind: "signature", value }).label }));
  for (const { value, key, label } of typeCommits) {
    const id = typeIdentifier(TypeArena.terms(storage).length);
    TypeArena.terms(storage).push(value); TypeArena.typeKeys(storage).set(key, id);
    TypeArena.addCandidate(storage, label, { kind: "type", identity: id });
  }
  for (const { value, key, label } of signatureCommits) {
    TypeArena.signatures(storage).push(value);
    TypeArena.signatureKeys(storage).set(key, value.id);
    TypeArena.addCandidate(storage, label, { kind: "signature", identity: value.id });
  }
  return { kind: "complete", value: { types: typeIds, signatures: signatureIds } };

}
