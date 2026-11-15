import type { TyId, SigId } from "../ids/contract.js";
import type { TypeInterner, TypeTerm, Signature, SignatureInput } from "./contract.js";
import type { LimitStop } from "./work.js";
import { TypeArena } from "./arena.js";
import { storedType } from "./interner.js";
import { remapTerm, remapSignature, orderedSignature, normalizeType } from "./canonical.js";
import { copyType, copySignature } from "./copy.js";
import { typeIdentifier, signatureIdentifier, required } from "./value.js";
import { typeText, signatureText } from "./print.js";

export interface GraphStageAccounting<Stop extends LimitStop> {
  readonly step: () => Stop | null;
  readonly growth: (count: number) => Stop | null;
  readonly type: (value: TypeTerm) => Stop | null;
  readonly signature: (value: SignatureInput) => Stop | null;
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
    const selected = resolveType(value);
    if (selected < typeBase) {
      const value = storedType(storage, selected);
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
  for (const stage of tasks) {
    const next = accounting.step();
    if (next !== null) return next;
    stage.queued = false;
    const changed = refresh(stage);
    if (failure !== null) return failure;
    if (stage.kind === "type") {
      const emit = (value: TypeTerm): TyId | Stop => {
        const admitted = accounting.type(value);
        if (admitted !== null) return admitted;
        const key = typeText(value);
        const existing = TypeArena.typeKeys(storage).get(key);
        if (existing !== undefined) {
          return typeIdentifier(existing);
        }
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
      const mapped = stage.value;
      const key = signatureText(mapped);
      const existing = TypeArena.signatureKeys(storage).get(key);
      let selected = stage.id;
      if (existing !== undefined) {
        selected = signatureIdentifier(existing);
      } else {
        const previous = signatureKeys.get(key);
        if (previous !== undefined) selected = resolve(previous, signatureAliases);
      }
      signatureKeys.set(key, selected);
      if (selected !== stage.id) redirect(stage, selected);
      else if (changed) notify(stage);
    }
  }
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
  const mappingStop = accounting.growth(typeRows.size + signatureRows.size + types.size + signatures.size);
  if (mappingStop !== null) return mappingStop;
  for (const id of typeRows.keys()) typeIds.set(id, compactType(typeIdentifier(id)));
  for (const id of signatureRows.keys()) signatureIds.set(id, compactSignature(signatureIdentifier(id)));
  const finalTypes: TypeTerm[] = [];
  const finalSignatures: Signature[] = [];
  for (const [id, stage] of types) if (!typeAliases.has(id)) {
    const admitted = accounting.type(stage.value);
    if (admitted !== null) return admitted;
    finalTypes.push(copyType(remapTerm(stage.value, compactType, compactSignature)));
  }
  for (const [id, stage] of signatures) if (!signatureAliases.has(id)) {
    const admitted = accounting.signature(stage.value);
    if (admitted !== null) return admitted;
    finalSignatures.push(copySignature({ id: compactSignature(signatureIdentifier(id)),
      ...orderedSignature(remapSignature(stage.value, compactType, compactSignature)) }));
  }
  const commitStop = accounting.growth(finalTypes.length * 2 + finalSignatures.length * 2 + 1);
  if (commitStop !== null) return commitStop;
  const typeCommits = finalTypes.map(value => ({ value, key: typeText(value) }));
  const signatureCommits = finalSignatures.map(value => ({ value,
    key: signatureText(remapSignature(value, type => type, signature => signature)) }));
  for (const { value, key } of typeCommits) {
    const id = typeIdentifier(TypeArena.terms(storage).length);
    TypeArena.terms(storage).push(value); TypeArena.typeKeys(storage).set(key, id);
  }
  for (const { value, key } of signatureCommits) {
    TypeArena.signatures(storage).push(value);
    TypeArena.signatureKeys(storage).set(key, value.id);
  }
  return { kind: "complete", value: { types: typeIds, signatures: signatureIds } };

}
