import type { BodyId, DefId, GroupId, SigId, TyId } from "../ids/contract.js";
import type { Violation } from "../diag/contract.js";
import type { BindingScope, BindingVerificationInput, TypeEvidence, TypeParameterIdentity, TypeTable, TypeRule, TypeSite } from "../ir-types/contract.js";
import type { CallConstraint, ConstructConstraint, InferredSignaturePart, InferRule, InferSite, InferVerificationInput, VerifyInference } from "./contract.js";
import { encodeGroupId, encodeKey } from "../ids/index.js";
import { verifyTypes } from "../ir-types/index.js";
import { createDataVisitor } from "./print.js";
import type { DataVisitor } from "./print.js";
import type { TextRoot } from "./text-decisions.js";
import { candidateKey, compareNumber, compareText, constraintKey, emit, makeInventory, nodeKey, ordinal, signatureReferences, termReferences, verifyContributions } from "./verify-contributions.js";
import type { Inventory } from "./verify-contributions.js";
import { verifySolution, visitBindings } from "./verify-solution.js";

const parts = Object.freeze(["return", "yield", "variable", "field", "parameter-initializer"]);
const kinds = Object.freeze(["signature", "local", "binder", "literal"]);

export function signaturePartKey(value: InferredSignaturePart): string {
  return encodeKey([value.definition, value.part.kind, value.part.kind === "parameter-initializer" ? value.part.index : null]);
}

function comparePart(left: InferredSignaturePart, right: InferredSignaturePart): number {
  return compareText(left.definition, right.definition) || compareNumber(parts.indexOf(left.part.kind), parts.indexOf(right.part.kind)) ||
    (left.part.kind === "parameter-initializer" && right.part.kind === "parameter-initializer"
      ? compareNumber(left.part.index, right.part.index) : 0);
}

export function verifyGroup(input: InferVerificationInput, output: Violation<InferRule, InferSite>[]): Inventory {
  const inventory = makeInventory(input);
  const groupSite: InferSite = { kind: "group", group: input.group.id };
  const first = input.group.bodies[0];
  if (first === undefined) emit(output, "group-order", groupSite, "bodies");
  else if (encodeGroupId([first, ...input.group.bodies.slice(1)]) !== input.group.id)
    emit(output, "group-order", groupSite, "id");
  let previousBody: string | null = null;
  const bodies = new Set(input.group.bodies);
  for (const body of input.group.bodies) {
    if (previousBody !== null && compareText(previousBody, body) >= 0) emit(output, "group-order", groupSite, "bodies");
    previousBody = body;
  }
  const signatures = new Set<string>();
  let previousPart: InferredSignaturePart | null = null;
  for (const signature of input.group.signatures) {
    const key = signaturePartKey(signature);
    if (previousPart !== null && comparePart(previousPart, signature) >= 0 || signatures.has(key) ||
      signature.part.kind === "parameter-initializer" && !ordinal(signature.part.index))
      emit(output, "inferred-part-identity", groupSite, "signatures");
    signatures.add(key); previousPart = signature;
  }
  const owned = new Set<string>();
  const variableIds = new Set<number>();
  let variableCount = 0;
  for (const set of input.constraints) {
    const bodySite: InferSite = { kind: "body", body: set.body };
    if (set.group !== input.group.id || !bodies.has(set.body) || owned.has(set.body))
      emit(output, "group-ownership", bodySite, "constraints");
    owned.add(set.body);
    let previousNode: number | null = null;
    let previousKind = -1;
    let previousVariable: number | null = null;
    for (const variable of set.variables) {
      variableCount += 1;
      const site: InferSite = { kind: "variable", group: input.group.id, variable: variable.id };
      if (!ordinal(variable.id) || variableIds.has(variable.id)) emit(output, "variable-id-dense", site, "id");
      variableIds.add(variable.id);
      const kind = kinds.indexOf(variable.kind);
      if (previousNode !== null && (compareNumber(variable.occurrence.node, previousNode) < 0 ||
        compareNumber(variable.occurrence.node, previousNode) === 0 && kind < previousKind) ||
        previousVariable !== null && compareNumber(variable.id, previousVariable) <= 0)
        emit(output, "variable-order", site, "variables");
      previousNode = variable.occurrence.node; previousKind = kind; previousVariable = variable.id;
      if (variable.occurrence.body !== set.body) emit(output, "group-ownership", site, "occurrence");
      if (variable.kind === "signature" && !signatures.has(signaturePartKey(variable.signature)))
        emit(output, "inferred-part-identity", site, "signature");
    }
    const candidateIds = new Set<number>();
    let previousList: number | null = null;
    for (const list of set.candidates) {
      if (!ordinal(list.id) || candidateIds.has(list.id) || previousList !== null && compareNumber(list.id, previousList) <= 0)
        emit(output, "candidate-order", bodySite, "candidates");
      candidateIds.add(list.id); previousList = list.id;
      let previousCandidate: number | null = null;
      for (const candidate of list.candidates) {
        if (!ordinal(candidate.ordinal) || previousCandidate !== null && compareNumber(candidate.ordinal, previousCandidate) <= 0)
          emit(output, "candidate-order", bodySite, "ordinal");
        previousCandidate = candidate.ordinal;
      }
    }
    for (const [index, constraint] of set.constraints.entries()) {
      const reference = { body: set.body, index };
      const site: InferSite = { kind: "constraint", constraint: reference };
      if (constraint.occurrence.body !== set.body) emit(output, "group-ownership", site, "occurrence");
      if ((constraint.kind === "call" || constraint.kind === "construct") &&
        !inventory.candidates.has(candidateKey(set.body, constraint.application.candidates)))
        emit(output, "candidate-reference", site, "candidates");
      if (constraint.kind === "discharge") {
        for (const obligation of constraint.obligations)
          if (!ordinal(obligation.index) || !inventory.constraints.has(constraintKey(obligation)))
            emit(output, "constraint-reference", site, "obligations");
      }
      if (constraint.kind === "default" && (!ordinal(constraint.variable) || !inventory.variables.has(constraint.variable)))
        emit(output, "open-term-resolves", site, "variable");
    }
  }
  if (owned.size !== bodies.size) emit(output, "group-ownership", groupSite, "bodies");
  for (let id = 0; id < variableCount; id += 1) {
    if (!variableIds.has(id)) emit(output, "variable-id-dense", { kind: "variable", group: input.group.id, variable: id }, "id");
  }
  return inventory;
}

interface ClosureNode {
  flags: number;
  readonly parents: ClosureNode[];
  readonly references: { readonly types: readonly TyId[]; readonly signatures: readonly SigId[] };
}

interface ClosureFlags {
  readonly types: ReadonlyMap<number, number>;
  readonly signatures: ReadonlyMap<number, number>;
}

export function typeClosure(table: TypeTable, group: GroupId, inventory: Inventory, visitData: DataVisitor): ClosureFlags {
  const types = new Map<number, ClosureNode>();
  const signatures = new Map<number, ClosureNode>();
  for (const [index, term] of table.terms.entries()) {
    if (term === undefined) continue;
    types.set(index, {
      flags: term.kind === "open" ? 4 | (ordinal(term.variable) && inventory.variables.has(term.variable) ? 0 : 1) | (term.group === group ? 0 : 2) : 0,
      parents: [], references: termReferences(term, visitData, `$.types.terms[${index}]`),
    });
  }
  for (const [index, signature] of table.signatures.entries()) {
    if (signature === undefined) continue;
    signatures.set(index, { flags: 0, parents: [], references: signatureReferences(signature) });
  }
  const pending: ClosureNode[] = [];
  for (const node of [...types.values(), ...signatures.values()]) {
    for (const reference of node.references.types) {
      const child = ordinal(reference) ? types.get(reference) : undefined;
      if (child === undefined) node.flags |= 8;
      else child.parents.push(node);
    }
    for (const reference of node.references.signatures) {
      const child = ordinal(reference) ? signatures.get(reference) : undefined;
      if (child === undefined) node.flags |= 8;
      else child.parents.push(node);
    }
    if (node.flags !== 0) pending.push(node);
  }
  for (const child of pending) for (const parent of child.parents) {
    const after = parent.flags | child.flags;
    if (after !== parent.flags) { parent.flags = after; pending.push(parent); }
  }
  return { types: new Map([...types].map(([index, node]) => [index, node.flags])),
    signatures: new Map([...signatures].map(([index, node]) => [index, node.flags])) };
}

function sameScopeParameters(left: readonly TypeParameterIdentity[], right: readonly TypeParameterIdentity[]): boolean {
  for (let index = 0; index < left.length; index += 1) {
    const expected = left[index];
    const actual = right[index];
    if (expected === undefined || actual === undefined || expected.owner.length !== actual.owner.length || expected.owner !== actual.owner ||
      !Object.is(expected.index, actual.index)) return false;
  }
  return true;
}

function sameScope(left: BindingScope, right: BindingScope): boolean {
  if (left.classParameters.length !== right.classParameters.length ||
    left.methodParameters.length !== right.methodParameters.length ||
    left.capturedParameters.length !== right.capturedParameters.length ||
    left.selfOwners.length !== right.selfOwners.length) return false;
  if (!sameScopeParameters(left.classParameters, right.classParameters) ||
    !sameScopeParameters(left.methodParameters, right.methodParameters) ||
    !sameScopeParameters(left.capturedParameters, right.capturedParameters)) return false;
  for (let index = 0; index < left.selfOwners.length; index += 1) {
    const expected = left.selfOwners[index];
    const actual = right.selfOwners[index];
    if (expected === undefined || actual === undefined || expected.length !== actual.length || expected !== actual) return false;
  }
  return true;
}

function verifyDocument(visitData: DataVisitor, input: InferVerificationInput, flags: ClosureFlags, root: TextRoot,
  site: InferSite, final: boolean, output: Violation<InferRule, InferSite>[], path: string): void {
  let combined = 0;
  let invalidNode = false;
  let invalidLocal = false;
  let invalidDefinition = false;
  visitData(root, reference => {
    switch (reference.kind) {
      case "type": combined |= ordinal(reference.value) ? flags.types.get(reference.value) ?? 8 : 8; break;
      case "signature": combined |= ordinal(reference.value) ? flags.signatures.get(reference.value) ?? 8 : 8; break;
      case "node":
        if (!ordinal(reference.value.node) || !input.nodeExists({ kind: "body", value: reference.value })) invalidNode = true;
        break;
      case "item":
        if (!ordinal(reference.value.node) || !input.nodeExists({ kind: "item", value: reference.value })) invalidNode = true;
        break;
      case "local":
        if (!ordinal(reference.value.local) || !input.localExists(reference.value)) invalidLocal = true;
        break;
      case "definition": if (input.declarationOf(reference.value) === null) invalidDefinition = true; break;
    }
  }, path);
  if ((combined & 1) !== 0) emit(output, "open-term-resolves", site, "types");
  if ((combined & 2) !== 0) emit(output, "open-term-owner", site, "types");
  if (final && (combined & 4) !== 0) emit(output, "no-open-in-solution", site, "types");
  if ((combined & 8) !== 0) emit(output, "qualified-reference", site, "types");
  if (invalidNode) emit(output, "qualified-reference", site, "nodes");
  if (invalidLocal) emit(output, "qualified-reference", site, "locals");
  if (invalidDefinition) emit(output, "qualified-reference", site, "declarations");
}

interface BinderParameters {
  readonly class: ReadonlySet<string>;
  readonly method: ReadonlySet<string>;
  readonly captured: ReadonlySet<string>;
}

function verifyVariables(input: InferVerificationInput, inventory: Inventory, output: Violation<InferRule, InferSite>[]): void {
  const applications = new Map<string, { readonly body: BodyId; readonly value: CallConstraint | ConstructConstraint } | null>();
  const parametersByDeclaration = new Map<DefId, BinderParameters | null>();
  for (const constraint of inventory.constraints.values()) {
    if (constraint.value.kind === "call" || constraint.value.kind === "construct") {
      const key = nodeKey(constraint.value.occurrence);
      applications.set(key, applications.has(key) ? null : { body: constraint.set.body, value: constraint.value });
    }
  }
  let previous: number | null = null;
  for (const set of input.constraints) for (const variable of set.variables) {
    const site: InferSite = { kind: "variable", group: input.group.id, variable: variable.id };
    if (previous !== null && compareNumber(variable.id, previous) <= 0) emit(output, "variable-order", site, "groupVariables");
    previous = variable.id;
    if (variable.kind !== "binder") continue;
    const application = applications.get(nodeKey(variable.application));
    if (application === null || application === undefined) {
      emit(output, "candidate-reference", site, "application"); continue;
    }
    const list = inventory.candidates.get(candidateKey(application.body, application.value.application.candidates));
    const candidate = ordinal(variable.candidate) && list !== undefined
      ? inventory.originalCandidates.get(list)?.get(variable.candidate) : undefined;
    if (candidate === undefined || candidate === null) { emit(output, "candidate-reference", site, "candidate"); continue; }
    let families = parametersByDeclaration.get(candidate.declaration);
    if (families === undefined) {
      const declaration = input.declarationOf(candidate.declaration);
      families = declaration === null ? null : {
        class: new Set(declaration.scope.classParameters.map(parameter => encodeKey([parameter.owner, parameter.index]))),
        method: new Set(declaration.scope.methodParameters.map(parameter => encodeKey([parameter.owner, parameter.index]))),
        captured: new Set(declaration.scope.capturedParameters.map(parameter => encodeKey([parameter.owner, parameter.index]))),
      };
      parametersByDeclaration.set(candidate.declaration, families);
    }
    if (families === null) { emit(output, "candidate-reference", site, "candidate"); continue; }
    if (!ordinal(variable.parameter.index) ||
      !families[variable.family].has(encodeKey([variable.parameter.owner, variable.parameter.index])))
      emit(output, "binding-vector-complete", site, "parameter");
  }
}

interface TypeResultPosition {
  readonly position: number;
  readonly rule: TypeRule;
}

function forwardTypeViolations(violations: readonly Violation<TypeRule, TypeSite>[], bindingSites: readonly InferSite[],
  evidenceSites: readonly InferSite[], groupSite: InferSite, output: Violation<InferRule, InferSite>[]): void {
  const bindings = new Map<number, TypeResultPosition[]>();
  const evidence = new Map<number, TypeResultPosition[]>();
  const routed: { readonly site: InferSite; readonly rule: InferRule; readonly field: string }[] = [];
  const queue = (buckets: Map<number, TypeResultPosition[]>, index: number, result: TypeResultPosition) => {
    const current = buckets.get(index);
    if (current === undefined) buckets.set(index, [result]);
    else current.push(result);
  };
  for (const [position, violation] of violations.entries()) {
    if (violation.site.kind === "binding") queue(bindings, violation.site.vector, { position, rule: violation.rule });
    else if (violation.site.kind === "evidence") queue(evidence, violation.site.position, { position, rule: violation.rule });
    else routed[position] = { site: groupSite, rule: "qualified-reference", field: violation.rule };
  }
  const associate = (sites: readonly InferSite[], buckets: ReadonlyMap<number, readonly TypeResultPosition[]>, rule: InferRule) => {
    for (const [index, site] of sites.entries()) for (const result of buckets.get(index) ?? [])
      routed[result.position] = { site, rule, field: result.rule };
  };
  associate(bindingSites, bindings, "binding-vector-complete");
  associate(evidenceSites, evidence, "qualified-reference");
  for (const result of routed) emit(output, result.rule, result.site, result.field);
}

export const verifyInput: VerifyInference = input => {
  const visitData = createDataVisitor();
  const output: Violation<InferRule, InferSite>[] = [];
  const groupSite: InferSite = { kind: "group", group: input.group.id };
  const inventory = verifyGroup(input, output);
  verifyVariables(input, inventory, output);
  const flags = typeClosure(input.types, input.group.id, inventory, visitData);
  for (const signature of input.group.signatures) {
    const declaration = input.declarationOf(signature.definition);
    if (declaration === null || signature.part.kind === "parameter-initializer" &&
      (declaration.parameterCount === null || signature.part.index >= declaration.parameterCount))
      emit(output, "inferred-part-identity", groupSite, "declaration");
  }
  verifyContributions(input, inventory, flags.types, output, visitData);
  verifySolution(input, inventory, output);
  for (const [setIndex, set] of input.constraints.entries()) {
    const bodySite: InferSite = { kind: "body", body: set.body };
    const path = `$.constraints[${setIndex}]`;
    for (const [index, variable] of set.variables.entries()) verifyDocument(visitData, input, flags, { kind: "InferenceVariable", value: variable },
      { kind: "variable", group: input.group.id, variable: variable.id }, false, output, `${path}.variables[${index}]`);
    for (const [index, candidate] of set.candidates.entries())
      verifyDocument(visitData, input, flags, { kind: "HirCandidateList", value: candidate }, bodySite, false, output, `${path}.candidates[${index}]`);
    for (const [index, evidence] of set.evidence.entries())
      verifyDocument(visitData, input, flags, { kind: "TypeEvidence", value: evidence }, bodySite, false, output, `${path}.evidence[${index}]`);
    for (const [index, constraint] of set.constraints.entries()) verifyDocument(visitData, input, flags, { kind: "Constraint", value: constraint },
      { kind: "constraint", constraint: { body: set.body, index } }, false, output, `${path}.constraints[${index}]`);
  }
  for (const [index, contribution] of input.contributions.entries()) verifyDocument(visitData, input, flags, { kind: "AtomicContribution", value: contribution },
    { kind: "contribution", key: contribution.key }, false, output, `$.contributions[${index}]`);
  if (input.solution !== null) {
    for (const [index, variable] of input.solution.variables.entries()) verifyDocument(visitData, input, flags, { kind: "FinalVariable", value: variable },
      { kind: "variable", group: input.group.id, variable: variable.variable }, true, output, `$.solution.variables[${index}]`);
    for (const [index, constraint] of input.solution.constraints.entries()) verifyDocument(visitData, input, flags, { kind: "SolvedConstraint", value: constraint },
      { kind: "constraint", constraint: constraint.constraint }, true, output, `$.solution.constraints[${index}]`);
    for (const [index, check] of input.solution.checks.entries()) verifyDocument(visitData, input, flags, { kind: "RecordedCheck", value: check },
      { kind: "check", index }, true, output, `$.solution.checks[${index}]`);
    for (const [index, body] of input.solution.bodies.entries()) verifyDocument(visitData, input, flags, { kind: "BodyTyping", value: body },
      { kind: "body", body: body.body }, true, output, `$.solution.bodies[${index}]`);
  }
  const bindings: BindingVerificationInput[] = [];
  const bindingSites: InferSite[] = [];
  const evidence: TypeEvidence[] = [];
  const evidenceSites: InferSite[] = [];
  let scopePosition = 0;
  visitBindings(input, (vector, site, definition) => {
    const scope = input.bindingScopes[scopePosition];
    if (scope === undefined) emit(output, "binding-vector-complete", site, `bindingScopes[${scopePosition}]`);
    else {
      if (definition !== null) {
        const declaration = input.declarationOf(definition);
        if (declaration === null || !sameScope(declaration.scope, scope))
          emit(output, "binding-vector-complete", site, "declarationScope");
      }
      bindings.push({ vector, scope }); bindingSites.push(site);
    }
    scopePosition += 1;
  }, (value, site) => { evidence.push(value); evidenceSites.push(site); });
  for (; scopePosition < input.bindingScopes.length; scopePosition += 1)
    emit(output, "binding-vector-complete", groupSite, `bindingScopes[${scopePosition}]`);
  forwardTypeViolations(verifyTypes({ table: input.types, bindings, evidence, nominalOf: input.nominalOf,
    nodeExists: input.nodeExists, localExists: input.localExists }), bindingSites, evidenceSites, groupSite, output);
  return output;
};
