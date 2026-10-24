import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import type { Node, Signature, Type } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../../source-navigation/index.js";
import type { ResolvedSourceCallInfo, SourceFileSemantics, TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalCallableValue, sourceStorageHasOriginalValue, sourceStorageObjectRestOwner } from "../model/subjects.js";
import { sourceStorageSuperConstructor } from "../model/construction.js";
import { sourceStorageComponentType, sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";
import type { SourceStorageClassValue } from "../model/construction.js";
import type { SourceStorageAccessorInvocation } from "./scoped-model.js";

export interface SourceStorageCallableInputSlot {
  readonly parameter: Node;
  readonly sourceParameterIndex: number;
  readonly effectiveIndex: number;
  readonly repeated: boolean;
  readonly projection: readonly SourceStorageProjection[] | undefined;
}

export function sourceStorageInvocationActual(
  source: TargetSourceProgram,
  selected: ResolvedSourceCallInfo,
  binding: ResolvedSourceCallInfo["sourceArgumentBindings"][number],
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
): SourceStorageSubject | undefined {
  const argument = selected.sourceArguments[binding.sourceArgumentIndex];
  if (argument === undefined) return undefined;
  const { ast, semantics } = source;
  if (binding.sourceForm === "value") return ast.is.IsSpreadElement(argument.expression)
    ? undefined : subjectFor(argument.expression);
  const index = binding.spreadElementIndex;
  const file = ast.getSourceFile(argument.expression);
  if (binding.sourceForm !== "spread-element" || index === undefined || !Number.isSafeInteger(index) || index < 0 ||
    !ast.is.IsSpreadElement(argument.expression) || file === undefined || !semantics.includes(file)) return undefined;
  const types = semantics.forFile(file).types;
  if (!types.isTuple(argument.type)) return undefined;
  const element = types.tupleElementInfos(argument.type)[index];
  if (element?.elementKind !== "required" && element?.elementKind !== "optional") return undefined;
  const actual = subjectFor(Node_Expression(ast, argument.expression));
  return actual === undefined ? undefined : subject(actual.node, actual.kind,
    [...actual.projection, { kind: "tuple-element", index }]);
}

export function sourceStorageInvocationArgumentAbsence(
  source: TargetSourceProgram,
  selected: ResolvedSourceCallInfo,
  binding: ResolvedSourceCallInfo["sourceArgumentBindings"][number],
): "absent" | "present" | "possible" {
  const argument = selected.sourceArguments[binding.sourceArgumentIndex];
  const file = argument === undefined ? undefined : source.ast.getSourceFile(argument.expression);
  if (argument === undefined || file === undefined || !source.semantics.includes(file)) return "possible";
  const types = source.semantics.forFile(file).types;
  const type = binding.selectedArgumentType;
  if (types.isNullish(type) || types.isVoidLike(type)) return "absent";
  if (binding.sourceForm === "spread-element") {
    const index = binding.spreadElementIndex;
    const element = index === undefined || !types.isTuple(argument.type) ? undefined : types.tupleElementInfos(argument.type)[index];
    if (element?.elementKind !== "required") return "possible";
  } else if (binding.sourceForm !== "value") return "possible";
  const present = types.nonNullableType(type);
  return types.isAny(type) || types.isUnknown(type) || present === undefined || !types.isIdentical(type, present)
    ? "possible" : "present";
}

type SourceStorageCallableInputEvidence = {
  readonly kind: "selected-signature" | "source-implementation";
  readonly signature: Signature | undefined;
};

export function sourceStorageCallableInputSlots(source: TargetSourceProgram, declaration: Node,
  semantics: SourceFileSemantics, evidence: SourceStorageCallableInputEvidence,
  step: () => boolean): readonly SourceStorageCallableInputSlot[] | undefined {
  const { ast } = source;
  if (!source.semantics.includes(semantics.sourceFile)) return undefined;
  const contract = evidence.signature === undefined ? undefined : semantics.declarations.signatureDeclaration(evidence.signature);
  if (evidence.signature !== undefined && contract === undefined) return undefined;
  if (evidence.kind === "source-implementation") {
    const file = ast.getSourceFile(declaration);
    if (file === undefined || !source.semantics.includes(file) || ast.body(declaration) === undefined) return undefined;
  }
  const signature = evidence.kind === "source-implementation" && contract !== declaration
    ? semantics.declarations.declarationSignature(declaration) : evidence.signature;
  if (signature === undefined || semantics.declarations.signatureDeclaration(signature) !== declaration) return undefined;
  const parameters = sourceCallableValueParameters(ast, declaration, semantics,
    { kind: "selected-invocation", signature });
  if (parameters === undefined) return undefined;
  const symbols = semantics.declarations.signatureParameters(signature);
  const effectiveParameters = semantics.types.signatureParameterInfos(signature);
  const slots: SourceStorageCallableInputSlot[] = [];
  for (const [effectiveIndex, selected] of effectiveParameters.entries()) {
    if (!step()) return undefined;
    const owners = semantics.declarations.symbolDeclarations(selected.sourceSymbol).filter(node => parameters.includes(node));
    const parameter = owners.length === 1 ? owners[0] : undefined;
    const sourceParameterIndex = symbols.indexOf(selected.sourceSymbol);
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) || sourceParameterIndex < 0) return undefined;
    const rest = ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined;
    let projection: readonly SourceStorageProjection[] | undefined = Object.freeze([]);
    let repeated = false;
    if (rest) {
      const type = semantics.types.typeOfSymbol(selected.sourceSymbol);
      if (type !== undefined && semantics.types.isTuple(type)) {
        const elements = semantics.types.tupleElementInfos(type);
        const group = effectiveParameters.filter(candidate => candidate.sourceSymbol === selected.sourceSymbol);
        const index = group.indexOf(selected);
        const element = elements[index];
        projection = group.length === elements.length && (element?.elementKind === "required" || element?.elementKind === "optional")
          ? Object.freeze([Object.freeze({ kind: "tuple-element" as const, index })]) : undefined;
      } else if (type !== undefined && semantics.types.isArrayLike(type) && selected.parameterKind === "rest") {
        projection = Object.freeze([Object.freeze({ kind: "array-element" as const })]);
        repeated = true;
      } else projection = undefined;
    }
    slots.push(Object.freeze({ parameter, sourceParameterIndex, effectiveIndex, repeated, projection }));
  }
  return Object.freeze(slots);
}

export interface SourceStorageNativeInputSlot {
  readonly parameterIndex: number;
  readonly type: Type | undefined;
  readonly absent: boolean;
  readonly acceptsOmission: boolean;
  readonly projection: readonly SourceStorageProjection[];
}

export function sourceStorageNativeInputSlots(source: TargetSourceProgram, declaration: Node,
  formal: SourceStorageSubject, contextualType: Type, semantics: SourceFileSemantics,
  step: () => boolean): readonly SourceStorageNativeInputSlot[] | undefined {
  const present = semantics.types.nonNullableType(contextualType);
  const signatures = present === undefined ? [] : semantics.types.callSignatures(present);
  const signature = signatures.length === 1 ? signatures[0] : undefined;
  const inputs = sourceStorageCallableInputSlots(source, declaration, semantics,
    { kind: "source-implementation", signature: undefined }, step);
  if (signature === undefined || inputs === undefined) return undefined;
  const parameters = semantics.types.signatureParameterInfos(signature);
  const matching = inputs.filter(input => input.parameter === formal.node);
  if (matching.length === 0) return undefined;
  const selected: SourceStorageNativeInputSlot[] = [];
  for (const input of matching) {
    if (!step() || input.projection === undefined) return undefined;
    const component = input.projection[0];
    let projection = formal.projection;
    if (component !== undefined) {
      const wanted = projection[0];
      if (wanted === undefined) return undefined;
      if (wanted.kind !== "array-element" && (wanted.kind !== "tuple-element" ||
        component.kind !== "tuple-element" || wanted.index !== component.index)) continue;
      projection = projection.slice(1);
    }
    const last = parameters[parameters.length - 1];
    const restIndex = last?.parameterKind === "rest" ? parameters.length - 1 : undefined;
    const maximum = input.repeated ? Math.max(input.effectiveIndex + 1, parameters.length) : input.effectiveIndex + 1;
    for (let parameterIndex = input.effectiveIndex; parameterIndex < maximum; parameterIndex += 1) {
      if (!step()) return undefined;
      const native = parameters[parameterIndex] ?? (restIndex !== undefined && parameterIndex >= restIndex ? last : undefined);
      let type = native?.type;
      if (native?.parameterKind === "rest" && type !== undefined)
        type = sourceStorageComponentType(type, { kind: "array-element" }, semantics, source.ast);
      for (const component of projection) {
        if (!step()) return undefined;
        type = type === undefined ? undefined : sourceStorageComponentType(type, component, semantics, source.ast);
      }
      selected.push(Object.freeze({ parameterIndex, type, absent: native === undefined,
        acceptsOmission: native === undefined || native.acceptsOmission, projection }));
    }
  }
  return selected.length === 0 ? undefined : Object.freeze(selected);
}

export function sourceStorageNativeCallablePayloads<Bindings>(source: TargetSourceProgram, budget: SourceStorageBudget,
  invocation: Node, bindings: Bindings, queries: {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    valuesFor(subject: SourceStorageSubject, bindings: Bindings): {
      readonly values: readonly SourceStorageClassValue<Bindings>[]; readonly complete: boolean;
    } | undefined;
    componentFor(value: SourceStorageClassValue<Bindings>, component: SourceStorageProjection): SourceStorageSubject | undefined;
    componentsFor(value: SourceStorageSubject): readonly SourceStorageProjection[] | undefined;
    callbackEntriesFor(invocation: Node): readonly SourceStorageCallbackEntry[];
    hasSourceImplementation(invocation: Node): boolean;
  }): { readonly values: readonly SourceStorageClassValue<Bindings>[];
    readonly uncertain: readonly SourceStorageClassValue<Bindings>[]; readonly complete: boolean } | undefined {
  return budget.withRows(rows => {
    const { ast, semantics } = source;
    const pending: SourceStorageClassValue<Bindings>[] = [];
    const visited = new Map<Bindings, Set<SourceStorageSubject>>();
    const values: SourceStorageClassValue<Bindings>[] = [];
    const uncertain: SourceStorageClassValue<Bindings>[] = [];
    let complete = true;
    const markUncertain = (value: SourceStorageClassValue<Bindings>): boolean => {
      complete = false;
      if (uncertain.some(previous => previous.subject === value.subject && previous.bindings === value.bindings)) return true;
      if (!rows.add(1)) return false;
      uncertain.push(value); return true;
    };
    const schedule = (subject: SourceStorageSubject | undefined, bindings: Bindings): boolean => {
      if (subject === undefined) { complete = false; return true; }
      const previous = visited.get(bindings);
      if (previous?.has(subject)) return true;
      if (!budget.step() || !rows.add(previous === undefined ? 3 : 2)) return false;
      const selected = previous ?? new Set<SourceStorageSubject>();
      selected.add(subject); visited.set(bindings, selected);
      pending.push({ subject, bindings });
      return true;
    };
    const inputs = (invocation: Node, bindings: Bindings): boolean => {
      const selected = semantics.forNode(invocation).operations.call(invocation);
      if (selected === undefined) { complete = false; return true; }
      const callbacks = queries.callbackEntriesFor(invocation);
      for (const [index, argument] of selected.sourceArguments.entries()) {
        if (!budget.step()) return false;
        if (callbacks.some(callback => callback.argument.binding.sourceArgumentIndex === index)) continue;
        if (!schedule(queries.subjectFor(argument.expression), bindings)) return false;
      }
      const receiver = selected.sourceReceiver?.expression ?? selected.sourceCalleeAccess?.receiver.expression;
      return receiver === undefined || schedule(queries.subjectFor(receiver), bindings);
    };
    if (!inputs(invocation, bindings)) return undefined;
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const selected = pending.pop()!;
      const producers = queries.valuesFor(selected.subject, selected.bindings);
      if (producers === undefined) {
        if (budget.failure() !== undefined) return undefined;
        if (!markUncertain(selected)) return undefined;
        continue;
      }
      complete &&= producers.complete;
      if (!producers.complete && !markUncertain(selected)) return undefined;
      for (const producer of producers.values) {
        if (!budget.step()) return undefined;
        if (sourceStorageHasOriginalCallableValue(producer.subject, ast)) {
          if (!values.some(value => value.subject === producer.subject && value.bindings === producer.bindings)) {
            if (!rows.add(1)) return undefined;
            values.push(producer);
          }
          continue;
        }
        const node = producer.subject.node;
        const context = semantics.forNode(node);
        const type = sourceStorageSubjectType(source, producer.subject);
        const alternatives = type === undefined ? [] : context.types.isUnion(type) || context.types.isIntersection(type)
          ? context.types.unionOrIntersectionTypes(type) : [type];
        if ((type === undefined || alternatives.some(alternative => {
          const symbol = context.declarations.typeSymbol(alternative);
          return context.types.isAny(alternative) || context.types.isUnknown(alternative) ||
            context.types.callSignatures(alternative).length !== 0 || context.types.constructSignatures(alternative).length !== 0 ||
            symbol !== undefined && context.declarations.symbolDeclarations(symbol).some(declaration => ast.is.IsTypeParameterDeclaration(declaration));
        })) && !markUncertain(producer)) return undefined;
        if (producer.subject.kind === "value" && (ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node) ||
          ast.is.IsNewExpression(node) || ast.is.IsCallExpression(node) || ast.is.IsBindingElement(node))) {
          const components = queries.componentsFor(producer.subject);
          if (components === undefined) { if (!markUncertain(producer)) return undefined; }
          else for (const component of components) {
            const selected = queries.componentFor(producer, component);
            if ((component.kind === "member" || component.kind === "method-value") && ast.is.IsGetAccessorDeclaration(component.declaration) &&
              (ast.parent(component.declaration) === node || !ast.is.IsObjectLiteralExpression(node) &&
                sourceStorageObjectRestOwner(node, ast) === undefined) &&
              (selected?.kind !== "return" || selected.node !== component.declaration)) {
              if (!markUncertain(producer)) return undefined;
              continue;
            }
            if (!budget.step() || !schedule(selected, producer.bindings)) return undefined;
          }
        }
        if (producer.subject.projection.length !== 0) continue;
        if ((ast.is.IsNewExpression(node) || ast.is.IsCallExpression(node)) && !queries.hasSourceImplementation(node) &&
          !inputs(node, producer.bindings)) return undefined;
      }
    }
    return budget.failure() === undefined ? Object.freeze({ values: Object.freeze(values), uncertain: Object.freeze(uncertain), complete }) : undefined;
  });
}

export interface SourceStorageInvocationInputs {
  readonly subjects: ReadonlySet<SourceStorageSubject>;
  readonly context: "caller" | "callee";
  readonly omitted: boolean;
  readonly calleeSubjects?: readonly SourceStorageSubject[];
}

export type SourceStorageInvocationInputQuery = (
  formal: SourceStorageSubject,
  candidate: Node,
  invocation: Node,
  callback?: SourceStorageCallbackEntry,
) => SourceStorageInvocationInputs;

export function createSourceStorageInvocationOrigins(source: TargetSourceProgram, budget: SourceStorageBudget,
  queries: {
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
    isUnresolved(invocation: Node): boolean;
  }) {
  return (origin: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject> | undefined => {
    if (queries.isUnresolved(invocation)) return undefined;
    const context = source.semantics.forNode(invocation);
    const parameters = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate) ? []
      : sourceCallableValueParameters(source.ast, candidate, source.semantics.forNode(candidate), { kind: "declaration" });
    if (parameters === undefined) return undefined;
    const slots = source.ast.body(candidate) === undefined ? undefined : sourceStorageCallableInputSlots(source, candidate, context,
      { kind: "source-implementation", signature: context.operations.call(invocation)?.selectedSignature }, budget.step);
    return budget.withRows(rows => {
      const origins = new Set<SourceStorageSubject>();
      const pending = [origin];
      const visited = new Set<SourceStorageSubject>();
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const current = pending.pop()!;
        if (visited.has(current)) continue;
        if (!rows.add(1)) return undefined;
        visited.add(current);
        if (source.ast.body(candidate) === undefined && current.projection.length === 0 &&
          source.ast.is.IsParameterDeclaration(current.node) && parameters.includes(current.node) &&
          source.ast.as.AsParameterDeclaration(current.node)?.DotDotDotToken !== undefined) {
          origins.add(current);
          continue;
        }
        if (current.kind === "receiver" || current.kind === "input") {
          if (current.kind === "input" && source.ast.body(candidate) !== undefined &&
            sourceStorageFormalOwner(current, source) === candidate) {
            const selected = slots?.filter(slot => slot.parameter === current.node);
            if (selected === undefined || selected.length === 0 || selected.some(slot => slot.repeated || slot.projection === undefined)) return undefined;
          }
          for (const input of queries.invocationInputs(current, candidate, invocation).subjects) {
            if (!budget.step()) return undefined;
            origins.add(input);
          }
        } else {
          const incoming = queries.incomingFor(current);
          if (sourceStorageHasOriginalValue(current, source.ast, incoming.size !== 0)) origins.add(current);
          for (const input of incoming) {
            if (!budget.step() || !rows.add(1)) return undefined;
            pending.push(input);
          }
        }
      }
      return origins;
    });
  };
}

export function createSourceStorageInvocationInputs(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
  accessorTargets: ReadonlyMap<Node, readonly SourceStorageAccessorInvocation[]>,
  isUnresolved: (invocation: Node) => boolean,
  rejectionOriginsFor: (receiver: Node, formal: SourceStorageSubject) => readonly SourceStorageSubject[] | undefined,
): SourceStorageInvocationInputQuery {
  const { ast, semantics } = source;
  return (formal, candidate, invocation, callback) => {
    const subjects = new Set<SourceStorageSubject>();
    const calleeSubjects = new Set<SourceStorageSubject>();
    let context: SourceStorageInvocationInputs["context"] = "caller";
    let omitted = false;
    if (isUnresolved(invocation)) {
      subjects.add(formal);
      return { subjects, context: "callee", omitted };
    }
    const consumer = semantics.forNode(invocation);
    const selected = consumer.operations.call(invocation);
    if (callback !== undefined) {
      if (selected === undefined || !selected.sourceArgumentBindings.some(binding =>
        binding.sourceArgumentIndex === callback.argument.binding.sourceArgumentIndex &&
        binding.sourceParameterIndex === callback.argument.binding.sourceParameterIndex &&
        binding.effectiveArgumentIndex === callback.argument.binding.effectiveArgumentIndex &&
        binding.sourceForm === callback.argument.binding.sourceForm &&
        binding.sourceParameterForm === callback.argument.binding.sourceParameterForm &&
        binding.spreadElementIndex === callback.argument.binding.spreadElementIndex &&
        binding.selectedArgumentType === callback.argument.binding.selectedArgumentType &&
        binding.selectedParameterType === callback.argument.binding.selectedParameterType)) {
        subjects.add(formal);
        return { subjects, context: "callee", omitted };
      }
      const types = consumer.types;
      const nativeInputs = sourceStorageNativeInputSlots(source, candidate, formal,
        callback.argument.binding.selectedParameterType, consumer, budget.step);
      const initializer = Node_Initializer(ast, formal.node);
      if (initializer !== undefined && nativeInputs?.some(input => input.absent)) {
        const root = subjectFor(initializer);
        const value = root === undefined ? undefined : subject(root.node, root.kind, [...root.projection, ...formal.projection]);
        if (value !== undefined) calleeSubjects.add(value);
      }
      if (nativeInputs === undefined) calleeSubjects.add(formal);
      for (const native of nativeInputs ?? []) {
        if (!budget.step()) break;
        if (native.absent) {
          if (initializer === undefined) calleeSubjects.add(formal);
          continue;
        }
        const input = callback.inputs?.find(input => input.parameterIndex === native.parameterIndex);
        if (input?.from === "receiver-rejection") {
          const receiver = selected.sourceReceiver?.expression;
          const rejected = receiver === undefined ? undefined : rejectionOriginsFor(receiver, formal);
          if (rejected === undefined || rejected.length === 0) calleeSubjects.add(formal);
          else for (const origin of rejected) {
            if (!budget.step()) break;
            const projected = subject(origin.node, origin.kind, [...origin.projection, ...native.projection]);
            if (projected !== undefined) subjects.add(projected);
          }
          continue;
        }
        let receiver: Node | undefined;
        if (input?.from === "receiver-element") receiver = selected.sourceReceiver?.expression;
        else if (input?.from === "argument-element") {
          const bindings = selected.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === input.sourceParameterIndex);
          if (bindings.length === 1 && bindings[0]!.sourceForm === "value" && bindings[0]!.sourceParameterForm === "parameter")
            receiver = selected.sourceArguments[bindings[0]!.sourceArgumentIndex]?.expression;
        }
        const type = receiver === undefined ? undefined : types.expressionType(receiver);
        const owner = receiver === undefined || type === undefined || !types.isArrayLike(type) ? undefined : subjectFor(receiver);
        const projected = owner === undefined ? undefined : subject(owner.node, owner.kind,
          [...owner.projection, { kind: "array-element" }, ...native.projection]);
        if (projected === undefined) calleeSubjects.add(formal);
        else subjects.add(projected);
      }
      omitted = initializer === undefined && nativeInputs !== undefined && nativeInputs.length !== 0 && nativeInputs.every(input => input.absent);
      return { subjects, context: initializer !== undefined && nativeInputs !== undefined && nativeInputs.length !== 0 &&
        nativeInputs.every(input => input.absent) ? "callee" : "caller", omitted,
        calleeSubjects: Object.freeze([...calleeSubjects]) };
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
          : subjectFor(accessorTargets.get(invocation)?.find(target => target.declaration === candidate)?.receiver
            ?? selected?.sourceReceiver?.expression ?? selected?.sourceCalleeAccess?.receiver.expression
            ?? semantics.forNode(invocation).operations.propertyAccess(invocation)?.receiver.expression));
      }
    } else {
      const contract = selected?.sourceSelectedSignatureKind === "resolved"
        ? consumer.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
      const slots = sourceStorageCallableInputSlots(source, candidate, consumer,
        { kind: contract === candidate && ast.body(candidate) === undefined ? "selected-signature" : "source-implementation",
          signature: selected?.selectedSignature }, budget.step);
      const owned = slots?.filter(slot => slot.parameter === formal.node);
      if (owned === undefined || owned.length === 0) subjects.add(formal);
      else {
        const initializer = Node_Initializer(ast, formal.node);
        let bound = false;
        let matched = false;
        for (const binding of selected?.sourceArgumentBindings ?? []) {
          if (!budget.step()) break;
          for (const slot of owned) {
            if (!budget.step()) break;
            if (binding.effectiveArgumentIndex !== slot.effectiveIndex && !(slot.repeated && binding.effectiveArgumentIndex >= slot.effectiveIndex) ||
              slot.projection === undefined) continue;
            const component = slot.projection[0];
            const wanted = formal.projection[0];
            if (component !== undefined && (wanted === undefined || wanted.kind !== "array-element" &&
              (wanted.kind !== "tuple-element" || component.kind !== "tuple-element" || wanted.index !== component.index))) continue;
            matched = true;
            const actual = selected === undefined ? undefined : sourceStorageInvocationActual(source, selected, binding, subject, subjectFor);
            const origin = actual === undefined ? undefined : subject(actual.node, actual.kind,
              [...actual.projection, ...(component === undefined ? formal.projection : formal.projection.slice(1))]);
            if (origin !== undefined) {
              bound = true;
              subjects.add(origin);
            }
          }
        }
        if (!bound && matched) subjects.add(formal);
        else if (!bound) {
          const access = accessorTargets.has(invocation) ? ast.parent(invocation) : undefined;
          const assignment = access === undefined || !ast.is.IsBinaryExpression(access) ? undefined : ast.as.AsBinaryExpression(access);
          const actual = assignment?.Left === invocation && ast.operatorKindName(access) === "KindEqualsToken" ? assignment.Right : undefined;
          const argument = subjectFor(actual ?? initializer);
          if (actual === undefined && initializer !== undefined) context = "callee";
          omitted = actual === undefined && initializer === undefined && selected !== undefined &&
            owned.every(slot => slot.projection !== undefined && slot.projection.length === 0);
          if (argument === undefined) subjects.add(formal);
          else add(argument);
        }
      }
    }
    return { subjects, context, omitted, calleeSubjects: Object.freeze([...calleeSubjects]) };
  };
}
