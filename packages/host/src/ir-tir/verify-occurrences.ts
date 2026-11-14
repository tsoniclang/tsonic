import type { DefId, LocalRef, NodeId, SourceNodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { HirNode } from "../ir-hir/contract.js";
import type { ApplicationDecision, DeferredDecision, MemberDecision, OperationDecision, RuleOutcome } from "../ir-infer/contract.js";
import type { BodyInstance, TypeEvidence, TypeTable } from "../ir-types/contract.js";
import type { MemberSelection, ResolvedCallee, TirBody, TirMemberOccurrence, TirModule, TirNode, TirProtocol, TirRule, TypedBodyTemplate, TypedOperation, TypedValue } from "./contract.js";
import type { TirLayouts, TirReference, TirRecordAssociation, TirRecordLayout, TirScalarValue, TirTypedWork, TirValuePath } from "./text-layouts.js";
import { enterTirInline, tirPathText } from "./text-layouts.js";

export type TirOccurrenceEmit = (rule: TirRule, node: TirNode | null, detail: string) => void;

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
  readonly node: TirNode | null;
  readonly phase: boolean;
  readonly path: TirValuePath | null;
}

export interface TirScalarVisit {
  readonly type: string;
  readonly ownerType: string | null;
  readonly value: TirScalarValue;
  readonly reference: TirReference | null;
  readonly node: TirNode | null;
  readonly path: TirValuePath | null;
}

export interface TirStructure {
  readonly records: readonly TirRecordVisit[];
  readonly scalars: readonly TirScalarVisit[];
  readonly nodes: readonly TirNode[];
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

export interface TirTypeGraph {
  readonly children: ReadonlyMap<number, readonly number[]>;
  readonly signatureOffset: number;
}

type TirVisitWork =
  | { readonly kind: "exit"; readonly value: object }
  | { readonly kind: "syntax-exit"; readonly value: object }
  | { readonly kind: "value"; readonly value: TirTypedWork; readonly node: TirNode | null;
      readonly phase: boolean; readonly path: TirValuePath | null; readonly ownerType: string | null;
      readonly bindingOwner: DefId | null;
      readonly members: TirMemberCursor };

export const inspectTirStructure = (
  subject: TirBody | TirModule, layouts: TirLayouts, stopBefore: ReadonlySet<NodeId>,
): TirStructure => {
  const body = "root" in subject;
  const root = body ? subject.root : subject.tree;
  const rootPath = body ? "$body" : "$module";
  const records: TirRecordVisit[] = [];
  const scalars: TirScalarVisit[] = [];
  const nodes: TirNode[] = [];
  const selectedMembers: TirSelectedMemberVisit[] = [];
  const pending: TirVisitWork[] = !body && stopBefore.has(root.id) ? [] : [{ kind: "value",
    value: body ? layouts.bodyWork(subject) : layouts.nodeWork(subject.tree), node: null, phase: false, path: null,
    ownerType: null, bindingOwner: null, members: { node: root, ordinal: 0 } }];
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
        if (syntaxActive.has(node)) throw new TypeError(`ir-tir: syntax cycle at ${tirPathText(work.path, rootPath)}`);
        if (syntaxCompleted.has(node)) continue;
        pending.push({ ...work, value: layouts.nodeWork(node), node });
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
          node, phase: work.phase, path: work.path });
        const association = value.association;
        if (association?.kind === "member-selection") {
          selectedMembers.push({ decision: association.value.decision, selection: association.value, node: members.node,
            occurrence: { kind: "selection", node: members.node.id, ordinal: nextMemberOrdinal(members) } });
        } else if (association?.kind === "construction-part") {
          const part = association.value;
          const decision = part.member;
          if (decision !== null) selectedMembers.push({ decision, selection: null, node: members.node,
              occurrence: { kind: "construction-part", node: members.node.id, ordinal: nextMemberOrdinal(members),
                source: part.source, destination: part.destination, part: part.part } });
        }
        const fields = value.fields();
        for (let position = fields.length - 1, field = fields[position]; field !== undefined; field = fields[--position]) {
          pending.push({ kind: "value", value: field.work, node, phase: work.phase || field.name === "tsonic",
            path: { parent: work.path, field: field.name }, ownerType: value.layout.label, bindingOwner, members });
        }
        break;
      }
    }
  }
  return { records, scalars, nodes, selectedMembers };
};

export const typedValueOf = (node: TirNode): TypedValue | null =>
  node.tsonic !== null && "convertedType" in node.tsonic ? node.tsonic : null;

export const deferredEvidence = (deferred: DeferredDecision): readonly TypeEvidence[] => {
  const invocation = deferred.invocation;
  switch (invocation.rule) {
    case "embed": return [invocation.input.from, invocation.input.to];
    case "domain-fit": return [invocation.input.value, invocation.input.domain];
    case "memory-equivalent": return [invocation.input.left, invocation.input.right];
    case "member": return [invocation.input.receiver];
    case "index": return [invocation.input.receiver, invocation.input.key];
    case "construct-literal": return [...invocation.input.parts.map(part => part.value),
      ...(invocation.input.destination === null ? [] : [invocation.input.destination])];
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

type TirSemanticWork =
  | { readonly kind: "application"; readonly value: ApplicationDecision; readonly node: TirNode }
  | { readonly kind: "callee"; readonly value: ResolvedCallee; readonly node: TirNode }
  | { readonly kind: "member"; readonly value: MemberSelection; readonly node: TirNode }
  | { readonly kind: "operation"; readonly value: TypedOperation; readonly node: TirNode }
  | { readonly kind: "protocol"; readonly value: TirProtocol; readonly node: TirNode; readonly ordinal: number | null }
  | { readonly kind: "deferred"; readonly value: DeferredDecision; readonly node: TirNode };

export interface TirSemanticInventory {
  readonly applications: readonly { readonly value: ApplicationDecision; readonly node: TirNode }[];
  readonly callees: readonly { readonly value: ResolvedCallee; readonly node: TirNode }[];
  readonly operations: readonly { readonly value: TypedOperation; readonly node: TirNode }[];
  readonly protocols: readonly { readonly value: TirProtocol; readonly node: TirNode; readonly ordinal: number | null }[];
  readonly deferred: readonly { readonly value: DeferredDecision; readonly node: TirNode }[];
  readonly initializers: readonly { readonly value: BodyInstance; readonly node: TirNode | null }[];
  readonly templates: readonly { readonly value: TypedBodyTemplate; readonly node: TirNode }[];
}

export const collectTirSemantics = (nodes: readonly TirNode[]): TirSemanticInventory => {
  const applications: { value: ApplicationDecision; node: TirNode }[] = [];
  const callees: { value: ResolvedCallee; node: TirNode }[] = [];
  const operations: { value: TypedOperation; node: TirNode }[] = [];
  const protocols: { value: TirProtocol; node: TirNode; ordinal: number | null }[] = [];
  const deferred: { value: DeferredDecision; node: TirNode }[] = [];
  const initializers: { value: BodyInstance; node: TirNode | null }[] = [];
  const templates: { value: TypedBodyTemplate; node: TirNode }[] = [];
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
  const template = (value: TypedBodyTemplate | null, node: TirNode): void => {
    if (value !== null) templates.push({ value, node });
  };
  for (const node of nodes) {
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
    if (node.kind === "CallExpression" || node.kind === "NewExpression" || node.kind === "TaggedTemplateExpression" || node.kind === "Decorator") {
      const application = node.tsonic.application;
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
      case "application":
        applications.push(work);
        break;
      case "callee":
        callees.push(work);
        pending.push({ kind: "application", value: work.value.decision, node });
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
  return { applications, callees, operations, protocols, deferred, initializers, templates };
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

export const verifyOccurrenceRole = (node: TirNode, original: HirNode | undefined, emit: TirOccurrenceEmit): void => {
  if (node.kind === "BindingElement" && (node.tsonic.role === "hole") !== (node.name === null)) {
    emit("binding-element-role-exact", node, "binding element role is hole exactly when its authored name is absent");
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

export const verifyOperationShape = (operation: TypedOperation, node: TirNode, emit: TirOccurrenceEmit): void => {
  const decision = operation.decision;
  const identity = decision.operation;
  if (identity.kind === "conversion" && (decision.operands.length !== 1 || decision.operands[0] !== identity.from || decision.result !== identity.to)) {
    emit("operation-type", node, "conversion operation does not retain its explicit operand and result endpoints");
  }
};

export const verifyOccurrenceOperation = (node: TirNode, emit: TirOccurrenceEmit): void => {
  const phase = node.tsonic;
  if (phase === null) return;
  const outcome = "operation" in phase ? phase.operation : "construction" in phase ? phase.construction : null;
  if (outcome?.kind !== "decided") return;
  const decision = outcome.decision.decision;
  const value = typedValueOf(node);
  if (value !== null && decision.result !== value.type) emit("operation-type", node, "selected occurrence operation does not retain its value result endpoint");
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

export const verifyDeferredParameters = (
  deferred: DeferredDecision, node: TirNode, body: TirBody, table: TypeTable, graph: TirTypeGraph,
  memo: Map<string, boolean>, emit: TirOccurrenceEmit,
): void => {
  const context = deferred.invocation.input.context;
  let valid = context.occurrence.body === body.body && Object.is(context.occurrence.node, node.id) &&
    context.origin.module === node.origin.module && context.origin.start === node.origin.start && context.origin.length === node.origin.length;
  const parameters = new Set<string>();
  const owners = new Set<string>();
  for (const family of [context.bindings.classBindings, context.bindings.methodBindings, context.bindings.capturedBindings]) {
    for (const binding of family) parameters.add(encodeKey([binding.parameter.owner, binding.parameter.index]));
  }
  for (const binding of context.bindings.selfBindings) owners.add(binding.owner);
  const support = encodeKey({ kind: "record", fields: [["parameters", [...parameters].sort()], ["owners", [...owners].sort()]] });
  for (const evidence of deferredEvidence(deferred)) {
    if (!Number.isSafeInteger(evidence.type) || Object.is(evidence.type, -0) || evidence.type < 0 || evidence.type >= table.terms.length) continue;
    const query = encodeKey([evidence.type, support]);
    let supported = memo.get(query);
    if (supported === undefined) {
      supported = true;
      const pending: number[] = [evidence.type];
      const visited = new Set<number>();
      for (let selected = pending.pop(); selected !== undefined; selected = pending.pop()) {
        if (visited.has(selected)) continue;
        visited.add(selected);
        const term = selected < graph.signatureOffset ? table.terms[selected] : undefined;
        if (term?.kind === "param" && !parameters.has(encodeKey([term.parameter.owner, term.parameter.index])) ||
          term?.kind === "self" && !owners.has(term.owner)) { supported = false; break; }
        for (const child of graph.children.get(selected) ?? []) pending.push(child);
      }
      memo.set(query, supported);
    }
    if (!supported) { valid = false; break; }
  }
  if (!valid) emit("deferred-parameters", node, "saved invocation does not retain its occurrence and complete captured rigid-parameter support");
};
