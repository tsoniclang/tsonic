import type { BodyId, DefId, LocalRef, NodeId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { ArrayLiteralExpression, BindingPattern, CheckedPhase, HirNode, SwitchStatement, VariableDeclaration } from "../ir-hir/contract.js";
import { checkedContextualTupleAssertionOf, checkedLayoutRoleOf, compoundAssignmentOperatorOf, prefixOperatorOf, shortCircuitOperatorOf, unparenthesizedExpression } from "../ir-hir/index.js";
import type { Origin } from "../ids/contract.js";
import type { ApplicationDecision, DeferredDecision, InferenceNativeFacts, MemberDecision, OperationDecision, RuleOutcome } from "../ir-infer/contract.js";
import type { BindingScope, BodyInstance, TypeComponent, TypeEvidence, TypeTable, TypeTerm } from "../ir-types/contract.js";
import { isNativeBinaryFloatPrimitive, isNativeIntegerPrimitive, nativeAbsenceComparisonOf, nativeArrayExtentOf, nativeCarrierHoldingOf, nativeCarrierOf, optionalValueDomainOf, readLexicalTypeSupport } from "../ir-types/index.js";
import type { MemberSelection, ResolvedCallee, TirApplication, TirBody, TirMemberOccurrence, TirModule, TirNode, TirProtocol, TirReadyReadAdmission, TirRule, TirTypedSyntax, TypedBodyTemplate, TypedOperation, TypedPhase, TypedValue } from "./contract.js";
import type { TirLayouts, TirReference, TirRecordAssociation, TirRecordLayout, TirScalarValue, TirTypedWork, TirValuePath } from "./text-layouts.js";
import { enterTirInline, roleSyntaxReference, tirPathText } from "./text-layouts.js";
import { requirePresent } from "../diag/index.js";

export interface TirOccurrenceSite { readonly id: NodeId; readonly origin: Origin }
export type TirOccurrenceEmit = (rule: TirRule, node: TirOccurrenceSite | null, detail: string) => void;

export const sameSourceReference = (left: SourceNodeRef, right: SourceNodeRef): boolean => {
  if (left.kind === "body") return right.kind === "body" && left.value.body === right.value.body && Object.is(left.value.node, right.value.node);
  return right.kind === "item" && left.value.owner === right.value.owner && Object.is(left.value.node, right.value.node);
};

export const sameLocalReference = (left: LocalRef | null, right: LocalRef | null): boolean =>
  left === null ? right === null : right !== null && left.body === right.body && Object.is(left.local, right.local);

export interface TirRecordVisit {
  readonly type: string;
  readonly layout: TirRecordLayout;
  readonly value: object;
  readonly association: TirRecordAssociation | null;
  readonly bindingOwner: DefId | null;
  readonly node: TirOccurrenceSite | null;
  readonly syntax: TirNode | null;
  readonly role: TirChapterHeader | null;
  readonly phase: boolean;
  readonly path: TirValuePath | null;
}

export interface TirScalarVisit {
  readonly type: string;
  readonly ownerType: string | null;
  readonly value: TirScalarValue;
  readonly reference: TirReference | null;
  readonly node: TirOccurrenceSite | null;
  readonly path: TirValuePath | null;
}

export interface TirStructure {
  readonly records: readonly TirRecordVisit[];
  readonly scalars: readonly TirScalarVisit[];
  readonly nodes: readonly TirNode[];
  readonly excluded: readonly TirOccurrenceSite[];
  readonly selectedMembers: readonly TirSelectedMemberVisit[];
}

export interface TirSelectedMemberVisit {
  readonly decision: MemberDecision;
  readonly selection: MemberSelection | null;
  readonly occurrence: TirMemberOccurrence;
  readonly node: TirNode;
}

interface TirMemberCursor {
  readonly node: TirNode;
  ordinal: number;
}

type TirChapterHeader = Extract<TirTypedSyntax, { readonly kind: "module-root" | "ready-callable" }>;

type TirVisitWork =
  | { readonly kind: "exit"; readonly value: object }
  | { readonly kind: "syntax-exit"; readonly value: object }
  | { readonly kind: "value"; readonly value: TirTypedWork; readonly node: TirOccurrenceSite | null;
      readonly phase: boolean; readonly path: TirValuePath | null; readonly ownerType: string | null;
      readonly bindingOwner: DefId | null;
      readonly role: Exclude<TirTypedSyntax, { readonly kind: "ordinary" }> | null;
      readonly members: TirMemberCursor | null };

export const inspectTirStructure = (
  subject: TirBody | TirModule, layouts: TirLayouts, stopBefore: ReadonlySet<NodeId>,
): TirStructure => {
  const body = "root" in subject;
  const root = body ? subject.root : subject.tree.root;
  const rootPath = body ? "$body" : "$module";
  const records: TirRecordVisit[] = [];
  const scalars: TirScalarVisit[] = [];
  const nodes: TirNode[] = [];
  const excluded: TirOccurrenceSite[] = [];
  const selectedMembers: TirSelectedMemberVisit[] = [];
  const input = body ? layouts.bodyWork(subject) : subject.tree.kind === "checked-root" || stopBefore.has(root.id) ? null
    : roleSyntaxReference("$TirModuleRoot", { kind: "module-root", node: subject.tree.root });
  const pending: TirVisitWork[] = input === null ? [] : [{ kind: "value",
    value: input, node: null, phase: false, path: null, ownerType: null, bindingOwner: null, role: null, members: null }];
  const inline = new Set<object>();
  const syntaxActive = new Set<object>();
  const syntaxCompleted = new Set<object>();
  const nextMemberOrdinal = (cursor: TirMemberCursor): number => cursor.ordinal++;
  for (let work = pending.pop(); work !== undefined; work = pending.pop()) {
    if (work.kind === "exit") { inline.delete(work.value); continue; }
    if (work.kind === "syntax-exit") {
      syntaxActive.delete(work.value);
      syntaxCompleted.add(work.value);
      continue;
    }
    const value = work.value;
    switch (value.kind) {
      case "scalar":
        scalars.push({ type: value.type, value: value.value, reference: value.reference, node: work.node, path: work.path, ownerType: work.ownerType });
        break;
      case "node": {
        const node = value.value;
        if ((node !== root || !body) && stopBefore.has(node.id)) continue;
        if (node.kind === "ExcludedExpression") {
          excluded.push(node);
          continue;
        }
        if (syntaxActive.has(node)) throw new TypeError(`ir-tir: syntax cycle at ${tirPathText(work.path, rootPath)}`);
        if (syntaxCompleted.has(node)) continue;
        pending.push({ ...work, value: layouts.nodeWork(node), node });
        break;
      }
      case "checked-node": break;
      case "role-node": {
        const node = value.value.node;
        if ((node !== root || !body) && stopBefore.has(node.id)) continue;
        if (syntaxActive.has(node)) throw new TypeError(`ir-tir: syntax cycle at ${tirPathText(work.path, rootPath)}`);
        if (syntaxCompleted.has(node)) continue;
        const formal = value.value.kind === "formal" ? value.value.node : null;
        if (formal !== null) nodes.push(formal);
        syntaxActive.add(node);
        pending.push({ kind: "syntax-exit", value: node });
        pending.push({ ...work, value: layouts.roleWork(value.value), node, role: value.value, members: null });
        break;
      }
      case "sequence":
        enterTirInline(inline, value.value, work.path, rootPath);
        pending.push({ kind: "exit", value: value.value });
        for (let position = value.length - 1; position >= 0; position--) {
          const path: TirValuePath = { parent: work.path, field: position };
          const child = value.element(position);
          if (child === null) throw new TypeError(`ir-tir: sparse vector at ${tirPathText(path, rootPath)}`);
          pending.push({ ...work, value: child, path });
        }
        break;
      case "record": {
        const node = value.syntax === null ? work.node : value.syntax;
        const bindingOwner = value.bindingOwner === undefined ? work.bindingOwner : value.bindingOwner;
        const members = value.syntax === null ? work.members : { node: value.syntax, ordinal: 0 };
        if (value.syntax === null) {
          enterTirInline(inline, value.value, work.path, rootPath);
          pending.push({ kind: "exit", value: value.value });
        } else {
          syntaxActive.add(value.syntax);
          nodes.push(value.syntax);
          pending.push({ kind: "syntax-exit", value: value.syntax });
        }
        records.push({ type: value.type, layout: value.layout, value: value.value, association: value.association, bindingOwner,
          node, syntax: work.role?.kind === "formal" ? work.role.node : value.syntax,
          role: work.role?.kind === "formal" ? null : work.role, phase: work.phase, path: work.path });
        const association = value.association;
        if (association?.kind === "member-selection") {
          const actual = requirePresent(members ?? undefined, { owner: "ir-tir", query: null, origin: null,
            message: "A Typed member selection requires its actual ordinary syntax occurrence." });
          selectedMembers.push({ decision: association.value.decision, selection: association.value, node: actual.node,
            occurrence: { kind: "selection", node: actual.node.id, ordinal: nextMemberOrdinal(actual) } });
        } else if (association?.kind === "construction-part") {
          const part = association.value;
          const decision = part.member;
          if (decision !== null) {
            const actual = requirePresent(members ?? undefined, { owner: "ir-tir", query: null, origin: null,
              message: "A Typed construction member requires its actual ordinary syntax occurrence." });
            selectedMembers.push({ decision, selection: null, node: actual.node,
              occurrence: { kind: "construction-part", node: actual.node.id, ordinal: nextMemberOrdinal(actual),
                source: part.source, destination: part.destination, part: part.part } });
          }
        }
        if (value.label === "layout-quote") break;
        const fields = value.fields();
        for (let position = fields.length - 1, field = fields[position]; field !== undefined; field = fields[--position]) {
          pending.push({ kind: "value", value: field.work, node, phase: work.phase || field.name === "tsonic",
            path: { parent: work.path, field: field.name }, ownerType: value.layout.label, bindingOwner, role: null, members });
        }
        break;
      }
    }
  }
  return { records, scalars, nodes, excluded, selectedMembers };
};

export const typedValueOf = (node: TirNode): TypedValue | null =>
  node.tsonic !== null && "convertedType" in node.tsonic ? node.tsonic : null;

export const applicationOf = (node: TirNode): RuleOutcome<TirApplication> | null => {
  if (node.kind === "CallExpression") return "application" in node.tsonic ? node.tsonic.application : null;
  if (node.kind === "NewExpression" || node.kind === "TaggedTemplateExpression" || node.kind === "Decorator") return node.tsonic.application;
  return null;
};

export const deferredEvidence = (deferred: DeferredDecision): readonly TypeEvidence[] => {
  const invocation = deferred.invocation;
  switch (invocation.rule) {
    case "embed": return [invocation.input.from, invocation.input.to];
    case "domain-fit": return [invocation.input.value, invocation.input.domain];
    case "memory-equivalent": return [invocation.input.left, invocation.input.right];
    case "member": return [invocation.input.receiver];
    case "index": return [invocation.input.receiver, invocation.input.key];
    case "construct-literal": return [...invocation.input.parts.map(part => part.value),
      ...(invocation.input.destination === null ? [] : [invocation.input.destination]), invocation.input.result];
    case "candidate": return [invocation.input.callee, ...(invocation.input.receiver === null ? [] : [invocation.input.receiver]),
      ...invocation.input.typeArguments, ...invocation.input.arguments.flatMap(argument => [argument.value, ...(argument.tuple ?? [])])];
    case "operator": return invocation.input.operands;
    case "literal-fit": return [invocation.input.destination];
    case "protocol": return [...(invocation.input.subject === null ? [] : [invocation.input.subject]), ...invocation.input.operands,
      ...(invocation.input.completion === null ? [] : [invocation.input.completion]), ...(invocation.input.yielded === null ? [] : [invocation.input.yielded]),
      ...(invocation.input.sent === null ? [] : [invocation.input.sent]), invocation.input.thrown];
    case "refinement": return [invocation.input.source, invocation.input.checked];
    case "library": return [...(invocation.input.receiver === null ? [] : [invocation.input.receiver]), ...invocation.input.arguments, invocation.input.result];
    case "core": return [...invocation.input.operands, invocation.input.result];
    case "closure": return [invocation.input.callable, ...invocation.input.captures.map(capture => capture.value)];
  }
};

type TirApplicationUse =
  | { readonly kind: "application"; readonly value: ApplicationDecision; readonly node: TirNode }
  | { readonly kind: "callee"; readonly value: ResolvedCallee; readonly node: TirNode };

type TirSemanticWork = TirApplicationUse
  | { readonly kind: "member"; readonly value: MemberSelection; readonly node: TirNode }
  | { readonly kind: "operation"; readonly value: TypedOperation; readonly node: TirNode }
  | { readonly kind: "protocol"; readonly value: TirProtocol; readonly node: TirNode; readonly ordinal: number | null }
  | { readonly kind: "deferred"; readonly value: DeferredDecision; readonly node: TirNode };

export interface TirSemanticInventory {
  readonly applications: readonly TirApplicationUse[];
  readonly operations: readonly { readonly value: TypedOperation; readonly node: TirNode }[];
  readonly protocols: readonly { readonly value: TirProtocol; readonly node: TirNode; readonly ordinal: number | null }[];
  readonly deferred: readonly { readonly value: DeferredDecision; readonly node: TirNode }[];
  readonly initializers: readonly { readonly value: BodyInstance; readonly node: TirNode | null }[];
  readonly templates: readonly { readonly value: TypedBodyTemplate; readonly node: TirOccurrenceSite }[];
}

export const collectTirSemantics = (structure: TirStructure): TirSemanticInventory => {
  const applications: TirApplicationUse[] = [];
  const operations: { value: TypedOperation; node: TirNode }[] = [];
  const protocols: { value: TirProtocol; node: TirNode; ordinal: number | null }[] = [];
  const deferred: { value: DeferredDecision; node: TirNode }[] = [];
  const initializers: { value: BodyInstance; node: TirNode | null }[] = [];
  const templates: { value: TypedBodyTemplate; node: TirOccurrenceSite }[] = [];
  const pending: TirSemanticWork[] = [];
  const initializer = (value: BodyInstance, node: TirNode | null): void => {
    initializers.push({ value, node });
  };
  const operation = (value: RuleOutcome<TypedOperation> | null, node: TirNode): void => {
    if (value !== null) pending.push(value.kind === "decided" ? { kind: "operation", value: value.decision, node }
      : { kind: "deferred", value: value.deferred, node });
  };
  const member = (value: RuleOutcome<MemberSelection>, node: TirNode): void => {
    pending.push(value.kind === "decided" ? { kind: "member", value: value.decision, node }
      : { kind: "deferred", value: value.deferred, node });
  };
  const protocol = (value: RuleOutcome<TirProtocol>, node: TirNode, ordinal: number | null): void => {
    pending.push(value.kind === "decided" ? { kind: "protocol", value: value.decision, node, ordinal }
      : { kind: "deferred", value: value.deferred, node });
  };
  const template = (value: TypedBodyTemplate | null, node: TirOccurrenceSite): void => {
    if (value !== null) templates.push({ value, node });
  };
  for (const { syntax: node, role } of structure.records) {
    if (role !== null) {
      template(role.node.tsonic.template, role.node);
      continue;
    }
    if (node === null) continue;
    const phase = node.tsonic;
    if (phase === null) continue;
    const value = typedValueOf(node);
    if (value?.conversion.kind === "convert" || value?.conversion.kind === "backed-convert")
      pending.push({ kind: "operation", value: value.conversion.operation, node });
    if (value?.conversion.kind === "deferred") pending.push({ kind: "deferred", value: value.conversion.deferred, node });
    if ("operation" in phase) operation(phase.operation, node);
    if ("construction" in phase) operation(phase.construction, node);
    if ("selection" in phase && phase.selection !== null && (phase.selection.kind === "decided" || phase.selection.kind === "deferred")) member(phase.selection, node);
    if ("member" in phase) member(phase.member, node);
    if ("protocol" in phase) protocol(phase.protocol, node, null);
    if ("protocols" in phase) for (const [ordinal, selected] of phase.protocols.entries()) protocol(selected, node, ordinal);
    if ("template" in phase) template(phase.template, node);
    if ("callable" in phase) template(phase.callable.template, node);
    if ("closure" in phase && phase.closure.kind === "deferred") pending.push({ kind: "deferred", value: phase.closure.deferred, node });
    if (node.kind === "BinaryExpression" && node.tsonic.role === "assignment") operation(node.tsonic.calculation, node);
    const application = applicationOf(node);
    if (application !== null) {
      if (application.kind === "deferred") pending.push({ kind: "deferred", value: application.deferred, node });
      else {
        pending.push({ kind: "callee", value: application.decision.callee, node });
        for (const argument of application.decision.arguments) if (argument.kind === "omitted" && argument.value.kind === "initializer") {
          initializer(argument.value.instance, node);
        }
      }
    } else if (node.kind === "ExpressionWithTypeArguments" && node.tsonic.role === "value" && node.tsonic.application !== null) {
      const application = node.tsonic.application;
      pending.push(application.kind === "decided" ? { kind: "application", value: application.decision, node }
        : { kind: "deferred", value: application.deferred, node });
    }
  }
  for (let work = pending.pop(); work !== undefined; work = pending.pop()) {
    const node = work.node;
    switch (work.kind) {
      case "application": case "callee":
        applications.push(work);
        break;
      case "member":
        if (work.value.getter !== null) pending.push({ kind: "callee", value: work.value.getter, node });
        if (work.value.setter !== null) pending.push({ kind: "callee", value: work.value.setter, node });
        break;
      case "operation": {
        operations.push(work);
        const identity = work.value.decision.operation;
        if (identity.kind === "protocol") for (const step of identity.steps) {
          if (step.operation.kind === "call") pending.push({ kind: "application", value: step.operation.application, node });
        }
        break;
      }
      case "protocol":
        protocols.push(work);
        for (const step of work.value.steps) {
          pending.push({ kind: "operation", value: step.operation, node });
          if (step.callee !== null) pending.push({ kind: "callee", value: step.callee, node });
        }
        break;
      case "deferred":
        deferred.push(work);
        break;
    }
  }
  return { applications, operations, protocols, deferred, initializers, templates };
};

export const verifyValueEndpoints = (body: TirBody, node: TirNode, emit: TirOccurrenceEmit): void => {
  const value = typedValueOf(node);
  if (value === null) return;
  const conversion = value.conversion;
  if (conversion.kind === "identity") {
    if (value.type !== value.convertedType) emit("conversion-destination", node, "conversion does not retain its destination endpoint");
  } else if (conversion.kind === "convert" || conversion.kind === "backed-convert") {
    const decision: OperationDecision = conversion.operation.decision;
    const operation = decision.operation;
    if (conversion.kind === "convert" ? operation.kind !== "conversion" : operation.kind !== "library" && operation.kind !== "core")
      emit("conversion-operation", node, "a conversion is carried out by the conversion identity, and a backed conversion by a core or library operation");
    // A conversion that is carried out embeds by a conversion: an identity embedding needs no operation and a refused one is
    // not carried out. Whether the conversion is the right one is the acceptance replay's (Validate's embedding-replay).
    const embedding = conversion.kind === "backed-convert" ? conversion.embedding : operation.kind === "conversion" ? operation.embedding : null;
    if (embedding !== null && embedding.kind !== "conversion")
      emit("conversion-carried", node, "a carried-out conversion states a conversion embedding");
    if (decision.operands.length !== 1 || decision.operands[0] !== value.type ||
      operation.kind === "conversion" && operation.from !== value.type) {
      emit("conversion-source", node, "conversion does not retain its value source endpoint");
    }
    if (decision.result !== value.convertedType || operation.kind === "conversion" && operation.to !== value.convertedType) {
      emit("conversion-destination", node, "conversion does not retain its destination endpoint");
    }
  } else if (conversion.kind === "deferred") {
    const deferred = conversion.deferred;
    if (deferred.result !== value.convertedType || deferred.invocation.input.context.occurrence.body !== body.body ||
      deferred.invocation.input.context.occurrence.node !== node.id) {
      emit("conversion-deferred", node, "deferred conversion does not retain its occurrence and result");
    }
  }
  if (value.narrowing !== null) {
    const narrowed = value.narrowing.kind === "identity" ? value.narrowing.type : value.narrowing.result;
    if (narrowed !== value.type) emit("refinement-destination", node, "refinement does not retain its value endpoint");
  }
  if (value.evidenceIndex !== null) {
    const evidence = body.evidence[value.evidenceIndex];
    if (!Number.isSafeInteger(value.evidenceIndex) || Object.is(value.evidenceIndex, -0) ||
      value.evidenceIndex < 0 || evidence === undefined || evidence.type !== value.type) {
      emit("evidence-reference", node, "value evidence index and type do not select a present evidence record");
    }
  }
};

const arithmeticTokens: readonly string[] = (["PlusToken", "MinusToken", "AsteriskToken", "AsteriskAsteriskToken", "SlashToken", "PercentToken",
  "LessThanLessThanToken", "GreaterThanGreaterThanToken", "GreaterThanGreaterThanGreaterThanToken", "AmpersandToken", "BarToken", "CaretToken"]);
const comparisonTokens: readonly string[] = (["LessThanToken", "LessThanEqualsToken", "GreaterThanToken", "GreaterThanEqualsToken", "EqualsEqualsToken",
  "ExclamationEqualsToken", "EqualsEqualsEqualsToken", "ExclamationEqualsEqualsToken", "InKeyword", "InstanceOfKeyword"]);
const shortCircuitTokens: readonly string[] = (["AmpersandAmpersandToken", "BarBarToken", "QuestionQuestionToken"]);
const assignmentTokens: readonly string[] = (["EqualsToken", "PlusEqualsToken", "MinusEqualsToken", "AsteriskEqualsToken", "AsteriskAsteriskEqualsToken",
  "SlashEqualsToken", "PercentEqualsToken", "LessThanLessThanEqualsToken", "GreaterThanGreaterThanEqualsToken",
  "GreaterThanGreaterThanGreaterThanEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", "CaretEqualsToken",
  "AmpersandAmpersandEqualsToken", "BarBarEqualsToken", "QuestionQuestionEqualsToken"]);

function verifyFieldBindings<Stop extends object>(typed: BindingPattern<TypedPhase>, checked: BindingPattern<CheckedPhase>,
  types: TypeTable, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  if (typed.elements.nodes.length !== checked.elements.nodes.length || types.terms[typed.tsonic.storage]?.kind !== "shape") {
    emit("binding-storage", typed, "an object binding retains its actual closed receiver and authored field count");
    return null;
  }
  for (let position = 0; position < typed.elements.nodes.length; position += 1) {
    const paid = admit({ kind: "row" });
    if (paid !== null) return paid;
    const element = typed.elements.nodes[position];
    const authored = checked.elements.nodes[position];
    if (element === undefined || authored?.id !== element.id || element.name?.kind !== "Identifier"
      || element.dotDotDotToken !== null || element.tsonic.role !== "field-binding") {
      emit("binding-storage", element ?? typed, "an object binding retains its actual ordered field and named destination");
      continue;
    }
    const binding = element.tsonic;
    const target = authored.tsonic.declaration;
    if (target === null || (target.kind === "local" ? binding.declaration.kind !== "local" || !sameLocalReference(binding.declaration.local, target.local)
      : binding.declaration.kind !== "definition" || binding.declaration.definition !== target.definition)
      || authored.tsonic.declaredType.kind !== "available" || authored.tsonic.declaredType.value !== binding.storage)
      emit("binding-storage", element, "a data-field binding retains its independently checked destination");
    if (element.initializer?.id !== authored.initializer?.id || (element.initializer === null) !== (binding.initializer === null))
      emit("binding-storage", element, "an authored default retains its actual independently placed expression");
    const read = binding.field.decision.read;
    const beforeRead = admit({ kind: "row" });
    if (beforeRead !== null) return beforeRead;
    const term = read === null ? undefined : types.terms[read];
    let stopped: Stop | null = null;
    const domain = term?.kind === "optional" && element.initializer !== null ? optionalValueDomainOf(term, type => {
      stopped ??= admit({ kind: "row" });
      return stopped === null ? types.terms[type] ?? null : null;
    }) : null;
    if (stopped !== null) return stopped;
    if (term === undefined || (domain === null ? binding.present !== null || read !== binding.storage
      : domain.kind !== "optional-value" || binding.present !== domain.present || binding.storage !== domain.present))
      emit("binding-storage", element, "the field read and selected native present value must fit the actual binding storage");
  }
  return null;
}

export function verifyPatternBinding<Stop extends object>(node: VariableDeclaration<TypedPhase>, original: HirNode | undefined,
  types: TypeTable, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  const checked = original?.kind === "VariableDeclaration" && !("declaration" in original.tsonic) ? original : null;
  if (!("role" in node.tsonic)) {
    if (checked !== null) emit("binding-storage", node, "a destructuring container cannot publish named storage");
    return null;
  }
  const paid = admit({ kind: "row" });
  if (paid !== null) return paid;
  const source = node.initializer === null ? null : typedValueOf(node.initializer);
  if (checked?.name.kind === "ObjectBindingPattern" && node.name.kind === "ObjectBindingPattern" && source !== null
    && node.name.id === checked.name.id && node.initializer?.id === checked.initializer?.id
    && node.name.tsonic.storage === source.convertedType)
    return verifyFieldBindings(node.name, checked.name, types, admit, emit);
  if (checked?.name.kind !== "ArrayBindingPattern" || node.name.kind !== "ArrayBindingPattern" || source === null
    || node.initializer?.id !== checked.initializer?.id || node.name.tsonic.storage !== source.convertedType) {
    emit("binding-storage", node, "a destructuring container must retain its original inline source and actual tuple type");
    return null;
  }
  interface PatternSlots {
    readonly typed: BindingPattern<TypedPhase>;
    readonly source: BindingPattern<CheckedPhase>;
    readonly tuple: Extract<TypeTerm, { readonly kind: "tuple" }>;
    index: number;
  }
  const pending: PatternSlots[] = [];
  const enter = (typed: BindingPattern<TypedPhase>, source: BindingPattern<CheckedPhase>): Stop | null => {
    const next = admit({ kind: "row" });
    if (next !== null) return next;
    const tuple = types.terms[typed.tsonic.storage];
    const slots = typed.elements.nodes;
    if (typed.id !== source.id || typed.kind !== "ArrayBindingPattern" || source.kind !== "ArrayBindingPattern"
      || tuple?.kind !== "tuple" || slots.length !== source.elements.nodes.length || slots.length > tuple.elements.length)
      emit("binding-storage", typed, "the fixed pattern must retain its actual complete authored slot inventory");
    else pending.push({ typed, source, tuple, index: 0 });
    return null;
  };
  const opened = enter(node.name, checked.name);
  if (opened !== null) return opened;
  for (let frame = pending.at(-1); frame !== undefined; frame = pending.at(-1)) {
    const { typed, source, tuple, index } = frame;
    if (index === typed.elements.nodes.length) { pending.pop(); continue; }
    const reached = admit({ kind: "row" });
    if (reached !== null) return reached;
    frame.index += 1;
    const element = typed.elements.nodes[index];
    const authored = source.elements.nodes[index];
    const slot = tuple.elements[index];
    if (element === undefined || authored?.id !== element.id || slot?.kind !== "required" || element.initializer !== null
      || element.dotDotDotToken !== null || element.propertyName !== null) {
      emit("binding-storage", element ?? typed, "a fixed binding slot must retain its actual authored ordinal and required selected value");
      continue;
    }
    const name = element.name;
    if (name === null) continue;
    if (name.kind !== "Identifier") {
      if (authored.name === null || authored.name.kind === "Identifier" || name.tsonic.storage !== slot.type)
        emit("binding-storage", element, "a nested pattern must consume its own actual projected tuple slot");
      else {
        const nested = enter(name, authored.name);
        if (nested !== null) return nested;
      }
      continue;
    }
    const target = authored.tsonic.declaration;
    const binding = element.tsonic;
    if (binding.role !== "binding" || binding.storage !== slot.type || binding.initializer !== null || target === null
      || (target.kind === "local" ? binding.declaration.kind !== "local" || !sameLocalReference(binding.declaration.local, target.local)
        : binding.declaration.kind !== "definition" || binding.declaration.definition !== target.definition))
      emit("binding-storage", element, "a fixed binding consumes its selected tuple slot in its actual named storage");
  }
  return null;
}

export const verifyOccurrenceRole = (node: TirNode, original: HirNode | undefined, emit: TirOccurrenceEmit): void => {
  if (node.kind === "CallExpression") {
    const expected = original?.kind === "CallExpression" ? checkedLayoutRoleOf(original) : null;
    const phase = node.tsonic;
    const layout = "layout" in phase ? phase.layout : null;
    if (layout !== expected || "layout" in phase && phase.application.kind === "decided"
      && phase.application.decision.callee.activation !== null)
      emit("layout-call-exact", node, "layout role must retain its original checked static application without runtime activation");
  }
  if (node.tsonic !== null && "role" in node.tsonic && node.tsonic.role === "declaration-name-expression") return;
  const source = original?.tsonic;
  const target = node.tsonic;
  if (node.kind === "ImportClause") {
    if (node.name === null) {
      if (node.tsonic !== null) emit("binding-capture-owner", node, "an import clause without a default name has no binding occurrence");
    } else if (original?.kind === "ImportClause") {
      const binding = original.tsonic.bindings.find(occurrence => occurrence.value.node === node.id);
      if (node.tsonic === null || binding === undefined || !sameSourceReference(binding, node.tsonic.binding))
        emit("binding-capture-owner", node, "a default import must retain its actual checked qualified occurrence");
    }
  } else if (node.kind === "ImportSpecifier" || node.kind === "NamespaceImport") {
    const binding = original?.kind === node.kind ? original.tsonic.bindings.find(occurrence => occurrence.value.node === node.id) : undefined;
    if (node.tsonic === null || !("binding" in node.tsonic) || binding === undefined || !sameSourceReference(binding, node.tsonic.binding))
      emit("binding-capture-owner", node, "an imported name must retain its actual checked qualified occurrence");
  } else if (source !== undefined && source !== null && target !== null && ("binding" in source || "binding" in target)) {
    if (!("binding" in source) || !("binding" in target) || !sameSourceReference(source.binding, target.binding))
      emit("binding-capture-owner", node, "typed binding syntax must retain its actual checked qualified occurrence");
  }
  if (node.kind === "NamespaceExport" && original?.kind === "NamespaceExport" &&
    node.tsonic.definition !== original.tsonic.definition)
    emit("binding-capture-owner", node, "a namespace export must retain its genuine same-node F1 declaration");
  if (node.kind === "BindingElement") {
    if ((node.tsonic.role === "hole") !== (node.name === null))
      emit("binding-element-role-exact", node, "binding element role is hole exactly when its authored name is absent");
    else if (node.name !== null && (node.name.kind === "Identifier"
      ? node.tsonic.role !== "binding" && node.tsonic.role !== "field-binding" : node.tsonic.role !== "pattern"))
      emit("binding-element-role-exact", node, "a binding element must distinguish a named destination from a nested pattern");
  }
  if (node.kind === "BinaryExpression") {
    const role = node.tsonic.role;
    const token = node.operatorToken.kind;
    const matches = role === "arithmetic" ? arithmeticTokens.includes(token)
      : role === "comparison" ? comparisonTokens.includes(token)
      : role === "short-circuit" ? shortCircuitTokens.includes(token)
      : role === "assignment" ? assignmentTokens.includes(token) : token === "CommaToken";
    if (!matches) emit("binary-role-operator", node, "binary role does not match its authored operator token");
  }
  if (original === undefined || original.tsonic === null || node.tsonic === null ||
    !("role" in original.tsonic) || !("role" in node.tsonic)) return;
  const sourceRole = original.tsonic.role;
  const targetRole = node.tsonic.role;
  const receiver = node.kind === "ThisKeyword" || node.kind === "SuperKeyword";
  const matches = sourceRole === targetRole || receiver && sourceRole === "value" &&
    (targetRole === "receiver" || targetRole === "super");
  if (!matches) {
    emit("occurrence-role", node, "typed occurrence does not retain its authored occurrence role");
    if (node.kind === "Identifier" || node.kind === "PrivateIdentifier" || node.kind === "QualifiedName") {
      emit("name-role-position", node, "name role does not match its original syntactic position");
    }
  }
  if ((sourceRole === "value" || sourceRole === "shorthand-value") && typedValueOf(node) === null) {
    emit("typed-value-occurrence", node, "authored value occurrence has no typed value endpoints");
  }
};

export function verifyTupleAssertionProduct<Stop extends object>(node: TirNode, original: HirNode | undefined,
  types: TypeTable, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  if ((node.kind !== "AsExpression" && node.kind !== "TypeAssertionExpression") || original?.kind !== node.kind) return null;
  const checked = checkedContextualTupleAssertionOf(original, type => types.terms[type]?.kind === "tuple", () => admit({ kind: "row" }));
  if (checked.kind === "resource-stop") return checked.stop;
  if (checked.value === null) return null;
  const reached = admit({ kind: "row" });
  if (reached !== null) return reached;
  const { literal } = checked.value;
  const product = node.tsonic.type;
  const reject = (): null => {
    emit("operation-type", node, "an identity assertion must retain its actual selected tuple product and original annotation");
    return null;
  };
  if (node.type.id !== original.type.id) return reject();
  let parent = node.id;
  let operand = node.expression;
  for (;;) {
    const step = admit({ kind: "row" });
    if (step !== null) return step;
    const value = typedValueOf(operand);
    if (operand.parent !== parent || value === null || value.type !== product || value.convertedType !== product
      || value.conversion.kind !== "identity") return reject();
    if (operand.kind !== "ParenthesizedExpression")
      return operand.kind === "ArrayLiteralExpression" && operand.id === literal ? null : reject();
    parent = operand.id;
    operand = operand.expression;
  }
}

export function verifyArrayConstruction<Stop extends object>(node: ArrayLiteralExpression<TypedPhase>, original: HirNode | undefined,
  instance: BodyInstance, types: TypeTable, native: InferenceNativeFacts, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  const reached = admit({ kind: "row" });
  if (reached !== null) return reached;
  const views = original?.kind === "ArrayLiteralExpression" && original.tsonic.role === "value" ? original.tsonic.value.views : null;
  const context = views?.contextual;
  const read = views?.read;
  const expected = context?.kind === "available" ? context.value ?? (read?.kind === "available" ? read.value : null) : null;
  const authored = expected === null ? undefined : types.terms[expected];
  const { body, bindings } = instance;
  const phase = node.tsonic;
  const target = phase.role === "value" ? types.terms[phase.type] : undefined;
  const decision = phase.role === "value" && phase.construction.kind === "decided" ? phase.construction.decision : null;
  const operation = decision?.decision.operation;
  if (target?.kind === "array" || operation?.kind === "exact-array-construction")
    return verifyExactArray(node, original, body, types, native, decision, admit, emit);
  if (authored?.kind !== "tuple" && target?.kind !== "tuple") return null;
  const boundSlots = context?.kind === "available" && context.value === null && phase.role === "value" && phase.type !== expected;
  const holding = native.carrierHolding;
  for (let index = 0; index < holding.length; index += 1) {
    const stop = admit({ kind: "row" });
    if (stop !== null) return stop;
  }
  if (original?.kind !== "ArrayLiteralExpression" || authored?.kind !== "tuple" || target?.kind !== "tuple" || phase.role !== "value"
    || authored.readonly !== target.readonly || authored.elements.length !== target.elements.length || boundSlots && bindings.kind !== "instantiated"
    || decision === null || operation?.kind !== "array-construction" || decision.permissionScope !== null
    || decision.decision.execution.kind !== "pure" || decision.decision.result !== phase.type
    || nativeCarrierHoldingOf(holding, "tuple") !== "in-place"
    || original.elements.nodes.length !== node.elements.nodes.length || node.elements.nodes.length !== target.elements.length
    || target.elements.length !== operation.parts.length || decision.decision.operands.length !== operation.parts.length) {
    emit("operation-type", node, "a fixed tuple literal requires its actual authored inventory and selected inline product");
    return null;
  }
  const slotAt = (component: TypeComponent, index: number): boolean => component.root.kind === "body"
    && component.root.value.body === body && component.root.value.node === node.id && component.path.length === 1
    && component.path[0]?.kind === "tuple-element" && Object.is(component.path[0].index, index);
  for (let index = 0; index < operation.parts.length; index += 1) {
    const stop = admit({ kind: "row" });
    if (stop !== null) return stop;
    const element = node.elements.nodes[index];
    const sourceElement = original.elements.nodes[index];
    const sourceSlot = authored.elements[index];
    const slot = target.elements[index];
    const part = operation.parts[index];
    const value = element === undefined ? null : typedValueOf(element);
    if (element === undefined || sourceElement?.id !== element.id || part === undefined
      || sourceSlot?.kind !== "required" || slot?.kind !== "required" || slot.declaration !== sourceSlot.declaration
      || value === null || !Object.is(part.part, index) || part.member !== null
      || part.source.body !== body || part.source.node !== element.id || !slotAt(part.destination, index)
      || decision.decision.operands[index] !== slot.type || value.convertedType !== slot.type) {
      emit("operation-type", element ?? node, "a fixed tuple slot retains its actual operand, type and destination");
      continue;
    }
    if (boundSlots) {
      const paid = admit({ kind: "row" });
      if (paid !== null) return paid;
      const payload = sourceElement.tsonic;
      const sourceValue = payload !== null && "value" in payload ? payload.value : payload;
      const sourceRead = sourceValue !== null && "views" in sourceValue ? sourceValue.views.read : null;
      let selected: TyId | null = null;
      if (sourceRead?.kind === "available") {
        if (sourceRead.value === sourceSlot.type) selected = value.type;
        else if (sourceRead.value === value.type) {
          const paid = admit({ kind: "row" });
          if (paid !== null) return paid;
          const checkedLiteral = types.terms[sourceRead.value];
          if (checkedLiteral?.kind === "literal" && checkedLiteral.base === sourceSlot.type) selected = checkedLiteral.base;
        }
      }
      if (selected !== slot.type) emit("operation-type", element, "a tuple slot requires its actual checked operand type or native literal base");
    }
    const conversion = value.conversion;
    if (part.embedding.kind === "identity") {
      if (conversion.kind !== "identity" || value.type !== slot.type)
        emit("conversion-carried", element, "a tuple identity fit retains its actual value and slot type");
      continue;
    }
    const applied = conversion.kind === "convert" ? conversion.operation.decision.operation : null;
    const expected = part.embedding.kind === "conversion" ? part.embedding.proof.steps[part.embedding.proof.conclusion] : undefined;
    const carried = applied?.kind === "conversion" && applied.embedding.kind === "conversion"
      ? applied.embedding.proof.steps[applied.embedding.proof.conclusion] : undefined;
    if (part.embedding.kind !== "conversion" || applied?.kind !== "conversion" || applied.embedding.kind !== "conversion"
      || applied.embedding.conversion !== part.embedding.conversion || applied.from !== value.type || applied.to !== slot.type
      || expected === undefined || carried === undefined || !slotAt(expected.to, index) || !slotAt(carried.to, index)
      || expected.from.root.kind !== "body" || expected.from.root.value.body !== body || expected.from.root.value.node !== element.id
      || expected.from.path.length !== 0 || carried.from.path.length !== 0 || !sameSourceReference(expected.from.root, carried.from.root)) {
      emit("conversion-carried", element, "a tuple conversion retains its actual selected slot fit");
    }
  }
  return null;
}

function verifyExactArray<Stop extends object>(node: ArrayLiteralExpression<TypedPhase>, original: HirNode | undefined,
  body: BodyId, types: TypeTable, native: InferenceNativeFacts, decision: TypedOperation | null, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  const stop = admit({ kind: "row" });
  if (stop !== null) return stop;
  const originalValue = original?.kind === "ArrayLiteralExpression" && original.tsonic.role === "value" ? original.tsonic.value.views : null;
  const checked = originalValue?.read.kind === "available" ? types.terms[originalValue.read.value] : undefined;
  const contextual = originalValue?.contextual;
  const plan = decision?.decision;
  const target = plan === undefined ? undefined : types.terms[plan.result];
  const operation = plan?.operation;
  const policy = native.arrayConstruction;
  const holding = native.carrierHolding;
  const extents = native.arrayExtents;
  for (let index = 0; index < holding.length + extents.length; index += 1) {
    const paid = admit({ kind: "row" });
    if (paid !== null) return paid;
  }
  if (original?.kind !== "ArrayLiteralExpression" || checked?.kind !== "array" || target?.kind !== "array"
    || contextual?.kind !== "available" || node.tsonic.role !== "value" || plan === undefined || decision?.permissionScope !== null
    || operation?.kind !== "exact-array-construction" || plan.execution.kind !== "array-initialization" || plan.result !== node.tsonic.type
    || (contextual.value === null ? checked.readonly !== target.readonly : contextual.value !== plan.result)
    || policy?.kind !== "exact-length" || policy.rangeCopy !== "contiguous" || policy.extentFailure !== operation.extentFailure
    || operation.extent !== nativeArrayExtentOf(extents, "array") || operation.holding !== nativeCarrierHoldingOf(holding, "array")
    || operation.allocationFailure !== (native.allocationFailure === "abort" ? "abort" : "unwind")
    || operation.parts.length !== node.elements.nodes.length || operation.parts.length !== original.elements.nodes.length
    || operation.parts.length !== plan.operands.length) {
    emit("operation-type", node, "native array construction requires its actual authored inventory and selected extent, holding and failure laws");
    return null;
  }
  let copied = false;
  const slot = (component: TypeComponent) => component.root.kind === "body" && component.root.value.body === body
    && component.root.value.node === node.id && component.path.length === 1 && component.path[0]?.kind === "array-element";
  for (let index = 0; index < operation.parts.length; index += 1) {
    const paid = admit({ kind: "row" });
    if (paid !== null) return paid;
    const part = operation.parts[index];
    const element = node.elements.nodes[index];
    const authored = original.elements.nodes[index];
    const operand = element?.kind === "SpreadElement" ? element.expression : element;
    const value = operand === undefined ? null : typedValueOf(operand);
    if (operand === undefined || element === undefined || authored?.id !== element.id || authored.kind !== element.kind
      || part === undefined || part.source.body !== body || part.source.node !== operand.id
      || value === null || value.convertedType !== plan.operands[index]) {
      emit("operation-type", element ?? node, "a native array part must name its exact authored operand");
      continue;
    }
    if (part.kind === "spread") {
      const range = types.terms[value.type];
      if (copied || element.kind !== "SpreadElement" || !("role" in element.tsonic) || element.tsonic.role !== "native-array-range"
        || authored.kind !== "SpreadElement" || authored.expression.id !== operand.id
        || range?.kind !== "array" || range.element !== target.element || value.conversion.kind !== "identity" || value.type !== value.convertedType)
        emit("operation-type", element, "a native array range requires one actual spread with identical element storage");
      copied = true;
      continue;
    }
    if (element.kind === "SpreadElement" || value.convertedType !== target.element) {
      emit("operation-type", element, "a native array element requires its actual selected slot type");
      continue;
    }
    const embedding = part.embedding;
    const applied = value.conversion.kind === "convert" ? value.conversion.operation.decision.operation : null;
    const expected = embedding.kind === "conversion" ? embedding.proof.steps[embedding.proof.conclusion] : undefined;
    const carried = applied?.kind === "conversion" && applied.embedding.kind === "conversion"
      ? applied.embedding.proof.steps[applied.embedding.proof.conclusion] : undefined;
    if (embedding.kind === "identity" ? value.conversion.kind !== "identity" || value.type !== target.element
      : embedding.kind !== "conversion" || applied?.kind !== "conversion" || applied.embedding.kind !== "conversion"
        || applied.from !== value.type || applied.to !== target.element || applied.embedding.conversion !== embedding.conversion
        || expected === undefined || carried === undefined || !slot(expected.to) || !slot(carried.to)
        || expected.from.root.kind !== "body" || expected.from.root.value.body !== body || expected.from.root.value.node !== operand.id
        || expected.from.path.length !== 0 || carried.from.path.length !== 0 || !sameSourceReference(expected.from.root, carried.from.root))
      emit("conversion-carried", element, "a native array element requires its actual selected scalar fit");
  }
  return null;
}

export const verifyOperationShape = (operation: TypedOperation, node: TirNode, emit: TirOccurrenceEmit): void => {
  const decision = operation.decision;
  const identity = decision.operation;
  if ((identity.kind === "exact-array-construction") !== (decision.execution.kind === "array-initialization")
    || identity.kind === "exact-array-construction" && node.kind !== "ArrayLiteralExpression")
    emit("operation-type", node, "staged array initialization belongs only to its actual construction");
  if (identity.kind === "conversion" && (decision.operands.length !== 1 || decision.operands[0] !== identity.from || decision.result !== identity.to)) {
    emit("operation-type", node, "conversion operation does not retain its explicit operand and result endpoints");
  }
};

function caseCarrier(table: TypeTable, type: TyId) {
  const valid = (id: TyId): boolean => Number.isSafeInteger(id) && !Object.is(id, -0) && id >= 0 && id < table.terms.length;
  if (!valid(type)) return null;
  let seen: Set<TyId> | undefined;
  return nativeCarrierOf(table, type, current => {
    const term = table.terms[current];
    if (term?.kind === "literal") {
      seen ??= new Set();
      seen.add(current);
      if (!valid(term.base) || seen.has(term.base)) return null;
    }
    return term ?? null;
  });
}

export function verifySwitchOperations(node: SwitchStatement<TypedPhase>, table: TypeTable, emit: TirOccurrenceEmit): void {
  const subject = typedValueOf(node.expression);
  const parent = node.caseBlock;
  const subjectCarrier = subject === null ? null : caseCarrier(table, subject.convertedType);
  for (const clause of parent.clauses.nodes) {
    if (clause.kind !== "CaseClause") continue;
    if (parent.parent !== node.id || clause.parent !== parent.id) {
      emit("operation-type", clause, "a case comparison must belong to its actual switch and case block");
      continue;
    }
    const selected = clause.tsonic.operation;
    if (selected.kind !== "decided") continue;
    const { decision, permissionScope } = selected.decision;
    const label = typedValueOf(clause.expression);
    const { operation } = decision;
    const result = table.terms[decision.result];
    if (subject === null || label === null || permissionScope !== null || decision.operands.length !== 2
      || decision.operands[0] !== subject.convertedType || decision.operands[1] !== label.convertedType
      || result?.kind !== "primitive" || result.primitive !== "bool" || decision.execution.kind !== "pure") {
      emit("operation-type", clause, "a case comparison must retain its actual endpoints and pure Boolean result");
      continue;
    }
    const labelCarrier = caseCarrier(table, label.convertedType);
    const native = operation.kind === "native-operator" && operation.operator === "==="
      && (isNativeIntegerPrimitive(operation.carrier) || isNativeBinaryFloatPrimitive(operation.carrier))
      && subjectCarrier?.kind === "primitive" && labelCarrier?.kind === "primitive"
      && subjectCarrier.type === labelCarrier.type && subjectCarrier.primitive === operation.carrier;
    const boolean = operation.kind === "boolean-operator" && operation.operator === "==="
      && subjectCarrier?.kind === "primitive" && subjectCarrier.primitive === "bool" && labelCarrier?.kind === "primitive" && labelCarrier.primitive === "bool";
    const string = operation.kind === "string-operator" && operation.operator === "==="
      && subjectCarrier?.kind === "needs-selected-association" && table.terms[subjectCarrier.type]?.kind === "string"
      && labelCarrier?.kind === "needs-selected-association" && table.terms[labelCarrier.type]?.kind === "string";
    if (!native && !boolean && !string) emit("operation-type", clause, "a case comparison must use the selected strict equality of its exact carriers");
  }
}

export const verifyOccurrenceOperation = (node: TirNode, table: TypeTable, qualifiedPresent: TyId | null, emit: TirOccurrenceEmit): void => {
  if (node.kind === "ThrowStatement") {
    let producer = node.expression;
    while (producer.kind === "ParenthesizedExpression") {
      const child = producer.expression;
      const wrapper = typedValueOf(producer);
      const value = typedValueOf(child);
      if (wrapper === null || value === null || wrapper.type !== value.convertedType) {
        emit("operation-type", node, "a throw parenthesis does not retain its actual child value endpoint");
        return;
      }
      producer = child;
    }
    const value = typedValueOf(producer);
    const application = applicationOf(producer);
    if (value === null || application?.kind === "decided" && application.decision.callee.decision.result !== value.type) {
      emit("operation-type", node, "a throw must retain its actual selected operand endpoint");
      return;
    }
    const type = table.terms[value.type];
    if (type?.kind === "intrinsic" && type.intrinsic === "void")
      emit("operation-type", node, "a throw operand cannot be an effect-only completion");
    return;
  }
  const phase = node.tsonic;
  if (phase === null) return;
  if (node.kind === "NonNullExpression" && !("role" in node.tsonic) && node.tsonic.narrowing?.kind !== "narrowed") {
    const { type } = node.tsonic;
    const term = table.terms[type];
    if (typedValueOf(node.expression)?.convertedType !== type
      || term?.kind !== "primitive" && term?.kind !== "string" && !(term?.kind === "literal" && term.value.kind !== "absence"))
      emit("operation-type", node, "a non-null assertion without a check must preserve an already-present operand");
  }
  if (node.kind === "BinaryExpression" && node.tsonic.role === "sequence" && typedValueOf(node.right)?.convertedType !== node.tsonic.type)
    emit("operation-type", node, "a sequence must retain the actual right value endpoint");
  const compound = node.kind === "BinaryExpression" ? compoundAssignmentOperatorOf(node.operatorToken.kind) : null;
  const logical = node.kind === "BinaryExpression" ? shortCircuitOperatorOf(node.operatorToken.kind, "assignment") : null;
  if (node.kind === "BinaryExpression" && node.tsonic.role === "assignment") {
    const target = unparenthesizedExpression<TypedPhase>(node.left);
    if (target.kind === "PropertyAccessExpression" && target.tsonic.role === "assignment-target"
      || (compound !== null || logical !== null) && target.kind === "Identifier" && target.tsonic.role === "assignment-target"
        && (target.tsonic.resolution.kind === "local" || compound !== null && target.tsonic.resolution.kind === "static")) {
      const { calculation, storage } = node.tsonic;
      const access = target.tsonic.access;
      if (logical !== null) {
        if (calculation !== null || access.kind !== "read-write" || access.storage !== storage
          || typedValueOf(node.right)?.convertedType !== storage)
          emit("operation-type", node, "conditional assignment requires its read-write storage and only its selected RHS embedding");
      } else if (compound === null) {
        if (node.operatorToken.kind !== "EqualsToken" || calculation !== null || access.kind !== "write"
          || access.storage !== storage || typedValueOf(node.right)?.convertedType !== storage)
          emit("operation-type", node, "plain field assignment requires its original write-only storage and RHS embedding");
      } else if (calculation === null || access.kind !== "read-write" || access.storage !== storage)
        emit("operation-type", node, "compound assignment requires its checked read-write access and calculation");
      else if (calculation.kind === "decided") {
        const { operation, operands, result } = calculation.decision.decision;
        const right = typedValueOf(node.right);
        const matches = (operation.kind === "native-operator" || operation.kind === "bigint-operator" || operation.kind === "string-operator")
          && operation.operator === compound;
        if (!matches || operands.length !== 2
          || operands[0] !== access.read || right === null || operands[1] !== right.convertedType || result !== storage)
          emit("operation-type", node, "compound assignment calculation differs from its authored operator, operands or storage");
      }
    }
  }
  const outcome = "operation" in phase ? phase.operation : "construction" in phase ? phase.construction : null;
  if (outcome?.kind !== "decided") return;
  const decision = outcome.decision.decision;
  if (decision.operation.kind === "array-extent"
    && (node.kind !== "PropertyAccessExpression" || node.tsonic.role !== "array-extent"))
    emit("operation-type", node, "an array extent may only select its actual checked property read");
  if (decision.operation.kind === "absence-test" && node.kind === "BinaryExpression") {
    const operator = node.operatorToken.kind;
    const left = decision.operands[0];
    const right = decision.operands[1];
    const result = table.terms[decision.result];
    if (node.tsonic.role !== "comparison" || decision.execution.kind !== "pure"
      || (operator !== "EqualsEqualsToken" && operator !== "EqualsEqualsEqualsToken"
        && operator !== "ExclamationEqualsToken" && operator !== "ExclamationEqualsEqualsToken")
      || decision.operation.negated !== (operator === "ExclamationEqualsToken" || operator === "ExclamationEqualsEqualsToken")
      || left === undefined || right === undefined || result?.kind !== "primitive" || result.primitive !== "bool"
      || nativeAbsenceComparisonOf(table.terms[left], table.terms[right], type => table.terms[type] ?? null, qualifiedPresent) !== "native-absence")
      emit("operation-type", node, "a binary absence test must preserve its authored equality and its actual native presence endpoints");
  }
  if (node.kind === "VoidExpression") {
    const result = table.terms[decision.result];
    if (decision.operation.kind !== "discard" || decision.execution.kind !== "pure"
      || result?.kind !== "intrinsic" || result.intrinsic !== "absence")
      emit("operation-type", node, "void must discard its actual operand and produce native absence");
  }
  const value = typedValueOf(node);
  if (value !== null && decision.result !== value.type) emit("operation-type", node, "selected occurrence operation does not retain its value result endpoint");
  if (node.kind === "PostfixUnaryExpression" || node.kind === "PrefixUnaryExpression") {
    const storage = node.kind === "PostfixUnaryExpression" ? node.tsonic.storage
      : node.tsonic.role === "update" ? node.tsonic.storage : null;
    const target = storage === null ? node.operand : unparenthesizedExpression<TypedPhase>(node.operand);
    if (storage !== null && target.kind === "Identifier" && target.tsonic.role === "assignment-target"
      && (target.tsonic.resolution.kind === "local" || target.tsonic.resolution.kind === "static")) {
      const { access } = target.tsonic;
      const { operation, operands, result } = decision;
      const operator = prefixOperatorOf(node.operator);
      if (access.kind !== "read-write" || access.storage !== storage || access.read !== storage
        || result !== access.storage || operands.length !== 1 || operands[0] !== access.read
        || (operator !== "++" && operator !== "--") || operation.kind !== "native-operator" || operation.operator !== operator)
        emit("operation-type", node, "update calculation differs from its authored operator, read or storage endpoint");
    }
  }
  const operands: TirNode[] = [];
  if (node.kind === "BinaryExpression" && (node.tsonic.role === "arithmetic" || node.tsonic.role === "comparison")) operands.push(node.left, node.right);
  else if (node.kind === "PrefixUnaryExpression" || node.kind === "PostfixUnaryExpression") operands.push(node.operand);
  else if (node.kind === "DeleteExpression" || node.kind === "TypeOfExpression" || node.kind === "VoidExpression") operands.push(node.expression);
  if (operands.length === 0) return;
  let matches = operands.length === decision.operands.length;
  for (const [position, operand] of operands.entries()) {
    const endpoint = typedValueOf(operand);
    if (endpoint !== null && endpoint.convertedType !== decision.operands[position]) matches = false;
  }
  if (!matches) emit("operation-type", node, "selected operation does not retain the authored operand count and value endpoints");
};

export function verifyDeferredParameters<Stop extends object>(
  deferred: DeferredDecision, node: TirNode, body: TirBody, table: TypeTable,
  emit: TirOccurrenceEmit, admit: TirReadyReadAdmission<Stop>,
): Stop | null {
  const setup = admit({ kind: "deferred-type-support", work: 1, records: 6 });
  if (setup !== null) return setup;
  const context = deferred.invocation.input.context;
  const valid = context.occurrence.body === body.body && Object.is(context.occurrence.node, node.id) &&
    context.origin.module === node.origin.module && context.origin.start === node.origin.start && context.origin.length === node.origin.length;
  const classParameters: DefId[] = [];
  const methodParameters: DefId[] = [];
  const capturedParameters: DefId[] = [];
  const selfOwners: DefId[] = [];
  const scope: BindingScope = { classParameters, methodParameters, capturedParameters, selfOwners };
  const { bindings } = context;
  const families = [
    { rows: bindings.classBindings, target: classParameters },
    { rows: bindings.methodBindings, target: methodParameters },
    { rows: bindings.capturedBindings, target: capturedParameters },
  ];
  for (const { rows, target } of families) for (let position = 0; position < rows.length; position += 1) {
    const step = admit({ kind: "deferred-type-support", work: 1, records: 1 });
    if (step !== null) return step;
    const binding = rows[position];
    if (binding !== undefined) target.push(binding.parameter);
  }
  for (let position = 0; position < bindings.selfBindings.length; position += 1) {
    const step = admit({ kind: "deferred-type-support", work: 1, records: 1 });
    if (step !== null) return step;
    const binding = bindings.selfBindings[position];
    if (binding !== undefined) selfOwners.push(binding.owner);
  }
  const roots: TyId[] = [];
  for (const evidence of deferredEvidence(deferred)) {
    const step = admit({ kind: "deferred-type-support", work: 1, records: 1 });
    if (step !== null) return step;
    const type = evidence.type;
    if (Number.isSafeInteger(type) && !Object.is(type, -0) && type >= 0 && type < table.terms.length) roots.push(type);
  }
  const admitSupport = (work: number, records: number): { readonly kind: "resource-limit"; readonly stop: Stop } | null => {
    const stop = admit({ kind: "deferred-type-support", work, records });
    return stop === null ? null : { kind: "resource-limit", stop };
  };
  const support = readLexicalTypeSupport(table, roots, scope, { work: count => admitSupport(count, 0), retain: count => admitSupport(0, count) });
  if (support.kind !== "complete") return support.stop;
  if (support.value === "invalid") emit("type-closed", node, "typed reference does not reach a present closed type/signature graph");
  if (!valid || support.value === "foreign")
    emit("deferred-parameters", node, "saved invocation does not retain its occurrence and complete captured rigid-parameter support");
  return null;
}
