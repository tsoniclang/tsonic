import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import { sourceStorageSuperConstructor } from "../model/construction.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";

export interface SourceStorageInvocationInputs {
  readonly subjects: ReadonlySet<SourceStorageSubject>;
  readonly context: "caller" | "callee";
  readonly defaults?: readonly SourceStorageSubject[];
}

export type SourceStorageInvocationInputQuery = (
  formal: SourceStorageSubject,
  candidate: Node,
  invocation: Node,
  callback?: SourceStorageCallbackEntry,
) => SourceStorageInvocationInputs;

export function createSourceStorageInvocationInputs(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
  isAccessor: (invocation: Node) => boolean,
  isUnresolved: (invocation: Node) => boolean,
): SourceStorageInvocationInputQuery {
  const { ast, semantics } = source;
  return (formal, candidate, invocation, callback) => {
    const subjects = new Set<SourceStorageSubject>();
    let context: SourceStorageInvocationInputs["context"] = "caller";
    if (isUnresolved(invocation)) return { subjects, context };
    const selected = semantics.forNode(invocation).operations.call(invocation);
    if (callback !== undefined) {
      if (selected === undefined || !selected.sourceArgumentBindings.some(binding =>
        binding.sourceArgumentIndex === callback.argument.binding.sourceArgumentIndex &&
        binding.sourceParameterIndex === callback.argument.binding.sourceParameterIndex &&
        binding.selectedParameterType === callback.argument.binding.selectedParameterType)) return { subjects, context };
      const parameterIndex = ast.parameters(candidate).indexOf(formal.node);
      const types = semantics.forNode(invocation).types;
      const callbackType = types.nonNullableType(callback.argument.binding.selectedParameterType);
      const signatures = callbackType === undefined ? [] : types.signatureInfos(callbackType, "call");
      const nativeInput = signatures.length === 1 ? signatures[0]!.parameters[parameterIndex] : undefined;
      const initializer = parameterIndex < 0 ? undefined : Node_Initializer(ast, formal.node);
      const present = nativeInput === undefined ? undefined : types.nonNullableType(nativeInput.type);
      const defaultInput = initializer === undefined || nativeInput !== undefined && !nativeInput.acceptsOmission &&
        !types.isAny(nativeInput.type) && !types.isUnknown(nativeInput.type) && !types.isNullish(nativeInput.type) &&
        !types.isVoidLike(nativeInput.type) && present !== undefined && types.isIdentical(nativeInput.type, present)
        ? undefined : subjectFor(initializer);
      const defaults = defaultInput === undefined ? undefined : Object.freeze([defaultInput]);
      const input = callback.inputs?.find(input => input.parameterIndex === parameterIndex);
      let receiver: Node | undefined;
      if (input?.from === "receiver-element") receiver = selected.sourceReceiver?.expression;
      else if (input?.from === "argument-element") {
        const bindings = selected.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === input.sourceParameterIndex);
        if (bindings.length === 1 && bindings[0]!.sourceForm === "value" && bindings[0]!.sourceParameterForm === "parameter")
          receiver = selected.sourceArguments[bindings[0]!.sourceArgumentIndex]?.expression;
      }
      const type = receiver === undefined ? undefined : semantics.forNode(invocation).types.expressionType(receiver);
      if (receiver !== undefined && type !== undefined && semantics.forNode(invocation).types.isArrayLike(type)) {
        const owner = subjectFor(receiver);
        const projected = owner === undefined ? undefined : subject(owner.node, owner.kind,
          [...owner.projection, { kind: "array-element" }, ...formal.projection]);
        if (projected !== undefined) subjects.add(projected);
        return { subjects, context: "caller", defaults };
      }
      subjects.add(formal);
      return { subjects, context: "callee", defaults };
    }
    const add = (origin: SourceStorageSubject | undefined): void => {
      if (origin === undefined) return;
      const projected = subject(origin.node, origin.kind, [...origin.projection, ...formal.projection]);
      if (projected !== undefined) subjects.add(projected);
    };
    if (formal.kind === "receiver") {
      if (formal.node !== candidate) subjects.add(formal);
      else {
        const base = sourceStorageSuperConstructor(invocation, source, budget.step);
        add(ast.is.IsNewExpression(invocation) ? subject(invocation)
          : base !== undefined ? subject(base.owner, "receiver")
          : subjectFor(selected?.sourceReceiver?.expression ?? selected?.sourceCalleeAccess?.receiver.expression
            ?? semantics.forNode(invocation).operations.propertyAccess(invocation)?.receiver.expression));
      }
    } else {
      const index = ast.parameters(candidate).indexOf(formal.node);
      if (index === -1) subjects.add(formal);
      else {
        let bound = false;
        for (const binding of selected?.sourceArgumentBindings ?? []) {
          if (!budget.step()) break;
          if (binding.sourceParameterIndex !== index) continue;
          bound = true;
          add(subjectFor(selected?.sourceArguments[binding.sourceArgumentIndex]?.expression));
        }
        if (!bound) {
          const access = isAccessor(invocation) ? ast.parent(invocation) : undefined;
          const assignment = access === undefined || !ast.is.IsBinaryExpression(access) ? undefined : ast.as.AsBinaryExpression(access);
          const actual = assignment?.Left === invocation && ast.operatorKindName(access) === "KindEqualsToken" ? assignment.Right : undefined;
          const initializer = Node_Initializer(ast, formal.node);
          const argument = subjectFor(actual ?? initializer);
          if (actual === undefined && initializer !== undefined) context = "callee";
          if (argument === undefined) subjects.add(formal);
          else add(argument);
        }
      }
    }
    return { subjects, context };
  };
}
