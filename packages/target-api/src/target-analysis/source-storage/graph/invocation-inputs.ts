import { sourceAnalysisIncludesFile, sourceAnalysisValueType, type SourceAnalysisProgram } from "../../analysis-program.js";
import { sourceTypeDescriptorOpenness } from "../../../source-semantics/local-type-flow/uses.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import { sourceBindingWriteAtReference } from "../../../source-navigation/references-usage.js";
import type { Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer, sourceTransparentExpressionOperand } from "../../../source-navigation/index.js";
import type { SourceNavigationCall, SourceNavigationCallBinding } from "../../../host-input/navigation.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorSignature } from "../../../source-semantics/local-type-flow/types.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalCallableValue, sourceStorageHasOriginalValue, sourceStorageObjectRestOwner } from "../model/subjects.js";
import { sourceSuperConstructor } from "../../../source-navigation/class-initialization.js";
import {
  sourcePresentStorageArms, sourceStorageArrayElementType, sourceStorageComponentType, sourceStorageIsAbsentType,
  sourceStorageIsArrayLikeType, sourceStorageSubjectType, sourceStorageTupleElements,
} from "../model/components.js";
import { sourceAnalysisCallSignatures, sourceAnalysisConstructSignatures, sourceAnalysisMayBeAbsent } from "../../analysis-program.js";
import { sourceTypeDescriptorStructure } from "../../../source-semantics/local-type-flow/terms.js";
import type { SourceStorageArgumentTransport, SourceStorageCallbackEntry, SourceStorageCallableInputSlot, SourceStorageInvocationInputSlots, SourceStorageInputSlotsSelection } from "../model/types.js";
import type { SourceStorageClassValue } from "../model/construction.js";
import type { SourceStorageAccessorInvocation } from "./scoped-model.js";

/** The receiver expression of a member call (`o.m()` → `o`), from the callee's member witness. */
export function sourceStorageCallReceiver(source: Pick<SourceAnalysisProgram, "ast" | "navigation">, selected: SourceNavigationCall): Node | undefined {
  let callee = selected.callee;
  while (source.ast.is.IsParenthesizedExpression(callee)) {
    const inner = source.ast.as.AsParenthesizedExpression(callee)?.Expression;
    if (inner === undefined) return undefined;
    callee = inner;
  }
  return source.ast.is.IsPropertyAccessExpression(callee) || source.ast.is.IsElementAccessExpression(callee)
    ? source.navigation.memberAccess(callee)?.receiver : undefined;
}

/**
 * The Host descriptor of the parameter a binding fills at a call: the instantiated parameter of the Host call selection,
 * else the declared parameter type. undefined when the Host refused it.
 */
export function sourceStorageBindingParameterType(source: SourceAnalysisProgram, selected: SourceNavigationCall,
  binding: SourceNavigationCallBinding): SourceTypeDescriptor | undefined {
  const selection = source.facts.selections.call(selected.call);
  if (selection !== undefined && selection.kind !== "refused") {
    const parameter = selection.parameters[binding.sourceParameterIndex];
    if (parameter !== undefined) return parameter.type;
  }
  const declaration = selected.parameters[binding.sourceParameterIndex]?.parameterDeclaration;
  return declaration === undefined ? undefined : sourceAnalysisValueType(source, declaration);
}

/**
 * The Host descriptor of the value a binding supplies: the argument's type for a value argument; for a spread, the
 * tuple element (spread-element) or the array element (spread-sequence) of the spread operand's type.
 */
export function sourceStorageBindingArgumentType(source: SourceAnalysisProgram, selected: SourceNavigationCall,
  binding: SourceNavigationCallBinding): SourceTypeDescriptor | undefined {
  const argument = selected.arguments[binding.sourceArgumentIndex];
  if (argument === undefined) return undefined;
  if (binding.sourceForm === "value") return sourceAnalysisValueType(source, argument);
  const operand = source.ast.is.IsSpreadElement(argument) ? Node_Expression(source.ast, argument) : undefined;
  const type = operand === undefined ? undefined : sourceAnalysisValueType(source, operand);
  if (type === undefined) return undefined;
  if (binding.sourceForm === "spread-sequence") return sourceStorageArrayElementType(source, type);
  const index = binding.spreadElementIndex;
  return index === undefined ? undefined : sourceStorageComponentType(source, type, { kind: "tuple-element", index });
}

export function sourceStorageInvocationActual(
  source: SourceAnalysisProgram,
  selected: SourceNavigationCall,
  binding: SourceNavigationCallBinding,
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
): { readonly subject: SourceStorageSubject; readonly sourceType: SourceTypeDescriptor | undefined;
  readonly targetType: SourceTypeDescriptor | undefined } | undefined {
  const argument = selected.arguments[binding.sourceArgumentIndex];
  if (argument === undefined) return undefined;
  const { ast } = source;
  const typed = (projected: SourceStorageSubject) => Object.freeze({ subject: projected,
    sourceType: sourceStorageBindingArgumentType(source, selected, binding),
    targetType: sourceStorageBindingParameterType(source, selected, binding) });
  if (binding.sourceForm === "value") {
    const actual = ast.is.IsSpreadElement(argument) ? undefined : subjectFor(argument);
    return actual === undefined ? undefined : typed(actual);
  }
  const index = binding.spreadElementIndex;
  if (!ast.is.IsSpreadElement(argument) || !sourceAnalysisIncludesFile(source, ast.getSourceFile(argument))) return undefined;
  const operand = Node_Expression(ast, argument);
  const operandType = operand === undefined ? undefined : sourceAnalysisValueType(source, operand);
  const actual = subjectFor(operand);
  if (actual === undefined || operandType === undefined) return undefined;
  if (binding.sourceForm === "spread-sequence") {
    if (binding.sourceParameterForm !== "rest-sequence" || index !== undefined) return undefined;
    const component = Object.freeze({ kind: "array-element" as const });
    if (sourceStorageComponentType(source, operandType, component) === undefined) return undefined;
    const projected = subject(actual.node, actual.kind, [...actual.projection, component]);
    return projected === undefined ? undefined : typed(projected);
  }
  if (index === undefined || !Number.isSafeInteger(index) || index < 0) return undefined;
  const tuples = sourceStorageTupleElements(operandType);
  if (tuples?.length !== 1) return undefined;
  const element = tuples[0]![index];
  if (element?.kind !== "required" && element?.kind !== "optional") return undefined;
  const projected = subject(actual.node, actual.kind, [...actual.projection, { kind: "tuple-element", index }]);
  return projected === undefined ? undefined : typed(projected);
}

export function sourceStorageInvocationArgumentAbsence(
  source: SourceAnalysisProgram,
  selected: SourceNavigationCall,
  binding: SourceNavigationCallBinding,
): "absent" | "present" | "possible" {
  const argument = selected.arguments[binding.sourceArgumentIndex];
  if (argument === undefined || !sourceAnalysisIncludesFile(source, source.ast.getSourceFile(argument))) return "possible";
  const type = sourceStorageBindingArgumentType(source, selected, binding);
  if (type === undefined) return "possible";
  if (sourceStorageIsAbsentType(type)) return "absent";
  if (binding.sourceForm === "spread-element") {
    const index = binding.spreadElementIndex;
    const operand = Node_Expression(source.ast, argument);
    const operandType = operand === undefined ? undefined : sourceAnalysisValueType(source, operand);
    const tuples = operandType === undefined ? undefined : sourceStorageTupleElements(operandType);
    const element = index === undefined || tuples?.length !== 1 ? undefined : tuples[0]![index];
    if (element?.kind !== "required") return "possible";
  } else if (binding.sourceForm !== "value") return "possible";
  return sourceAnalysisMayBeAbsent(source.ast, type) || sourcePresentStorageArms(type).length === 0 ? "possible" : "present";
}

/** The selected signature declaration of a call or the callable's own declaration (source implementation). */
type SourceStorageCallableInputEvidence =
  | { readonly kind: "selected-signature"; readonly signature: Node; readonly use: Node | undefined }
  | { readonly kind: "source-implementation"; readonly signature: Node | undefined };

export function sourceStorageCallableInputSlots(source: SourceAnalysisProgram, declaration: Node,
  evidence: SourceStorageCallableInputEvidence, step: () => boolean): readonly SourceStorageCallableInputSlot[] | undefined {
  const { ast, navigation } = source;
  // The consuming site must be a program file; a selected signature may be declared outside them (library or
  // provider declaration), a source implementation may not.
  const site = evidence.kind === "selected-signature" && evidence.use !== undefined ? evidence.use : declaration;
  if (!sourceAnalysisIncludesFile(source, ast.getSourceFile(site))) return undefined;
  if (evidence.kind === "source-implementation" && ast.body(declaration) === undefined) return undefined;
  if (evidence.kind === "selected-signature" && evidence.signature !== declaration) return undefined;
  const use = evidence.kind === "selected-signature" ? evidence.use : undefined;
  const parameters = use === undefined
    ? sourceCallableValueParameters(ast, declaration, navigation, { kind: "declaration" })
    : sourceCallableValueParameters(ast, declaration, navigation, { kind: "selected-invocation", call: use });
  if (parameters === undefined) return undefined;
  const instantiated = use === undefined || evidence.kind !== "selected-signature" || evidence.signature !== declaration
    ? undefined : source.facts.selections.call(use);
  const slots: SourceStorageCallableInputSlot[] = [];
  let effectiveIndex = 0;
  for (const [sourceParameterIndex, parameter] of parameters.entries()) {
    if (!step()) return undefined;
    if (!ast.is.IsParameterDeclaration(parameter)) return undefined;
    const rest = ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined;
    if (!rest) {
      slots.push(Object.freeze({ parameter, sourceParameterIndex, effectiveIndex, repeated: false, projection: Object.freeze([]) }));
      effectiveIndex += 1;
      continue;
    }
    const type = instantiated !== undefined && instantiated.kind !== "refused" && instantiated.parameters[sourceParameterIndex] !== undefined
      ? instantiated.parameters[sourceParameterIndex]!.type : sourceAnalysisValueType(source, parameter);
    const tuples = type === undefined ? undefined : sourceStorageTupleElements(type);
    if (tuples?.length === 1 && tuples[0]!.every(element => element.kind !== "rest")) {
      for (const [index, element] of tuples[0]!.entries()) {
        if (!step()) return undefined;
        slots.push(Object.freeze({ parameter, sourceParameterIndex, effectiveIndex, repeated: false,
          projection: element.kind === "required" || element.kind === "optional"
            ? Object.freeze([Object.freeze({ kind: "tuple-element" as const, index })]) : undefined }));
        effectiveIndex += 1;
      }
    } else if (type !== undefined && sourceStorageArrayElementType(source, type) !== undefined) {
      slots.push(Object.freeze({ parameter, sourceParameterIndex, effectiveIndex, repeated: true,
        projection: Object.freeze([Object.freeze({ kind: "array-element" as const })]) }));
      effectiveIndex += 1;
    } else {
      slots.push(Object.freeze({ parameter, sourceParameterIndex, effectiveIndex, repeated: false, projection: undefined }));
      effectiveIndex += 1;
    }
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

/**
 * The callable signature a native callback argument is invoked with: the single call signature of the present
 * instantiated parameter type of the callback binding. undefined when there is not exactly one.
 */
export function sourceStorageCallbackSignature(entry: SourceStorageCallbackEntry): SourceTypeDescriptorSignature | undefined {
  const type = entry.argument.parameterType;
  if (type === undefined) return undefined;
  const signatures = sourcePresentStorageArms(type).flatMap(arm => sourceAnalysisCallSignatures(arm));
  return signatures.length === 1 ? signatures[0] : undefined;
}

export function sourceStorageInvocationInputSelection(source: SourceAnalysisProgram, key: SourceStorageInvocationSelectionKey,
  nodes: ReadonlySet<Node>, exact: boolean, step: () => boolean, retain: (cost: number) => boolean,
  read: (declaration: Node) => SourceStorageInvocationInputSlots | undefined): SourceStorageInvocationInputSlots | undefined {
  const { ast, navigation } = source;
  const entry = "kind" in key && (key.kind === "source-storage-callback-entry" || key.kind === "source-storage-accessor-entry") ? key : undefined;
  const node = "invocation" in key ? key.invocation : key;
  const selectedCall = entry === undefined && (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node))
    ? navigation.call(node) : undefined;
  // `signature`: the selected signature declaration (the callable's own declaration for a declaration key).
  let signature = selectedCall?.selection === "resolved" ? selectedCall.signature : undefined;
  let declaration: Node | undefined;
  if (entry?.kind === "source-storage-callback-entry") {
    signature = sourceStorageCallbackSignature(entry)?.declaration;
  } else if (entry?.kind === "source-storage-accessor-entry") {
    declaration = entry.declaration;
    signature = entry.declaration;
  } else if (selectedCall === undefined) {
    declaration = node;
    signature = navigation.declaredParameters(node) === undefined ? undefined : node;
  }
  declaration ??= signature;
  const unresolved: SourceStorageInputSlotsSelection = Object.freeze({ kind: "unresolved",
    reason: "Source storage invocation inputs require their exact checked selected signature and implementation parameters." });
  const included = declaration !== undefined && sourceAnalysisIncludesFile(source, ast.getSourceFile(declaration));
  const canonical = declaration === undefined || declaration === key || !included ? undefined : read(declaration);
  if (declaration !== undefined && declaration !== key && included && canonical === undefined) return undefined;
  const shared = canonical !== undefined && canonical.signature === signature && selectedCall === undefined;
  const selectedSlots = shared || declaration === undefined || signature === undefined ? undefined
    : sourceStorageCallableInputSlots(source, declaration,
      { kind: "selected-signature", signature, use: selectedCall === undefined ? undefined : node }, step);
  const selected: SourceStorageInputSlotsSelection = shared ? canonical.selected : selectedSlots === undefined ? unresolved
    : Object.freeze({ kind: "resolved", slots: selectedSlots });
  const implementations: { readonly declaration: Node; readonly selected: SourceStorageInputSlotsSelection }[] = [];
  for (const candidate of nodes) {
    if (!step()) return undefined;
    let body: SourceStorageInputSlotsSelection = unresolved;
    if (ast.body(candidate) !== undefined && sourceAnalysisIncludesFile(source, ast.getSourceFile(candidate))) {
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
  readonly type: SourceTypeDescriptor | undefined;
  readonly absent: boolean;
  readonly acceptsOmission: boolean;
  readonly projection: readonly SourceStorageProjection[];
}

/** The native callback parameters a formal of the callback implementation receives (callback signature descriptors). */
export function sourceStorageNativeInputSlots(source: SourceAnalysisProgram, declaration: Node,
  formal: SourceStorageSubject, selection: SourceStorageInvocationInputSlots | undefined,
  step: () => boolean): readonly SourceStorageNativeInputSlot[] | undefined {
  const signature = selection?.kind === "native-callback" ? sourceStorageCallbackSignature(selection.entry) : undefined;
  const inputs = sourceStorageSelectedInputSlots(selection, declaration);
  if (signature === undefined || inputs === undefined) return undefined;
  const parameters = signature.parameters;
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
    const restIndex = last?.kind === "rest" ? parameters.length - 1 : undefined;
    const maximum = input.repeated ? Math.max(input.effectiveIndex + 1, parameters.length) : input.effectiveIndex + 1;
    for (let parameterIndex = input.effectiveIndex; parameterIndex < maximum; parameterIndex += 1) {
      if (!step()) return undefined;
      const native = parameters[parameterIndex] ?? (restIndex !== undefined && parameterIndex >= restIndex ? last : undefined);
      let type = native?.type;
      if (native?.kind === "rest" && type !== undefined)
        type = sourceStorageComponentType(source, type, { kind: "array-element" });
      for (const component of projection) {
        if (!step()) return undefined;
        type = type === undefined ? undefined : sourceStorageComponentType(source, type, component);
      }
      selected.push(Object.freeze({ parameterIndex, type, absent: native === undefined,
        acceptsOmission: native === undefined || native.kind !== "required", projection }));
    }
  }
  return selected.length === 0 ? undefined : Object.freeze(selected);
}

export function sourceStorageNativeCallablePayloads<Bindings>(source: SourceAnalysisProgram, budget: SourceStorageBudget,
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
      const selected = source.navigation.call(invocation);
      if (selected === undefined) { complete = false; return true; }
      const callbacks = queries.callbackEntriesFor(invocation);
      for (const [index, argument] of selected.arguments.entries()) {
        if (!budget.step()) return false;
        if (callbacks.some(callback => callback.argument.binding.sourceArgumentIndex === index)) continue;
        if (!schedule(queries.subjectFor(argument), bindings)) return false;
      }
      const receiver = sourceStorageCallReceiver(source, selected);
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
        const alternatives = type === undefined ? [] : sourcePresentStorageArms(type);
        if ((type === undefined || alternatives.some(alternative => {
          const structure = sourceTypeDescriptorStructure(alternative);
          return sourceTypeDescriptorOpenness(source.ast, alternative) === "top" ||
            sourceAnalysisCallSignatures(alternative).length !== 0 || sourceAnalysisConstructSignatures(alternative).length !== 0 ||
            structure.kind === "declared" && ast.is.IsTypeParameterDeclaration(structure.declaration);
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

export function createSourceStorageInvocationOrigins(source: SourceAnalysisProgram, budget: SourceStorageBudget,
  queries: {
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
    incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
    isUnresolved(invocation: Node): boolean;
  }) {
  return (origin: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject> | undefined => {
    if (queries.isUnresolved(invocation)) return undefined;
    const parameters = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate) ? []
      : sourceCallableValueParameters(source.ast, candidate, source.navigation, { kind: "declaration" });
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
  source: SourceAnalysisProgram,
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
    const selected = source.navigation.call(invocation);
    if (callback !== undefined) {
      if (selected === undefined || !selected.bindings.some(binding =>
        binding.sourceArgumentIndex === callback.argument.binding.sourceArgumentIndex &&
        binding.sourceParameterIndex === callback.argument.binding.sourceParameterIndex &&
        binding.effectiveArgumentIndex === callback.argument.binding.effectiveArgumentIndex &&
        binding.sourceForm === callback.argument.binding.sourceForm &&
        binding.sourceParameterForm === callback.argument.binding.sourceParameterForm &&
        binding.spreadElementIndex === callback.argument.binding.spreadElementIndex)) {
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
          const receiver = sourceStorageCallReceiver(source, selected);
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
        if (input?.from === "receiver-element") receiver = sourceStorageCallReceiver(source, selected);
        else if (input?.from === "argument-element") {
          const bindings = selected.bindings.filter(binding => binding.sourceParameterIndex === input.sourceParameterIndex);
          if (bindings.length === 1 && bindings[0]!.sourceForm === "value" && bindings[0]!.sourceParameterForm === "parameter")
            receiver = selected.arguments[bindings[0]!.sourceArgumentIndex];
        }
        const type = receiver === undefined ? undefined : sourceAnalysisValueType(source, receiver);
        const owner = receiver === undefined || type === undefined || !sourceStorageIsArrayLikeType(type) ? undefined : subjectFor(receiver);
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
        const base = sourceSuperConstructor(invocation, source, budget.step);
        add(ast.is.IsNewExpression(invocation) ? subject(invocation)
          : base !== undefined ? subject(base.owner, "receiver")
          : subjectFor(accessorTargets.get(invocation)?.find(target => target.declaration === candidate)?.receiver
            ?? (selected === undefined ? undefined : sourceStorageCallReceiver(source, selected))
            ?? source.navigation.memberAccess(invocation)?.receiver));
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
            if (binding.effectiveArgumentIndex !== slot.effectiveIndex && !(slot.repeated && binding.effectiveArgumentIndex >= slot.effectiveIndex) ||
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
