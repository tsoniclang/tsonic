import type { BodyId, GroupId, KeyData, NodeRef, SigId, TyId } from "../ids/contract.js";
import type { Violation } from "../diag/contract.js";
import type { HirCandidate, HirCandidateList } from "../ir-hir/contract.js";
import type { Signature, TypeTable, TypeTerm } from "../ir-types/contract.js";
import type {
  AtomicContribution, Constraint, ConstraintRef, ConstraintSet, ContributionKey, ContributionRole,
  InferenceVariable, InferRule, InferSite, InferVerificationInput,
} from "./contract.js";
import { encodeKey } from "../ids/index.js";
import type { DataVisitor } from "./print.js";

export interface OwnedConstraint {
  readonly set: ConstraintSet;
  readonly reference: ConstraintRef;
  readonly value: Constraint;
}

export interface Inventory {
  readonly sets: ReadonlyMap<BodyId, ConstraintSet>;
  readonly variables: ReadonlyMap<number, InferenceVariable>;
  readonly variableOwners: ReadonlyMap<number, BodyId>;
  readonly constraints: ReadonlyMap<string, OwnedConstraint>;
  readonly contributions: ReadonlyMap<string, OwnedContribution>;
  readonly candidates: ReadonlyMap<string, HirCandidateList>;
  readonly originalCandidates: ReadonlyMap<HirCandidateList, ReadonlyMap<number, HirCandidate | null>>;
}

interface OwnedContribution {
  readonly value: AtomicContribution;
  readonly bounds: ReadonlySet<number>;
}

export function emit(output: Violation<InferRule, InferSite>[], rule: InferRule, site: InferSite, field: string): void {
  output.push({ rule, site, detail: [{ kind: "text", value: field }] });
}

export function ordinal(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

export function compareNumber(left: number, right: number): number {
  if (Object.is(left, right)) return 0;
  if (Number.isNaN(left)) return 1;
  if (Number.isNaN(right)) return -1;
  if (left === 0 && right === 0) return Object.is(left, -0) ? -1 : 1;
  return left < right ? -1 : 1;
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function nodeKey(value: NodeRef): string {
  return encodeKey([value.body, value.node]);
}

export function constraintKey(value: ConstraintRef): string {
  return encodeKey([value.body, value.index]);
}

export function candidateKey(body: BodyId, candidate: number): string {
  return encodeKey([body, candidate]);
}

export function roleParts(role: ContributionRole): readonly KeyData[] {
  switch (role.kind) {
    case "equality": return [role.kind, role.direction];
    case "argument-flow": return [role.kind, role.argument, role.component];
    case "context-flow": return [role.kind, role.argument, role.parameter];
    case "closure-result-flow": return [role.kind, role.argument, role.result];
    case "construction-part": return [role.kind, role.part];
    case "flow": case "selection": case "receiver-flow": case "application-result": case "member": case "index":
    case "operator": case "literal": case "protocol": case "refinement": case "discharge": case "default": return [role.kind];
  }
}

function roleOrder(role: ContributionRole): readonly [number, number, number] {
  switch (role.kind) {
    case "equality": return [0, role.direction === "left-to-right" ? 0 : 1, 0];
    case "flow": return [1, 0, 0];
    case "selection": return [2, 0, 0];
    case "argument-flow": return [3, role.argument, role.component];
    case "receiver-flow": return [4, 0, 0];
    case "context-flow": return [5, role.argument, role.parameter];
    case "closure-result-flow": return [6, role.argument, role.result];
    case "application-result": return [7, 0, 0];
    case "member": return [8, 0, 0];
    case "index": return [9, 0, 0];
    case "operator": return [10, 0, 0];
    case "literal": return [11, 0, 0];
    case "protocol": return [12, 0, 0];
    case "refinement": return [13, 0, 0];
    case "discharge": return [14, 0, 0];
    case "default": return [15, 0, 0];
    case "construction-part": return [16, role.part, 0];
  }
}

export function contributionKey(value: ContributionKey): string {
  return encodeKey([value.node.body, value.node.node, value.candidate, roleParts(value.role)]);
}

export function compareContribution(left: ContributionKey, right: ContributionKey): number {
  const owner = compareText(left.node.body, right.node.body) || compareNumber(left.node.node, right.node.node);
  if (owner !== 0) return owner;
  if (!Object.is(left.candidate, right.candidate)) {
    if (left.candidate === null) return -1;
    if (right.candidate === null) return 1;
    const candidate = compareNumber(left.candidate, right.candidate);
    if (candidate !== 0) return candidate;
  }
  const first = roleOrder(left.role);
  const second = roleOrder(right.role);
  return compareNumber(first[0], second[0]) || compareNumber(first[1], second[1]) || compareNumber(first[2], second[2]);
}

export function makeInventory(input: InferVerificationInput): Inventory {
  const sets = new Map<BodyId, ConstraintSet>();
  const variables = new Map<number, InferenceVariable>();
  const variableOwners = new Map<number, BodyId>();
  const constraints = new Map<string, OwnedConstraint>();
  const contributions = new Map<string, OwnedContribution>();
  const candidates = new Map<string, HirCandidateList>();
  const originalCandidates = new Map<HirCandidateList, ReadonlyMap<number, HirCandidate | null>>();
  for (const set of input.constraints) {
    if (!sets.has(set.body)) sets.set(set.body, set);
    for (const variable of set.variables) {
      if (!variables.has(variable.id)) { variables.set(variable.id, variable); variableOwners.set(variable.id, set.body); }
    }
    for (const [index, value] of set.constraints.entries()) {
      const reference = { body: set.body, index };
      const key = constraintKey(reference);
      if (!constraints.has(key)) constraints.set(key, { set, reference, value });
    }
    for (const candidate of set.candidates) {
      const key = candidateKey(set.body, candidate.id);
      if (!candidates.has(key)) candidates.set(key, candidate);
      const originals = new Map<number, HirCandidate | null>();
      for (const original of candidate.candidates)
        originals.set(original.ordinal, originals.has(original.ordinal) ? null : original);
      originalCandidates.set(candidate, originals);
    }
  }
  for (const contribution of input.contributions) {
    const key = contributionKey(contribution.key);
    if (!contributions.has(key)) contributions.set(key, { value: contribution, bounds: new Set(contribution.bounds) });
  }
  return { sets, variables, variableOwners, constraints, contributions, candidates, originalCandidates };
}

function declared(values: readonly number[], variables: ReadonlyMap<number, InferenceVariable>): boolean {
  let previous = -1;
  for (const value of values) {
    if (!ordinal(value) || value <= previous || !variables.has(value)) return false;
    previous = value;
  }
  return true;
}

function roleMatches(value: Constraint, key: ContributionKey): boolean {
  const role = key.role;
  if (value.kind === "call" || value.kind === "construct") {
    if (role.kind === "selection") return key.candidate === null;
    if (key.candidate === null || !ordinal(key.candidate)) return false;
    switch (role.kind) {
      case "argument-flow": {
        const argument = value.application.arguments[role.argument];
        return ordinal(role.argument) && ordinal(role.component) && argument !== undefined &&
          (argument.tuple === null ? role.component === 0 : role.component < argument.tuple.length);
      }
      case "context-flow": return ordinal(role.argument) && ordinal(role.parameter) &&
        value.application.arguments[role.argument]?.closure !== null && value.application.arguments[role.argument] !== undefined;
      case "closure-result-flow": return ordinal(role.argument) && ordinal(role.result) &&
        value.application.arguments[role.argument]?.closure !== null && value.application.arguments[role.argument] !== undefined;
      case "receiver-flow": return value.application.receiver !== null;
      case "application-result": return true;
      case "equality": case "flow": case "member": case "index": case "operator": case "literal": case "protocol":
      case "refinement": case "discharge": case "default": case "construction-part": return false;
    }
  }
  if (key.candidate !== null) return false;
  switch (value.kind) {
    case "eq": return role.kind === "equality";
    case "flow": return role.kind === "flow";
    case "literal": return role.kind === "literal";
    case "op": return role.kind === "operator";
    case "member": return role.kind === "member";
    case "index": return role.kind === "index";
    case "construct-literal": return role.kind === "construction-part" && ordinal(role.part) && role.part < value.parts.length;
    case "protocol": return role.kind === "protocol";
    case "refine": return role.kind === "refinement";
    case "discharge": return role.kind === "discharge";
    case "default": return role.kind === "default";
    case "closure": return false;
  }
}

export function termReferences(term: TypeTerm, visitData: DataVisitor, path: string = "$"): { readonly types: readonly TyId[]; readonly signatures: readonly SigId[] } {
  switch (term.kind) {
    case "literal": return { types: [term.base], signatures: [] };
    case "union": case "intersection": return { types: term.members, signatures: [] };
    case "optional": return { types: [term.value], signatures: [] };
    case "array": case "fixed-array": return { types: [term.element], signatures: [] };
    case "tuple": return { types: term.elements.map(element => element.type), signatures: [] };
    case "declared": case "construction-reference": return { types: term.arguments, signatures: [] };
    case "shape": return {
      types: [...term.members.flatMap(member => [...member.read === null ? [] : [member.read], ...member.write === null ? [] : [member.write]]),
        ...term.indexes.flatMap(index => [index.key, index.read, ...index.write === null ? [] : [index.write]])],
      signatures: [...term.calls, ...term.constructs],
    };
    case "callable": return { types: [], signatures: [...term.calls, ...term.constructs] };
    case "projection": {
      const types = [term.source];
      const signatures: SigId[] = [];
      if (term.projection.kind === "component") visitData({ kind: "TypeComponent", value: term.projection.component }, reference => {
        if (reference.kind === "type") types.push(reference.value);
        else if (reference.kind === "signature") signatures.push(reference.value);
      }, `${path}.projection.component`);
      return { types, signatures };
    }
    case "primitive": case "string": case "intrinsic": case "enum": case "param": case "self": case "open": case "error":
      return { types: [], signatures: [] };
  }
}

export function signatureReferences(signature: Signature): { readonly types: readonly TyId[]; readonly signatures: readonly SigId[] } {
  return { types: [...signature.typeParameters.flatMap(parameter => [
    ...parameter.constraint === null ? [] : [parameter.constraint], ...parameter.default === null ? [] : [parameter.default]]),
  ...signature.receiver === null ? [] : [signature.receiver], ...signature.parameters.map(parameter => parameter.type), signature.result],
  signatures: signature.composition === null ? [] : signature.composition.signatures };
}

function boundsCoverTypes(table: TypeTable, group: GroupId, roots: readonly TyId[], bounds: ReadonlySet<number>, visitData: DataVisitor): boolean {
  const types = new Set<TyId>();
  const signatures = new Set<SigId>();
  const pending: ({ readonly kind: "type"; readonly id: TyId } | { readonly kind: "signature"; readonly id: SigId })[] =
    roots.map(id => ({ kind: "type", id }));
  for (let task = pending.pop(); task !== undefined; task = pending.pop()) {
    if (!ordinal(task.id)) continue;
    if (task.kind === "type") {
      if (types.has(task.id)) continue;
      types.add(task.id);
      const term = table.terms[task.id];
      if (term === undefined) continue;
      if (term.kind === "open" && term.group === group && !bounds.has(term.variable)) return false;
      const references = termReferences(term, visitData, `$.types.terms[${task.id}]`);
      for (const id of references.types) pending.push({ kind: "type", id });
      for (const id of references.signatures) pending.push({ kind: "signature", id });
    } else {
      if (signatures.has(task.id)) continue;
      signatures.add(task.id);
      const signature = table.signatures[task.id];
      if (signature === undefined) continue;
      const references = signatureReferences(signature);
      for (const id of references.types) pending.push({ kind: "type", id });
      for (const id of references.signatures) pending.push({ kind: "signature", id });
    }
  }
  return true;
}

function contributionFootprint(input: InferVerificationInput, inventory: Inventory,
  root: OwnedConstraint, typeFlags: ReadonlyMap<number, number>, bounds: ReadonlySet<number>, visitData: DataVisitor): boolean | null {
  const visited = new Set<string>();
  const variables = new Set<number>();
  const types = new Set<TyId>();
  const pending = [root];
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    const key = constraintKey(current.reference);
    if (visited.has(key)) continue;
    visited.add(key);
    const value = current.value;
    switch (value.kind) {
      case "eq": types.add(value.left); types.add(value.right); break;
      case "flow": types.add(value.from); types.add(value.to); break;
      case "literal": types.add(value.destination); break;
      case "op":
        for (const operand of value.operands) types.add(operand);
        types.add(value.result);
        break;
      case "refine": types.add(value.source); types.add(value.checked); types.add(value.result); break;
      case "closure":
        for (const capture of value.captures) types.add(capture);
        types.add(value.result);
        break;
      case "default":
        variables.add(value.variable);
        if (value.type !== null) types.add(value.type);
        break;
      case "discharge":
        for (const reference of value.obligations) {
          const obligation = inventory.constraints.get(constraintKey(reference));
          if (obligation !== undefined) pending.push(obligation);
        }
        break;
      case "member": case "index": case "construct-literal": case "call": case "construct": case "protocol": return null;
    }
  }
  for (const variable of variables) if (!bounds.has(variable)) return false;
  return boundsCoverTypes(input.types, input.group.id, [...types].filter(type => ((typeFlags.get(type) ?? 0) & 4) !== 0), bounds, visitData);
}

export function verifyContributions(input: InferVerificationInput, inventory: Inventory,
  typeFlags: ReadonlyMap<number, number>, output: Violation<InferRule, InferSite>[], visitData: DataVisitor): void {
  const seen = new Set<string>();
  const footprints = new Map<string, boolean | null>();
  let previous: ContributionKey | null = null;
  for (const contribution of input.contributions) {
    const site: InferSite = { kind: "contribution", key: contribution.key };
    const key = contributionKey(contribution.key);
    if (seen.has(key)) emit(output, "contribution-key-unique", site, "key");
    seen.add(key);
    if (previous !== null && compareContribution(previous, contribution.key) >= 0)
      emit(output, "contribution-order", site, "key");
    previous = contribution.key;
    const reference = constraintKey(contribution.constraint);
    const target = inventory.constraints.get(reference);
    if (target === undefined) emit(output, "constraint-reference", site, "constraint");
    else {
      const value = target.value;
      if (nodeKey(contribution.key.node) !== nodeKey(value.occurrence) || !roleMatches(value, contribution.key))
        emit(output, "contribution-role", site, "role");
      if (value.kind === "call" || value.kind === "construct") {
        const list = inventory.candidates.get(candidateKey(target.set.body, value.application.candidates));
        const selected = contribution.key.candidate;
        const candidate = selected !== null && ordinal(selected) && list !== undefined
          ? inventory.originalCandidates.get(list)?.get(selected) : undefined;
        if (selected !== null && (candidate === undefined || candidate === null))
          emit(output, "candidate-reference", site, "candidate");
      }
      const footprintKey = encodeKey([reference, contribution.bounds]);
      let footprint = footprints.get(footprintKey);
      if (footprint === undefined) {
        footprint = contributionFootprint(input, inventory, target, typeFlags, new Set(contribution.bounds), visitData);
        footprints.set(footprintKey, footprint);
      }
      if (footprint === false) emit(output, "contribution-footprint-complete", site, "bounds");
    }
    if (!declared(contribution.reads, inventory.variables))
      emit(output, "contribution-reads-bounds-declared", site, "reads");
    if (!declared(contribution.bounds, inventory.variables))
      emit(output, "contribution-reads-bounds-declared", site, "bounds");
  }
}
