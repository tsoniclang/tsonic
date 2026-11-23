import { encodeKey } from "../ids/index.js";
import type { TyId, SigId, DefId } from "../ids/contract.js";
import type { Substitute, SubstituteSignature, ProjectBindingValues, HasLexicalTypeDependency, ReadLexicalTypeSupport, TypeInterner, TypeTerm, SignatureInput, SignatureSubstitution, TypeBinding, BindingVector,
  SelfBinding, TypeExpansionLimits, TypeTableAdmissionWork, TypeTableAdmissionStop } from "./contract.js";
import { storedType, storedSignature } from "./interner.js";
import { TypeArena, type GraphIdentity } from "./arena.js";
import { remapTerm, remapConditional, remapSignature, orderedSignature, graphReferences, type GraphValue } from "./canonical.js";
import { stageGraph } from "./graph-stage.js";
import { readBindingKey, readBindingRows, typeIdentifier, signatureIdentifier, required, type BindingReader } from "./value.js";
import type { ExpansionResult, ExpansionStop, TypePublicationStop, TypePublicationWork } from "./work.js";
import { PublicationAccount, publicationAdmission } from "./work.js";
import { admitGraphType, admitGraphSignature, readStagedGraph } from "./publication-read.js";

interface ScopeNode { readonly id: number; readonly left: ScopeNode | null; readonly right: ScopeNode | null }
interface Scope { readonly root: ScopeNode | null; readonly height: number }
const unblocked: Scope = { root: null, height: 0 };
interface PlanBase {
  readonly key: string;
  readonly blocked: Scope;
  readonly depth: number;
  readonly children: Plan[];
  readonly parents: Plan[];
  readonly edges: Map<string | number, Plan>;
  readonly memoKey: string | null;
  readonly retained: number | null;
  redirect: Plan | null;
  changed: boolean;
  output: number;
}
type Plan = PlanBase & (
  | { readonly kind: "type"; readonly identity: TyId; readonly value: TypeTerm }
  | { readonly kind: "signature"; readonly identity: SigId; readonly value: SignatureInput; readonly applied: boolean }
);
type Dimension = "depth" | "visits" | "union-members" | "intersection-members";
interface SubstitutionEnvironment {
  readonly storage: TypeInterner;
  key: string;
  memo: Map<string, number>;
  readonly parameters: ReadonlyMap<DefId, TyId | null>;
  readonly self: ReadonlyMap<DefId, TyId | null>;
  readonly limits: TypeExpansionLimits;
  readonly goal: "extend" | "project";
  readonly absent: Set<string> | null;
  visits: number;
}

function visitBindingValue(environment: SubstitutionEnvironment): ExpansionStop | null {
  if (environment.visits >= environment.limits.maximumVisits) {
    return { kind: "resource-limit", dimension: "visits", maximum: environment.limits.maximumVisits };
  }
  environment.visits += 1;
  return null;
}

const parameterFamilies: readonly ("classBindings" | "methodBindings" | "capturedBindings")[] = [
  "classBindings", "methodBindings", "capturedBindings",
];

function parameterKey(value: DefId): string {
  return encodeKey([value]);
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

function prepareSubstitution<Stop extends TypeTableAdmissionStop>(
  interner: TypeInterner, bindings: BindingVector, limits: TypeExpansionLimits,
  commitment: TypeTableAdmissionWork<Stop>, goal: SubstitutionEnvironment["goal"],
): ExpansionResult<SubstitutionEnvironment> | Stop {
  admittedLimits(limits);
  const storage = interner;
  const parameters = new Map<DefId, TyId | null>();
  const self = new Map<DefId, TyId | null>();
  const environment: SubstitutionEnvironment = { storage, key: "", parameters, self, limits, goal,
    absent: goal === "project" ? new Set<string>() : null, visits: 0, memo: new Map<string, number>() };
  const admit = () => visitBindingValue(environment) ?? commitment.work(1);
  const read: BindingReader = (family, row) => {
    const lexicalSelf = family === "selfBindings";
    if (row === null) throw new TypeError(lexicalSelf ? "ir-types: a binding vector contains no self holes."
      : "ir-types: a binding vector contains no parameter holes.");
    const replacements = lexicalSelf ? self : parameters;
    if (replacements.has(row[1])) throw new Error(lexicalSelf ? "ir-types: a binding vector contains each lexical self owner once."
      : "ir-types: a binding vector contains each owner-qualified parameter once.");
    replacements.set(row[1], row[0] === "bound" ? row[2] : null);
  };
  if (goal === "extend") {
    const key = readBindingKey(bindings, admit, read);
    if (key.kind !== "complete") return key;
    environment.key = encodeKey([key.key, limits.maximumDepth, limits.maximumVisits,
      limits.maximumUnionMembers, limits.maximumIntersectionMembers]);
    environment.memo = TypeArena.substitutions(storage).get(environment.key) ?? environment.memo;
  } else {
    const stop = readBindingRows(bindings, admit, read);
    if (stop !== null) return stop;
  }
  return { kind: "complete", value: environment };
}

function lexicalScopes() {
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
  return { block, scopeHas };
}

function nestedPatternScope(graph: GraphValue, blocked: Scope, block: ReturnType<typeof lexicalScopes>["block"]): Scope | null {
  if (graph.kind !== "type" || graph.value.kind !== "projection" || graph.value.projection.kind !== "conditional") return null;
  const binder = graph.value.projection.inferParameter;
  return binder === null ? null : block(blocked, [parameterKey(binder)]);
}

function referenceScope(role: number, blocked: Scope, patternScope: Scope | null): Scope {
  return role === 1 || role === 2 ? patternScope ?? blocked : blocked;
}

export const readLexicalTypeSupport: ReadLexicalTypeSupport = (table, roots, scope, admission) => {
  const initial = admission.work(1);
  if (initial !== null) return initial;
  const setup = admission.retain(4);
  if (setup !== null) return setup;
  const parameters = new Set<string>();
  const selfOwners = new Set<DefId>();
  for (const family of [scope.classParameters, scope.methodParameters, scope.capturedParameters]) {
    for (let position = 0; position < family.length; position += 1) {
      const stop = admission.work(1) ?? admission.retain(1);
      if (stop !== null) return stop;
      const parameter = family[position];
      if (parameter === undefined) throw new TypeError("A lexical binding scope requires dense parameters.");
      parameters.add(parameterKey(parameter));
    }
  }
  for (let position = 0; position < scope.selfOwners.length; position += 1) {
    const stop = admission.work(1) ?? admission.retain(1);
    if (stop !== null) return stop;
    const owner = scope.selfOwners[position];
    if (owner === undefined) throw new TypeError("A lexical binding scope requires dense self owners.");
    selfOwners.add(owner);
  }

  const { block, scopeHas } = lexicalScopes();
  const seen = new Set<string>();
  const pending: { readonly reference: GraphIdentity; readonly blocked: Scope }[] = [];
  let dependent = false;
  for (let position = 0; position < roots.length; position += 1) {
    const rootRead = admission.work(1) ?? admission.retain(1);
    if (rootRead !== null) return rootRead;
    const identity = roots[position];
    if (identity === undefined) throw new TypeError("A lexical dependency scan requires dense roots.");
    pending.push({ reference: { kind: "type", identity }, blocked: unblocked });
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      const { reference } = next;
      const admit = admission.work(1);
      if (admit !== null) return admit;
      if (!Number.isSafeInteger(reference.identity) || reference.identity < 0 || Object.is(reference.identity, -0))
        return { kind: "complete", value: "invalid" };
      let graph: GraphValue;
      if (reference.kind === "type") {
        const value = table.terms[reference.identity];
        if (value === undefined) return { kind: "complete", value: "invalid" };
        graph = { kind: "type", value };
      } else {
        const value = table.signatures[reference.identity];
        if (value === undefined || value.id !== reference.identity) return { kind: "complete", value: "invalid" };
        graph = { kind: "signature", value };
      }
      const fields = graph.kind === "type"
        ? admitGraphType(graph.value, admission.work, () => null) : admitGraphSignature(graph.value, admission.work, () => null);
      if (fields !== null) return fields;
      const blocked = graph.kind === "type" ? next.blocked : block(next.blocked,
        graph.value.typeParameters.map(parameter => parameterKey(parameter.declaration)));
      const key = `${reference.kind}:${reference.identity}:${blocked.root?.id ?? 0}`;
      if (seen.has(key)) continue;
      const remember = admission.retain(1);
      if (remember !== null) return remember;
      seen.add(key);
      if (graph.kind === "type") {
        const term = graph.value;
        if (term.kind === "param") {
          const parameter = parameterKey(term.parameter);
          if (!scopeHas(blocked, parameter)) {
            if (!parameters.has(parameter)) return { kind: "complete", value: "foreign" };
            dependent = true;
          }
        } else if (term.kind === "self") {
          if (!selfOwners.has(term.owner)) return { kind: "complete", value: "foreign" };
          dependent = true;
        }
      }
      const patternScope = nestedPatternScope(graph, blocked, block);
      const children = graphReferences(graph);
      for (let child = children.length - 1; child >= 0; child -= 1) {
        const reserve = admission.work(1) ?? admission.retain(1);
        if (reserve !== null) return reserve;
        const edge = children[child];
        if (edge === undefined) throw new TypeError("A lexical dependency scan requires a dense canonical graph.");
        pending.push({ reference: edge, blocked: referenceScope(edge.role, blocked, patternScope) });
      }
    }
  }
  return { kind: "complete", value: dependent ? "dependent" : "independent" };
};

export const hasLexicalTypeDependency: HasLexicalTypeDependency = (interner, roots, scope, work) => {
  const result = readLexicalTypeSupport(TypeArena.view(interner), roots, scope, publicationAdmission(work));
  if (result.kind !== "complete") return result;
  if (result.value === "foreign" || result.value === "invalid")
    throw new TypeError("An inferred application requires its actual closed or lexically supported type references.");
  return { kind: "complete", value: result.value === "dependent" };
};

function transform<Stop extends TypeTableAdmissionStop>(
  environment: SubstitutionEnvironment, kind: "type" | "signature", original: number,
  mode: SignatureSubstitution, commitment: TypeTableAdmissionWork<Stop>,
): ExpansionResult<number | null> | Stop {
  const { storage, parameters, self, limits, memo } = environment;
  const stop = (dimension: Dimension, maximum: number): ExpansionStop => ({ kind: "resource-limit", dimension, maximum });
  const memoKey = (kind: "type" | "signature", identity: number, scope: SignatureSubstitution): string =>
    encodeKey([scope === "selected" ? "selected-signature" : kind, identity]);
  const cacheKey = memoKey(kind, original, mode);
  if (environment.absent?.has(cacheKey) === true) return { kind: "complete", value: null };
  const retained = memo.get(cacheKey);
  if (retained !== undefined) {
    const admission = commitment.work(1);
    if (admission !== null) return admission;
    if (kind === "type") storedType(storage, typeIdentifier(retained));
    else storedSignature(storage, signatureIdentifier(retained));
    return { kind: "complete", value: retained };
  }
  const { block, scopeHas } = lexicalScopes();
  const nodes = new Map<string, Plan>();
  const work: Plan[] = [];
  const enqueue = (kind: "type" | "signature", identity: number, inherited: Scope, depth: number,
    scope: SignatureSubstitution): ExpansionResult<Plan> | Stop => {
    const admission = commitment.work(1);
    if (admission !== null) return admission;
    const signature = kind === "signature" ? storedSignature(storage, signatureIdentifier(identity)) : null;
    if (signature !== null) {
      const fields = admitGraphSignature(signature, commitment.work, () => null);
      if (fields !== null) return fields;
    }
    let blocked = inherited;
    let rootScope = false;
    let value: SignatureInput | null = signature;
    if (value !== null) {
      if (scope === "selected" && value.typeParameters.length !== 0) {
        const remaining = value.typeParameters.filter(parameter => (parameters.get(parameter.declaration) ?? null) === null);
        if (remaining.length !== value.typeParameters.length) value = { ...value, typeParameters: remaining };
      }
      const keys = value.typeParameters.map(parameter => parameterKey(parameter.declaration));
      blocked = block(inherited, keys);
      rootScope = block(unblocked, keys).root === blocked.root;
    }
    const applied = value !== signature;
    const key = encodeKey([applied ? "selected-signature" : kind, identity, blocked.root === null ? 0 : blocked.root.id]);
    const previous = nodes.get(key);
    if (previous !== undefined) return { kind: "complete", value: previous };
    if (depth > limits.maximumDepth) return stop("depth", limits.maximumDepth);
    if (environment.visits >= limits.maximumVisits) return stop("visits", limits.maximumVisits);
    environment.visits += 1;
    const signatureKey = rootScope ? memoKey("signature", identity, applied ? "selected" : "lexical") : null;
    const remembered = signatureKey === null ? undefined : memo.get(signatureKey);
    let retained: number | null = null;
    if (remembered !== undefined) {
      const admission = commitment.work(1);
      if (admission !== null) return admission;
      retained = storedSignature(storage, signatureIdentifier(remembered)).id;
    }
    const common: PlanBase = { key, blocked, depth, children: [], parents: [], edges: new Map(), memoKey: signatureKey,
      retained, redirect: null, changed: false, output: retained ?? identity };
    const selected: Plan = value === null
      ? { ...common, kind: "type", identity: typeIdentifier(identity), value: storedType(storage, typeIdentifier(identity)) }
      : { ...common, kind: "signature", identity: signatureIdentifier(identity), value, applied };
    nodes.set(key, selected);
    work.push(selected);
    return { kind: "complete", value: selected };
  };
  const initial = enqueue(kind, original, unblocked, 0, mode);
  if (initial.kind !== "complete") return initial;
  const root = initial.value;
  const beforeMember = (kind: "union" | "intersection", count: number): ExpansionStop | null => {
    const maximum = kind === "union" ? limits.maximumUnionMembers : limits.maximumIntersectionMembers;
    return count > maximum ? stop(kind === "union" ? "union-members" : "intersection-members", maximum) : null;
  };
  for (const plan of work) {
    const child = (kind: "type" | "signature", identity: number, blocked = plan.blocked,
      edge: string | number = `${kind}:${identity}`): ExpansionResult<Plan> | Stop => {
      const selected = enqueue(kind, identity, blocked, plan.depth + 1, "lexical");
      if (selected.kind !== "complete") return selected;
      plan.children.push(selected.value); selected.value.parents.push(plan); plan.edges.set(edge, selected.value);
      return selected;
    };
    if (plan.kind === "type" && (plan.value.kind === "param" || plan.value.kind === "self")) {
      const value = plan.value;
      const key = value.kind === "param" ? parameterKey(value.parameter) : `self:${value.owner}`;
      const replacement = value.kind === "param" ? parameters.get(value.parameter) : self.get(value.owner);
      if (!scopeHas(plan.blocked, key) && replacement !== undefined && replacement !== null && replacement !== plan.identity) {
        const selected = child("type", replacement, block(plan.blocked, [key]));
        if (selected.kind !== "complete") return selected;
        plan.redirect = selected.value;
      }
    } else {
      if (plan.kind === "type" && (plan.value.kind === "union" || plan.value.kind === "intersection")) {
        const selected = beforeMember(plan.value.kind, plan.value.members.length);
        if (selected !== null) return selected;
      }
      if (plan.kind === "type") {
        const fields = admitGraphType(plan.value, commitment.work, () => null);
        if (fields !== null) return fields;
      }
      const patternScope = nestedPatternScope(plan, plan.blocked, block);
      for (const reference of graphReferences(plan)) {
        const selected = patternScope === null ? child(reference.kind, reference.identity) : child(reference.kind, reference.identity,
          referenceScope(reference.role, plan.blocked, patternScope), reference.role);
        if (selected.kind !== "complete") return selected;
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
  for (const plan of work) if (plan.kind === "signature" && plan.applied || plan.retained !== null && plan.retained !== plan.identity
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
    if (environment.goal === "project") {
      const retained = commitment.retain(1);
      if (retained !== null) return retained;
    }
    const typeOf = (type: TyId): TyId => typeIdentifier(edge(plan, "type", type).output);
    const signatureOf = (signature: SigId): SigId => signatureIdentifier(edge(plan, "signature", signature).output);
    if (plan.kind === "type") {
      const value = plan.value;
      typeRows.set(plan.output, value.kind === "projection" && value.projection.kind === "conditional" && value.projection.inferParameter !== null
        ? remapConditional(value.source, value.projection, (_type, role) => typeIdentifier(target(required(plan.edges, role)).output))
        : remapTerm(value, typeOf, signatureOf));
    }
    else signatureRows.set(plan.output, orderedSignature(remapSignature(plan.value, typeOf, signatureOf)));
  }
  const admit = (count = 1): ExpansionStop | Stop | null => {
    if (count > limits.maximumVisits - environment.visits) return stop("visits", limits.maximumVisits);
    environment.visits += count;
    return commitment.work(count);
  };
  const staged = stageGraph<ExpansionStop | Stop>(storage, typeRows, signatureRows, {
    step: admit,
    growth: commitment.work,
    ...readStagedGraph(commitment.work),
    ...(environment.goal === "project" ? { project: true } : {
      commitType: (value: TypeTerm) => admitGraphType(value, commitment.work, commitment.retain),
      commitSignature: (value: SignatureInput) => admitGraphSignature(value, commitment.work, commitment.retain),
    }),
    beforeMember,
  });
  if (staged.kind !== "complete") return staged;
  const projected = environment.goal === "project";
  const compactType = (value: TyId): TyId | null => value < typeBase ? value
    : projected ? staged.value.types.get(value) ?? null : required(staged.value.types, value);
  const compactSignature = (value: SigId): SigId | null => value < signatureBase ? value
    : projected ? staged.value.signatures.get(value) ?? null : required(staged.value.signatures, value);
  const value = kind === "type" ? compactType(typeIdentifier(target(root).output))
    : compactSignature(signatureIdentifier(target(root).output));
  if (!projected) {
    for (const plan of work) if (plan.memoKey !== null) {
      const signature = compactSignature(signatureIdentifier(target(plan).output));
      if (signature === null) throw new TypeError("A promoted signature must retain its admitted row.");
      memo.set(plan.memoKey, signature);
    }
    TypeArena.substitutions(storage).set(environment.key, memo);
  }
  if (value !== null) memo.set(cacheKey, value);
  else environment.absent?.add(cacheKey);
  return { kind: "complete", value };
}

function transformRoots<Identity extends number, Stop extends TypeTableAdmissionStop>(
  interner: TypeInterner, kind: "type" | "signature", roots: readonly Identity[],
  bindings: BindingVector, limits: TypeExpansionLimits, identity: (value: number) => Identity, mode: SignatureSubstitution,
  commitment: TypeTableAdmissionWork<Stop>,
): ExpansionResult<readonly Identity[]> | Stop {
  const initial = commitment.work(0);
  if (initial !== null) return initial;
  const prepared = prepareSubstitution(interner, bindings, limits, commitment, "extend");
  if (prepared.kind !== "complete") return prepared;
  const environment = prepared.value;
  const values: Identity[] = [];
  for (let position = 0; position < roots.length; position += 1) {
    const stop = visitBindingValue(environment) ?? commitment.work(1);
    if (stop !== null) return stop;
    const root = roots[position];
    if (root === undefined) throw new TypeError("ir-types: a substitution root vector contains no holes.");
    const selected = transform(environment, kind, root, mode, commitment);
    if (selected.kind !== "complete") return selected;
    if (selected.value === null) throw new TypeError("A promoted substitution root must retain its admitted row.");
    values.push(identity(selected.value));
  }
  return { kind: "complete", value: values };
}

function constructionAdmission<Stop extends TypeTableAdmissionStop>(
  commitment: TypePublicationWork | TypeTableAdmissionWork<Stop>,
): TypeTableAdmissionWork<Stop | TypePublicationStop> {
  return commitment instanceof PublicationAccount ? publicationAdmission(commitment) : commitment;
}

export const substitute: Substitute = (interner, roots, bindings, limits, commitment) =>
  transformRoots(interner, "type", roots, bindings, limits, typeIdentifier, "lexical", constructionAdmission(commitment));

export const substituteSignature: SubstituteSignature = (interner, roots, bindings, limits, mode, commitment) => {
  if (mode !== "lexical" && mode !== "selected") throw new TypeError("ir-types: signature substitution requires its actual root mode.");
  return transformRoots(interner, "signature", roots, bindings, limits, signatureIdentifier, mode, constructionAdmission(commitment));
};

export const projectBindingValues: ProjectBindingValues = (interner, input, bindings, limits, account) => {
  const initial = account.work(0) ?? account.retain(2);
  if (initial !== null) return initial;
  const prepared = prepareSubstitution(interner, bindings, limits, account, "project");
  if (prepared.kind !== "complete") return prepared;
  const environment = prepared.value;
  const types: (TyId | null)[] = [];
  const values: (BindingVector | null)[] = [];
  const entry = (records: number) => visitBindingValue(environment) ?? account.work(1) ?? account.retain(records);
  for (let position = 0; position < input.types.length; position += 1) {
    const stop = entry(1);
    if (stop !== null) return stop;
    const type = input.types[position];
    if (type === undefined) throw new TypeError("ir-types: a substitution root vector contains no holes.");
    const result = transform(environment, "type", type, "lexical", account);
    if (result.kind !== "complete") return result;
    types.push(result.value === null ? null : typeIdentifier(result.value));
  }
  for (let position = 0; position < input.bindings.length; position += 1) {
    const stop = entry(1);
    if (stop !== null) return stop;
    const vector = input.bindings[position];
    if (vector === undefined) throw new TypeError("ir-types: a binding-value vector contains no holes.");
    const allocation = account.retain(4);
    if (allocation !== null) return allocation;
    let complete = true;
    const output: { classBindings: TypeBinding[]; methodBindings: TypeBinding[];
      capturedBindings: TypeBinding[]; selfBindings: SelfBinding[] } = {
      classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
    };
    for (const family of parameterFamilies) {
      const bindings = vector[family];
      for (let position = 0; position < bindings.length; position += 1) {
        const stop = entry(1);
        if (stop !== null) return stop;
        const original = bindings[position];
        if (original === undefined) throw new TypeError("ir-types: a binding vector contains no parameter holes.");
        const parameter = original.parameter;
        const type = original.kind === "rigid" ? environment.parameters.get(parameter) ?? null : original.type;
        if (type === null) output[family].push(original);
        else {
          const result = transform(environment, "type", type, "lexical", account);
          if (result.kind !== "complete") return result;
          if (result.value === null) complete = false;
          else output[family].push({ kind: "bound", parameter, type: typeIdentifier(result.value) });
        }
      }
    }
    const selfBindings = vector.selfBindings;
    for (let position = 0; position < selfBindings.length; position += 1) {
      const stop = entry(1);
      if (stop !== null) return stop;
      const original = selfBindings[position];
      if (original === undefined) throw new TypeError("ir-types: a binding vector contains no self holes.");
      const owner = original.owner;
      const type = original.kind === "rigid" ? environment.self.get(owner) ?? null : original.type;
      if (type === null) output.selfBindings.push(original);
      else {
        const result = transform(environment, "type", type, "lexical", account);
        if (result.kind !== "complete") return result;
        if (result.value === null) complete = false;
        else output.selfBindings.push({ kind: "bound", owner, type: typeIdentifier(result.value) });
      }
    }
    values.push(complete ? output : null);
  }
  return { kind: "complete", value: { types, bindings: values } };
};
