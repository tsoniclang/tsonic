import type { SourceStorageProgram } from "../model/program.js";
import { sourceStorageValue } from "../model/program.js";
import type { SourceApplication, SourceArgumentPlace, SourceTypeEvidence, SourceSignatureIdentity, SourceTypeDescriptorSignature } from "../../../public/source/contracts.js";
import { sourceCallableSignatures, sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import { sourceBindingWriteAtReference } from "../../../source-navigation/references-usage.js";
import type { Node } from "@tsonic/tsts";
import { Node_Initializer, sourceTransparentExpressionOperand } from "../../../source-navigation/index.js";
import { sourcePresenceLiteralDisposition } from "../../../source-model/literals/domain.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageProjection, SourceStorageSubject } from "../../../source-model/storage.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalCallableValue, sourceStorageHasOriginalValue, sourceStorageObjectRestOwner } from "../model/subjects.js";
import { sourceSuperConstructor } from "../../../source-navigation/class-initialization.js";
import { sourceStorageComponentType, sourceStorageOriginalSignature, sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageArgumentTransport, SourceStorageCallbackEntry, SourceStorageCallableInputSlot, SourceStorageInvocationInputSlots, SourceStorageInputSlotsSelection } from "../../../source-model/storage.js";
import type { SourceStorageClassValue } from "../model/construction.js";
import type { SourceStorageAccessorInvocation } from "./scoped-model.js";

export function sourceStorageInvocationActual(
  source: SourceStorageProgram,
  selected: SourceApplication,
  binding: SourceArgumentPlace,
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
): { readonly subject: SourceStorageSubject; readonly sourceType: SourceTypeEvidence; readonly targetType: SourceTypeEvidence } | undefined {
  const argument = selected.sourceArguments[binding.sourceArgumentIndex];
  if (selected.argumentDisposition === "skip") return undefined;
  if (!selected.arguments.includes(binding)) throw new Error("Storage arguments require their identical Source application binding.");
  if (argument === undefined || argument.occurrence !== binding.sourceArgument) return undefined;
  const operand = sourceStorageValue(argument.operand);
  if (binding.sourceForm === "value") {
    const actual = argument.form !== "value" ? undefined : subjectFor(operand.occurrence);
    return actual === undefined ? undefined : Object.freeze({ subject: actual,
      sourceType: binding.source, targetType: binding.destination.applied });
  }
  const index = binding.spreadElementIndex;
  if (argument.form !== "spread") return undefined;
  const actual = subjectFor(operand.occurrence);
  if (actual === undefined) return undefined;
  if (binding.sourceForm === "spread-sequence") {
    if (binding.parameter.form !== "rest-sequence" || index !== undefined) return undefined;
    const component = Object.freeze({ kind: "array-element" as const });
    const originalType = sourceStorageComponentType(operand.value, component, source);
    if (originalType === undefined) return undefined;
    const projected = subject(actual.node, actual.kind, [...actual.projection, component]);
    return projected === undefined ? undefined : Object.freeze({ subject: projected,
      sourceType: binding.source, targetType: binding.destination.applied });
  }
  if (index === undefined || !Number.isSafeInteger(index) || index < 0) return undefined;
  if (operand.value.type.kind !== "tuple") return undefined;
  const element = operand.value.type.elements[index];
  if (element?.kind !== "required" && element?.kind !== "optional") return undefined;
  const projected = subject(actual.node, actual.kind, [...actual.projection, { kind: "tuple-element", index }]);
  return projected === undefined ? undefined : Object.freeze({ subject: projected,
    sourceType: binding.source, targetType: binding.destination.applied });
}

export function sourceStorageInvocationArgumentAbsence(
  source: SourceStorageProgram,
  selected: SourceApplication,
  binding: SourceArgumentPlace,
): "absent" | "present" | "possible" {
  const argument = selected.sourceArguments[binding.sourceArgumentIndex];
  if (selected.argumentDisposition === "skip" || argument === undefined) return "possible";
  if (!selected.arguments.includes(binding)) throw new Error("Storage absence requires its identical Source argument binding.");
  const disposition = sourcePresenceLiteralDisposition(source.analysis.literalDomain(binding.source));
  if (disposition === "absent") return "absent";
  if (binding.sourceForm === "spread-element") {
    const index = binding.spreadElementIndex;
    const operand = sourceStorageValue(argument.operand);
    const element = index === undefined || operand.value.type.kind !== "tuple" ? undefined : operand.value.type.elements[index];
    if (element?.kind !== "required") return "possible";
  } else if (binding.sourceForm !== "value") return "possible";
  return disposition === "present" ? "present" : "possible";
}

type SourceStorageCallableInputEvidence = {
  readonly signature: SourceSignatureIdentity;
  readonly value: SourceTypeEvidence;
};

function signatureFor(source: SourceStorageProgram, identity: SourceSignatureIdentity | undefined, value?: SourceTypeEvidence) {
  if (identity === undefined || value === undefined) return undefined;
  const candidates = sourceStorageValue(sourceCallableSignatures(source, value, source.work));
  const selected = candidates.filter(candidate => candidate.signature.identity === identity);
  return selected.length === 1 ? selected[0] : undefined;
}

function effectiveParameters(source: SourceStorageProgram, value: SourceTypeEvidence, signature: SourceTypeDescriptorSignature,
  step: () => boolean) {
  const selected: { readonly parameter: Node | undefined; readonly sourceParameterIndex: number;
    readonly effectiveIndex: number; readonly repeated: boolean; readonly acceptsOmission: boolean;
    readonly type: SourceTypeEvidence | undefined; readonly projection: readonly SourceStorageProjection[] | undefined }[] = [];
  for (const [index, parameter] of signature.parameters.entries()) {
    if (!step()) return undefined;
    const component = sourceStorageValue(source.facts.descriptors.component(value,
      { kind: "parameter", signature: signature.identity, index }));
    const original = { parameter: parameter.declaration, sourceParameterIndex: index };
    if (parameter.kind !== "rest") {
      selected.push({ ...original, effectiveIndex: selected.length, repeated: false,
        acceptsOmission: parameter.kind === "optional", type: component, projection: Object.freeze([]) });
      continue;
    }
    const type = sourceStorageValue(source.facts.descriptors.definition(component));
    if (type.type.kind === "tuple") {
      for (const [ordinal, element] of type.type.elements.entries()) {
        if (!step()) return undefined;
        const projection = element.kind === "rest" ? undefined
          : Object.freeze([Object.freeze({ kind: "tuple-element" as const, index: ordinal })]);
        const child = projection === undefined ? undefined : sourceStorageValue(source.facts.descriptors.component(type,
          { kind: "tuple-element", index: ordinal }));
        selected.push({ ...original, effectiveIndex: selected.length, repeated: element.kind === "rest",
          acceptsOmission: element.kind !== "required", type: child, projection });
      }
    } else {
      const child = sourceStorageComponentType(type, { kind: "array-element" }, source);
      selected.push({ ...original, effectiveIndex: selected.length, repeated: true, acceptsOmission: true,
        type: child, projection: child === undefined ? undefined : Object.freeze([Object.freeze({ kind: "array-element" as const })]) });
    }
  }
  return Object.freeze(selected);
}

export function sourceStorageCallableInputSlots(source: SourceStorageProgram, declaration: Node,
  evidence: SourceStorageCallableInputEvidence,
  step: () => boolean): readonly SourceStorageCallableInputSlot[] | undefined {
  const { ast } = source;
  source.facts.navigation.callableRoles(declaration);
  const original = signatureFor(source, evidence.signature, evidence.value);
  if (original === undefined || original.signature.identity.declaration !== declaration) return undefined;
  const parameters = effectiveParameters(source, original.value, original.signature, step);
  if (parameters === undefined) return undefined;
  const slots: SourceStorageCallableInputSlot[] = [];
  for (const selected of parameters) {
    if (!step()) return undefined;
    const parameter = selected.parameter;
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) || ast.parent(parameter) !== declaration ||
      !source.facts.navigation.includes(parameter)) return undefined;
    slots.push(Object.freeze({ parameter, sourceParameterIndex: selected.sourceParameterIndex,
      effectiveIndex: selected.effectiveIndex, repeated: selected.repeated, projection: selected.projection }));
  }
  return Object.freeze(slots);
}

export type SourceStorageInvocationSelectionKey = Node | SourceStorageCallbackEntry | SourceStorageAccessorInvocation;

export type SourceStorageInvocationInputSelectionQuery = (declaration: Node, invocation: Node | undefined,
  callback?: SourceStorageCallbackEntry) => SourceStorageInvocationInputSlots | undefined;

export function sourceStorageSelectedInputSlots(selection: SourceStorageInvocationInputSlots | undefined,
  declaration: Node): readonly SourceStorageCallableInputSlot[] | undefined {
  const selected = selection?.implementations.find(input => input.declaration === declaration)?.selected;
  if (selected?.kind === "resolved") return selected.slots;
  return selection?.selectedDeclaration === declaration && selection.selected.kind === "resolved"
    ? selection.selected.slots : undefined;
}

export function sourceStorageInvocationInputSelection(source: SourceStorageProgram, key: SourceStorageInvocationSelectionKey,
  nodes: ReadonlySet<Node>, exact: boolean, step: () => boolean, retain: (cost: number) => boolean,
  read: (declaration: Node) => SourceStorageInvocationInputSlots | undefined): SourceStorageInvocationInputSlots | undefined {
  const { ast } = source;
  const entry = "kind" in key && (key.kind === "source-storage-callback-entry" || key.kind === "source-storage-accessor-entry") ? key : undefined;
  const node = "invocation" in key ? key.invocation : key;
  const selectedCall = entry === undefined && (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node))
    ? sourceStorageValue(source.facts.applications.application(node)) : undefined;
  let signature = selectedCall?.identity.signature;
  let callable = selectedCall?.callee.value;
  let declaration: Node | undefined;
  if (entry?.kind === "source-storage-callback-entry") {
    callable = entry.argument.binding.destination.applied;
    const signatures = sourceStorageValue(sourceCallableSignatures(source, callable, source.work))
      .filter(candidate => candidate.signature.identity.kind === "call");
    signature = signatures.length === 1 ? signatures[0]!.signature.identity : undefined;
  } else if (entry?.kind === "source-storage-accessor-entry") {
    declaration = entry.declaration;
    const original = sourceStorageOriginalSignature(source, declaration,
      source.facts.navigation.callableRoles(declaration).body ? "body" : "signature");
    signature = original?.signature.identity;
    callable = original?.value;
  } else if (selectedCall === undefined) {
    declaration = node;
    const original = sourceStorageOriginalSignature(source, node,
      source.facts.navigation.callableRoles(node).body ? "body" : "signature");
    signature = original?.signature.identity;
    callable = original?.value;
  }
  declaration ??= signature?.declaration;
  const unresolved: SourceStorageInputSlotsSelection = Object.freeze({ kind: "unresolved",
    reason: "Source storage invocation inputs require their exact checked selected signature and implementation parameters." });
  const included = declaration !== undefined && source.facts.navigation.includes(declaration);
  const implementationDeclaration = declaration !== undefined && included && source.facts.navigation.callableRoles(declaration).body
    ? declaration : undefined;
  const canonical = implementationDeclaration === undefined || implementationDeclaration === key
    ? undefined : read(implementationDeclaration);
  if (implementationDeclaration !== undefined && implementationDeclaration !== key && canonical === undefined)
    return undefined;
  const shared = canonical !== undefined && canonical.signature === signature;
  const selectedSlots = shared || declaration === undefined || signature === undefined || callable === undefined ? undefined
    : sourceStorageCallableInputSlots(source, declaration, { signature, value: callable }, step);
  const selected: SourceStorageInputSlotsSelection = shared ? canonical.selected : selectedSlots === undefined ? unresolved
    : Object.freeze({ kind: "resolved", slots: selectedSlots });
  const implementations: { readonly declaration: Node; readonly selected: SourceStorageInputSlotsSelection }[] = [];
  for (const candidate of nodes) {
    if (!step()) return undefined;
    let body: SourceStorageInputSlotsSelection = unresolved;
    if (ast.body(candidate) !== undefined && source.facts.navigation.includes(candidate)) {
      if (candidate === key) body = exact && candidate === declaration ? selected : unresolved;
      else {
        const implementation = candidate === declaration ? canonical : read(candidate);
        if (implementation === undefined) return undefined;
        const published = implementation.implementations.find(input => input.declaration === candidate)?.selected;
        if (published?.kind === "resolved") body = candidate === declaration ? selected : published;
      }
    }
    if (!retain(1)) return undefined;
    implementations.push(Object.freeze({ declaration: candidate, selected: body }));
  }
  if (!retain(1 + (selectedSlots?.length ?? 0))) return undefined;
  const implementation = exact && implementations.length !== 0 && implementations.every(input => input.selected.kind === "resolved")
    ? Object.freeze({ kind: "resolved" as const }) : unresolved;
  const data = { signature, selectedDeclaration: declaration, selected, implementation, implementations: Object.freeze(implementations) };
  if (entry?.kind === "source-storage-callback-entry") return Object.freeze({ ...data, kind: "native-callback", entry });
  if (entry?.kind === "source-storage-accessor-entry") {
    const write = sourceBindingWriteAtReference(ast, node);
    const value = write?.values.length === 1 && write.values[0]?.kind === "value" && write.values[0].projection.length === 0
      ? write.values[0].expression : undefined;
    return Object.freeze({ ...data, kind: ast.is.IsSetAccessorDeclaration(entry.declaration) ? "setter" : "getter",
      invocation: node, accessor: entry.declaration, value });
  }
  return ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)
    ? Object.freeze({ ...data, kind: ast.is.IsNewExpression(node) ? "construct" : "call", invocation: node })
    : Object.freeze({ ...data, kind: "signature", declaration: node });
}

export interface SourceStorageNativeInputSlot {
  readonly parameterIndex: number;
  readonly type: SourceTypeEvidence | undefined;
  readonly absent: boolean;
  readonly acceptsOmission: boolean;
  readonly projection: readonly SourceStorageProjection[];
}

export function sourceStorageNativeInputSlots(source: SourceStorageProgram, declaration: Node,
  formal: SourceStorageSubject, selection: SourceStorageInvocationInputSlots | undefined,
  step: () => boolean): readonly SourceStorageNativeInputSlot[] | undefined {
  const signature = selection?.kind === "native-callback" ? selection.signature : undefined;
  const inputs = sourceStorageSelectedInputSlots(selection, declaration);
  if (signature === undefined || inputs === undefined) return undefined;
  const original = selection?.kind !== "native-callback" ? undefined
    : signatureFor(source, signature, selection.entry.argument.binding.destination.applied);
  const parameters = original === undefined ? undefined : effectiveParameters(source, original.value, original.signature, step);
  if (parameters === undefined) return undefined;
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
    const restIndex = last?.repeated === true ? parameters.length - 1 : undefined;
    const maximum = input.repeated ? Math.max(input.effectiveIndex + 1, parameters.length) : input.effectiveIndex + 1;
    for (let parameterIndex = input.effectiveIndex; parameterIndex < maximum; parameterIndex += 1) {
      if (!step()) return undefined;
      const native = parameters[parameterIndex] ?? (restIndex !== undefined && parameterIndex >= restIndex ? last : undefined);
      let type = native?.type;
      for (const component of projection) {
        if (!step()) return undefined;
        type = type === undefined ? undefined : sourceStorageComponentType(type, component, source);
      }
      selected.push(Object.freeze({ parameterIndex, type, absent: native === undefined,
        acceptsOmission: native === undefined || native.acceptsOmission, projection }));
    }
  }
  return selected.length === 0 ? undefined : Object.freeze(selected);
}

export function sourceStorageNativeCallablePayloads<Bindings>(source: SourceStorageProgram, budget: SourceStorageBudget,
  invocation: Node, bindings: Bindings, queries: {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    inputsFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
    valuesFor(subject: SourceStorageSubject, bindings: Bindings): {
      readonly values: readonly SourceStorageClassValue<Bindings>[]; readonly complete: boolean;
    } | undefined;
    componentFor(value: SourceStorageClassValue<Bindings>, component: SourceStorageProjection): SourceStorageSubject | undefined;
    componentsFor(value: SourceStorageSubject): readonly SourceStorageProjection[] | undefined;
    callbackEntriesFor(invocation: Node): readonly SourceStorageCallbackEntry[];
    hasOnlySourceImplementations(invocation: Node): boolean;
  }): { readonly values: readonly SourceStorageClassValue<Bindings>[];
    readonly uncertain: readonly SourceStorageClassValue<Bindings>[]; readonly complete: boolean } | undefined {
  return budget.withRows(rows => {
    const { ast } = source;
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
      const selected = sourceStorageValue(source.facts.applications.application(invocation));
      if (selected.argumentDisposition === "skip") return true;
      const callbacks = queries.callbackEntriesFor(invocation);
      for (const [index, argument] of selected.sourceArguments.entries()) {
        if (!budget.step()) return false;
        if (callbacks.some(callback => callback.argument.binding.sourceArgumentIndex === index)) continue;
        if (!schedule(queries.subjectFor(sourceStorageValue(argument.operand).occurrence), bindings)) return false;
      }
      const receiver = selected.receiver.kind === "value" ? selected.receiver.occurrence : undefined;
      return receiver === undefined || schedule(queries.subjectFor(receiver), bindings);
    };
    if (!inputs(invocation, bindings)) return undefined;
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const selected = pending.pop()!;
      if (selected.subject.kind === "value" && selected.subject.projection.length === 0) {
        const node = selected.subject.node;
        if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
          if (!queries.hasOnlySourceImplementations(node) && !inputs(node, selected.bindings)) return undefined;
        } else if (ast.is.IsIdentifier(node) || ast.is.IsVariableDeclaration(node) || ast.is.IsBindingElement(node) ||
          sourceTransparentExpressionOperand(ast, node) !== undefined) {
          for (const original of queries.inputsFor(selected.subject))
            if (!schedule(original, selected.bindings)) return undefined;
        }
      }
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
        const type = sourceStorageSubjectType(source, producer.subject);
        const alternatives = type === undefined ? [] : type.sum?.arms ?? [type];
        if ((type === undefined || alternatives.some(alternative =>
          alternative.type.kind === "intrinsic" && (alternative.type.intrinsic === "any" || alternative.type.intrinsic === "unknown") ||
          alternative.type.kind === "parameter" || alternative.type.kind === "projection" ||
          sourceStorageValue(sourceCallableSignatures(source, alternative, source.work)).length !== 0)) && !markUncertain(producer)) return undefined;
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
        if ((ast.is.IsNewExpression(node) || ast.is.IsCallExpression(node)) && !queries.hasOnlySourceImplementations(node) &&
          !schedule(producer.subject, producer.bindings)) return undefined;
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

export function createSourceStorageInvocationOrigins(source: SourceStorageProgram, budget: SourceStorageBudget,
  queries: {
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
    incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
    isUnresolved(invocation: Node): boolean;
  }) {
  return (origin: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject> | undefined => {
    if (queries.isUnresolved(invocation)) return undefined;
    const selected = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate) ? undefined
      : sourceStorageValue(sourceCallableValueParameters(source, candidate, undefined));
    const parameters = selected === undefined ? [] : selected.kind === "present" ? selected.value : undefined;
    if (parameters === undefined) return undefined;
    const slots = sourceStorageSelectedInputSlots(queries.inputSlotsFor(candidate, invocation), candidate);
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
  source: SourceStorageProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
  accessorTargets: ReadonlyMap<Node, readonly SourceStorageAccessorInvocation[]>,
  isUnresolved: (invocation: Node) => boolean,
  rejectionOriginsFor: (receiver: Node, formal: SourceStorageSubject) => readonly SourceStorageSubject[] | undefined,
  inputSlotsFor: SourceStorageInvocationInputSelectionQuery,
  argumentTransports: ReadonlyMap<Node, readonly SourceStorageArgumentTransport[]>,
): SourceStorageInvocationInputQuery {
  const { ast } = source;
  return (formal, candidate, invocation, callback) => {
    const subjects = new Set<SourceStorageSubject>();
    const calleeSubjects = new Set<SourceStorageSubject>();
    let context: SourceStorageInvocationInputs["context"] = "caller";
    let omitted = false;
    if (isUnresolved(invocation)) {
      subjects.add(formal);
      return { subjects, context: "callee", omitted };
    }
    const selected = ast.is.IsCallExpression(invocation) || ast.is.IsNewExpression(invocation)
      ? sourceStorageValue(source.facts.applications.application(invocation)) : undefined;
    if (selected?.argumentDisposition === "skip") return { subjects, context, omitted };
    if (callback !== undefined) {
      if (selected === undefined || !selected.arguments.includes(callback.argument.binding)) {
        subjects.add(formal);
        return { subjects, context: "callee", omitted };
      }
      const nativeInputs = sourceStorageNativeInputSlots(source, candidate, formal,
        inputSlotsFor(candidate, invocation, callback), budget.step);
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
          const receiver = selected.receiver.kind === "value" ? selected.receiver.occurrence : undefined;
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
        if (input?.from === "receiver-element") receiver = selected.receiver.kind === "value" ? selected.receiver.occurrence : undefined;
        else if (input?.from === "argument-element") {
          const bindings = selected.arguments.filter(binding => binding.parameter.index === input.sourceParameterIndex);
          if (bindings.length === 1 && bindings[0]!.sourceForm === "value" && bindings[0]!.parameter.form === "parameter") {
            const argument = selected.sourceArguments[bindings[0]!.sourceArgumentIndex];
            receiver = argument === undefined ? undefined : sourceStorageValue(argument.operand).occurrence;
          }
        }
        const type = receiver === undefined ? undefined : sourceStorageValue(source.facts.values.type(receiver));
        const owner = receiver === undefined || type === undefined ||
          sourceStorageComponentType(type, { kind: "array-element" }, source) === undefined ? undefined : subjectFor(receiver);
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
        const base = sourceStorageValue(sourceSuperConstructor(invocation, source, budget.step));
        const access = selected === undefined && (ast.is.IsPropertyAccessExpression(invocation) || ast.is.IsElementAccessExpression(invocation))
          ? sourceStorageValue(source.facts.objects.use(invocation)) : undefined;
        add(ast.is.IsNewExpression(invocation) ? subject(invocation)
          : base !== undefined ? subject(base.owner, "receiver")
          : subjectFor(accessorTargets.get(invocation)?.find(target => target.declaration === candidate)?.receiver
            ?? (selected?.receiver.kind === "value" ? selected.receiver.occurrence : undefined)
            ?? access?.receiver.occurrence));
      }
    } else {
      const mapping = inputSlotsFor(candidate, invocation);
      const slots = sourceStorageSelectedInputSlots(mapping, candidate);
      const owned = slots?.filter(slot => slot.parameter === formal.node);
      if (owned === undefined || owned.length === 0) subjects.add(formal);
      else {
        const initializer = Node_Initializer(ast, formal.node);
        let bound = false;
        let matched = false;
        const arguments_ = argumentTransports.get(invocation);
        if (selected !== undefined && (mapping?.kind === "call" || mapping?.kind === "construct") && arguments_ === undefined)
          throw new Error("Selected source storage invocation actuals were not published before their consumers.");
        for (const argument of arguments_ ?? []) {
          if (!budget.step()) break;
          const binding = argument.binding;
          for (const slot of owned) {
            if (!budget.step()) break;
            if (binding.parameter.index !== slot.sourceParameterIndex ||
              binding.effectiveArgumentIndex !== slot.effectiveIndex && !(slot.repeated && binding.effectiveArgumentIndex >= slot.effectiveIndex) ||
              slot.projection === undefined) continue;
            const component = slot.projection[0];
            const wanted = formal.projection[0];
            if (component !== undefined && (wanted === undefined || wanted.kind !== "array-element" &&
              (wanted.kind !== "tuple-element" || component.kind !== "tuple-element" || wanted.index !== component.index))) continue;
            matched = true;
            const origin = subject(argument.actual.node, argument.actual.kind,
              [...argument.actual.projection, ...(component === undefined ? formal.projection : formal.projection.slice(1))]);
            if (origin !== undefined) {
              bound = true;
              subjects.add(origin);
            }
          }
        }
        if (!bound && matched) subjects.add(formal);
        else if (!bound) {
          const actual = mapping?.kind === "setter" ? mapping.value : undefined;
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
