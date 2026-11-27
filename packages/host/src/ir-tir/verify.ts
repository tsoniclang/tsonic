import type { BodyId, CandidateListId, DefId, ItemNodeRef, NodeId, SourceNodeRef, TyId } from "../ids/contract.js";
import { encodeBodyId, encodeKey } from "../ids/index.js";
import type { CheckedPhase, CheckedSourceObjectFieldReader, HirApplication, HirBody, HirCandidate, HirModule, HirNode, ParameterDeclaration, ReferenceArgumentRequest } from "../ir-hir/contract.js";
import type { Diagnostic, Violation } from "../diag/contract.js";
import { checkedLayoutConstructionOf, checkedLayoutGeometryOperands, checkedLayoutRoleOf, checkedMemberStorageOf,
  checkedReferenceArgumentViewOf, checkedSourceBindingFieldOf, checkedSourceObjectFieldsOf, checkedVariableStorageOf, childrenOfSyntax, hasOverloadEndpoints, indexSyntaxTree,
  readWriteRootStorageOf, resolveModuleBinding, unparenthesizedExpression, walkSyntaxTree,
  writableRootStorageOf } from "../ir-hir/index.js";
import type { BindingVerificationInput, BodyInstance, ReferenceArgumentView, TypeEvidence, TypeRule, TypeTable } from "../ir-types/contract.js";
import { isNativeIntegerPrimitive, nativeArrayExtentOf, nativeCarrierHoldingOf, optionalValueDomainOf, sameInstance, verifyTypes } from "../ir-types/index.js";
import type { TirBindingTarget, TirBody, TirChapterSyntax, TirModule, TirNode, TirNodeSite, TirOperationsOf, TirReadyReadAdmission, TirRule, TirSite, TirSyntaxOccurrence, TirTypedSyntax, TirVerificationResult, TirVerifierInput, TypedPhase, VerifyTir, VerifyTirModule } from "./contract.js";
import type { CallExpression, ElementAccessExpression, PropertyAccessExpression } from "../ir-hir/contract.js";
import type { TirOccurrenceEmit, TirOccurrenceSite, TirStructure } from "./verify-occurrences.js";
import { applicationOf, collectTirSemantics, inspectTirStructure, sameLocalReference, sameSourceReference, typedValueOf, verifyArrayConstruction, verifyDeferredParameters, verifyOccurrenceOperation, verifyOccurrenceRole, verifyOperationShape, verifyPatternBinding, verifySwitchOperations, verifyValueEndpoints } from "./verify-occurrences.js";
import type { TirDeclarationInventory, TirMemberInventory } from "./verify-applications.js";
import { declarationEndpoints, indexMembers, verifyActivation, verifyArgumentTransport, verifyCallEndpoints, verifyMemberDecision, verifyMemberSelection, verifyProtocolOperation, verifyProtocolRecord } from "./verify-applications.js";
import { publicationMembership, sameBindingScope, sameParameterSelection, verifyBindingSlots, verifyBodylessParameters, verifyCanonicalTemplates, verifyControlledContexts, verifyDeclarationNames, verifyNestedPublication, verifyPublishedInstance, verifyQualifiedReferences } from "./verify-instances.js";
import { sameSyntaxFields } from "./syntax-compare.js";
import { sameSourceFileHeader } from "./syntax-compare-values.js";
import { sameTextRange1, sameVector } from "./syntax-compare-common.js";
import { chapterSyntaxSlots, indexChapterSyntax, isLayoutOperandBody, readChapterSyntaxSlot, tirBodySyntaxOf } from "./chapter-syntax.js";
import { createTirLayouts } from "./text-model.js";
import { verifyInterfaceInstance } from "./verify-interface.js";

export interface TirSourceInventory {
  readonly original: HirBody | undefined;
  readonly sourceNodes: ReadonlyMap<NodeId, HirNode>;
  readonly typedNodes: ReadonlyMap<NodeId, TirSyntaxOccurrence>;
  readonly typedOfSource: ReadonlyMap<HirNode, TirSyntaxOccurrence>;
  readonly ownNodes: readonly TirSyntaxOccurrence[];
  readonly nestedRoots: ReadonlySet<NodeId>;
}

function sourceFieldsOf<Stop extends object>(input: TirVerifierInput, boundary: TirSourceBoundary, admit: TirReadyReadAdmission<Stop>) {
  const body = boundary.original;
  const bodyOf = (id: BodyId) => boundary.bodies.get(id) ?? null;
  let stopped: Stop | null = null;
  let missing = false;
  let reader: CheckedSourceObjectFieldReader | null = null;
  const work = (work: number, records: number): boolean => {
    stopped ??= admit({ kind: "source-field-proof", work, records });
    return stopped === null;
  };
  const read = (reference: SourceNodeRef) => {
    if (reference.kind === "item") stopped ??= admit({ kind: "source-declaration", definition: reference.value.owner });
    if (stopped !== null) return null;
    const node = input.nodeOf(reference);
    if (node === null || node.id !== reference.value.node) { missing = true; return null; }
    return node;
  };
  const item = (definition: DefId) => {
    stopped ??= admit({ kind: "source-declaration", definition });
    if (stopped !== null) return null;
    const reference = input.declarationSourceOf(definition);
    if (reference?.kind !== "item" || reference.value.owner !== definition) { missing = true; return null; }
    const node = input.nodeOf(reference);
    if (node === null || node.id !== reference.value.node) { missing = true; return null; }
    return node;
  };
  const field: CheckedSourceObjectFieldReader = access => {
    missing = false;
    if (body === undefined) return null;
    if (reader === null) {
      if (!work(1, 3)) return null;
      reader = checkedSourceObjectFieldsOf(body, { bodyOf, nodeOf: read, itemOf: item, typeOf: type => input.types.terms[type], admit: work }).field;
    }
    return reader(access);
  };
  const referenceArgument = (request: ReferenceArgumentRequest) => body === undefined ? null
    : checkedReferenceArgumentViewOf({ ...request, body }, { bodyOf, nodeOf: read, itemOf: item, typeOf: type => input.types.terms[type], admit: work });
  return { field, referenceArgument, work, stop: () => stopped, missing: () => missing };
}

function sameReferenceView<Stop extends object>(actual: ReferenceArgumentView, selected: ReferenceArgumentView,
  admit: TirReadyReadAdmission<Stop>): boolean | Stop {
  const header = admit({ kind: "row" });
  if (header !== null) return header;
  if (actual.caller !== selected.caller || actual.formal !== selected.formal || actual.fields.length !== selected.fields.length) return false;
  for (let position = 0; position < actual.fields.length; position += 1) {
    const paid = admit({ kind: "row" });
    if (paid !== null) return paid;
    const left = actual.fields[position];
    const right = selected.fields[position];
    if (left === undefined || right === undefined || left.parent !== right.parent || left.caller !== right.caller || left.formal !== right.formal
      || left.callerType !== right.callerType || left.formalType !== right.formalType) return false;
  }
  return true;
}

function verifyOptionalReferenceWrite<Stop extends object>(input: TirVerifierInput, inventory: TirSourceInventory,
  node: TirNode, original: HirNode | undefined, fields: ReturnType<typeof sourceFieldsOf<Stop>>,
  admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  const right = typedValueOf(node);
  if (right?.conversion.kind !== "convert") return null;
  const operation = right.conversion.operation.decision.operation;
  if (operation.kind !== "conversion" || operation.embedding.kind !== "conversion" || operation.embedding.conversion !== "absence") return null;
  const destination = input.types.terms[operation.to];
  if (destination?.kind !== "optional" || input.types.terms[destination.value]?.kind !== "shape") return null;
  const paid = admit({ kind: "row" });
  if (paid !== null) return paid;
  const authored = original?.parent == null ? undefined : inventory.sourceNodes.get(original.parent);
  const parent = authored === undefined ? undefined : inventory.typedOfSource.get(authored);
  const target = authored?.kind === "BinaryExpression" && authored.right === original
    ? unparenthesizedExpression<CheckedPhase>(authored.left) : null;
  const witness = target?.kind === "PropertyAccessExpression" && target.tsonic.role === "assignment-target"
    ? fields.field(target) : null;
  const stopped = fields.stop();
  if (stopped !== null) return stopped;
  const source = input.types.terms[operation.from];
  const { proof } = operation.embedding;
  const step = proof.steps[0];
  if (parent?.kind !== "BinaryExpression" || parent.tsonic.role !== "assignment" || parent.right !== node || parent.id !== authored?.id
    || witness?.presence?.storage !== operation.to || parent.tsonic.storage !== witness.presence.storage
    || source?.kind !== "intrinsic" || source.intrinsic !== "absence" || right.conversion.role !== "assignment"
    || operation.embedding.check.kind !== "none" || proof.conclusion !== 0 || proof.steps.length !== 1
    || step?.rule !== "absence" || step.premises.length !== 0 || step.from.path.length !== 0 || step.to.path.length !== 0
    || !sameSourceReference(step.from.root, { kind: "body", value: { body: witness.occurrence.body, node: node.id } })
    || !sameSourceReference(step.to.root, { kind: "body", value: witness.occurrence }))
    emit("operation-type", node, "an absence write to an optional reference requires its actual checked field and qualified conversion");
  return null;
}

function checkedComparisonPayload<Stop extends object>(input: TirVerifierInput, node: TirNode, original: HirNode | undefined,
  fields: ReturnType<typeof sourceFieldsOf<Stop>>): TyId | null {
  if (node.kind !== "BinaryExpression" || node.tsonic.role !== "comparison" || node.tsonic.operation.kind !== "decided"
    || original?.kind !== "BinaryExpression" || original.tsonic.role !== "comparison") return null;
  const { operands, operation } = node.tsonic.operation.decision.decision;
  if (operation.kind !== "absence-test" || operands.length !== 2) return null;
  const [leftType, rightType] = operands;
  if (leftType === undefined || rightType === undefined) return null;
  const left = input.types.terms[leftType];
  const right = input.types.terms[rightType];
  const selected = left?.kind === "optional" && right?.kind === "intrinsic" && right.intrinsic === "absence" ? 0
    : right?.kind === "optional" && left?.kind === "intrinsic" && left.intrinsic === "absence" ? 1 : null;
  if (selected === null) return null;
  const term = selected === 0 ? left : right;
  if (term?.kind !== "optional" || input.types.terms[term.value]?.kind !== "shape") return null;
  let checked = selected === 0 ? original.left : original.right;
  while (checked.kind === "ParenthesizedExpression") {
    if (!fields.work(1, 0)) return null;
    checked = checked.expression;
  }
  if (checked.kind !== "PropertyAccessExpression" || checked.tsonic.role !== "value") return null;
  const proof = fields.field(checked)?.presence;
  return proof != null && proof.storage === operands[selected] && proof.present === term.value ? proof.present : null;
}

function verifyIndex(input: TirVerifierInput, node: ElementAccessExpression<TypedPhase>, original: HirNode | undefined,
  emit: TirOccurrenceEmit): void {
  const value = node.tsonic;
  if (!("index" in value)) return;
  const selected = value.index;
  const receiver = typedValueOf(node.expression);
  const key = typedValueOf(node.argumentExpression);
  const storage = input.types.terms[selected.receiver];
  const nativeKey = input.types.terms[selected.key];
  const holding = nativeCarrierHoldingOf(input.selectedNativeFacts.carrierHolding, selected.carrier);
  if (original?.kind !== "ElementAccessExpression" || original.questionDotToken !== null || node.questionDotToken !== null
    || receiver?.convertedType !== selected.receiver || key?.convertedType !== selected.key
    || nativeKey?.kind !== "primitive" || !isNativeIntegerPrimitive(nativeKey.primitive)
    || (storage?.kind !== "array" && storage?.kind !== "fixed-array") || selected.carrier !== storage.kind
    || holding === null || holding !== selected.holding
    || selected.failure !== (storage.kind === "array" ? input.selectedNativeFacts.arrayIndexFailure : input.selectedNativeFacts.fixedArrayIndexFailure)) {
    emit("access-location", node, "an indexed place must retain its actual receiver, holding, native index operand and bounds failure");
    return;
  }
  if (value.role === "value") {
    const read = original.tsonic.role === "value" ? original.tsonic.value.views.read : null;
    if (read?.kind !== "available" || value.type !== selected.read
      || selected.read !== storage.element || selected.write !== null || selected.writeCheck !== null)
      emit("access-location", node, "an indexed read must retain the actual selected element and no write");
  } else {
    const checked = checkedMemberStorageOf(original);
    const reachedRead = checked?.read == null ? null : storage.element;
    if (checked === null || (storage.kind === "array" && storage.readonly) || selected.write !== storage.element
      || selected.writeCheck !== input.selectedNativeFacts.destinationCheck
      || value.access.storage !== selected.write || selected.read !== reachedRead
      || (value.access.kind === "write" ? reachedRead !== null
        : reachedRead === null || value.access.read !== reachedRead || value.access.narrowing !== null || value.access.evidenceIndex !== null))
      emit("access-location", node, "an indexed write must retain its actual checked write and only its reached read");
  }
}

function verifyArrayExtent(input: TirVerifierInput, node: PropertyAccessExpression<TypedPhase> | ElementAccessExpression<TypedPhase>,
  original: HirNode | undefined, emit: TirOccurrenceEmit): void {
  const value = node.tsonic;
  const checked = original?.kind === "PropertyAccessExpression" && original.tsonic.role === "array-extent" ? original.tsonic : null;
  const operation = value.role === "array-extent" && value.operation.kind === "decided" ? value.operation.decision : null;
  const selected = operation?.decision.operation;
  const operand = operation?.decision.operands[0];
  const carrier = operand === undefined ? undefined : input.types.terms[operand];
  const result = operation === null ? undefined : input.types.terms[operation.decision.result];
  if (value.role !== "array-extent" || node.kind !== "PropertyAccessExpression" || node.questionDotToken !== null
    || checked === null || selected?.kind !== "array-extent" || operation === null
    || operation.permissionScope !== null || operation.decision.execution.kind !== "pure" || operation.decision.operands.length !== 1
    || checked.selectedMember.owner !== selected.declaration.owner || checked.selectedMember.node !== selected.declaration.node
    || typedValueOf(node.expression)?.convertedType !== operand || value.type !== operation.decision.result
    || (carrier?.kind !== "array" && carrier?.kind !== "fixed-array") || result?.kind !== "primitive"
    || result.primitive !== nativeArrayExtentOf(input.selectedNativeFacts.arrayExtents, carrier.kind)
    || selected.holding !== nativeCarrierHoldingOf(input.selectedNativeFacts.carrierHolding, carrier.kind))
    emit("access-location", node, "an array extent must retain its checked declaration, actual receiver and selected native result");
}

const validRange = (start: number, length: number): boolean =>
  Number.isSafeInteger(start) && !Object.is(start, -0) && start >= 0 &&
  Number.isSafeInteger(length) && !Object.is(length, -0) && length >= 0 && Number.isSafeInteger(start + length);

interface TirSourceBoundary {
  readonly original: HirBody | undefined;
  readonly bodies: ReadonlyMap<BodyId, HirBody>;
  readonly nestedRoots: ReadonlySet<NodeId>;
  readonly headers: readonly (ParameterDeclaration<CheckedPhase> | null)[];
}

interface IndexedTypeViolation {
  readonly ordinal: number;
  readonly rule: TypeRule;
}

interface MappedTypeViolation extends IndexedTypeViolation {
  readonly target: TirRule;
  readonly node: TirOccurrenceSite | null;
}

const indexTypeViolation = (
  index: Map<number, IndexedTypeViolation[]>, position: number, violation: IndexedTypeViolation,
): void => {
  const findings = index.get(position);
  if (findings === undefined) index.set(position, [violation]);
  else findings.push(violation);
};

const readSourceBoundary = (body: BodyId, source: HirModule, nodeOf: TirVerifierInput["nodeOf"]): TirSourceBoundary => {
  const sourceBodies = new Map<BodyId, HirBody>();
  for (const candidate of source.bodies) if (candidate !== undefined) sourceBodies.set(candidate.body, candidate);
  const original = sourceBodies.get(body);
  const nestedRoots = new Set<NodeId>();
  if (original !== undefined) for (const nested of original.nestedBodies) {
    const candidate = sourceBodies.get(nested);
    if (candidate !== undefined) nestedRoots.add(candidate.root.id);
  }
  const headers: (ParameterDeclaration<CheckedPhase> | null)[] = [];
  if (original !== undefined) for (const parameter of original.params) {
    const local = original.locals[parameter.local];
    const header = local === undefined ? null : nodeOf(local.declaration);
    if (header?.kind !== "Parameter" || local?.declaration.kind !== "item"
      || local.declaration.value.owner !== parameter.declaration || header.id !== local.declaration.value.node
      || header.tsonic.parent !== original.owner) {
      headers.push(null);
      continue;
    }
    headers.push(header);
    if (header.initializer !== null) nestedRoots.add(header.initializer.id);
  }
  return { original, bodies: sourceBodies, nestedRoots, headers };
};

function* chapterRoots(module: TirModule): Generator<TirChapterSyntax> {
  const tree = module.tree;
  yield tree.kind === "checked-root" ? { kind: "checked", node: tree.root } : { kind: "module-root", node: tree.root };
}

function sameChapterFields(subject: TirTypedSyntax, checked: HirNode): boolean {
  switch (subject.kind) {
    case "ordinary": return sameSyntaxFields(subject.node, checked);
    case "module-root": return checked.kind === "SourceFile"
      && sameVector(subject.node.flags, checked.flags, Object.is)
      && sameSourceFileHeader<TypedPhase, CheckedPhase>(subject.node, checked)
      && sameTextRange1(subject.node.statements.loc, checked.statements.loc);
    case "ready-callable": return checked.kind === "FunctionDeclaration" && checked.body !== null
      && sameVector(subject.node.flags, checked.flags, Object.is)
      && sameTextRange1(subject.node.parameters.loc, checked.parameters.loc)
      && (subject.node.name === null) === (checked.name === null)
      && (subject.node.modifiers === null) === (checked.modifiers === null)
      && (subject.node.asteriskToken === null) === (checked.asteriskToken === null)
      && (subject.node.typeParameters === null) === (checked.typeParameters === null)
      && (subject.node.type === null) === (checked.type === null)
      && (subject.node.fullSignature === null) === (checked.fullSignature === null);
    case "formal": return checked.kind === "Parameter"
      && (subject.node.initializer.kind === "none") === (checked.initializer === null)
      && sameSyntaxFields(subject.node, checked);
  }
}

function chapterNodes(module: TirModule, emit: TirOccurrenceEmit): ReadonlyMap<NodeId, TirSyntaxOccurrence> {
  const typed = new Map<NodeId, TirSyntaxOccurrence>();
  for (const subject of indexChapterSyntax(chapterRoots(module), chapterSyntaxSlots, () => true)) {
    if (subject.kind === "checked") continue;
    const node = subject.node;
    const previous = typed.get(node.id);
    if (previous !== undefined && previous !== node) emit("module-node-identity", node, "chapter has conflicting authored occurrences");
    else typed.set(node.id, node);
  }
  return typed;
}

function verifyChapterRoles<Stop extends object>(
  input: TirVerifierInput, module: TirModule, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit,
): Stop | null {
  const original = input.source.tree;
  const rootRead = admit({ kind: "row" });
  if (rootRead !== null) return rootRead;
  const tree = module.tree;
  const moduleInstance: BodyInstance = { body: original.tsonic.body, bindings: { kind: "parametric" } };
  const moduleIdentity = admit({ kind: "artifact", instance: moduleInstance });
  if (moduleIdentity !== null) return moduleIdentity;
  const moduleBody = input.bodyOf(moduleInstance);
  if (tree.kind === "checked-root") {
    if (tree.root !== original || moduleBody !== null)
      emit("module-node-identity", tree.root, "checked module root must be the actual authored root with no required module body");
    return null;
  }
  const root = tree.root;
  if (moduleBody === null || moduleBody.root !== root || moduleBody.owner !== original.tsonic.definition
    || root.id !== original.id || root.tsonic.module !== module.module || root.tsonic.template?.body !== moduleInstance.body) {
    emit("module-node-identity", root, "ready module root must share the independently required module template");
  }
  const statements = root.statements.nodes;
  const authored = original.statements.nodes;
  if (statements.length !== authored.length || !sameChapterFields({ kind: "module-root", node: root }, original))
    emit("kind-children-shape", root, "ready module retains the actual authored header and ordered statement slots");
  for (let position = 0; position < statements.length; position += 1) {
    const row = admit({ kind: "row" });
    if (row !== null) return row;
    const statement = statements[position];
    const actual = authored[position];
    if (statement === undefined || actual === undefined || statement.node.id !== actual.id || statement.node.kind !== actual.kind) {
      emit("authored-node-ids-preserved", root, "chapter statement slot differs from the actual authored position");
      continue;
    }
    if (statement.kind === "checked-declaration" && !Object.is(statement.node, actual)) {
      emit("module-node-identity", statement.node, "checked declaration slot does not retain its actual authored occurrence");
    }
    if (statement.kind === "ready-statement" && statement.node.kind === "InterfaceDeclaration") {
      const stop = verifyInterfaceInstance(input, statement.node, actual, admit, emit);
      if (stop !== null) return stop;
    }
    if (actual.kind !== "FunctionDeclaration") {
      if (statement.kind === "ready-callable") emit("nested-template-identity", statement.node, "ready callable slot requires its actual authored function");
      continue;
    }
    const template = actual.tsonic.body;
    if (template === null) {
      if (statement.kind === "ready-callable") emit("nested-template-identity", statement.node, "bodyless declarations do not publish executable roles");
      continue;
    }
    const instance: BodyInstance = { body: template, bindings: { kind: "parametric" } };
    const identity = admit({ kind: "artifact", instance });
    if (identity !== null) return identity;
    const selected = input.bodyOf(instance);
    if (statement.kind === "ready-callable") {
      const callable = statement.node;
      let shared = selected !== null && selected.root === callable.body && selected.owner === actual.tsonic.definition
        && callable.tsonic.definition === actual.tsonic.definition && callable.tsonic.template?.body === template
        && selected.params.length === callable.parameters.nodes.length;
      if (selected !== null && shared) for (let index = 0; index < selected.params.length; index += 1) {
        const formal = admit({ kind: "row" });
        if (formal !== null) return formal;
        const parameter = selected.params[index];
        if (parameter === undefined || parameter !== callable.parameters.nodes[index]) { shared = false; break; }
      }
      if (!shared) {
        emit("nested-template-identity", callable, "ready callable must retain its independently required body and each actual formal pointer");
      }
    } else if (selected !== null || statement.kind !== "checked-declaration") {
      emit("nested-template-identity", statement.node, "an unopened callable role cannot replace its independently required body");
    }
  }
  return null;
}

export const verifySourcePreservation = (
  body: TirBody, source: HirModule, module: TirModule, boundary: TirSourceBoundary, emit: TirOccurrenceEmit,
): TirSourceInventory => {
  const { original, nestedRoots, headers } = boundary;
  const sourceNodes = new Map<NodeId, HirNode>();
  const typedNodes = chapterNodes(module, emit);
  for (const node of indexSyntaxTree<CheckedPhase>(source.tree)) {
    sourceNodes.set(node.id, node);
  }
  const ownNodes: TirSyntaxOccurrence[] = [];
  function* selectedRoots(): Generator<TirChapterSyntax> {
    yield tirBodySyntaxOf(body.root);
    for (const node of body.params) yield { kind: "formal", node };
  }
  for (const subject of indexChapterSyntax(selectedRoots(), chapterSyntaxSlots, () => true)) {
    if (subject.kind !== "checked") ownNodes.push(subject.node);
  }
  const bodyNodes = new Set(original === undefined ? [] : walkSyntaxTree<CheckedPhase>(original.root, []).map((node: HirNode) => node.id));
  for (const header of headers) if (header !== null)
    for (const node of walkSyntaxTree<CheckedPhase>(header, [])) bodyNodes.add(node.id);
  if (original === undefined || original.owner !== body.owner) {
    emit("body-owner", null, "body identity and owner do not retain the actual original body");
  }
  if (module.module !== source.module || body.root.origin.module !== source.module ||
    body.bindings.kind === "parametric" && module.tree.kind === "ready-root" && !isLayoutOperandBody(body.body) &&
    typedNodes.get(body.root.id) !== body.root) {
    emit("module-node-identity", body.root, "body does not retain its module identity and canonical parametric subtree");
  }
  interface TransferScope { readonly breakTo: NodeId | null; readonly continueTo: NodeId | null }
  const paired: { subject: TirChapterSyntax; original: HirNode; transfers: TransferScope | undefined }[] = original === undefined
    ? [] : [{ subject: tirBodySyntaxOf(body.root), original: original.root, transfers: { breakTo: null, continueTo: null } }];
  for (const [index, parameter] of body.params.entries()) {
    const checked = headers[index];
    if (checked === undefined || checked === null)
      emit("parameter-order", parameter, "selected header has no actual checked parameter item and owning callable association");
    else paired.push({ subject: { kind: "formal", node: parameter }, original: checked, transfers: undefined });
    if (body.bindings.kind === "parametric" && module.tree.kind === "ready-root" && typedNodes.get(parameter.id) !== parameter)
      emit("module-node-identity", parameter, "selected parameter is not the canonical header occurrence of its callable");
  }
  const sourceOfTyped = new Map<TirSyntaxOccurrence, HirNode>();
  const typedOfSource = new Map<HirNode, TirSyntaxOccurrence>();
  for (let pair = paired.pop(); pair !== undefined; pair = paired.pop()) {
    const subject = pair.subject;
    const checked = pair.original;
    if (subject.kind === "checked") {
      if (!Object.is(subject.node, checked)) emit("module-node-identity", subject.node, "checked chapter role does not retain its actual authored pointer");
      continue;
    }
    const node = subject.node;
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
    const children = Array.from(chapterSyntaxSlots(subject), readChapterSyntaxSlot).filter(child => child !== null);
    const originals = childrenOfSyntax<CheckedPhase>(checked);
    if (!sameChapterFields(subject, checked) || children.length !== originals.length) {
      emit("kind-children-shape", node, "typed syntax does not retain the authored kind, fields and child presence");
    }
    if (subject.kind === "ordinary" && pair.transfers !== undefined && (node.kind === "BreakStatement" || node.kind === "ContinueStatement")
      && checked.kind === node.kind && checked.label === null && node.label === null) {
      const target = node.tsonic.target;
      const expected = node.kind === "BreakStatement" ? pair.transfers.breakTo : pair.transfers.continueTo;
      if (target.body !== body.body || target.node !== expected)
        emit("node-reference", node, "unlabelled transfer does not target its actual enclosing control in this execution");
    }
    if (pair.transfers !== undefined && (node.kind === "LabeledStatement" || node.kind === "BreakStatement" || node.kind === "ContinueStatement")
      && (checked.kind === "LabeledStatement" || checked.kind === "BreakStatement" || checked.kind === "ContinueStatement")
      && node.kind === checked.kind && checked.label !== null && node.label !== null) {
      const sourceName = checked.label.tsonic;
      const typedName = node.label.tsonic;
      const expected = sourceName.role === "label" ? sourceName.target : null;
      const declaration = expected === null ? undefined : sourceNodes.get(expected.node);
      const target = node.tsonic.target;
      if (expected === null || expected.body !== body.body || declaration?.kind !== "LabeledStatement"
        || declaration.label.text !== checked.label.text || node.kind === "LabeledStatement" && expected.node !== checked.id
        || target.body !== expected.body || target.node !== expected.node
        || typedName.role !== "label" || typedName.target.body !== expected.body || typedName.target.node !== expected.node)
        emit("node-reference", node, "labelled control does not retain the actual qualified checked label binding");
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
    for (let position = children.length - 1; position >= 0; position--) {
      const child = children[position];
      const sourceChild = originals[position];
      if (child !== undefined && sourceChild !== undefined) {
        let transfers = nestedRoots.has(sourceChild.id) ? undefined : pair.transfers;
        if (transfers !== undefined) {
          if ((checked.kind === "WhileStatement" || checked.kind === "DoStatement" || checked.kind === "ForStatement"
            || checked.kind === "ForInStatement" || checked.kind === "ForOfStatement") && sourceChild === checked.statement)
            transfers = { breakTo: checked.id, continueTo: checked.id };
          else if (checked.kind === "SwitchStatement" && sourceChild === checked.caseBlock)
            transfers = { breakTo: checked.id, continueTo: transfers.continueTo };
        }
        paired.push({ subject: child, original: sourceChild, transfers });
      }
      else if (child !== undefined) emit("no-inserted-nodes", child.node, "typed syntax adds an authored child position");
    }
  }
  if (original !== undefined && body.root.id !== original.root.id) {
    emit("node-in-body-range", body.root, "typed body root does not retain the actual original body subtree");
  }
  if (original !== undefined) for (const node of ownNodes) if (!bodyNodes.has(node.id)) {
    emit("node-in-body-range", node, "typed syntax contains a real or invented node outside its actual original body subtree");
  }
  return { original, sourceNodes, typedNodes, typedOfSource, ownNodes, nestedRoots };
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
    const selected = parameter.tsonic;
    const checked = original?.params[position];
    if (checked !== undefined && !sameParameterSelection(selected, checked, body.body)) parameterOrder = false;
    const local = selected.local === null ? undefined : body.locals[selected.local.local];
    if (local === undefined || local.role !== "parameter" || !Object.is(local.storage, selected.storage)) {
      emit("local-storage", null, "parameter storage does not retain its real local slot");
    }
    if (selected.role === "this" && position !== 0 || selected.role === "rest" && position !== body.params.length - 1) parameterOrder = false;
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
  root: TirOccurrenceSite, structure: TirStructure, table: TypeTable, diagnostics: readonly Diagnostic[], emit: TirOccurrenceEmit,
): void => {
  const reverse = new Map<number, number[]>();
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
      case "declared": case "merged-interface": case "alias-application": case "construction-reference":
        for (const child of term.arguments) edge(position, child); break;
      case "projection": edge(position, term.source); break;
      case "primitive": case "string": case "intrinsic": case "enum": case "param": case "merged-parameter": case "self": break;
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

const verifyTypePayload = <Stop extends object>(
  input: TirVerifierInput, target: TirBindingTarget, subject: TirBody | TirModule, structure: TirStructure,
  declarationOf: (definition: DefId) => TirDeclarationInventory | null,
  emit: TirOccurrenceEmit, appendViolation: TirOccurrenceEmit, admit: TirReadyReadAdmission<Stop>,
): Stop | null => {
  const stop = target.kind === "body" ? admit({ kind: "artifact", instance: target.instance })
    : admit({ kind: "module-scope", module: target.module });
  if (stop !== null) return stop;
  const supplied = input.bindingScopesOf<Stop>(target, subject, consume => {
    for (let position = 0; position < structure.records.length; position += 1) {
      const stop = admit({ kind: "row" });
      if (stop !== null) return stop;
      const record = structure.records[position];
      if (record?.association?.kind !== "binding") continue;
      const consumed = consume(record.bindingOwner);
      if (consumed !== null) return consumed;
    }
    return null;
  });
  if (supplied.kind === "resource-stop") return supplied.stop;
  const scopes = supplied.scopes;
  if (scopes === null) emit("binding-vector-complete", null, "binding target has no actual supplied scope inventory");
  const bindingInputs: BindingVerificationInput[] = [];
  const bindingSites: (TirOccurrenceSite | null)[] = [];
  const evidence: TypeEvidence[] = [];
  const evidenceSites: (TirOccurrenceSite | null)[] = [];
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
  return null;
};

export const tirOperationsOf: TirOperationsOf = (input, instance) => {
  const body = input.bodyOf(instance);
  if (body === null) throw new TypeError("The operation inventory requires its actual verified typed body.");
  const boundary = readSourceBoundary(body.body, input.source, input.nodeOf);
  const structure = inspectTirStructure(body, createTirLayouts(), boundary.nestedRoots);
  return collectTirSemantics(structure).operations.map(({ value, node }) =>
    ({ operation: value, node: { body: body.body, node: node.id }, origin: node.origin }));
};

function verifyPlacedDefaults<Stop extends object>(input: TirVerifierInput, body: TirBody, boundary: TirSourceBoundary,
  admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  let minimum: number | undefined;
  let ordinal = 0;
  for (let position = 0; position < body.params.length; position += 1) {
    const row = admit({ kind: "row" });
    if (row !== null) return row;
    const parameter = body.params[position];
    const authored = boundary.headers[position];
    if (parameter === undefined || parameter.tsonic.role === "this") continue;
    const formal = ordinal++;
    if (authored === null || authored === undefined) continue;
    const placement = authored.tsonic.initializer;
    const role = parameter.initializer;
    if (placement === null || authored.initializer === null) {
      if (role.kind !== "none" || placement !== null || authored.initializer !== null)
        emit("parameter-order", parameter, "an initializer role needs its actual authored expression and placement");
      continue;
    }
    const instance: BodyInstance = { body: placement, bindings: body.bindings };
    const identity = admit({ kind: "artifact", instance });
    if (identity !== null) return identity;
    const ready = input.bodyOf(instance);
    let exact = parameter.tsonic.initializer === placement && boundary.bodies.get(placement)?.root === authored.initializer;
    if (ready === null) exact &&= role.kind === "checked-default" && role.root === authored.initializer;
    else {
      const actual = { body: ready.body, bindings: ready.bindings };
      const returned = admit({ kind: "artifact", instance: actual });
      if (returned !== null) return returned;
      exact &&= ready.owner === parameter.tsonic.declaration && sameInstance(actual, instance)
        && role.kind === "ready-default" && role.root === ready.root;
    }
    if (body.bindings.kind === "instantiated") {
      if (minimum === undefined) {
        const caller = { body: body.body, bindings: body.bindings };
        const asked = admit({ kind: "artifact", instance: caller });
        if (asked !== null) return asked;
        const entries = input.requiredEntriesOf(caller);
        const read = admit({ kind: "row" });
        if (read !== null) return read;
        minimum = entries?.at(-1) ?? -1;
      }
      if (minimum < 0) exact = false;
      else if (minimum <= formal) {
        const asked = admit({ kind: "artifact", instance });
        if (asked !== null) return asked;
        const entries = input.requiredEntriesOf(instance);
        const read = admit({ kind: "row" });
        if (read !== null) return read;
        exact &&= ready !== null && entries?.length === 1 && Object.is(entries[0], 0);
      }
    }
    if (!exact) emit("nested-template-identity", parameter, "formal default must match its placed body and independently required execution");
  }
  return null;
}

function verifyLayoutArguments<Stop extends object>(node: CallExpression<TypedPhase>, original: HirNode | undefined, body: TirBody,
  input: TirVerifierInput, sourceBodies: TirSourceBoundary["bodies"], admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit,
): Stop | null {
  const capture = original?.kind === "CallExpression" ? checkedLayoutConstructionOf(original) : null;
  const args = node.arguments;
  if (original?.kind === "CallExpression" && checkedLayoutRoleOf(original) === "field-offset") {
    if (!("kind" in args) || args.kind !== "field-offset-quote") {
      emit("kind-children-shape", node, "a field-offset quotation must retain its layout and nonexecuting checked selector");
      return null;
    }
    const stopped = admit({ kind: "row" });
    if (stopped !== null) return stopped;
    const layout = args.layout;
    const checkedLayout = original.arguments.nodes[0];
    if (checkedLayout === undefined || layout.id !== checkedLayout.id)
      emit("node-reference", node, "a field-offset layout must retain its exact checked operand occurrence");
    const selectorRead = admit({ kind: "row" });
    if (selectorRead !== null) return selectorRead;
    const selector = args.selector;
    if (selector !== original.arguments.nodes[1] || !("role" in selector.tsonic) || selector.tsonic.role !== "layout-selector" ||
      selector.tsonic.call.body !== body.body || selector.tsonic.call.node !== original.id)
      emit("node-reference", node, "a field-offset selector must retain its exact nonexecuting checked occurrence");
    return null;
  }
  if ((capture !== null) !== ("kind" in args && args.kind === "layout-quote") ||
    ("kind" in args && args.kind === "field-offset-quote"))
    emit("kind-children-shape", node, "a layout quotation belongs only to its actual checked construction");
  if (capture === null || !("kind" in args) || args.kind !== "layout-quote") return null;
  const expected = checkedLayoutGeometryOperands(capture);
  if (args.operands.length !== expected.length || expected.length !== (capture.kind === "field" ? 2 : capture.kind === "array" ? 4 : 3)) {
    emit("kind-children-shape", node, "a layout quote must retain its complete checked geometry operand inventory");
    return null;
  }
  for (let position = 0; position < expected.length; position += 1) {
    const stopped = admit({ kind: "row" });
    if (stopped !== null) return stopped;
    const checked = expected[position];
    const operand = args.operands[position];
    if (checked?.kind !== "body" || operand === undefined ||
      operand.source.body !== checked.value.body || operand.source.node !== checked.value.node) {
      emit("node-reference", node, "a layout operand must retain its exact checked source occurrence");
      continue;
    }
    const instance = { body: checked.value.body, bindings: body.bindings };
    const paid = admit({ kind: "artifact", instance });
    if (paid !== null) return paid;
    const source = sourceBodies.get(instance.body);
    const ready = input.layoutOperandOf(instance);
    if (source === undefined || source.root.id !== checked.value.node || operand.root.id !== checked.value.node ||
      input.nodeOf(checked) !== source.root ||
      ready !== operand.root)
      emit("module-node-identity", node, "a layout operand must share its exact independently required ready body root");
  }
  return null;
}

function verifyLayoutBody<Stop extends object>(input: TirVerifierInput, body: TirBody,
  admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  if (!isLayoutOperandBody(body.body)) return null;
  const instance: BodyInstance = { body: body.body, bindings: body.bindings };
  const paid = admit({ kind: "artifact", instance });
  if (paid !== null) return paid;
  if (input.layoutOperandOf(instance) !== body.root)
    emit("module-node-identity", body.root, "layout body does not retain its actual independently owned geometry root");
  return null;
}

function verifyBody<Stop extends object>(input: TirVerifierInput, body: TirBody, admit: TirReadyReadAdmission<Stop>,
  membership: (selected: TirBody, emit: TirOccurrenceEmit) => Stop | null,
): TirVerificationResult<TirSite, Stop> {
  const previous = admit({ kind: "prior" });
  if (previous !== null) return { kind: "resource-stop", stop: previous };
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
  const boundary = readSourceBoundary(body.body, input.source, input.nodeOf);
  const structure = inspectTirStructure(body, createTirLayouts(), boundary.nestedRoots);
  const inventory = verifySourcePreservation(body, input.source, input.module, boundary, emit);
  const fields = sourceFieldsOf(input, boundary, admit);
  for (const node of structure.excluded)
    emit("kind-children-shape", node, "An excluded source expression cannot occupy a Typed syntax slot.");
  verifyBodylessParameters(input, structure.nodes, inventory.sourceNodes, emit);
  verifyDeclarationNames(structure.nodes, inventory.sourceNodes, emit);
  const semantics = collectTirSemantics(structure);
  verifyBodyRecords(body, inventory.original, emit);
  verifyClosedReferences(body.root, structure, input.types, input.diagnostics, emit);
  verifyQualifiedReferences(input, body, structure, emit);
  const publication = membership(body, emit);
  if (publication !== null) return { kind: "resource-stop", stop: publication };
  const geometry = verifyLayoutBody(input, body, admit, emit);
  if (geometry !== null) return { kind: "resource-stop", stop: geometry };
  const defaults = verifyPlacedDefaults(input, body, boundary, admit, emit);
  if (defaults !== null) return { kind: "resource-stop", stop: defaults };
  const ownNodeIds = verifyNestedPublication(input, body, semantics, inventory.original, inventory.typedNodes, inventory.ownNodes, boundary.headers, emit);
  verifyControlledContexts(body, inventory.original, structure, semantics, emit);
  const bindingSlots = verifyBindingSlots(body, structure, inventory.sourceNodes, boundary.bodies, input.module.bodies, input.bodyOf, input.nodeOf, emit, admit);
  if (bindingSlots !== null) return { kind: "resource-stop", stop: bindingSlots };
  const declarationOf = declarationInventory(input);
  verifyScalarReferences(structure, inventory.sourceNodes, declarationOf, emit);
  const instanceRead = admit({ kind: "row" });
  if (instanceRead !== null) return { kind: "resource-stop", stop: instanceRead };
  const instance: BodyInstance = { body: body.body, bindings: body.bindings };
  const types = verifyTypePayload(input, { kind: "body", instance }, body, structure, declarationOf, emit, appendViolation, admit);
  if (types !== null) return { kind: "resource-stop", stop: types };
  const aliasOf = input.layoutAliasOf;
  if (aliasOf) {
    const stopped = admit({ kind: "row" });
    if (stopped !== null) return { kind: "resource-stop", stop: stopped };
  }
  const alias = aliasOf ? aliasOf(body.body) : null;
  const candidates = new Map<CandidateListId, readonly HirCandidate[]>();
  if (inventory.original !== undefined) for (const list of inventory.original.candidateLists) {
    if (list !== undefined) candidates.set(list.id, list.candidates);
  }
  for (const node of structure.nodes) {
    const original = inventory.sourceNodes.get(node.id);
    if (node.kind === "VariableDeclaration") {
      const stop = verifyPatternBinding(node, original, input.types, admit, emit);
      if (stop !== null) return { kind: "resource-stop", stop };
    }
    if (node.kind === "ArrayLiteralExpression") {
      const stop = verifyArrayConstruction(node, original, instance, input.types, input.selectedNativeFacts, admit, emit);
      if (stop !== null) return { kind: "resource-stop", stop };
    }
    if (node.kind === "InterfaceDeclaration") {
      const stop = verifyInterfaceInstance(input, node, original, admit, emit);
      if (stop !== null) return { kind: "resource-stop", stop };
    }
    if (node.kind === "CallExpression") {
      const layout = verifyLayoutArguments(node, original, body, input, boundary.bodies, admit, emit);
      if (layout !== null) return { kind: "resource-stop", stop: layout };
    }
    verifyOccurrenceRole(node, original, emit);
    if (node.kind === "SpreadElement" && "role" in node.tsonic) {
      const paid = admit({ kind: "row" });
      if (paid !== null) return { kind: "resource-stop", stop: paid };
      const parent = original?.parent === null || original?.parent === undefined ? undefined : inventory.sourceNodes.get(original.parent);
      const owner = node.tsonic.role === "finite-call-argument" ? "CallExpression" : "ArrayLiteralExpression";
      if (original?.kind !== "SpreadElement" || original.expression.id !== node.expression.id || parent?.kind !== owner)
        emit("authored-order-preserved", node, "a selected spread requires its actual authored operand and owner");
    }
    verifyValueEndpoints(body, node, emit);
    const qualified = checkedComparisonPayload(input, node, original, fields);
    const comparisonStop = fields.stop();
    if (comparisonStop !== null) return { kind: "resource-stop", stop: comparisonStop };
    verifyOccurrenceOperation(node, input.types, qualified, emit);
    const write = verifyOptionalReferenceWrite(input, inventory, node, original, fields, admit, emit);
    if (write !== null) return { kind: "resource-stop", stop: write };
    if (node.kind === "PropertyAccessExpression" && node.tsonic.role === "value" && node.tsonic.narrowing?.kind === "narrowed") {
      const paid = admit({ kind: "row" });
      if (paid !== null) return { kind: "resource-stop", stop: paid };
      const { selection, narrowing } = node.tsonic;
      const source = input.types.terms[narrowing.source];
      const domain = source === undefined ? null : optionalValueDomainOf(source, type => input.types.terms[type] ?? null);
      const read = original?.kind === "PropertyAccessExpression" && original.tsonic.role === "value" ? original.tsonic.value.views.read : null;
      const witness = domain?.kind !== "optional-value" && original?.kind === "PropertyAccessExpression" ? fields.field(original)?.presence : null;
      const stopped = fields.stop();
      if (stopped !== null) return { kind: "resource-stop", stop: stopped };
      const present = domain?.kind === "optional-value" ? domain.present : witness?.storage === narrowing.source ? witness.present : null;
      if (read?.kind !== "available" || read.value !== narrowing.result || selection.kind !== "decided"
        || selection.decision.decision.location.kind !== "data" || selection.decision.decision.read !== narrowing.source
        || present !== narrowing.result)
        emit("refinement-destination", node, "a narrowed field requires its completed native storage and actual checked read endpoint");
    }
    if ((node.kind === "PropertyAccessExpression" || node.kind === "ElementAccessExpression")
      && (node.tsonic.role === "array-extent" || original?.kind === "PropertyAccessExpression" && original.tsonic.role === "array-extent")) {
      const paid = admit({ kind: "row" });
      if (paid !== null) return { kind: "resource-stop", stop: paid };
      verifyArrayExtent(input, node, original, emit);
    }
    if (node.kind === "ElementAccessExpression" && "index" in node.tsonic) {
      const paid = admit({ kind: "row" });
      if (paid !== null) return { kind: "resource-stop", stop: paid };
      verifyIndex(input, node, original, emit);
    }
    if (node.kind === "SwitchStatement") verifySwitchOperations(node, input.types, emit);
    const phase = node.tsonic;
    const checked = original?.tsonic;
    const descriptor = phase !== null && "resolution" in phase && phase.resolution.kind === "layout-descriptor" ? phase.resolution : null;
    if (descriptor !== null || alias !== null && alias.read.node === node.id) {
      if (descriptor === null || alias === null || alias.read.body !== body.body || alias.read.node !== node.id ||
        node.kind !== "Identifier" || node.tsonic.role !== "value" ||
        original?.kind !== "Identifier" || original.tsonic.role !== "value" ||
        original.tsonic.value.views.read.kind !== "available" ||
        node.tsonic.type !== original.tsonic.value.views.read.value ||
        !sameSourceReference(descriptor.descriptor, alias.descriptor))
        emit("layout-call-exact", node, "a layout alias retains its actual checked immutable initializer and descriptor");
    }
    const checkedIntrinsic = checked !== undefined && checked !== null && "resolution" in checked
      && checked.resolution.kind === "intrinsic-value";
    const typedIntrinsic = phase !== null && "resolution" in phase && phase.resolution.kind === "intrinsic-value";
    if (checkedIntrinsic || typedIntrinsic) {
      const type = node.kind === "Identifier" && node.tsonic.role === "value" ? input.types.terms[node.tsonic.type] : undefined;
      if (!checkedIntrinsic || !typedIntrinsic || type?.kind !== "intrinsic" || type.intrinsic !== "absence")
        emit("intrinsic-value-use", node, "a typed intrinsic value must retain its actual checked identifier read and native absence type");
    }
    if (phase !== null && "resolution" in phase && phase.resolution.kind === "static") {
      const reference = phase.resolution;
      const original = checked !== undefined && checked !== null && "resolution" in checked ? checked.resolution : null;
      const binding = original?.kind === "binding" ? resolveModuleBinding(input, original.occurrence) : null;
      const selected = binding === null ? original : binding.target.kind === "available" ? binding.target.value : null;
      const aliases = binding?.aliases ?? [];
      const declaration = input.nodeOf({ kind: "item", value: reference.declaration });
      const checkedStorage = declaration?.kind === "VariableDeclaration" ? checkedVariableStorageOf(declaration) : null;
      let storage: TyId | null = null;
      if (node.kind === "Identifier" && node.tsonic.role === "value") storage = node.tsonic.type;
      else if (node.kind === "Identifier" && node.tsonic.role === "assignment-target" && original?.kind === "declarations"
        && checked !== null && checked !== undefined && "role" in checked && checked.role === "assignment-target" && checkedStorage !== null) {
        const access = node.tsonic.access;
        if (checked.access === "write" && access.kind === "write" && writableRootStorageOf(checked.place, original) === checkedStorage
          || checked.access === "read-write" && access.kind === "read-write" && access.read === access.storage
            && access.narrowing === null && access.evidenceIndex === null && readWriteRootStorageOf(checked.place, original) === checkedStorage)
          storage = access.storage;
      }
      const ownsStorage = storage !== null && selected?.kind === "declarations"
        && selected.definitions.length === 1 && selected.definitions[0] === reference.declaration.owner
        && declaration?.kind === "VariableDeclaration" && "declaration" in declaration.tsonic && declaration.id === reference.declaration.node
        && declaration.tsonic.declaration.kind === "definition" && declaration.tsonic.declaration.definition === reference.declaration.owner;
      if (ownsStorage) {
        const paid = admit({ kind: "static-item", declaration: reference.declaration });
        if (paid !== null) return { kind: "resource-stop", stop: paid };
      }
      if (!ownsStorage
        || input.staticStorageOf(reference.declaration) !== storage
        || reference.aliases.length !== aliases.length || reference.aliases.some((alias, index) => {
          const actual = aliases[index];
          return actual === undefined || !sameSourceReference(alias, actual);
        }))
        emit("static-reference-exact", node, "a static access must retain its actual checked declaration, binding hops and storage type");
    }
    const enumReference = phase !== null && "resolution" in phase && phase.resolution.kind === "enum-member" ? phase.resolution : null;
    const checkedRead = original?.kind === "Identifier" && original.tsonic.role === "value" ? original.tsonic.value.views.read : null;
    const checkedMember = original?.kind === "PropertyAccessExpression" && original.tsonic.role === "enum-member" ? original.tsonic : null;
    if (enumReference !== null || checkedMember !== null || checkedRead?.kind === "available" && input.types.terms[checkedRead.value]?.kind === "enum") {
      const qualified = checkedMember !== null && original?.kind === "PropertyAccessExpression" ? original.expression : null;
      const checkedQualifier = qualified?.kind === "Identifier" && qualified.tsonic.role === "enum-qualifier" ? qualified.tsonic : null;
      const originalResolution = checkedQualifier !== null ? checkedQualifier.resolution
        : checkedMember === null && checked !== undefined && checked !== null && "resolution" in checked ? checked.resolution : null;
      const binding = originalResolution?.kind === "binding" ? resolveModuleBinding(input, originalResolution.occurrence) : null;
      const selected = binding === null ? originalResolution : binding.target.kind === "available" ? binding.target.value : null;
      const aliases = binding?.aliases ?? [];
      const definition = checkedMember !== null ? checkedMember.selectedMember.owner
        : selected?.kind === "declarations" && selected.definitions.length === 1 ? selected.definitions[0] : undefined;
      let owned: ItemNodeRef | null = null;
      if (definition !== undefined) {
        const paid = admit({ kind: "source-declaration", definition });
        if (paid !== null) return { kind: "resource-stop", stop: paid };
        const declaration = input.declarationSourceOf(definition);
        if (declaration?.kind === "item" && declaration.value.owner === definition) owned = declaration.value;
      }
      const paid = owned === null ? null : admit({ kind: "static-item", declaration: owned });
      if (paid !== null) return { kind: "resource-stop", stop: paid };
      const member = owned === null ? null : input.nodeOf({ kind: "item", value: owned });
      if (enumReference !== null || checkedMember !== null || member?.kind === "EnumMember") {
        let earned = false;
        let valueType = node.kind === "Identifier" && node.tsonic.role === "value" && checkedMember === null ? node.tsonic.type : null;
        if (node.kind === "PropertyAccessExpression" && node.tsonic.role === "enum-member" && checkedMember !== null
          && checkedQualifier !== null && owned !== null && checkedMember.selectedMember.node === owned.node && node.questionDotToken === null
          && node.expression.kind === "Identifier" && node.expression.tsonic.role === "enum-qualifier"
          && node.expression.tsonic.nominal === checkedQualifier.nominal && member?.kind === "EnumMember"
          && member.tsonic.parent !== null && selected?.kind === "declarations") {
          let findsNominal = false;
          for (let position = 0; position < selected.definitions.length; position += 1) {
            const cut = admit({ kind: "row" });
            if (cut !== null) return { kind: "resource-stop", stop: cut };
            if (selected.definitions[position] === checkedQualifier.nominal) { findsNominal = true; break; }
          }
          if (findsNominal) {
            const parent = member.tsonic.parent;
            const parentRead = admit({ kind: "source-declaration", definition: parent });
            if (parentRead !== null) return { kind: "resource-stop", stop: parentRead };
            const source = input.declarationSourceOf(parent);
            if (source?.kind === "item" && source.value.owner === parent) {
              const parentNodeRead = admit({ kind: "static-item", declaration: source.value });
              if (parentNodeRead !== null) return { kind: "resource-stop", stop: parentNodeRead };
              const parentNode = input.nodeOf(source);
              if (parentNode?.kind === "EnumDeclaration" && parentNode.tsonic.nominal === checkedQualifier.nominal)
                valueType = node.tsonic.type;
            }
          }
        }
        if (enumReference !== null && valueType !== null && owned !== null
          && enumReference.declaration.owner === owned.owner && enumReference.declaration.node === owned.node
          && member?.kind === "EnumMember" && member.id === owned.node && member.tsonic.declaration.kind === "definition"
          && member.tsonic.declaration.definition === owned.owner
          && enumReference.bindings.kind === "instantiated" && enumReference.aliases.length === aliases.length
          && enumReference.aliases.every((alias, index) => {
            const actual = aliases[index];
            return actual !== undefined && sameSourceReference(alias, actual);
          })) {
          const { bindings } = enumReference.bindings;
          const valueSource = member.tsonic.valueSource;
          const template: BodyInstance | null = valueSource === null ? null : { body: valueSource.body, bindings: { kind: "parametric" } };
          const stop = admit({ kind: "bindings", bindings }) ?? (template === null ? null : admit({ kind: "artifact", instance: template }));
          if (stop !== null) return { kind: "resource-stop", stop };
          const scope = input.declarationOf(owned.owner)?.scope;
          earned = bindings.classBindings.length === 0 && bindings.methodBindings.length === 0
            && bindings.capturedBindings.length === 0 && bindings.selfBindings.length === 0
            && scope !== undefined && scope.classParameters.length === 0 && scope.methodParameters.length === 0
            && scope.capturedParameters.length === 0 && scope.selfOwners.length === 0;
          if (earned) {
            if (template === null || valueSource === null) {
              const type = input.types.terms[valueType];
              earned = type?.kind === "primitive" && type.primitive === "int64";
            } else {
              const ready = input.bodyOf(template);
              earned = ready !== null && ready.body === template.body && ready.bindings.kind === "parametric"
                && ready.owner === valueSource.definition && ready.completion === valueType;
            }
          }
        }
        if (!earned) emit("enum-reference-exact", node, "an enum read must retain its actual checked member, binding hops and completed value type");
      }
    }
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
      const signature = input.types.signatures[application.decision.callee.decision.completion.signature];
      if (signature !== undefined) {
        const call = application.decision;
        const original = originalApplication(inventory.sourceNodes.get(node.id));
        const stop = verifyArgumentTransport(call, node, signature, original, inventory.sourceNodes, input.types, admit, emit);
        if (stop !== null) return { kind: "resource-stop", stop };
        for (const mapping of call.callee.decision.parameters) {
          if (mapping.kind !== "reference-argument") continue;
          const paid = admit({ kind: "row" });
          if (paid !== null) return { kind: "resource-stop", stop: paid };
          const source = original?.arguments[mapping.argument];
          const passed = call.arguments[mapping.parameter];
          const formal = signature.parameters[mapping.parameter];
          const argument = node.kind === "CallExpression" && !("kind" in node.arguments) ? node.arguments.nodes[mapping.argument] : undefined;
          const value = argument === undefined ? null : typedValueOf(argument);
          const distinct = formal !== undefined && source?.kind === "value" && passed?.kind === "provided"
            && passed.expression === source.expression && argument?.id === source.expression && value !== null && value.conversion.kind === "identity"
            && mapping.passing === "by-value" && mapping.component === null;
          const actual = distinct ? fields.referenceArgument({ argument: { body: body.body, node: source.expression },
            caller: value.convertedType, endpoint: call.callee.decision.api, ordinal: mapping.parameter, formal }) : null;
          const stopped = fields.stop();
          if (stopped !== null) return { kind: "resource-stop", stop: stopped };
          const exact = actual === null ? false : sameReferenceView(actual, mapping.view, admit);
          if (typeof exact !== "boolean") return { kind: "resource-stop", stop: exact };
          if (!exact) emit("argument-passing", node, "a reference argument must retain its actual checked caller and formal field correspondence");
        }
      }
    }
  }
  let previousEvidence = -1;
  const nodeOrder = new Map<NodeId, number>();
  for (const [position, { syntax, role }] of structure.records.entries()) {
    const node = syntax ?? role?.node;
    if (node !== undefined) nodeOrder.set(node.id, position);
  }
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
    const decision = application.kind === "callee" ? application.value.decision : application.value;
    const original = originalApplication(inventory.sourceNodes.get(application.node.id));
    let actualCandidates: readonly HirCandidate[] | null = null;
    if (original?.candidates.kind === "available") {
      const actual = candidates.get(original.candidates.value);
      if (actual === undefined) emit("call-endpoints", application.node, "selected application names a missing actual candidate inventory");
      else actualCandidates = actual;
    }
    let activated: TirBody | null | undefined;
    if (application.kind === "callee" && application.value.activation !== null) {
      const activation = application.value.activation;
      activated = null;
      const admissible = verifyActivation(application.value, application.node, emit, admit);
      if (admissible.kind === "resource-stop") return admissible;
      if (admissible.valid) {
        const lookup = admit({ kind: "artifact", instance: activation });
        if (lookup !== null) return { kind: "resource-stop", stop: lookup };
        const published = input.bodyOf(activation);
        if (published !== null && published.owner === decision.api.declaration) {
          const original = admit({ kind: "artifact", instance: activation });
          if (original !== null) return { kind: "resource-stop", stop: original };
          const row = admit({ kind: "row" });
          if (row !== null) return { kind: "resource-stop", stop: row };
          const actual = { body: published.body, bindings: published.bindings };
          const comparison = admit({ kind: "artifact", instance: actual });
          if (comparison !== null) return { kind: "resource-stop", stop: comparison };
          if (sameInstance(activation, actual)) activated = published;
        }
        verifyPublishedInstance(activated, application.node, emit);
      }
    }
    verifyCallEndpoints(decision, application.node, input.types,
      { advertised: declarationOf(decision.advertised.declaration), api: declarationOf(decision.api.declaration),
        candidates: actualCandidates, activated }, emit);
  }
  for (const instance of semantics.initializers) {
    const paid = admit({ kind: "artifact", instance: instance.value });
    if (paid !== null) return { kind: "resource-stop", stop: paid };
    verifyPublishedInstance(input.bodyOf(instance.value), instance.node, emit);
  }
  for (const deferred of semantics.deferred) {
    const stop = verifyDeferredParameters(deferred.value, deferred.node, body, input.types, emit, admit);
    if (stop !== null) return { kind: "resource-stop", stop };
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
    const paid = admit({ kind: "member", instance, occurrence: member.occurrence });
    if (paid !== null) return { kind: "resource-stop", stop: paid };
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
    const original = inventory.sourceNodes.get(member.node.id);
    const binding = member.node.kind === "BindingElement" ? member.node.tsonic : null;
    if (member.node.kind === "BindingElement" && binding?.role === "field-binding") {
      const element = member.node;
      const { primary, key, location } = binding.field.decision;
      let stopped: Stop | null = null;
      const read = (reference: SourceNodeRef) => input.nodeOf(reference);
      const holding = member.occurrence.kind === "selection" && original?.kind === "BindingElement"
        && inventory.original !== undefined && primary !== null
        ? checkedSourceBindingFieldOf(inventory.original, original, key, primary, {
          bodyOf: id => boundary.bodies.get(id) ?? null, nodeOf: read,
          itemOf: definition => {
            stopped ??= admit({ kind: "source-declaration", definition });
            if (stopped !== null) return null;
            const reference = input.declarationSourceOf(definition);
            return reference?.kind === "item" && reference.value.owner === definition ? read(reference) : null;
          }, typeOf: type => input.types.terms[type], admit: (work, records) => {
            stopped ??= admit({ kind: "source-field-proof", work, records });
            return stopped === null;
          },
        }) : null;
      if (stopped !== null) return { kind: "resource-stop", stop: stopped };
      if (holding === null || holding.receiver !== table?.receiver || primary !== holding.field
        || location.kind !== "data" || location.receiver !== "by-reference" || location.check.kind !== "none"
        || binding.field.getter !== null || binding.field.setter !== null)
        emit("access-location", element, "a binding field must retain its actual checked reference and selected data field");
      if (binding.initializer !== null) {
        const target = binding.declaration;
        const local = target.kind === "local" ? body.locals[target.local.local]?.declaration : null;
        const owner = target.kind === "definition" ? target.definition : local?.kind === "item" && local.value.node === element.id ? local.value.owner : null;
        if (owner === null || binding.initializer !== encodeBodyId({ owner, role: "initializer", ordinal: 0 })) {
          emit("nested-template-identity", element, "a binding initializer needs its actual named declaration");
        } else {
          const selected = { body: binding.initializer, bindings: body.bindings };
          const use = admit({ kind: "artifact", instance: selected });
          if (use !== null) return { kind: "resource-stop", stop: use };
          const placed = input.bodyOf(selected);
          const actual = placed === null ? null : { body: placed.body, bindings: placed.bindings };
          if (actual !== null) {
            const found = admit({ kind: "artifact", instance: actual });
            if (found !== null) return { kind: "resource-stop", stop: found };
          }
          if (placed === null || actual === null || !sameInstance(selected, actual) || placed.owner !== owner
            || placed.root !== element.initializer || placed.completion !== binding.storage)
            emit("nested-template-identity", element, "the binding retains its independently placed initializer and actual root");
        }
      }
    }
    if (member.occurrence.kind === "selection" && original?.kind === "PropertyAccessExpression" && inventory.original !== undefined) {
      if (original.tsonic.role === "assignment-target" && original.tsonic.place.kind === "available"
        && original.tsonic.place.value.base.kind === "receiver") {
        const storage = checkedMemberStorageOf(original);
        const selected = member.node.kind === "PropertyAccessExpression" && member.node.tsonic.role === "assignment-target"
          ? member.node.tsonic.access : null;
        if (storage === null || selected === null || selected.kind !== original.tsonic.access
          || selected.storage !== storage.write || member.decision.write !== storage.write
          || (selected.kind === "read-write" && (selected.read !== storage.read || member.decision.read !== storage.read)))
          emit("access-location", member.node, "reference-held field assignment must retain its actual checked write and reached read types");
      }
      const holding = fields.field(original);
      const stopped = fields.stop();
      if (stopped !== null) return { kind: "resource-stop", stop: stopped };
      const { location, primary } = member.decision;
      if (holding !== null) {
        if (table?.receiver !== holding.receiver || primary !== holding.field || location.kind !== "data"
          || location.receiver !== "by-reference" || location.check.kind !== "none")
          emit("access-location", member.node, "ordinary object parameter access must retain its actual reference-held field");
        if (holding.presence !== null && original.tsonic.role === "value") {
          const read = original.tsonic.value.views.read;
          if (read.kind === "available" && read.value === holding.presence.present) {
            const narrowing = typedValueOf(member.node)?.narrowing;
            if (narrowing?.kind !== "narrowed" || narrowing.source !== holding.presence.storage || narrowing.result !== holding.presence.present
              || narrowing.failure !== input.selectedNativeFacts.absentAccessFailure)
              emit("refinement-destination", member.node, "an optional reference payload requires its actual selected presence check");
          }
        }
      } else if (location.kind === "data" && location.receiver === "by-reference") {
        let path = fields.missing();
        if (!path && table !== null && input.types.terms[table.receiver]?.kind === "shape") {
          let receiver = original.expression;
          while (receiver.kind === "ParenthesizedExpression") {
            const read = admit({ kind: "row" });
            if (read !== null) return { kind: "resource-stop", stop: read };
            receiver = receiver.expression;
          }
          path = receiver.kind === "PropertyAccessExpression";
        }
        if (path) emit("access-location", member.node, "reference-held access requires its independently qualified source declarations");
      }
    }
    if (member.selection === null) verifyMemberDecision(member.decision, member.node, members, emit);
    else verifyMemberSelection(member.selection, member.node, members, emit);
  }
  return { kind: "complete", violations };
}

export const verifyTypedBody: VerifyTir = (input, admit) => {
  const membership = publicationMembership(input, admit);
  return body => verifyBody(input, body, admit, membership);
};

export const verifyTypedModule: VerifyTirModule = (input, module, admit) => {
  const previous = admit({ kind: "prior" });
  if (previous !== null) return { kind: "resource-stop", stop: previous };
  const violations: Violation<TirRule, TirNodeSite>[] = [];
  const emitted = new Set<string>();
  const appendViolation: TirOccurrenceEmit = (rule, node, message) => {
    const subject = node === null ? module.tree.root : node;
    violations.push({ rule, site: { kind: "node", module: subject.origin.module, node: subject.id },
      detail: [{ kind: "text", value: message }] });
  };
  const emit: TirOccurrenceEmit = (rule, node, message) => {
    const key = encodeKey([rule, node === null ? module.tree.root.id : node.id, message]);
    if (!emitted.has(key)) { emitted.add(key); appendViolation(rule, node, message); }
  };
  if (module.module !== input.module.module || module.module !== input.source.module || module.tree !== input.module.tree) {
    emit("module-node-identity", module.tree.root, "module tree does not retain its actual source and publication identity");
  }
  const required = verifyChapterRoles(input, module, admit, emit);
  if (required !== null) return { kind: "resource-stop", stop: required };
  if (module.bodies.length !== input.module.bodies.length) {
    emit("template-shared-once", null, "chapter does not retain the complete independently required body inventory");
  }
  const membership = publicationMembership(input, admit);
  const setup = admit({ kind: "retain-publication-entry" });
  if (setup !== null) return { kind: "resource-stop", stop: setup };
  const found = new Set<TirBody>();
  const stops = new Set<NodeId>();
  for (let position = 0; position < module.bodies.length; position += 1) {
    const row = admit({ kind: "row" });
    if (row !== null) return { kind: "resource-stop", stop: row };
    const body = module.bodies[position];
    if (body === undefined) throw new TypeError(`ir-tir: sparse vector at $module["bodies"][${position}]`);
    const member = membership(body, emit);
    if (member !== null) return { kind: "resource-stop", stop: member };
    const geometry = verifyLayoutBody(input, body, admit, emit);
    if (geometry !== null) return { kind: "resource-stop", stop: geometry };
    if (found.has(body)) emit("template-shared-once", null, "chapter repeats an independently required body");
    else {
      const retain = admit({ kind: "retain-publication-entry" });
      if (retain !== null) return { kind: "resource-stop", stop: retain };
      found.add(body);
    }
    stops.add(body.root.id);
  }
  const structure = inspectTirStructure(module, createTirLayouts(), stops);
  for (const node of structure.excluded)
    emit("kind-children-shape", node, "An excluded source expression cannot occupy a Typed syntax slot.");
  const moduleNodes = chapterNodes(module, emit);
  verifyCanonicalTemplates(input, module, moduleNodes, emit);
  const sourceNodes = new Map<NodeId, HirNode>();
  for (const node of indexSyntaxTree<CheckedPhase>(input.source.tree)) sourceNodes.set(node.id, node);
  verifyClosedReferences(module.tree.root, structure, input.types, input.diagnostics, emit);
  verifyQualifiedReferences(input, null, structure, emit);
  const declarationOf = declarationInventory(input);
  verifyScalarReferences(structure, sourceNodes, declarationOf, emit);
  for (const node of structure.nodes) {
    const original = sourceNodes.get(node.id);
    if (node.kind === "VariableDeclaration") {
      const stop = verifyPatternBinding(node, original, input.types, admit, emit);
      if (stop !== null) return { kind: "resource-stop", stop };
    }
    verifyOccurrenceRole(node, original, emit);
  }
  verifyBodylessParameters(input, structure.nodes, sourceNodes, emit);
  verifyDeclarationNames(structure.nodes, sourceNodes, emit);
  const types = verifyTypePayload(input, { kind: "module", module: module.module }, module, structure, declarationOf, emit, appendViolation, admit);
  return types === null ? { kind: "complete", violations } : { kind: "resource-stop", stop: types };
};
