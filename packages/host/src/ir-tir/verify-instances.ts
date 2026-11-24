import type { BodyId, DefId, LocalId, LocalRef, NodeId } from "../ids/contract.js";
import { diagnosticIdentityKey, unitPositionData } from "../diag/index.js";
import { encodeKey } from "../ids/index.js";
import type { Cause } from "../diag/contract.js";
import type { BindingScope } from "../ir-types/contract.js";
import { bindingVectorKey, instanceKey } from "../ir-types/index.js";
import type { CheckedPhase, HirBody, HirNode, HirParam, ParameterDeclaration } from "../ir-hir/contract.js";
import { childrenOfSyntax, shortCircuitOperatorOf } from "../ir-hir/index.js";
import type { CaptureSource } from "../ir-infer/contract.js";
import { captureRequiresLocation, sameCaptureSource } from "../ir-infer/index.js";
import type { TirBody, TirFormal, TirModule, TirNode, TirReadyReadAdmission, TirSelection, TirSyntaxOccurrence, TirTypedSyntax, TirVerifierInput, TypedBinding, TypedParameter, TypedPhase } from "./contract.js";
import type { TirOccurrenceEmit } from "./verify-occurrences.js";
import type { TirSemanticInventory, TirStructure } from "./verify-occurrences.js";
import { sameLocalReference, sameSourceReference, typedValueOf } from "./verify-occurrences.js";
import { chapterSyntaxSlots, indexChapterSyntax, isLayoutOperandBody, readChapterSyntaxSlot, tirBodySyntaxOf } from "./chapter-syntax.js";

function* typedSyntaxChildren(node: TirNode): Generator<TirNode> {
  for (const slot of chapterSyntaxSlots({ kind: "ordinary", node })) {
    const child = readChapterSyntaxSlot(slot);
    if (child?.kind === "ordinary" || child?.kind === "formal") yield child.node;
  }
}

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
      if (parameter === undefined || other === undefined || parameter !== other) return false;
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

const causeIdentity = (cause: Cause): string => cause.kind === "diagnostic"
  ? diagnosticIdentityKey(cause.diagnostic)
  : encodeKey([cause.unit.request.query, cause.unit.request.key, unitPositionData(cause.unit.position)]);

export const verifyDeclarationNames = (
  nodes: readonly TirNode[], originals: ReadonlyMap<NodeId, HirNode>, emit: TirOccurrenceEmit,
): void => {
  const parents = new Map<NodeId, Extract<TirNode, { readonly kind: "PropertySignature" | "MethodSignature" }>>();
  const eligible = new Set<NodeId>();
  for (const node of nodes) if (node.kind === "PropertySignature" || node.kind === "MethodSignature") parents.set(node.id, node);
  for (const node of nodes) {
    if (node.kind !== "ComputedPropertyName" || node.tsonic.kind !== "declaration") continue;
    const checked = originals.get(node.id);
    const originalParent = checked?.parent === null || checked?.parent === undefined ? undefined : originals.get(checked.parent);
    const parent = node.parent === null ? undefined : parents.get(node.parent);
    if (checked?.kind !== "ComputedPropertyName" || originalParent === undefined
      || originalParent.kind !== "PropertySignature" && originalParent.kind !== "MethodSignature"
      || originalParent.name !== checked || parent === undefined || parent.name !== node
      || parent.id !== originalParent.id) {
      emit("occurrence-role", node, "nonexecuting names belong only to their actual checked declaration-only computed-name context");
      continue;
    }
    const actual = node.tsonic.key;
    const expected = checked.tsonic.key;
    let same = actual.kind === expected.kind;
    if (actual.kind === "available" && expected.kind === "available") {
      const left = actual.value;
      const right = expected.value;
      same = left.kind === right.kind && (left.kind === "text" ? right.kind === "text" && left.value === right.value
        : left.kind === "symbol" ? right.kind === "symbol" && left.declaration === right.declaration
          : right.kind === "number" && left.value.numerator === right.value.numerator && left.value.denominator === right.value.denominator
            && left.value.negativeZero === right.value.negativeZero);
    } else if (actual.kind === "unavailable" && expected.kind === "unavailable") {
      same = actual.reason === expected.reason && actual.causes.length === expected.causes.length;
      for (let index = 0; index < actual.causes.length; index++) {
        const left = actual.causes[index];
        const right = expected.causes[index];
        if (left === undefined || right === undefined || left.kind !== right.kind || causeIdentity(left) !== causeIdentity(right)) same = false;
      }
    }
    if (!same) emit("occurrence-role", node, "a declaration name retains its one original checked key fact and causes");
    const pending: TirNode[] = [node.expression];
    for (let child = pending.pop(); child !== undefined; child = pending.pop()) {
      if (eligible.has(child.id)) continue;
      eligible.add(child.id);
      if (child.tsonic !== null && (!("role" in child.tsonic) || child.tsonic.role !== "declaration-name-expression"))
        emit("occurrence-role", child, "every nonexecuting name-expression payload asserts syntax role only");
      for (const nested of typedSyntaxChildren(child)) pending.push(nested);
    }
  }
  for (const node of nodes) if (node.tsonic !== null && "role" in node.tsonic
    && node.tsonic.role === "declaration-name-expression" && !eligible.has(node.id))
    emit("occurrence-role", node, "a nonexecuting name-expression role cannot replace an executable value or member decision");
};

export const verifyBodylessParameters = (
  input: TirVerifierInput, nodes: readonly TirNode[], originals: ReadonlyMap<NodeId, HirNode>, emit: TirOccurrenceEmit,
): void => {
  for (const node of nodes) {
    if (node.kind !== "FunctionDeclaration" && node.kind !== "MethodDeclaration" && node.kind !== "MethodSignature"
      && node.kind !== "CallSignature" && node.kind !== "ConstructSignature" && node.kind !== "IndexSignature"
      && node.kind !== "Constructor" && node.kind !== "GetAccessor" && node.kind !== "SetAccessor") continue;
    const original = originals.get(node.id);
    if (original === undefined || original.kind !== node.kind || original.tsonic.body !== null) continue;
    let valid = original.parameters.nodes.length === node.parameters.nodes.length && node.tsonic.definition === original.tsonic.definition;
    const signatures = original.tsonic.signatures.map(endpoint => input.types.signatures[endpoint.signature]);
    if (node.kind !== "IndexSignature" && signatures.length === 0) valid = false;
    let ordinal = 0;
    for (const [position, parameter] of node.parameters.nodes.entries()) {
      const checked = original.parameters.nodes[position];
      const selected = parameter.tsonic;
      if (checked === undefined || checked.tsonic.declaration.kind !== "definition" || parameter.id !== checked.id
        || parameter.parent !== node.id || checked.parent !== original.id || checked.tsonic.parent !== original.tsonic.definition
        || selected.declaration !== checked.tsonic.declaration.definition || selected.local !== null
        || node.kind !== "IndexSignature" && selected.passing === null
        || selected.initializer !== null || checked.tsonic.initializer !== null || parameter.initializer.kind !== "none"
        || checked.tsonic.declaredType.kind !== "available" || checked.tsonic.declaredType.value === null) valid = false;
      for (const signature of signatures) {
        if (signature === undefined || signature.declaration !== original.tsonic.definition) { valid = false; continue; }
        if (selected.role === "this") {
          if (position !== 0 || signature.receiver !== selected.storage) valid = false;
        } else {
          const formal = signature.parameters[ordinal];
          if (formal === undefined || formal.declaration !== selected.declaration || formal.type !== selected.storage || formal.passing !== selected.passing
            || formal.kind !== selected.role || formal.initializer !== selected.initializer) valid = false;
        }
      }
      if (selected.role !== "this") ordinal += 1;
      if (node.kind === "IndexSignature" && (selected.passing !== null || selected.local !== null
        || node.parameters.nodes.length !== 1 || selected.role !== "required" || node.tsonic.key !== selected.storage
        || checked?.tsonic.declaredType.kind !== "available" || checked.tsonic.declaredType.value !== selected.storage)) valid = false;
    }
    for (const signature of signatures) if (signature === undefined || signature.parameters.length !== ordinal) valid = false;
    if (!valid) emit("parameter-order", node, "bodyless formals retain their genuine checked declarations and selected signature without execution locals");
  }
};

export const sameParameterSelection = (selected: TypedParameter, checked: HirParam, body: BodyId): boolean =>
  selected.local !== null && selected.passing !== null && selected.local.body === body && Object.is(selected.local.local, checked.local)
  && selected.declaration === checked.declaration && selected.role === checked.role
  && selected.passing === checked.passing && selected.initializer === checked.initializer;

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

export const verifyCanonicalTemplates = (
  input: TirVerifierInput, module: TirModule, moduleNodes: ReadonlyMap<NodeId, TirSyntaxOccurrence>, emit: TirOccurrenceEmit,
): { readonly originals: ReadonlyMap<BodyId, HirBody>; readonly templates: ReadonlyMap<BodyId, TirBody> } => {
  const originals = new Map<BodyId, HirBody>();
  const order = new Map<BodyId, number>();
  for (let position = 0; position < input.source.bodies.length; position++) {
    const candidate = input.source.bodies[position];
    if (candidate !== undefined) { originals.set(candidate.body, candidate); order.set(candidate.body, position); }
  }
  const templates = new Map<BodyId, TirBody>();
  let previous = -1;
  for (const candidate of module.bodies) {
    if (candidate === undefined || candidate.bindings.kind !== "parametric") continue;
    if (templates.has(candidate.body)) emit("template-shared-once", null, "actual source body has more than one canonical parametric template");
    templates.set(candidate.body, candidate);
    const position = order.get(candidate.body);
    if (position === undefined || position < previous) emit("stable-order", null, "canonical template publication does not retain actual source body order");
    else previous = position;
    const source = originals.get(candidate.body);
    if (source === undefined || source.root.id !== candidate.root.id || source.owner !== candidate.owner ||
      module.tree.kind === "ready-root" && !isLayoutOperandBody(candidate.body) && moduleNodes.get(candidate.root.id) !== candidate.root) {
      emit("nested-template-identity", null, "published template is not the authentic body's canonical shared module subtree");
    }
  }
  return { originals, templates };
};

export const verifyNestedPublication = (
  input: TirVerifierInput, body: TirBody, semantics: TirSemanticInventory, original: HirBody | undefined,
  moduleNodes: ReadonlyMap<NodeId, TirSyntaxOccurrence>, actualNodes: readonly TirSyntaxOccurrence[],
  headers: readonly (ParameterDeclaration<CheckedPhase> | null)[], emit: TirOccurrenceEmit,
): ReadonlySet<NodeId> => {
  const { originals, templates } = verifyCanonicalTemplates(input, input.module, moduleNodes, emit);
  if (original !== undefined && body.bindings.kind === "instantiated" && !templates.has(body.body))
    emit("template-shared-once", null, "actual source body has no canonical parametric template in the publication");
  const ownNodes = new Map<NodeId, TirSyntaxOccurrence>();
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
    for (const header of headers) if (header !== null) {
      pending.push(header);
      if (header.initializer !== null) stops.add(header.initializer.id);
    }
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

const nodeIntervals = (root: TirTypedSyntax): ReadonlyMap<NodeId, TirNodeInterval> => {
  const ranges = new Map<NodeId, TirNodeInterval>();
  const visited = new Set<object>();
  const pending: ({ readonly kind: "enter"; readonly subject: TirTypedSyntax } | { readonly kind: "exit"; readonly node: TirSyntaxOccurrence; readonly start: number })[] =
    [{ kind: "enter", subject: root }];
  let cursor = 0;
  for (let work = pending.pop(); work !== undefined; work = pending.pop()) {
    if (work.kind === "exit") { ranges.set(work.node.id, { start: work.start, end: cursor }); continue; }
    const subject = work.subject;
    if (visited.has(subject.node)) continue;
    visited.add(subject.node);
    pending.push({ kind: "exit", node: subject.node, start: cursor++ });
    const children = Array.from(chapterSyntaxSlots(subject), readChapterSyntaxSlot);
    for (let position = children.length - 1; position >= 0; position--) {
      const child = children[position];
      if (child !== undefined && child !== null && child.kind !== "checked") pending.push({ kind: "enter", subject: child });
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
  const ranges = nodeIntervals(tirBodySyntaxOf(body.root));
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
      const expected = shortCircuitOperatorOf(node.operatorToken.kind, node.tsonic.role);
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

type BindingRead<Value, Stop extends object> =
  | { readonly kind: "complete"; readonly value: Value }
  | { readonly kind: "resource-stop"; readonly stop: Stop };

export const verifyBindingSlots = <Stop extends object>(
  body: TirBody, structure: TirStructure, originals: ReadonlyMap<NodeId, HirNode>, sources: ReadonlyMap<BodyId, HirBody>,
  published: readonly (TirBody | undefined)[], bodyOf: TirVerifierInput["bodyOf"], nodeOf: TirVerifierInput["nodeOf"], emit: TirOccurrenceEmit,
  admit: TirReadyReadAdmission<Stop>,
): Stop | null => {
  const checkedParameters = new Map<BodyId, { readonly declarations: ReadonlyMap<DefId, HirParam>;
    readonly locals: ReadonlyMap<LocalId, HirParam> }>();
  const checkedParameterRows = (owner: BodyId) => {
    let parameters = checkedParameters.get(owner);
    if (parameters === undefined) {
      const source = sources.get(owner);
      if (source === undefined) return undefined;
      const declarations = new Map<DefId, HirParam>();
      const locals = new Map<LocalId, HirParam>();
      for (const parameter of source.params) {
        declarations.set(parameter.declaration, parameter);
        locals.set(parameter.local, parameter);
      }
      parameters = { declarations, locals };
      checkedParameters.set(owner, parameters);
    }
    return parameters;
  };
  const reassignable = (reference: LocalRef): boolean | null => {
    return sources.get(reference.body)?.locals[reference.local]?.mutable ?? null;
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
  const contains = (root: TirTypedSyntax): TirNode | null => {
    for (const subject of indexChapterSyntax([root], chapterSyntaxSlots))
      if (subject.kind === "ordinary" && subject.node.id === body.root.id) return subject.node;
    return null;
  };
  let environment: string | null = null;
  const creatorOf = (creating: BodyId): BindingRead<TirBody | null, Stop> => {
    const known = creators.get(creating);
    if (known !== undefined) return { kind: "complete", value: known };
    let selected: TirBody | null = null;
    let count = 0;
    for (let index = 0; index < published.length; index += 1) {
      const row = admit({ kind: "row" });
      if (row !== null) return { kind: "resource-stop", stop: row };
      const candidate = published[index];
      if (candidate === undefined || candidate.body !== creating) continue;
      const node = contains(tirBodySyntaxOf(candidate.root));
      const template = node !== null && (node.kind === "ArrowFunction" || node.kind === "FunctionExpression") ? node.tsonic.callable.template : null;
      if (template === null || template.body !== body.body) continue;
      if (environment === null) {
        const field = admit({ kind: "row" });
        if (field !== null) return { kind: "resource-stop", stop: field };
        const lexical = body.lexicalBindings;
        const identity = admit({ kind: "bindings", bindings: lexical });
        if (identity !== null) return { kind: "resource-stop", stop: identity };
        environment = bindingVectorKey(lexical);
      }
      const field = admit({ kind: "row" });
      if (field !== null) return { kind: "resource-stop", stop: field };
      const lexical = template.lexicalBindings;
      const identity = admit({ kind: "bindings", bindings: lexical });
      if (identity !== null) return { kind: "resource-stop", stop: identity };
      if (bindingVectorKey(lexical) === environment) {
        selected = candidate;
        count += 1;
      }
    }
    const creator = count === 1 ? selected : null;
    creators.set(creating, creator);
    return { kind: "complete", value: creator };
  };
  const incomingOf = (reference: LocalRef): BindingRead<CaptureSource | null, Stop> => {
    const source = sources.get(reference.body);
    if (source !== undefined) {
      const local = source.locals[reference.local];
      if (local === undefined) return { kind: "complete", value: null };
      if (local.role === "capture") {
        const from = local.capturedFrom;
        if (from === null) return { kind: "complete", value: null };
        const creator = creatorOf(reference.body);
        if (creator.kind === "resource-stop") return creator;
        const capture = creator.value?.captures.find(row => sameLocalReference(row.local, from))?.capture ?? null;
        return { kind: "complete", value: capture === null ? null : { kind: "capture", capture } };
      }
      const parameter = local.role === "parameter" ? checkedParameterRows(reference.body)?.locals.get(reference.local) : undefined;
      if (parameter !== undefined && !Object.is(parameter.local, reference.local)) return { kind: "complete", value: null };
      return { kind: "complete", value: parameter === undefined ? { kind: "binding" } : { kind: "parameter", passing: parameter.passing } };
    }
    return { kind: "complete", value: null };
  };
  if (body.captures.length !== 0 && body.root.parent !== null) {
    const authored = originals.get(body.root.parent);
    if (authored?.kind === "Parameter" || authored?.kind === "VariableDeclaration" || authored?.kind === "PropertyDeclaration") {
      const creator = nodeOf({ kind: "item", value: { owner: body.owner, node: body.root.parent } });
      if (creator !== authored || authored.tsonic.initializer !== body.body || authored.initializer !== originals.get(body.root.id))
        emit("capture-qualified", body.root, "a placed capture must retain its actual creator's separately owned initializer root");
      for (const row of body.captures) {
        const mutable = reassignable(row.local);
        const incoming = incomingOf(row.local);
        if (incoming.kind === "resource-stop") return incoming.stop;
        if (row.capture === "captured-value" && (mutable === true || incoming.value !== null && captureRequiresLocation(false, incoming.value)))
          emit("closure-capture-binding", body.root, "a placed body must capture writable outer storage as a location");
      }
    }
  }
  const parameterOwners = new Map<TirNode | TirFormal, TirBody>();
  const registerParameter = (parameter: TirFormal | ParameterDeclaration<TypedPhase>, owner: TirBody): void => {
    parameterOwners.set(parameter, owner);
    const pending: TirNode[] = [parameter.name];
    for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
      parameterOwners.set(name, owner);
      for (const child of typedSyntaxChildren(name)) pending.push(child);
    }
  };
  for (const parameter of body.params) registerParameter(parameter, body);
  for (const record of structure.records) {
    const node = record.role?.kind === "ready-callable" ? record.role.node : record.syntax;
    if (node === null || node.kind !== "FunctionDeclaration" && node.kind !== "MethodDeclaration" && node.kind !== "Constructor"
      && node.kind !== "GetAccessor" && node.kind !== "SetAccessor" && node.kind !== "ArrowFunction" && node.kind !== "FunctionExpression") continue;
    const callable = node.kind === "ArrowFunction" || node.kind === "FunctionExpression" ? node.tsonic.callable : node.tsonic;
    if (callable.template === null || callable.template.body === body.body && node === body.root) continue;
    const instanceRead = admit({ kind: "row" });
    if (instanceRead !== null) return instanceRead;
    const instance = { body: callable.template.body, bindings: body.bindings };
    const lookup = admit({ kind: "artifact", instance });
    if (lookup !== null) return lookup;
    const nested = bodyOf(instance);
    if (nested === null || nested.body !== callable.template.body || nested.owner !== callable.definition) continue;
    const nestedRead = admit({ kind: "row" });
    if (nestedRead !== null) return nestedRead;
    const actual = { body: nested.body, bindings: nested.bindings };
    const nestedIdentity = admit({ kind: "artifact", instance: actual });
    if (nestedIdentity !== null) return nestedIdentity;
    const actualKey = instanceKey(actual);
    const expected = admit({ kind: "artifact", instance });
    if (expected !== null) return expected;
    if (actualKey !== instanceKey(instance) || nested.params.length !== node.parameters.nodes.length
      || node.parameters.nodes.some((parameter, index) => !Object.is(nested.params[index], parameter))) continue;
    for (const parameter of nested.params) registerParameter(parameter, nested);
  }
  const storage = (reference: LocalRef, type: number | null, node: TirNode): void => {
    const owner = parameterOwners.get(node) ?? body;
    const local = owner.locals[reference.local];
    if (reference.body !== owner.body || local === undefined || type === null || !Object.is(local.storage, type)) {
      emit("binding-storage", node, "binding occurrence does not retain its actual qualified local storage slot");
    }
  };
  const binding = (value: TypedBinding, node: TirNode): void => {
    if (value.declaration.kind === "local") storage(value.declaration.local, value.storage, node);
  };
  for (const node of structure.nodes) {
    if (node.kind === "VariableDeclaration") {
      binding(node.tsonic, node);
    } else if (node.kind === "BindingElement") {
      const phase = node.tsonic;
      if (phase.role === "binding") binding(phase, node);
    } else if (node.kind === "Parameter") {
      const original = originals.get(node.id);
      if (original?.kind === "Parameter" && original.tsonic.declaration.kind === "definition") continue;
      if (node.tsonic.local === null)
        emit("parameter-order", node, "an execution parameter requires its actual qualified local");
      else storage(node.tsonic.local, node.tsonic.storage, node);
      const owner = parameterOwners.get(node);
      const checked = owner === undefined ? undefined : checkedParameterRows(owner.body)?.declarations.get(node.tsonic.declaration);
      if (owner === undefined || checked === undefined || !sameParameterSelection(node.tsonic, checked, owner.body))
        emit("parameter-order", node, "parameter occurrence does not retain its actual declared formal and local association");
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
        if (original?.kind === "ArrowFunction" || original?.kind === "FunctionExpression") {
          const payload = original.tsonic;
          if (!("captures" in payload))
            emit("capture-qualified", node, "a nonexecuting field selector cannot supply a closure");
          else if (named.length !== payload.captures.length || named.some((capture, position) => {
            const expected = payload.captures[position];
            return expected === undefined || !sameLocalReference(capture.local, expected);
          })) emit("capture-qualified", node, "closure captures do not retain the real authored outer-local sequence");
        }
      }
      if (closure.kind === "decided") {
        for (const row of closure.decision.captures) {
          if (row.capture !== "captured-value") continue;
          const incoming = incomingOf(row.local);
          if (incoming.kind === "resource-stop") return incoming.stop;
          const mutable = reassignable(row.local) === true;
          if (incoming.value === null ? mutable : captureRequiresLocation(mutable, incoming.value)) {
            emit("closure-capture-binding", node, "a binding whose storage another party can write is a captured location");
            break;
          }
        }
      } else if (closure.deferred.invocation.rule === "closure") {
        for (const capture of closure.deferred.invocation.input.captures) {
          const evidence = reassignable(capture.local);
          const incoming = incomingOf(capture.local);
          if (incoming.kind === "resource-stop") return incoming.stop;
          if (evidence !== null && capture.reassignable !== evidence
            || incoming.value !== null && !sameCaptureSource(capture.incoming, incoming.value)) {
            emit("closure-capture-binding", node, "saved capture evidence does not state the binding evidence of its captured locals");
            break;
          }
        }
      }
    }
  }
  return null;
};

export const verifyPublishedInstance = (
  published: TirBody | null, node: TirNode | null, emit: TirOccurrenceEmit,
): void => {
  if (published === null) {
    emit("nested-instance-key", node, "instance does not select a real canonical body with the complete artifact environment");
  }
};

export function publicationMembership<Stop extends object>(input: TirVerifierInput, admit: TirReadyReadAdmission<Stop>):
  (selected: TirBody, emit: TirOccurrenceEmit) => Stop | null {
  let proof: ReadonlyMap<string, TirBody> | null = null;
  let proofDuplicate = false;
  return (selected, emit) => {
    let current = proof;
    let duplicate = proofDuplicate;
    if (current === null) {
      const setup = admit({ kind: "retain-publication-entry" });
      if (setup !== null) return setup;
      const bodies = new Map<string, TirBody>();
      const inventory = input.module.bodies;
      for (let position = 0; position < inventory.length; position += 1) {
        const step = admit({ kind: "row" });
        if (step !== null) return step;
        const body = inventory[position];
        if (body === undefined) { duplicate = true; continue; }
        const instance = { body: body.body, bindings: body.bindings };
        const identity = admit({ kind: "artifact", instance });
        if (identity !== null) return identity;
        const key = instanceKey(instance);
        if (bodies.has(key)) { duplicate = true; continue; }
        const retain = admit({ kind: "retain-publication-entry" });
        if (retain !== null) return retain;
        bodies.set(key, body);
      }
      current = bodies;
    }
    const selectedRow = admit({ kind: "row" });
    if (selectedRow !== null) return selectedRow;
    const instance = { body: selected.body, bindings: selected.bindings };
    const identity = admit({ kind: "artifact", instance });
    if (identity !== null) return identity;
    const member = current.get(instanceKey(instance)) === selected;
    if (duplicate || !member) {
      emit("template-shared-once", null, "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once");
    }
    proof = current;
    proofDuplicate = duplicate;
    return null;
  };
}
