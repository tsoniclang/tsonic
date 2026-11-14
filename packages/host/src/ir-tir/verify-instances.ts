import type { BodyId, LocalRef, NodeId } from "../ids/contract.js";
import type { BindingScope } from "../ir-types/contract.js";
import { bindingVectorKey, instanceKey } from "../ir-types/index.js";
import type { CheckedPhase, HirBody, HirNode } from "../ir-hir/contract.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import type { CaptureSource, LogicalCapture } from "../ir-infer/contract.js";
import { captureRequiresLocation, sameCaptureSource } from "../ir-infer/index.js";
import type { TirBody, TirModule, TirNode, TirSelection, TirVerifierInput, TypedBinding, TypedPhase } from "./contract.js";
import type { TirOccurrenceEmit } from "./verify-occurrences.js";
import type { TirSemanticInventory, TirStructure } from "./verify-occurrences.js";
import { sameLocalReference, sameSourceReference, typedValueOf } from "./verify-occurrences.js";

export const sameBindingScope = (left: BindingScope, right: BindingScope): boolean => {
  const families: readonly ("classParameters" | "methodParameters" | "capturedParameters")[] =
    ["classParameters", "methodParameters", "capturedParameters"];
  for (const family of families) {
    const expected = left[family];
    const actual = right[family];
    if (expected.length !== actual.length) return false;
    for (let position = 0; position < expected.length; position++) {
      const parameter = expected[position];
      const other = actual[position];
      if (parameter === undefined || other === undefined || parameter.owner !== other.owner || !Object.is(parameter.index, other.index)) return false;
    }
  }
  if (left.selfOwners.length !== right.selfOwners.length) return false;
  for (let position = 0; position < left.selfOwners.length; position++) {
    if (left.selfOwners[position] === undefined || left.selfOwners[position] !== right.selfOwners[position]) return false;
  }
  return true;
};

const validIdentity = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);

export const verifyQualifiedReferences = (
  input: TirVerifierInput, body: TirBody | null, structure: TirStructure, emit: TirOccurrenceEmit,
): void => {
  for (const record of structure.records) {
    const association = record.association;
    if (association === null) continue;
    if (association.kind === "node-reference") {
      const value = association.value;
      if (!validIdentity(value.node) || input.nodeOf({ kind: "body", value }) === null) {
        emit("node-reference", record.node, "qualified node does not name an actual node in its declared body");
      }
    } else if (association.kind === "source-reference") {
      const value = association.value;
      if (!validIdentity(value.value.node) || input.nodeOf(value) === null) {
        emit("cross-owner-qualified", record.node, "source reference does not name an actual node in its declared owner");
      }
    } else if (association.kind === "local-reference") {
      const value = association.value;
      if (!validIdentity(value.local) || !input.localExists(value)) {
        emit("cross-owner-qualified", record.node, "local reference does not name an actual local in its declared body");
      }
      if (body !== null && value.body === body.body && body.locals[value.local] === undefined) {
        emit("local-storage", record.node, "same-body local reference does not select a real local storage slot");
      }
    }
  }
  for (const reference of structure.scalars) {
    if (body !== null && reference.reference?.prefix === "l" && reference.ownerType !== "LocalRef") {
      const local = reference.reference.value;
      if (!validIdentity(local) || body.locals[local] === undefined) {
        emit("local-storage", reference.node, "local identity does not select a real local storage slot");
      }
    }
  }
};

export const verifyNestedPublication = (
  input: TirVerifierInput, body: TirBody, semantics: TirSemanticInventory, original: HirBody | undefined,
  moduleNodes: ReadonlyMap<NodeId, TirNode>, actualNodes: readonly TirNode[], emit: TirOccurrenceEmit,
): ReadonlySet<NodeId> => {
  const originals = new Map<BodyId, HirBody>();
  const order = new Map<BodyId, number>();
  for (let position = 0; position < input.source.bodies.length; position++) {
    const candidate = input.source.bodies[position];
    if (candidate !== undefined) { originals.set(candidate.body, candidate); order.set(candidate.body, position); }
  }
  const templates = new Map<BodyId, TirBody>();
  let previous = -1;
  for (const candidate of input.module.bodies) {
    if (candidate === undefined || candidate.bindings.kind !== "parametric") continue;
    templates.set(candidate.body, candidate);
    const position = order.get(candidate.body);
    if (position === undefined || position < previous) emit("stable-order", null, "canonical template publication does not retain actual source body order");
    else previous = position;
    const source = originals.get(candidate.body);
    if (source === undefined || source.root.id !== candidate.root.id || source.owner !== candidate.owner ||
      moduleNodes.get(candidate.root.id) !== candidate.root) {
      emit("nested-template-identity", null, "published template is not the authentic body's canonical shared module subtree");
    }
  }
  for (const source of input.source.bodies) if (source !== undefined && !templates.has(source.body)) {
    emit("template-shared-once", null, "actual source body has no canonical parametric template in the publication");
  }
  const ownNodes = new Map<NodeId, TirNode>();
  for (const node of actualNodes) ownNodes.set(node.id, node);
  for (const template of semantics.templates) {
    const source = originals.get(template.value.body);
    const published = templates.get(template.value.body);
    const originalPhase = input.nodeOf({ kind: "body", value: { body: body.body, node: template.node.id } })?.tsonic;
    const sourceOwns = source !== undefined && originalPhase !== undefined && originalPhase !== null &&
      ("body" in originalPhase ? originalPhase.body === template.value.body
        : "definition" in originalPhase && originalPhase.definition === source.owner);
    if (source === undefined || published === undefined || !sourceOwns ||
      body.bindings.kind === "parametric" && ownNodes.get(source.root.id) !== published.root) {
      emit("nested-template-identity", template.node, "typed template does not retain its real authored body and shared syntax identity");
    }
  }
  const stops = new Set<NodeId>();
  if (original !== undefined) for (const nested of original.nestedBodies) {
    const source = originals.get(nested);
    if (source !== undefined) stops.add(source.root.id);
  }
  const owned = new Set<NodeId>();
  if (original !== undefined) {
    const pending: HirNode[] = [original.root];
    const visited = new Set<object>();
    for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
      if (visited.has(node) || node !== original.root && stops.has(node.id)) continue;
      visited.add(node);
      owned.add(node.id);
      const children = childrenOfSyntax<CheckedPhase>(node);
      for (let position = children.length - 1; position >= 0; position--) {
        const child = children[position];
        if (child !== undefined) pending.push(child);
      }
    }
  }
  for (const evidence of body.evidence) if (evidence.component.kind === "body" &&
    evidence.component.value.body === body.body && !owned.has(evidence.component.value.node)) {
    emit("nested-boundary", null, "body evidence crosses an authentic nested-body root or leaves its own body subtree");
  }
  return owned;
};

interface TirNodeInterval {
  readonly start: number;
  readonly end: number;
}

const nodeIntervals = (root: TirNode): ReadonlyMap<NodeId, TirNodeInterval> => {
  const ranges = new Map<NodeId, TirNodeInterval>();
  const visited = new Set<object>();
  const pending: ({ readonly kind: "enter"; readonly node: TirNode } | { readonly kind: "exit"; readonly node: TirNode; readonly start: number })[] =
    [{ kind: "enter", node: root }];
  let cursor = 0;
  for (let work = pending.pop(); work !== undefined; work = pending.pop()) {
    if (work.kind === "exit") { ranges.set(work.node.id, { start: work.start, end: cursor }); continue; }
    if (visited.has(work.node)) continue;
    visited.add(work.node);
    pending.push({ kind: "exit", node: work.node, start: cursor++ });
    const children = childrenOfSyntax<TypedPhase>(work.node);
    for (let position = children.length - 1; position >= 0; position--) {
      const child = children[position];
      if (child !== undefined) pending.push({ kind: "enter", node: child });
    }
  }
  return ranges;
};

interface TirControlledBranch {
  readonly root: NodeId;
  readonly when: "true" | "false" | "present" | "absent";
  readonly active: "always" | "never" | "conditional";
}

export const verifyControlledContexts = (
  body: TirBody, original: HirBody | undefined, structure: TirStructure, semantics: TirSemanticInventory, emit: TirOccurrenceEmit,
): void => {
  const ranges = nodeIntervals(body.root);
  const contains = (root: NodeId, node: NodeId): boolean => {
    const parent = ranges.get(root);
    const child = ranges.get(node);
    return parent !== undefined && child !== undefined && child.start >= parent.start && child.end <= parent.end;
  };
  const controls = new Map<NodeId, readonly TirControlledBranch[]>();
  const rootControls = new Map<NodeId, { control: NodeId; branch: TirControlledBranch }>();
  for (const node of structure.nodes) {
    let selection: TirSelection | null = null;
    const branches: TirControlledBranch[] = [];
    if (node.kind === "ConditionalExpression") {
      selection = node.tsonic.selection;
      if (selection.kind !== "conditional" || selection.control !== node.condition.id || selection.whenTrue !== node.whenTrue.id ||
        selection.whenFalse !== node.whenFalse.id) emit("controlled-demand", node, "selection does not retain its authored control and branch endpoints");
      else branches.push({ root: node.whenTrue.id, when: "true", active: selection.disposition === "dynamic" ? "conditional" : selection.disposition === "true" ? "always" : "never" },
        { root: node.whenFalse.id, when: "false", active: selection.disposition === "dynamic" ? "conditional" : selection.disposition === "false" ? "always" : "never" });
    } else if (node.kind === "BinaryExpression" && (node.tsonic.role === "short-circuit" || node.tsonic.role === "assignment")) {
      selection = node.tsonic.selection;
      const token = node.operatorToken.kind;
      const expected = token === "AmpersandAmpersandToken" || token === "AmpersandAmpersandEqualsToken" ? "and"
        : token === "BarBarToken" || token === "BarBarEqualsToken" ? "or"
        : token === "QuestionQuestionToken" || token === "QuestionQuestionEqualsToken" ? "coalesce" : null;
      if (selection === null ? expected !== null : selection.kind === "conditional" || selection.kind !== expected ||
        selection.control !== node.left.id || selection.right !== node.right.id) {
        emit("controlled-demand", node, "selection does not retain its authored control and branch endpoints");
      } else if (selection !== null && selection.kind !== "conditional") branches.push({ root: node.right.id,
        when: selection.kind === "and" ? "true" : selection.kind === "or" ? "false" : "absent",
        active: selection.disposition === "dynamic" ? "conditional" : selection.disposition === "right" ? "always" : "never" });
    }
    if (selection !== null && branches.length !== 0) {
      controls.set(selection.control, branches);
      for (const branch of branches) rootControls.set(branch.root, { control: selection.control, branch });
    }
  }
  for (const node of structure.nodes) {
    const value = typedValueOf(node);
    if (value === null) continue;
    const demand = value.demand;
    if (demand.kind === "always") {
      const root = rootControls.get(node.id);
      if (root !== undefined && root.branch.active !== "always") emit("controlled-demand", node, "controlled branch does not retain its selected or never-evaluated demand");
    } else {
      const branches = controls.get(demand.control);
      if (branches === undefined || !branches.some(branch => contains(branch.root, node.id) &&
        (demand.kind === "never" ? branch.active === "never" : demand.when === branch.when && branch.active !== "never"))) {
        emit("controlled-demand", node, "demand does not retain its actual enclosing control, branch and condition");
      }
    }
    if (value.evidenceIndex !== null) {
      const evidence = body.evidence[value.evidenceIndex];
      if (evidence !== undefined && (evidence.component.kind !== "body" || evidence.component.value.body !== body.body ||
        !Object.is(evidence.component.value.node, node.id))) {
        emit("evidence-reference", node, "value evidence does not retain its actual occurrence component");
      }
    }
  }
  const scopes = new Set<NodeId>();
  for (let position = 0; position < body.scopes.length; position++) {
    const scope = body.scopes[position];
    const source = original?.scopes[position];
    if (scope === undefined || source === undefined || scope.node !== source.node || scope.parent !== source.parent ||
      scope.attributes.length !== source.attributes.length) {
      emit("permission-scope", null, "lexical scope inventory does not retain actual authored scope order and ownership");
      continue;
    }
    scopes.add(scope.node);
    for (let ordinal = 0; ordinal < scope.attributes.length; ordinal++) {
      const attribute = scope.attributes[ordinal];
      const actual = source.attributes[ordinal];
      if (attribute === undefined || actual === undefined || attribute.declaration !== actual.declaration ||
        !sameSourceReference(attribute.occurrence, actual.occurrence) || attribute.arguments.length !== actual.arguments.length) {
        emit("permission-scope", null, "lexical scope attributes do not retain actual authored permission data");
      } else for (let argument = 0; argument < attribute.arguments.length; argument++) {
        const supplied = attribute.arguments[argument];
        const expected = actual.arguments[argument];
        if (supplied === undefined || expected === undefined || !sameSourceReference(supplied, expected)) {
          emit("permission-scope", null, "lexical scope attributes do not retain actual authored permission data");
        }
      }
    }
  }
  if (original !== undefined && original.scopes.length !== body.scopes.length) emit("permission-scope", null, "lexical scope inventory does not retain actual authored scope order and ownership");
  for (const operation of semantics.operations) {
    const scope = operation.value.permissionScope;
    if (scope !== null && (!scopes.has(scope) || !contains(scope, operation.node.id))) {
      emit("permission-scope", operation.node, "operation permission scope is not an actual enclosing lexical scope");
    }
  }
};

export const verifyBindingSlots = (
  body: TirBody, nodes: readonly TirNode[], originals: ReadonlyMap<NodeId, HirNode>, sources: readonly (HirBody | undefined)[],
  published: readonly (TirBody | undefined)[], emit: TirOccurrenceEmit,
): void => {
  const reassignable = (reference: LocalRef): boolean | null => {
    for (const source of sources) if (source !== undefined && source.body === reference.body) return source.locals[reference.local]?.mutable ?? null;
    return null;
  };
  // Where the storage of a captured local comes from in the body that declares it, or null when nothing here says. The
  // declaration facts are read from the checked body. A name bound under a parameter pattern has the parameter role and
  // no parameter record: its storage is the body's own. A local that is itself a capture of the creating body has its
  // logical capture in the creating artifact's typed row for the local it was captured from.
  //
  // The creating artifact is the one that creates this body: a published artifact of the creating body whose tree holds
  // this body's root as a closure naming this body with this body's lexical bindings. Exactly one such artifact gives its
  // rows; none or several is missing context, and nothing is read. A null row (a template whose creating closure saved the
  // closure rule) states nothing yet. Publication order does not matter.
  const creators = new Map<BodyId, TirBody | null>();
  const contains = (root: TirNode): TirNode | null => {
    const pending: TirNode[] = [root];
    for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
      if (node.id === body.root.id) return node;
      pending.push(...childrenOfSyntax<TypedPhase>(node));
    }
    return null;
  };
  const creatorOf = (creating: BodyId): TirBody | null => {
    const known = creators.get(creating);
    if (known !== undefined) return known;
    const environment = bindingVectorKey(body.lexicalBindings);
    let selected: TirBody | null = null;
    let count = 0;
    for (const candidate of published) if (candidate !== undefined && candidate.body === creating) {
      const node = contains(candidate.root);
      const template = node !== null && (node.kind === "ArrowFunction" || node.kind === "FunctionExpression") ? node.tsonic.callable.template : null;
      if (template !== null && template.body === body.body && bindingVectorKey(template.lexicalBindings) === environment) {
        selected = candidate;
        count += 1;
      }
    }
    const creator = count === 1 ? selected : null;
    creators.set(creating, creator);
    return creator;
  };
  const enclosingRow = (creating: BodyId, from: LocalRef): LogicalCapture | null =>
    creatorOf(creating)?.captures.find(row => sameLocalReference(row.local, from))?.capture ?? null;
  const incomingOf = (reference: LocalRef): CaptureSource | null => {
    for (const source of sources) if (source !== undefined && source.body === reference.body) {
      const local = source.locals[reference.local];
      if (local === undefined) return null;
      if (local.role === "capture") {
        const capture = local.capturedFrom === null ? null : enclosingRow(reference.body, local.capturedFrom);
        return capture === null ? null : { kind: "capture", capture };
      }
      const parameter = local.role === "parameter" ? source.params.find(candidate => candidate.local === reference.local) : undefined;
      return parameter === undefined ? { kind: "binding" } : { kind: "parameter", passing: parameter.passing };
    }
    return null;
  };
  const parameters = new Map(body.params.map(parameter => [parameter.declaration, parameter]));
  const storage = (reference: LocalRef, type: number | null, node: TirNode): void => {
    const local = body.locals[reference.local];
    if (reference.body !== body.body || local === undefined || type === null || !Object.is(local.storage, type)) {
      emit("binding-storage", node, "binding occurrence does not retain its actual qualified local storage slot");
    }
  };
  const binding = (value: TypedBinding, node: TirNode): void => {
    if (value.declaration.kind === "local") storage(value.declaration.local, value.storage, node);
  };
  for (const node of nodes) {
    if (node.kind === "VariableDeclaration") {
      binding(node.tsonic, node);
    } else if (node.kind === "BindingElement") {
      const phase = node.tsonic;
      if (phase.role === "binding") binding(phase, node);
    } else if (node.kind === "Parameter") {
      storage(node.tsonic.local, node.tsonic.storage, node);
      const parameter = parameters.get(node.tsonic.declaration);
      if (parameter === undefined || parameter.local !== node.tsonic.local.local || parameter.passing !== node.tsonic.passing ||
        parameter.initializer !== node.tsonic.initializer) emit("parameter-order", node, "parameter occurrence does not retain its actual declared formal and local association");
    }
    else if ((node.kind === "Identifier" || node.kind === "PrivateIdentifier" || node.kind === "QualifiedName") &&
      node.tsonic.role === "declaration-name" && node.tsonic.declaration.kind === "local") {
      storage(node.tsonic.declaration.local, node.tsonic.storage, node);
    } else if (node.kind === "ArrowFunction" || node.kind === "FunctionExpression") {
      // The captured locals of a closure are the ones its outcome names: the rows of the decision, or the saved evidence of
      // the deferred closure rule, read where they stand. A closure that defers another rule names none.
      const closure = node.tsonic.closure;
      const named: readonly { readonly local: LocalRef }[] | null = closure.kind === "decided" ? closure.decision.captures
        : closure.deferred.invocation.rule === "closure" ? closure.deferred.invocation.input.captures : null;
      const actual = node.tsonic.callable.template;
      const original = originals.get(node.id);
      if (named === null) emit("closure-capture-total", node, "a deferred closure does not save the closure rule's evidence of its captured locals");
      else {
        if (actual !== null && named.some(capture => capture.local.body === actual.body))
          emit("capture-qualified", node, "closure captures contain a local from the closure's own body");
        if ((original?.kind === "ArrowFunction" || original?.kind === "FunctionExpression") &&
          (named.length !== original.tsonic.captures.length || named.some((capture, position) => {
            const expected = original.tsonic.captures[position];
            return expected === undefined || !sameLocalReference(capture.local, expected);
          }))) emit("capture-qualified", node, "closure captures do not retain the real authored outer-local sequence");
      }
      if (closure.kind === "decided") {
        if (closure.decision.captures.some(row => {
          if (row.capture !== "captured-value") return false;
          const incoming = incomingOf(row.local);
          // with no incoming storage known, only the reassignment fact is evidence
          return incoming === null ? reassignable(row.local) === true : captureRequiresLocation(reassignable(row.local) === true, incoming);
        }))
          emit("closure-capture-binding", node, "a binding whose storage another party can write is a captured location");
      } else if (closure.deferred.invocation.rule === "closure") {
        if (closure.deferred.invocation.input.captures.some(capture => {
          const evidence = reassignable(capture.local);
          const incoming = incomingOf(capture.local);
          return evidence !== null && capture.reassignable !== evidence || incoming !== null && !sameCaptureSource(capture.incoming, incoming);
        })) emit("closure-capture-binding", node, "saved capture evidence does not state the binding evidence of its captured locals");
      }
    }
  }
};

export const verifyPublishedInstance = (
  published: TirBody | null, node: TirNode | null, emit: TirOccurrenceEmit,
): void => {
  if (published === null) {
    emit("nested-instance-key", node, "instance does not select a real canonical body with the complete artifact environment");
  }
};

export const verifyPublicationInventory = (module: TirModule, selected: TirBody, emit: TirOccurrenceEmit): void => {
  const keys = new Set<string>();
  let duplicate = false;
  let selectedCount = 0;
  for (const body of module.bodies) {
    if (body === undefined) { duplicate = true; continue; }
    if (body === selected) selectedCount++;
    const key = instanceKey({ body: body.body, bindings: body.bindings });
    if (keys.has(key)) duplicate = true;
    keys.add(key);
  }
  if (duplicate || selectedCount !== 1) {
    emit("template-shared-once", null, "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once");
  }
};
