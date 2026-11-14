import type { BodyId, CandidateListId, DefId, NodeId, SourceNodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { CheckedPhase, HirApplication, HirBody, HirCandidate, HirModule, HirNode } from "../ir-hir/contract.js";
import type { Diagnostic, Violation } from "../diag/contract.js";
import { childrenOfSyntax, hasOverloadEndpoints, indexSyntaxTree, walkSyntaxTree } from "../ir-hir/index.js";
import type { BindingVerificationInput, BodyInstance, TypeEvidence, TypeRule, TypeTable } from "../ir-types/contract.js";
import { verifyTypes } from "../ir-types/index.js";
import type { TirBindingTarget, TirBody, TirModule, TirNode, TirNodeSite, TirRule, TirSite, TirVerifierInput, TypedPhase, VerifyTir, VerifyTirModule } from "./contract.js";
import type { TirOccurrenceEmit, TirStructure, TirTypeGraph } from "./verify-occurrences.js";
import { collectTirSemantics, inspectTirStructure, sameLocalReference, sameSourceReference, typedValueOf, verifyDeferredParameters, verifyOccurrenceOperation, verifyOccurrenceRole, verifyOperationShape, verifyValueEndpoints } from "./verify-occurrences.js";
import type { TirDeclarationInventory, TirMemberInventory } from "./verify-applications.js";
import { applicationOf, declarationEndpoints, indexMembers, verifyActivation, verifyArgumentTransport, verifyCallEndpoints, verifyMemberDecision, verifyMemberSelection, verifyProtocolOperation, verifyProtocolRecord } from "./verify-applications.js";
import { sameBindingScope, verifyBindingSlots, verifyControlledContexts, verifyNestedPublication, verifyPublicationInventory, verifyPublishedInstance, verifyQualifiedReferences } from "./verify-instances.js";
import { sameSyntaxFields } from "./syntax-compare.js";
import { createTirLayouts } from "./text-model.js";

export interface TirSourceInventory {
  readonly original: HirBody | undefined;
  readonly sourceNodes: ReadonlyMap<NodeId, HirNode>;
  readonly typedNodes: ReadonlyMap<NodeId, TirNode>;
  readonly ownNodes: readonly TirNode[];
  readonly nestedRoots: ReadonlySet<NodeId>;
}

const validRange = (start: number, length: number): boolean =>
  Number.isSafeInteger(start) && !Object.is(start, -0) && start >= 0 &&
  Number.isSafeInteger(length) && !Object.is(length, -0) && length >= 0 && Number.isSafeInteger(start + length);

interface TirSourceBoundary {
  readonly original: HirBody | undefined;
  readonly nestedRoots: ReadonlySet<NodeId>;
}

interface IndexedTypeViolation {
  readonly ordinal: number;
  readonly rule: TypeRule;
}

interface MappedTypeViolation extends IndexedTypeViolation {
  readonly target: TirRule;
  readonly node: TirNode | null;
}

const indexTypeViolation = (
  index: Map<number, IndexedTypeViolation[]>, position: number, violation: IndexedTypeViolation,
): void => {
  const findings = index.get(position);
  if (findings === undefined) index.set(position, [violation]);
  else findings.push(violation);
};

const readSourceBoundary = (body: BodyId, source: HirModule): TirSourceBoundary => {
  const sourceBodies = new Map<BodyId, HirBody>();
  for (const candidate of source.bodies) if (candidate !== undefined) sourceBodies.set(candidate.body, candidate);
  const original = sourceBodies.get(body);
  const nestedRoots = new Set<NodeId>();
  if (original !== undefined) for (const nested of original.nestedBodies) {
    const candidate = sourceBodies.get(nested);
    if (candidate !== undefined) nestedRoots.add(candidate.root.id);
  }
  return { original, nestedRoots };
};

export const verifySourcePreservation = (
  body: TirBody, source: HirModule, module: TirModule, boundary: TirSourceBoundary, emit: TirOccurrenceEmit,
): TirSourceInventory => {
  const { original, nestedRoots } = boundary;
  const sourceNodes = new Map<NodeId, HirNode>();
  const typedNodes = new Map<NodeId, TirNode>();
  for (const node of indexSyntaxTree<CheckedPhase>(source.tree)) {
    sourceNodes.set(node.id, node);
  }
  for (const node of indexSyntaxTree<TypedPhase>(module.tree)) {
    typedNodes.set(node.id, node);
  }
  const ownNodes: TirNode[] = [];
  const pendingNodes: TirNode[] = [body.root];
  const ownObjects = new Set<object>();
  for (let node = pendingNodes.pop(); node !== undefined; node = pendingNodes.pop()) {
    if (ownObjects.has(node)) continue;
    ownObjects.add(node);
    ownNodes.push(node);
    const children = childrenOfSyntax<TypedPhase>(node);
    for (let position = children.length - 1; position >= 0; position--) {
      const child = children[position];
      if (child !== undefined) pendingNodes.push(child);
    }
  }
  const bodyNodes = new Set(original === undefined ? [] : walkSyntaxTree<CheckedPhase>(original.root, []).map((node: HirNode) => node.id));
  if (original === undefined || original.owner !== body.owner) {
    emit("body-owner", null, "body identity and owner do not retain the actual original body");
  }
  if (module.module !== source.module || body.root.origin.module !== source.module ||
    body.bindings.kind === "parametric" && typedNodes.get(body.root.id) !== body.root) {
    emit("module-node-identity", body.root, "body does not retain its module identity and canonical parametric subtree");
  }
  const paired: { node: TirNode; original: HirNode }[] = original === undefined ? [] : [{ node: body.root, original: original.root }];
  const sourceOfTyped = new Map<TirNode, HirNode>();
  const typedOfSource = new Map<HirNode, TirNode>();
  for (let pair = paired.pop(); pair !== undefined; pair = paired.pop()) {
    const node = pair.node;
    const checked = pair.original;
    const previousSource = sourceOfTyped.get(node);
    if (previousSource !== undefined) {
      if (previousSource !== checked) emit("authored-node-ids-preserved", node, "typed node identity differs from the actual authored node at this position");
      continue;
    }
    sourceOfTyped.set(node, checked);
    const previousTyped = typedOfSource.get(checked);
    if (previousTyped !== undefined) emit("no-inserted-nodes", node, "typed syntax duplicates an actual authored arena node");
    else typedOfSource.set(checked, node);
    if (!Object.is(node.id, checked.id)) emit("authored-node-ids-preserved", node, "typed node identity differs from the actual authored node at this position");
    if (!sourceNodes.has(node.id)) emit("no-inserted-nodes", node, "typed syntax includes a node not present in the actual source arena");
    if (!sameSyntaxFields(node, checked)) {
      emit("kind-children-shape", node, "typed syntax does not retain the authored kind, fields and child presence");
    }
    if (!Object.is(node.parent, checked.parent)) emit("parent-reference", node, "typed node parent differs from the real authored parent");
    let sameDerivation = node.origin.derived.length === checked.origin.derived.length;
    for (let position = 0; position < node.origin.derived.length; position++) {
      const derivation = node.origin.derived[position];
      const other = checked.origin.derived[position];
      if (derivation === undefined || other === undefined || derivation.kind !== other.kind ||
        derivation.kind === "lowering" && (other.kind !== "lowering" || derivation.pass !== other.pass) ||
        derivation.kind === "expansion" && (other.kind !== "expansion" || derivation.expansion !== other.expansion)) sameDerivation = false;
    }
    if (!validRange(node.origin.start, node.origin.length) || node.origin.module !== checked.origin.module ||
      node.origin.start !== checked.origin.start || node.origin.length !== checked.origin.length ||
      !validRange(node.loc.pos, node.loc.end - node.loc.pos) || node.loc.pos !== checked.loc.pos || node.loc.end !== checked.loc.end || !sameDerivation) {
      emit("origin-range", node, "typed origin or lexical range does not retain the actual source interval");
    }
    const children = childrenOfSyntax<TypedPhase>(node);
    const originals = childrenOfSyntax<CheckedPhase>(checked);
    for (let position = children.length - 1; position >= 0; position--) {
      const child = children[position];
      const sourceChild = originals[position];
      if (child !== undefined && sourceChild !== undefined) paired.push({ node: child, original: sourceChild });
      else if (child !== undefined) emit("no-inserted-nodes", child, "typed syntax adds an authored child position");
    }
  }
  if (original !== undefined && body.root.id !== original.root.id) {
    emit("node-in-body-range", body.root, "typed body root does not retain the actual original body subtree");
  }
  if (original !== undefined) for (const node of ownNodes) if (!bodyNodes.has(node.id)) {
    emit("node-in-body-range", node, "typed syntax contains a real or invented node outside its actual original body subtree");
  }
  return { original, sourceNodes, typedNodes, ownNodes, nestedRoots };
};

export const verifyBodyRecords = (body: TirBody, original: HirBody | undefined, emit: TirOccurrenceEmit): void => {
  for (const [position, local] of body.locals.entries()) {
    if (!Object.is(local.id, position)) {
      emit("local-dense", null, "local records are not dense in their actual body order");
      continue;
    }
    const checked = original?.locals[position];
    if (checked !== undefined && (!Object.is(local.id, checked.id) || local.name !== checked.name || local.role !== checked.role ||
      local.mutable !== checked.mutable || !sameSourceReference(local.declaration, checked.declaration))) {
      emit("binding-storage", null, "local storage is not associated with its real original binding");
    }
    if (local.capturedFrom !== null && local.capturedFrom.body === body.body ||
      local.role === "capture" && local.capturedFrom === null ||
      checked !== undefined && !sameLocalReference(local.capturedFrom, checked.capturedFrom)) {
      emit("capture-qualified", null, "captured local does not retain its actual qualified outer binding");
    }
  }
  if (original !== undefined && body.locals.length !== original.locals.length) {
    emit("binding-storage", null, "local inventory does not retain the actual source binding inventory");
  }
  let parameterOrder = original === undefined || body.params.length === original.params.length;
  for (const [position, parameter] of body.params.entries()) {
    const checked = original?.params[position];
    if (checked !== undefined && (!Object.is(parameter.local, checked.local) || parameter.declaration !== checked.declaration ||
      parameter.role !== checked.role || parameter.passing !== checked.passing || parameter.initializer !== checked.initializer)) parameterOrder = false;
    const local = body.locals[parameter.local];
    if (local === undefined || local.role !== "parameter" || !Object.is(local.storage, parameter.storage)) {
      emit("local-storage", null, "parameter storage does not retain its real local slot");
    }
    if (parameter.role === "this" && position !== 0 || parameter.role === "rest" && position !== body.params.length - 1) parameterOrder = false;
  }
  if (!parameterOrder) emit("parameter-order", null, "parameter records do not retain the actual declared formal order");
  let stable = original === undefined || body.captures.length === original.captures.length && body.nestedBodies.length === original.nestedBodies.length;
  for (const [position, capture] of body.captures.entries()) {
    const checked = original?.captures[position];
    if (capture.local.body === body.body) emit("capture-qualified", null, "capture inventory does not name a real qualified outer local");
    if (original !== undefined && (checked === undefined || !sameLocalReference(capture.local, checked))) stable = false;
  }
  for (const [position, nested] of body.nestedBodies.entries()) {
    if (original !== undefined && nested !== original.nestedBodies[position]) stable = false;
  }
  if (!stable) {
    emit("stable-order", null, "capture and nested-body inventories do not retain actual source order");
  }
  // A body created by a closure states the rows of the closure's outcome at its root: the decided rows, local, order and
  // logical capture; or, while the closure rule is saved for instantiation, the saved locals in order with no capture yet.
  // A body that no closure creates has no undecided row.
  const root = body.root;
  const outcome = root.kind === "ArrowFunction" || root.kind === "FunctionExpression" ? root.tsonic.closure : null;
  const decided = outcome?.kind === "decided" ? outcome.decision.captures : null;
  const saved = outcome?.kind === "deferred" && outcome.deferred.invocation.rule === "closure" ? outcome.deferred.invocation.input.captures : null;
  const named = decided ?? saved;
  if (named === null ? body.captures.some(row => row.capture === null)
    : body.captures.some((row, position) => {
      const stated = named[position];
      return stated === undefined || !sameLocalReference(row.local, stated.local) || row.capture !== ("capture" in stated ? stated.capture : null);
    }) || body.captures.length !== named.length) emit("capture-rows-agree", null, "body capture rows do not state the outcome of the closure that creates the body");
};

const validIndex = (value: number, length: number): boolean =>
  Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value < length;

export const verifyClosedReferences = (
  root: TirNode, structure: TirStructure, table: TypeTable, diagnostics: readonly Diagnostic[], emit: TirOccurrenceEmit,
): TirTypeGraph => {
  const reverse = new Map<number, number[]>();
  const children = new Map<number, number[]>();
  const invalid = new Set<number>();
  const errors = new Set<number>();
  const errorOrigins = new Set<string>();
  let bodyError = false;
  for (const diagnostic of diagnostics) if (diagnostic !== undefined && diagnostic.severity === "error" && diagnostic.site.kind === "source") {
    const origin = diagnostic.site.origin;
    errorOrigins.add(encodeKey([origin.module, origin.start, origin.length]));
    if (origin.module === root.origin.module && origin.start >= root.origin.start &&
      origin.start + origin.length <= root.origin.start + root.origin.length) bodyError = true;
  }
  const offset = table.terms.length;
  const edge = (owner: number, target: number, signature = false): void => {
    if (!validIndex(target, signature ? table.signatures.length : table.terms.length)) { invalid.add(owner); return; }
    const selected = signature ? target + offset : target;
    const outgoing = children.get(owner) ?? [];
    outgoing.push(selected);
    children.set(owner, outgoing);
    const incoming = reverse.get(selected) ?? [];
    incoming.push(owner);
    reverse.set(selected, incoming);
  };
  for (let position = 0; position < table.terms.length; position++) {
    const term = table.terms[position];
    if (term === undefined) { invalid.add(position); continue; }
    switch (term.kind) {
      case "open": invalid.add(position); break;
      case "error": errors.add(position); break;
      case "literal": edge(position, term.base); break;
      case "union": case "intersection": for (const child of term.members) edge(position, child); break;
      case "optional": edge(position, term.value); break;
      case "array": case "fixed-array": edge(position, term.element); break;
      case "tuple": for (const child of term.elements) if (child !== undefined) edge(position, child.type); break;
      case "shape":
        for (const member of term.members) if (member !== undefined) {
          if (member.read !== null) edge(position, member.read);
          if (member.write !== null) edge(position, member.write);
        }
        for (const index of term.indexes) if (index !== undefined) {
          edge(position, index.key); edge(position, index.read);
          if (index.write !== null) edge(position, index.write);
        }
        for (const signature of term.calls) edge(position, signature, true);
        for (const signature of term.constructs) edge(position, signature, true);
        break;
      case "callable":
        for (const signature of term.calls) edge(position, signature, true);
        for (const signature of term.constructs) edge(position, signature, true);
        break;
      case "declared": case "construction-reference": for (const child of term.arguments) edge(position, child); break;
      case "projection": edge(position, term.source); break;
      case "primitive": case "string": case "intrinsic": case "enum": case "param": case "self": break;
    }
  }
  for (let position = 0; position < table.signatures.length; position++) {
    const signature = table.signatures[position];
    const owner = position + offset;
    if (signature === undefined) { invalid.add(owner); continue; }
    edge(owner, signature.result);
    if (signature.receiver !== null) edge(owner, signature.receiver);
    for (const parameter of signature.parameters) if (parameter !== undefined) edge(owner, parameter.type);
    for (const parameter of signature.typeParameters) if (parameter !== undefined) {
      if (parameter.constraint !== null) edge(owner, parameter.constraint);
      if (parameter.default !== null) edge(owner, parameter.default);
    }
    if (signature.composition !== null) for (const child of signature.composition.signatures) edge(owner, child, true);
  }
  const propagate = (seeds: Set<number>): void => {
    const pending = [...seeds];
    for (let selected = pending.pop(); selected !== undefined; selected = pending.pop()) {
      for (const owner of reverse.get(selected) ?? []) if (!seeds.has(owner)) { seeds.add(owner); pending.push(owner); }
    }
  };
  propagate(invalid);
  propagate(errors);
  for (const reference of structure.scalars) {
    const actual = reference.reference;
    if (actual === null || actual.prefix !== "t" && actual.prefix !== "sig") continue;
    const signature = actual.prefix === "sig";
    const id = actual.value;
    if (!validIndex(id, signature ? table.signatures.length : table.terms.length) ||
      invalid.has(signature ? id + offset : id)) {
      emit("type-closed", reference.node, "typed reference does not reach a present closed type/signature graph");
      continue;
    }
    if (errors.has(signature ? id + offset : id)) {
      const origin = reference.node?.origin ?? root.origin;
      const reported = reference.node === null ? bodyError : errorOrigins.has(encodeKey([origin.module, origin.start, origin.length]));
      if (!reported) emit("error-diagnostic", reference.node, "error type is not accompanied by an actual error diagnostic at its source origin");
    }
  }
  return { children, signatureOffset: offset };
};

const originalApplication = (node: HirNode | undefined): HirApplication | null => {
  const phase = node?.tsonic;
  return phase !== undefined && phase !== null && "application" in phase && phase.application.kind === "available"
    ? phase.application.value : null;
};

const declarationInventory = (input: TirVerifierInput): ((definition: DefId) => TirDeclarationInventory | null) => {
  const declarations = new Map<DefId, TirDeclarationInventory | null>();
  return definition => {
    const existing = declarations.get(definition);
    if (existing !== undefined) return existing;
    const actual = input.declarationOf(definition);
    const indexed = actual === null ? null
      : { declaration: actual, endpoints: declarationEndpoints(actual), overloaded: hasOverloadEndpoints(actual.endpoints) };
    declarations.set(definition, indexed);
    return indexed;
  };
};

const verifyScalarReferences = (
  structure: TirStructure, sourceNodes: ReadonlyMap<NodeId, HirNode>,
  declarationOf: (definition: DefId) => TirDeclarationInventory | null, emit: TirOccurrenceEmit,
): void => {
  for (const reference of structure.scalars) {
    const actual = reference.reference;
    if (actual?.prefix === "n" && reference.ownerType !== "NodeRef" && reference.ownerType !== "ItemNodeRef" &&
      (!Number.isSafeInteger(actual.value) || actual.value < 0 || Object.is(actual.value, -0) || !sourceNodes.has(actual.value))) {
      emit("node-reference", reference.node, "node identity does not name an actual node in its module arena");
    } else if (actual?.prefix === "def" && declarationOf(actual.value) === null) {
      emit("cross-owner-qualified", reference.node, "definition reference does not name an actual declaration");
    }
  }
};

const verifyTypePayload = (
  input: TirVerifierInput, target: TirBindingTarget, structure: TirStructure,
  declarationOf: (definition: DefId) => TirDeclarationInventory | null,
  emit: TirOccurrenceEmit, appendViolation: TirOccurrenceEmit,
): void => {
  const scopes = input.bindingScopesOf(target);
  if (scopes === null) emit("binding-vector-complete", null, "binding target has no actual supplied scope inventory");
  const bindingInputs: BindingVerificationInput[] = [];
  const bindingSites: (TirNode | null)[] = [];
  const evidence: TypeEvidence[] = [];
  const evidenceSites: (TirNode | null)[] = [];
  let vectorPosition = 0;
  for (const record of structure.records) {
    if (record.association?.kind === "binding") {
      const vector = record.association.value;
      const position = vectorPosition++;
      if (scopes === null) continue;
      const scope = scopes[position];
      if (scope === undefined) emit("binding-vector-complete", record.node, "actual binding vector has no corresponding supplied scope");
      else {
        if (record.bindingOwner !== null) {
          const declaration = declarationOf(record.bindingOwner);
          if (declaration === null || !sameBindingScope(scope, declaration.declaration.scope)) {
            emit("binding-vector-complete", record.node, "binding environment does not retain its genuine declaration scope");
          }
        }
        bindingInputs.push({ vector, scope });
        bindingSites.push(record.node);
      }
    } else if (record.association?.kind === "evidence") {
      evidence.push(record.association.value);
      evidenceSites.push(record.node);
    }
  }
  if (scopes !== null) for (let position = vectorPosition; position < scopes.length; position++) {
    emit("binding-vector-complete", null, "supplied binding scope has no corresponding actual vector");
  }
  const typeViolations = verifyTypes({ table: input.types, bindings: bindingInputs, evidence, nominalOf: input.nominalOf,
    nodeExists: (reference: SourceNodeRef) => input.nodeOf(reference) !== null, localExists: input.localExists });
  const bindingViolations = new Map<number, IndexedTypeViolation[]>();
  const evidenceViolations = new Map<number, IndexedTypeViolation[]>();
  const mappedViolations: MappedTypeViolation[] = [];
  for (const [ordinal, violation] of typeViolations.entries()) {
    if (violation.site.kind === "binding") {
      indexTypeViolation(bindingViolations, violation.site.vector, { ordinal, rule: violation.rule });
    } else if (violation.site.kind === "evidence") {
      indexTypeViolation(evidenceViolations, violation.site.position, { ordinal, rule: violation.rule });
    } else mappedViolations.push({ ordinal, rule: violation.rule,
      target: violation.rule === "cross-owner-qualified" ? "cross-owner-qualified" : "type-closed", node: null });
  }
  for (const [position, node] of bindingSites.entries()) {
    for (const violation of bindingViolations.get(position) ?? []) {
      mappedViolations.push({ ...violation, target: "binding-vector-complete", node });
    }
  }
  for (const [position, node] of evidenceSites.entries()) {
    for (const violation of evidenceViolations.get(position) ?? []) {
      mappedViolations.push({ ...violation, target: "evidence-reference", node });
    }
  }
  mappedViolations.sort((left, right) => left.ordinal - right.ordinal);
  for (const violation of mappedViolations) {
    appendViolation(violation.target, violation.node, `type verifier: ${violation.rule}`);
  }
};

export const verifyTypedBody: VerifyTir = (input, body) => {
  const violations: Violation<TirRule, TirSite>[] = [];
  const emitted = new Set<string>();
  const appendViolation: TirOccurrenceEmit = (rule, node, message) => {
    const site: TirSite = node === null ? { kind: "body", body: body.body }
      : { kind: "node", module: body.root.origin.module, node: node.id };
    violations.push({ rule, site, detail: [{ kind: "text", value: message }] });
  };
  const emit: TirOccurrenceEmit = (rule, node, message) => {
    const key = encodeKey([rule, body.body, node === null ? null : node.id, message]);
    if (!emitted.has(key)) {
      emitted.add(key);
      appendViolation(rule, node, message);
    }
  };
  const boundary = readSourceBoundary(body.body, input.source);
  const structure = inspectTirStructure(body, createTirLayouts(), boundary.nestedRoots);
  const inventory = verifySourcePreservation(body, input.source, input.module, boundary, emit);
  const semantics = collectTirSemantics(structure.nodes);
  verifyBodyRecords(body, inventory.original, emit);
  const typeGraph = verifyClosedReferences(body.root, structure, input.types, input.diagnostics, emit);
  verifyQualifiedReferences(input, body, structure, emit);
  verifyPublicationInventory(input.module, body, emit);
  const ownNodeIds = verifyNestedPublication(input, body, semantics, inventory.original, inventory.typedNodes, inventory.ownNodes, emit);
  verifyControlledContexts(body, inventory.original, structure, semantics, emit);
  verifyBindingSlots(body, structure.nodes, inventory.sourceNodes, input.source.bodies, input.module.bodies, emit);
  const declarationOf = declarationInventory(input);
  verifyScalarReferences(structure, inventory.sourceNodes, declarationOf, emit);
  const instance: BodyInstance = { body: body.body, bindings: body.bindings };
  verifyTypePayload(input, { kind: "body", instance }, structure, declarationOf, emit, appendViolation);
  const candidates = new Map<CandidateListId, readonly HirCandidate[]>();
  if (inventory.original !== undefined) for (const list of inventory.original.candidateLists) {
    if (list !== undefined) candidates.set(list.id, list.candidates);
  }
  for (const node of structure.nodes) {
    verifyOccurrenceRole(node, inventory.sourceNodes.get(node.id), emit);
    verifyValueEndpoints(body, node, emit);
    verifyOccurrenceOperation(node, emit);
    const phase = node.tsonic;
    if (phase !== null && "resolution" in phase && phase.resolution.kind === "error") {
      const index = phase.resolution.diagnostic;
      const diagnostic = input.diagnostics[index];
      if (!validIndex(index, input.diagnostics.length) || diagnostic === undefined || diagnostic.severity !== "error" ||
        diagnostic.site.kind !== "source" || diagnostic.site.origin.module !== node.origin.module ||
        diagnostic.site.origin.start !== node.origin.start || diagnostic.site.origin.length !== node.origin.length) {
        emit("error-diagnostic", node, "error resolution does not select an actual error diagnostic at its source origin");
      }
    }
    const application = applicationOf(node);
    if (application?.kind === "decided") {
      const signature = input.types.signatures[application.decision.callee.decision.api.signature];
      if (signature !== undefined) verifyArgumentTransport(application.decision, node, signature,
        originalApplication(inventory.sourceNodes.get(node.id)), inventory.sourceNodes, emit);
    }
  }
  let previousEvidence = -1;
  const nodeOrder = new Map<NodeId, number>();
  for (const [position, node] of structure.nodes.entries()) nodeOrder.set(node.id, position);
  for (const evidence of body.evidence) {
    const reference = evidence.component;
    const order = reference.kind === "body" && reference.value.body === body.body ? nodeOrder.get(reference.value.node) : undefined;
    if (order !== undefined) {
      if (order < previousEvidence) emit("evidence-order", null, "evidence vector does not retain actual own-body occurrence order");
      previousEvidence = order;
    }
    if (reference.kind === "body" && reference.value.body === body.body && !ownNodeIds.has(reference.value.node)) {
      emit("evidence-reference", null, "body evidence does not select an occurrence in its actual own-body boundary");
    }
  }
  for (const application of semantics.applications) {
    const original = originalApplication(inventory.sourceNodes.get(application.node.id));
    let actualCandidates: readonly HirCandidate[] | null = null;
    if (original?.candidates.kind === "available") {
      const actual = candidates.get(original.candidates.value);
      if (actual === undefined) emit("call-endpoints", application.node, "selected application names a missing actual candidate inventory");
      else actualCandidates = actual;
    }
    verifyCallEndpoints(application.value, application.node, input.types,
      { advertised: declarationOf(application.value.advertised.declaration), api: declarationOf(application.value.api.declaration),
        candidates: actualCandidates }, emit);
  }
  for (const callee of semantics.callees) {
    verifyActivation(callee.value, callee.node, emit);
    if (callee.value.activation !== null) {
      const published = input.bodyOf(callee.value.activation);
      const completion = callee.value.decision.completion;
      if (published !== null && (completion.signature !== published.signature || completion.completion !== published.completion ||
        completion.yielded !== published.yielded || completion.sent !== published.sent)) {
        emit("completion-endpoint", callee.node, "selected completion does not retain the actual activated body's signature and channels");
      }
      verifyPublishedInstance(published, callee.node, emit);
    }
  }
  for (const instance of semantics.initializers) verifyPublishedInstance(input.bodyOf(instance.value), instance.node, emit);
  const supportMemo = new Map<string, boolean>();
  for (const deferred of semantics.deferred) {
    verifyDeferredParameters(deferred.value, deferred.node, body, input.types, typeGraph, supportMemo, emit);
  }
  for (const operation of semantics.operations) {
    verifyOperationShape(operation.value, operation.node, emit);
    verifyProtocolOperation(operation.value, operation.node, input.types, emit);
  }
  for (const protocol of semantics.protocols) {
    const original = inventory.sourceNodes.get(protocol.node.id)?.tsonic;
    const captured = original === undefined || original === null ? null : protocol.ordinal === null
      ? "protocol" in original ? original.protocol : null
      : "disposal" in original ? original.disposal[protocol.ordinal] : null;
    verifyProtocolRecord(protocol.value, protocol.node, captured?.kind === "available" ? captured.value : null, input.types, emit);
  }
  for (const member of structure.selectedMembers) {
    const table = input.memberTableOf(instance, member.occurrence);
    let members: TirMemberInventory | null = null;
    if (table !== null) {
      members = indexMembers(table);
      const node = member.node;
      const receiver = node.kind === "PropertyAccessExpression" || node.kind === "ElementAccessExpression"
        ? typedValueOf(node.expression) : null;
      if (receiver !== null && table.receiver !== receiver.convertedType) {
        emit("member-origin", node, "member inventory does not retain the actual receiver type");
      }
    }
    if (member.selection === null) verifyMemberDecision(member.decision, member.node, members, emit);
    else verifyMemberSelection(member.selection, member.node, members, emit);
  }
  return violations;
};

export const verifyTypedModule: VerifyTirModule = (input, module) => {
  const violations: Violation<TirRule, TirNodeSite>[] = [];
  const emitted = new Set<string>();
  const appendViolation: TirOccurrenceEmit = (rule, node, message) => {
    const subject = node === null ? module.tree : node;
    violations.push({ rule, site: { kind: "node", module: subject.origin.module, node: subject.id },
      detail: [{ kind: "text", value: message }] });
  };
  const emit: TirOccurrenceEmit = (rule, node, message) => {
    const key = encodeKey([rule, node === null ? module.tree.id : node.id, message]);
    if (!emitted.has(key)) { emitted.add(key); appendViolation(rule, node, message); }
  };
  const stops = new Set<NodeId>();
  for (const [position, body] of module.bodies.entries()) {
    if (body === undefined) throw new TypeError(`ir-tir: sparse vector at $module["bodies"][${position}]`);
    stops.add(body.root.id);
  }
  const structure = inspectTirStructure(module, createTirLayouts(), stops);
  const sourceNodes = new Map<NodeId, HirNode>();
  for (const node of indexSyntaxTree<CheckedPhase>(input.source.tree)) sourceNodes.set(node.id, node);
  if (module.module !== input.module.module || module.module !== input.source.module || module.tree !== input.module.tree) {
    emit("module-node-identity", module.tree, "module tree does not retain its actual source and publication identity");
  }
  verifyClosedReferences(module.tree, structure, input.types, input.diagnostics, emit);
  verifyQualifiedReferences(input, null, structure, emit);
  const declarationOf = declarationInventory(input);
  verifyScalarReferences(structure, sourceNodes, declarationOf, emit);
  for (const node of structure.nodes) verifyOccurrenceRole(node, sourceNodes.get(node.id), emit);
  verifyTypePayload(input, { kind: "module", module: module.module }, structure, declarationOf, emit, appendViolation);
  return violations;
};
