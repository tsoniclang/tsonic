import type { DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { BodyId, DefId, NodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ExecutionDependency, SummaryKey } from "../ir-facts/contract.js";
import { admitSummaryIdentity, summaryKey } from "../ir-facts/index.js";
import type { RuleOutcome } from "../ir-infer/contract.js";
import type { ResolvedCallee, TirApplication, TirChapterSyntaxSlot, TirNode, TirProtocol, TirTypedSyntax, TypedOperation } from "../ir-tir/contract.js";
import { chapterSyntaxSlots, layoutBindingOf, readChapterSyntaxSlot, tirBodySyntaxOf } from "../ir-tir/index.js";
import { sameInstance } from "../ir-types/index.js";
import type { DependenciesOf } from "./contract.js";

function selected<Value>(outcome: RuleOutcome<Value>): Value {
  if (outcome.kind !== "decided") throw new TypeError("Dependency discovery requires completed typed selection.");
  return outcome.decision;
}

function callableSyntax(node: TirNode): boolean {
  switch (node.kind) {
    case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunction":
    case "MethodDeclaration": case "Constructor": case "GetAccessor": case "SetAccessor":
      return true;
    default: return false;
  }
}

export const dependenciesOf: DependenciesOf = (deps, input) => {
  const { account } = deps;
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
  if (setup !== null) return setup;
  const current: SummaryKey = { kind: "body", execution: input.execution };
  const identities = admitSummaryIdentity(current, account)
    ?? admitSummaryIdentity({ kind: "body", execution: {
      instance: { body: input.tir.body, bindings: input.tir.bindings }, provided: input.execution.provided,
    } }, account);
  if (identities !== null) return identities;
  if (!sameInstance(input.execution.instance, { body: input.tir.body, bindings: input.tir.bindings }))
    throw new TypeError("Dependency discovery retains the actual selected typed body instance.");
  const operations: SummaryKey[] = [current];
  const dependencies: ExecutionDependency[] = [];
  const known = new Set([summaryKey(current)]);
  const occurrences = new Set<string>();
  const add = (at: NodeRef, reason: ExecutionDependency["reason"], target: SummaryKey): DataflowStop | null => {
    const stop = admitSummaryIdentity(target, account) ?? chargeWork(account, 1);
    if (stop !== null) return stop;
    const key = summaryKey(target);
    if (!known.has(key)) {
      const growth = chargeResultEntries(account, 2);
      if (growth !== null) return growth;
      known.add(key);
      operations.push(target);
    }
    const occurrence = encodeKey([at.node, reason, key]);
    if (occurrences.has(occurrence)) return null;
    const growth = chargeResultEntries(account, 6);
    if (growth !== null) return growth;
    occurrences.add(occurrence);
    dependencies.push({ dependent: input.execution, at, reason, target });
    return null;
  };
  const entries = (at: NodeRef, reason: ExecutionDependency["reason"], values: readonly SummaryKey[] | null): DataflowStop | null => {
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    if (values === null) throw new TypeError("The actual selected dependency requires its complete ready operation/entry association.");
    for (let position = 0; position < values.length; position += 1) {
      const row = chargeWork(account, 1);
      if (row !== null) return row;
      const value = values[position];
      if (value === undefined) throw new TypeError("Ready selected operation entries are dense.");
      const stop = add(at, reason, value);
      if (stop !== null) return stop;
    }
    return null;
  };
  const callable = (at: NodeRef, definition: DefId): DataflowStop | null => {
    const lookup = chargeWork(account, 1);
    return lookup ?? entries(at, "activation", deps.callableEntriesAt(at, definition));
  };
  const callee = (at: NodeRef, value: ResolvedCallee, reason: ExecutionDependency["reason"]): DataflowStop | null => {
    const lookup = chargeWork(account, 1);
    if (lookup !== null) return lookup;
    const target = deps.calleeAt(at, value);
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    if (target === null) throw new TypeError("A selected callee requires its actual complete request and provided entry.");
    if (value.activation !== null && (target.kind !== "body" || !sameInstance(target.execution.instance, value.activation)))
      throw new TypeError("The selected callee entry belongs to its actual activation body.");
    if (target.kind === "declared" && target.execution.request.definition !== value.decision.api.declaration)
      throw new TypeError("A declared dependency retains the selected API declaration.");
    return add(at, reason, target);
  };
  const initializer = (at: NodeRef, body: BodyId): DataflowStop | null => {
    const lookup = chargeWork(account, 1);
    if (lookup !== null) return lookup;
    const target = deps.initializerAt(at, body);
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    if (target === null || target.kind !== "body" || target.execution.instance.body !== body)
      throw new TypeError("An executed initializer requires its actual selected body and offered entry.");
    return add(at, "initializer", target);
  };
  const application = (at: NodeRef, value: TirApplication, reason: ExecutionDependency["reason"]): DataflowStop | null => {
    const stop = callee(at, value.callee, reason);
    if (stop !== null) return stop;
    for (let position = 0; position < value.arguments.length; position += 1) {
      const row = chargeWork(account, 1);
      if (row !== null) return row;
      const argument = value.arguments[position];
      if (argument === undefined) throw new TypeError("A ready application has dense argument transport.");
      if (argument.kind !== "omitted" || argument.value.kind !== "initializer") continue;
      const lookup = chargeWork(account, 1);
      if (lookup !== null) return lookup;
      const target = deps.initializerAt(at, { instance: argument.value.instance, parameter: argument.parameter, callee: value.callee });
      const stopped = accountFailure(account);
      if (stopped !== null) return stopped;
      if (target === null || target.kind !== "body" || !sameInstance(target.execution.instance, argument.value.instance))
        throw new TypeError("An omitted default retains its actual selected initializer instance and entry.");
      const added = add(at, "initializer", target);
      if (added !== null) return added;
    }
    return null;
  };
  const operation = (at: NodeRef, value: TypedOperation): DataflowStop | null => {
    const identity = value.decision.operation;
    if (identity.kind !== "library" && identity.kind !== "core" && identity.kind !== "protocol") return null;
    const lookup = chargeWork(account, 1);
    return lookup ?? entries(at, "protocol", deps.operationEntriesAt(at, value));
  };
  const protocol = (at: NodeRef, value: TirProtocol): DataflowStop | null => {
    for (let position = 0; position < value.steps.length; position += 1) {
      const row = chargeWork(account, 1);
      if (row !== null) return row;
      const step = value.steps[position];
      if (step === undefined) throw new TypeError("A selected protocol has dense steps.");
      const stop = step.callee === null ? operation(at, step.operation) : callee(at, step.callee, "protocol");
      if (stop !== null) return stop;
    }
    return null;
  };
  let selectedTarget = false;
  const visit = (node: TirNode, accountedTarget: boolean): DataflowStop | null => {
    const at: NodeRef = { body: input.tir.body, node: node.id };
    switch (node.kind) {
      case "ArrowFunction": case "FunctionExpression": return callable(at, node.tsonic.callable.definition);
      case "Identifier": case "PrivateIdentifier": case "QualifiedName": {
        const name = node.tsonic;
        if ((name.role === "value" || name.role === "shorthand-value") && name.resolution.kind === "definition") {
          if (accountedTarget) return null;
          const lookup = chargeWork(account, 1);
          if (lookup !== null) return lookup;
          const values = deps.callableEntriesAt(at, name.resolution.definition);
          return entries(at, "activation", values);
        }
        return null;
      }
      case "CallExpression": case "TaggedTemplateExpression": case "NewExpression": {
        const phase = node.tsonic;
        if (!("application" in phase)) return null;
        const applied = selected(phase.application);
        const stop = application(at, applied, node.kind === "NewExpression" ? "constructor" : "call");
        if (stop !== null) return stop;
        selectedTarget = true;
        if (node.kind === "NewExpression") {
          const lookup = chargeWork(account, 1);
          if (lookup !== null) return lookup;
          return entries(at, "dispatch", deps.dispatchEntriesAt(at));
        }
        return null;
      }
      case "Decorator": return application(at, selected(node.tsonic.application), "call");
      case "PropertyAccessExpression": case "ElementAccessExpression": {
        const value = node.tsonic;
        if ("index" in value || value.role !== "value" && value.role !== "assignment-target") return null;
        const member = selected(value.selection);
        const read = value.role === "value" || value.access.kind === "read-write";
        const getter = read && member.getter !== null ? callee(at, member.getter, "getter") : null;
        if (getter !== null) return getter;
        return value.role === "assignment-target" && member.setter !== null ? callee(at, member.setter, "setter") : null;
      }
      case "VariableDeclaration":
        return node.tsonic.initializer === null || layoutBindingOf(node.initializer) !== null ? null : initializer(at, node.tsonic.initializer);
      case "PropertyDeclaration":
        return node.tsonic.initializer === null ? null : initializer(at, node.tsonic.initializer);
      case "SpreadElement": return "role" in node.tsonic ? null : protocol(at, selected(node.tsonic.protocol));
      case "YieldExpression": case "AwaitExpression":
      case "ForInStatement": case "ForOfStatement": return protocol(at, selected(node.tsonic.protocol));
      case "BinaryExpression": {
        const binary = node.tsonic;
        if (binary.role === "arithmetic" || binary.role === "comparison") return operation(at, selected(binary.operation));
        return binary.role === "assignment" && binary.calculation !== null ? operation(at, selected(binary.calculation)) : null;
      }
      case "PrefixUnaryExpression":
        return node.tsonic.role === "type-literal" ? null : operation(at, selected(node.tsonic.operation));
      case "PostfixUnaryExpression": case "DeleteExpression": case "TypeOfExpression": case "VoidExpression":
        return operation(at, selected(node.tsonic.operation));
      case "TemplateExpression": return operation(at, selected(node.tsonic.operation));
      case "ArrayLiteralExpression": case "ObjectLiteralExpression":
        return node.tsonic.role === "value" ? operation(at, selected(node.tsonic.construction)) : null;
      case "SpreadAssignment": return operation(at, selected(node.tsonic.construction));
      default: return null;
    }
  };
  if (input.tir.params.length !== 0) {
    const lookup = chargeWork(account, 1);
    if (lookup !== null) return lookup;
    const signature = deps.signatureOf(input.tir.signature);
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    if (signature.id !== input.tir.signature)
      throw new TypeError("Default discovery retains the actual selected signature.");
    let parameterIndex = 0;
    for (let position = 0; position < input.tir.params.length; position += 1) {
      const headerRead = chargeWork(account, 1);
      if (headerRead !== null) return headerRead;
      const header = input.tir.params[position];
      if (header === undefined) throw new TypeError("Ready execution parameter headers are dense.");
      const parameter = header.tsonic;
      if (parameter.role === "this") continue;
      const formalRead = chargeWork(account, 1);
      if (formalRead !== null) return formalRead;
      const formal = signature.parameters[parameterIndex];
      if (formal === undefined || formal.declaration !== parameter.declaration)
        throw new TypeError("An execution header retains its actual selected formal position.");
      if (parameterIndex >= input.execution.provided && parameter.initializer !== null) {
        if (!formal.acceptsOmission)
          throw new TypeError("An executed default requires the selected formal's actual omission capability.");
        const stop = initializer({ body: input.tir.body, node: header.id }, parameter.initializer);
        if (stop !== null) return stop;
      }
      parameterIndex += 1;
    }
    if (parameterIndex !== signature.parameters.length)
      throw new TypeError("Execution headers retain every actual selected ordinary formal.");
  }
  const stack: { readonly children: Iterator<TirChapterSyntaxSlot>; readonly callable: boolean; readonly placed: boolean;
    readonly target: boolean; readonly targetField: string }[] = [];
  let subject: TirTypedSyntax | null = tirBodySyntaxOf(input.tir.root);
  let accountedTarget = false;
  while (subject !== null || stack.length !== 0) {
    if (subject !== null) {
      const admission = chargeWork(account, 1);
      if (admission !== null) return admission;
      selectedTarget = false;
      const node: TirNode | null = subject.kind === "ordinary" ? subject.node : null;
      if (node?.kind === "EnumDeclaration" || node?.kind === "CallExpression" && "layout" in node.tsonic) {
        subject = null;
        continue;
      }
      const growth = chargeResultEntries(account, 4);
      if (growth !== null) return growth;
      const stop = node === null ? null : visit(node, accountedTarget);
      if (stop !== null) return stop;
      const placed = subject.kind === "formal" || (node?.kind === "VariableDeclaration" || node?.kind === "PropertyDeclaration")
        && node.tsonic.initializer !== null;
      stack.push({ children: chapterSyntaxSlots(subject)[Symbol.iterator](), callable: node !== null && callableSyntax(node),
        placed, target: node?.kind === "ParenthesizedExpression" ? accountedTarget : selectedTarget,
        targetField: node?.kind === "TaggedTemplateExpression" ? "tag" : "expression" });
      subject = null;
    }
    const frame = stack[stack.length - 1];
    if (frame === undefined) throw new TypeError("Dependency traversal retains an actual charged frame.");
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const child = frame.children.next();
    if (child.done) stack.pop();
    else {
      const field = child.value.fields[0];
      if (frame.placed && field === "initializer" || frame.callable && (field === "parameters" || field === "body")) continue;
      const next = readChapterSyntaxSlot(child.value);
      if (next === null || next.kind === "checked" || next.kind === "ready-callable") continue;
      accountedTarget = field === frame.targetField && frame.target;
      subject = next;
    }
  }
  return { kind: "complete", value: { operations, dependencies } };
};
