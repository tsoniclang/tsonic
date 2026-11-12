import { encodeKey } from "../ids/index.js";
import type { TyId, SigId, DefId } from "../ids/contract.js";
import type { Substitute, SubstituteSignature, TypeInterner, TypeTerm, Signature, SignatureInput, TypeBinding, BindingVector,
  SelfBinding, TypeParameterIdentity, TypeExpansionLimits } from "./contract.js";
import { storedType, storedSignature } from "./interner.js";
import { TypeArena } from "./arena.js";
import { remapTerm, remapSignature, normalizeType, orderedSignature, inspectGraphValue } from "./canonical.js";
import { copyType, copySignature } from "./copy.js";
import { typeIdentifier, signatureIdentifier, required } from "./value.js";
import type { ExpansionResult, ExpansionStop } from "./work.js";
import { typeText, signatureText } from "./print.js";

interface ScopeNode { readonly id: number; readonly left: ScopeNode | null; readonly right: ScopeNode | null }
interface Scope { readonly root: ScopeNode | null; readonly height: number }
interface PlanBase {
  readonly key: string;
  readonly blocked: Scope;
  readonly depth: number;
  readonly children: Plan[];
  readonly parents: Plan[];
  readonly edges: Map<string, Plan>;
  readonly memoKey: string | null;
  readonly retained: number | null;
  redirect: Plan | null;
  changed: boolean;
  output: number;
}
type Plan = PlanBase & (
  | { readonly kind: "type"; readonly identity: TyId; readonly value: TypeTerm }
  | { readonly kind: "signature"; readonly identity: SigId; readonly value: Signature }
);
type Dimension = "depth" | "visits" | "union-members" | "intersection-members";
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

interface SubstitutionEnvironment {
  readonly storage: TypeInterner;
  readonly key: string;
  readonly memo: Map<string, number>;
  readonly parameters: ReadonlyMap<string, TypeBinding>;
  readonly self: ReadonlyMap<DefId, SelfBinding>;
  readonly limits: TypeExpansionLimits;
}

function stageKey(value: Stage): string {
  return `${value.kind}:${value.id}`;
}

function parameterKey(value: TypeParameterIdentity): string {
  return encodeKey([value.owner, value.index]);
}

function bindingKey(value: BindingVector): string {
  const family = (bindings: readonly TypeBinding[]): readonly (readonly (string | number)[])[] => bindings.map(binding =>
    binding.kind === "bound" ? [binding.kind, binding.parameter.owner, binding.parameter.index, binding.type]
      : [binding.kind, binding.parameter.owner, binding.parameter.index]);
  return encodeKey([family(value.classBindings), family(value.methodBindings), family(value.capturedBindings),
    value.selfBindings.map(binding => binding.kind === "bound" ? [binding.kind, binding.owner, binding.type] : [binding.kind, binding.owner])]);
}

function admittedLimits(limits: TypeExpansionLimits): void {
  if (![limits.maximumDepth, limits.maximumVisits, limits.maximumUnionMembers, limits.maximumIntersectionMembers]
    .every(value => Number.isSafeInteger(value) && value >= 0))
    throw new TypeError("ir-types: expansion maxima must be nonnegative safe integers.");
}

function target(plan: Plan): Plan {
  let selected = plan;
  while (selected.redirect !== null) selected = selected.redirect;
  let current = plan;
  while (current.redirect !== null && current.redirect !== selected) {
    const next = current.redirect; current.redirect = selected; current = next;
  }
  return selected;
}

function edge(plan: Plan, kind: "type" | "signature", identity: number): Plan {
  return target(required(plan.edges, `${kind}:${identity}`));
}

function prepareSubstitution(interner: TypeInterner, bindings: BindingVector, limits: TypeExpansionLimits): SubstitutionEnvironment {
  admittedLimits(limits);
  const storage = interner;
  const key = encodeKey([bindingKey(bindings), limits.maximumDepth, limits.maximumVisits,
    limits.maximumUnionMembers, limits.maximumIntersectionMembers]);
  const parameters = new Map<string, TypeBinding>();
  for (const family of [bindings.classBindings, bindings.methodBindings, bindings.capturedBindings])
    for (const binding of family) {
      const key = parameterKey(binding.parameter);
      if (parameters.has(key)) throw new Error("ir-types: a binding vector contains each owner-qualified parameter once.");
      parameters.set(key, binding);
    }
  const self = new Map(bindings.selfBindings.map(binding => [binding.owner, binding]));
  if (self.size !== bindings.selfBindings.length) throw new Error("ir-types: a binding vector contains each lexical self owner once.");
  return { storage, key, parameters, self, limits, memo: TypeArena.substitutions(storage).get(key) ?? new Map<string, number>() };
}

function transform(environment: SubstitutionEnvironment, kind: "type" | "signature", original: number): ExpansionResult<number> {
  const { storage, parameters, self, limits, memo } = environment;
  const stop = (dimension: Dimension, maximum: number): ExpansionStop => ({ kind: "resource-limit", dimension, maximum });
  const memoKey = (kind: "type" | "signature", identity: number): string => encodeKey([kind, identity]);
  const cacheKey = memoKey(kind, original);
  const retained = memo.get(cacheKey);
  if (retained !== undefined) {
    if (kind === "type") storedType(storage, typeIdentifier(retained));
    else storedSignature(storage, signatureIdentifier(retained));
    return { kind: "complete", value: retained };
  }
  const binderIds = new Map<string, number>();
  const scopeNodes = new Map<string, ScopeNode>();
  const leaf: ScopeNode = { id: 1, left: null, right: null };
  let nextScope = 2;
  const branch = (height: number, left: ScopeNode | null, right: ScopeNode | null): ScopeNode | null => {
    if (left === null && right === null) return null;
    const key = `${height}:${left === null ? 0 : left.id}:${right === null ? 0 : right.id}`;
    const previous = scopeNodes.get(key);
    if (previous !== undefined) return previous;
    const value: ScopeNode = { id: nextScope++, left, right };
    scopeNodes.set(key, value);
    return value;
  };
  const scopeHas = (scope: Scope, key: string): boolean => {
    const identity = binderIds.get(key);
    if (identity === undefined) return false;
    let selected = scope.root;
    for (let level = scope.height; selected !== null && level > 0; level -= 1)
      selected = Math.floor(identity / 2 ** (level - 1)) % 2 === 0 ? selected.left : selected.right;
    return selected !== null && identity < 2 ** scope.height;
  };
  const block = (scope: Scope, keys: Iterable<string>): Scope => {
    let result = scope;
    for (const key of keys) {
      if (scopeHas(result, key)) continue;
      let identity = binderIds.get(key);
      if (identity === undefined) { identity = binderIds.size; binderIds.set(key, identity); }
      let selected = result.root;
      let height = result.height;
      while (identity >= 2 ** height) { height += 1; selected = branch(height, selected, null); }
      const path: { readonly node: ScopeNode | null; readonly right: boolean; readonly height: number }[] = [];
      for (let level = height; level > 0; level -= 1) {
        const right = Math.floor(identity / 2 ** (level - 1)) % 2 !== 0;
        path.push({ node: selected, right, height: level });
        selected = selected === null ? null : right ? selected.right : selected.left;
      }
      selected = leaf;
      for (const step of path.reverse()) {
        const left = step.node === null ? null : step.node.left;
        const right = step.node === null ? null : step.node.right;
        selected = branch(step.height, step.right ? left : selected, step.right ? selected : right);
      }
      result = { root: selected, height };
    }
    return result;
  };
  const nodes = new Map<string, Plan>();
  const work: Plan[] = [];
  const unblocked: Scope = { root: null, height: 0 };
  const enqueue = (kind: "type" | "signature", identity: number, inherited: Scope, depth: number): ExpansionResult<Plan> => {
    const signature = kind === "signature" ? storedSignature(storage, signatureIdentifier(identity)) : null;
    let blocked = inherited;
    let rootScope = false;
    if (signature !== null) {
      const keys = signature.typeParameters.map(parameter => parameterKey(parameter.identity));
      blocked = block(inherited, keys);
      rootScope = block(unblocked, keys).root === blocked.root;
    }
    const key = encodeKey([kind, identity, blocked.root === null ? 0 : blocked.root.id]);
    const previous = nodes.get(key);
    if (previous !== undefined) return { kind: "complete", value: previous };
    if (depth > limits.maximumDepth) return stop("depth", limits.maximumDepth);
    if (nodes.size >= limits.maximumVisits) return stop("visits", limits.maximumVisits);
    const signatureKey = rootScope ? memoKey("signature", identity) : null;
    const remembered = signatureKey === null ? undefined : memo.get(signatureKey);
    let retained: number | null = null;
    if (remembered !== undefined) {
      retained = storedSignature(storage, signatureIdentifier(remembered)).id;
    }
    const common: PlanBase = { key, blocked, depth, children: [], parents: [], edges: new Map(), memoKey: signatureKey,
      retained, redirect: null, changed: false, output: retained ?? identity };
    const selected: Plan = signature === null
      ? { ...common, kind: "type", identity: typeIdentifier(identity), value: storedType(storage, typeIdentifier(identity)) }
      : { ...common, kind: "signature", identity: signature.id, value: signature };
    nodes.set(key, selected);
    work.push(selected);
    return { kind: "complete", value: selected };
  };
  const initial = enqueue(kind, original, unblocked, 0);
  if (initial.kind === "resource-limit") return initial;
  const root = initial.value;
  const beforeMember = (kind: "union" | "intersection", count: number): ExpansionStop | null => {
    const maximum = kind === "union" ? limits.maximumUnionMembers : limits.maximumIntersectionMembers;
    return count > maximum ? stop(kind === "union" ? "union-members" : "intersection-members", maximum) : null;
  };
  for (const plan of work) {
    const child = (kind: "type" | "signature", identity: number, blocked = plan.blocked): ExpansionResult<Plan> => {
      const selected = enqueue(kind, identity, blocked, plan.depth + 1);
      if (selected.kind === "resource-limit") return selected;
      plan.children.push(selected.value); selected.value.parents.push(plan); plan.edges.set(`${kind}:${identity}`, selected.value);
      return selected;
    };
    if (plan.kind === "type" && (plan.value.kind === "param" || plan.value.kind === "self")) {
      const value = plan.value;
      const key = value.kind === "param" ? parameterKey(value.parameter) : `self:${value.owner}`;
      const replacement = value.kind === "param" ? parameters.get(key) : self.get(value.owner);
      if (!scopeHas(plan.blocked, key) && replacement?.kind === "bound" && replacement.type !== plan.identity) {
        const selected = child("type", replacement.type, block(plan.blocked, [key]));
        if (selected.kind === "resource-limit") return selected;
        plan.redirect = selected.value;
      }
    } else {
      if (plan.kind === "type" && (plan.value.kind === "union" || plan.value.kind === "intersection")) {
        const selected = beforeMember(plan.value.kind, plan.value.members.length);
        if (selected !== null) return selected;
      }
      const description = plan.kind === "type" ? inspectGraphValue({ kind: "type", value: plan.value })
        : inspectGraphValue({ kind: "signature", value: plan.value });
      for (const reference of description.references) {
        const selected = child(reference.kind, reference.identity);
        if (selected.kind === "resource-limit") return selected;
      }
    }
  }
  interface DepthFrame { readonly plan: Plan; readonly depth: number; readonly leave: boolean; readonly next: DepthFrame | null }
  let pending: DepthFrame | null = { plan: root, depth: 0, leave: false, next: null };
  const active = new Set<string>();
  const heights = new Map<string, number>();
  while (pending !== null) {
    const current: DepthFrame = pending;
    pending = current.next;
    if (current.leave) {
      let height = 0;
      for (const child of current.plan.children) if (!active.has(child.key)) height = Math.max(height, required(heights, child.key) + 1);
      heights.set(current.plan.key, height); active.delete(current.plan.key);
    } else if (!active.has(current.plan.key)) {
      const height = heights.get(current.plan.key);
      if (height !== undefined) {
        if (current.depth + height > limits.maximumDepth) return stop("depth", limits.maximumDepth);
      } else {
        if (current.depth > limits.maximumDepth) return stop("depth", limits.maximumDepth);
        active.add(current.plan.key);
        pending = { ...current, leave: true, next: pending };
        for (const child of current.plan.children) pending = { plan: child, depth: current.depth + 1, leave: false, next: pending };
      }
    }
  }
  const changed: Plan[] = [];
  for (const plan of work) if (plan.retained !== null && plan.retained !== plan.identity
    || plan.redirect !== null && target(plan).identity !== plan.identity) { plan.changed = true; changed.push(plan); }
  for (const plan of changed) for (const parent of plan.parents) if (!parent.changed) { parent.changed = true; changed.push(parent); }
  const typeBase = TypeArena.terms(storage).length;
  const signatureBase = TypeArena.signatures(storage).length;
  let nextType = typeBase;
  let nextSignature = signatureBase;
  for (const plan of work) if (plan.changed && plan.redirect === null && plan.retained === null)
    plan.output = plan.kind === "type" ? nextType++ : nextSignature++;
  const typeRows = new Map<number, TypeTerm>();
  const signatureRows = new Map<number, SignatureInput>();
  for (const plan of work) if (plan.changed && plan.redirect === null && plan.retained === null) {
    const typeOf = (type: TyId): TyId => typeIdentifier(edge(plan, "type", type).output);
    const signatureOf = (signature: SigId): SigId => signatureIdentifier(edge(plan, "signature", signature).output);
    if (plan.kind === "type") typeRows.set(plan.output, remapTerm(plan.value, typeOf, signatureOf));
    else signatureRows.set(plan.output, orderedSignature(remapSignature(plan.value, typeOf, signatureOf)));
  }
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
    if (!stage.queued) { stage.queued = true; tasks.push(stage); }
  };
  const invalidate = (stage: Stage): void => {
    const index = stage.kind === "type" ? keys : signatureKeys;
    if (stage.key !== null && index.get(stage.key) === stage.id) index.delete(stage.key);
  };
  const notify = (stage: Stage): void => {
    for (const parent of stage.parents.values()) { invalidate(parent); schedule(parent); }
  };
  const refresh = (stage: Stage): boolean => {
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
  const read = (value: TyId): TypeTerm => {
    const selected = resolveType(value);
    if (selected < typeBase) return storedType(storage, selected);
    const staged = required(types, selected);
    return remapTerm(staged.value, resolveType, resolveSignature);
  };
  for (const stage of types.values()) { refresh(stage); schedule(stage); }
  for (const stage of signatures.values()) { refresh(stage); schedule(stage); }
  let visits = nodes.size;
  for (const stage of tasks) {
    stage.queued = false;
    if (visits >= limits.maximumVisits) return stop("visits", limits.maximumVisits);
    visits += 1;
    const changed = refresh(stage);
    if (stage.kind === "type") {
      const emit = (value: TypeTerm): TyId => {
        const key = typeText(value);
        const existing = TypeArena.typeKeys(storage).get(key);
        if (existing !== undefined) {
          return typeIdentifier(existing);
        }
        const previous = keys.get(key);
        if (previous !== undefined) return typeIdentifier(resolve(previous, typeAliases));
        const id = typeIdentifier(nextType++);
        const created: TypeStage = { kind: "type", id, value, key: null, parents: new Map(), children: new Map(), queued: false };
        types.set(id, created); refresh(created); schedule(created);
        return id;
      };
      const selected = normalizeType(stage.value, read, emit, beforeMember);
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
  const finalTypes: TypeTerm[] = [];
  const finalSignatures: Signature[] = [];
  for (const [id, stage] of types) if (!typeAliases.has(id)) finalTypes.push(copyType(remapTerm(stage.value, compactType, compactSignature)));
  for (const [id, stage] of signatures) if (!signatureAliases.has(id)) finalSignatures.push(copySignature({
    id: compactSignature(signatureIdentifier(id)), ...orderedSignature(remapSignature(stage.value, compactType, compactSignature)) }));
  for (const value of finalTypes) {
    const id = typeIdentifier(TypeArena.terms(storage).length);
    TypeArena.terms(storage).push(value); TypeArena.typeKeys(storage).set(typeText(value), id);
  }
  for (const value of finalSignatures) {
    TypeArena.signatures(storage).push(value); TypeArena.signatureKeys(storage).set(signatureText(remapSignature(value, type => type, signature => signature)), value.id);
  }
  const value = kind === "type" ? compactType(typeIdentifier(target(root).output))
    : compactSignature(signatureIdentifier(target(root).output));
  for (const plan of work) if (plan.memoKey !== null)
    memo.set(plan.memoKey, compactSignature(signatureIdentifier(target(plan).output)));
  memo.set(cacheKey, value);
  TypeArena.substitutions(storage).set(environment.key, memo);
  return { kind: "complete", value };
}

function transformRoots<Identity extends number>(
  interner: TypeInterner, kind: "type" | "signature", roots: readonly Identity[],
  bindings: BindingVector, limits: TypeExpansionLimits, identity: (value: number) => Identity,
): ExpansionResult<readonly Identity[]> {
  const environment = prepareSubstitution(interner, bindings, limits);
  const values: Identity[] = [];
  for (const root of roots) {
    const selected = transform(environment, kind, root);
    if (selected.kind === "resource-limit") return selected;
    values.push(identity(selected.value));
  }
  return { kind: "complete", value: values };
}

export const substitute: Substitute = (interner, roots, bindings, limits) =>
  transformRoots(interner, "type", roots, bindings, limits, typeIdentifier);

export const substituteSignature: SubstituteSignature = (interner, roots, bindings, limits) =>
  transformRoots(interner, "signature", roots, bindings, limits, signatureIdentifier);
