import type { RawSignatureId, RawTypeId, TyId } from "../ids/contract.js";
import type * as Hir from "../ir-hir/contract.js";
import type { ComponentSelector, TypeBinding } from "../ir-types/contract.js";
import { admitTypePublicationStep, readSignature, readType } from "../ir-types/index.js";
import type { RawCallSelection, RawComponent, RawNodeRef } from "./contract.js";
import { sameSource, sourceOccurrence } from "./bindings.js";
import { convertRawType, rawSignatureParameter, signatureOf } from "./type-conversion.js";
import type { ConversionResult, TypeConversion } from "./type-conversion.js";

function fail(message: string): never {
  throw new TypeError("front: " + message);
}

function typeOf(conversion: TypeConversion, id: RawTypeId): ConversionResult<TyId> {
  const type = convertRawType(conversion, id);
  if (type.kind === "unavailable") return fail("a selected call requires its actual captured binding or contribution type");
  return type.kind === "complete" ? { kind: "complete", value: type.value.type } : type;
}

type RawCall = Extract<RawCallSelection, { readonly kind: "applicable" }>;
type Call = Hir.CallExpression<Hir.SyntaxPhase>;

function contextualTuplePath(conversion: TypeConversion, source: RawComponent, formal: RawComponent,
  signature: RawSignatureId): ConversionResult<readonly Extract<ComponentSelector, { readonly kind: "tuple-element" }>[]> {
  const { raw, typeWork } = conversion;
  const slots: Extract<ComponentSelector, { readonly kind: "tuple-element" }>[] = [];
  let from = source;
  let to = formal;
  while (true) {
    const stop = admitTypePublicationStep(typeWork, 2);
    if (stop !== null) return stop;
    const sourcePath = from.path;
    const formalPath = to.path;
    if (sourcePath?.step.kind !== "tuple-element" || formalPath?.step.kind !== "tuple-element"
      || formalPath.step.index !== sourcePath.step.index || !Number.isSafeInteger(sourcePath.step.index)
      || sourcePath.step.index < 0 || Object.is(sourcePath.step.index, -0)
      || (sourcePath.prefix !== null && sourcePath.prefix >= from.id) || formalPath.prefix === null || formalPath.prefix >= to.id)
      return fail("a contextual tuple contribution must retain matching ordered source and formal slots");
    const retain = admitTypePublicationStep(typeWork, sourcePath.prefix === null ? 1 : 2, 1);
    if (retain !== null) return retain;
    slots.push({ kind: "tuple-element", index: sourcePath.step.index });
    const formalParent = raw.types.components[formalPath.prefix];
    if (formalParent?.id !== formalPath.prefix || !sameSource(formalParent.root, formal.root))
      return fail("a contextual tuple contribution must retain its actual source and formal roots");
    to = formalParent;
    if (sourcePath.prefix === null) break;
    const sourceParent = raw.types.components[sourcePath.prefix];
    if (sourceParent?.id !== sourcePath.prefix || !sameSource(sourceParent.root, source.root))
      return fail("a contextual tuple contribution must retain its actual source and formal roots");
    from = sourceParent;
  }
  if (to.path?.prefix !== null || to.path.step.kind !== "result" || to.path.step.signature !== signature)
    return fail("a contextual tuple contribution must retain the actual original result selector");
  return { kind: "complete", value: slots.reverse() };
}

export function verifyFiniteCallTransport(conversion: TypeConversion, call: RawCall,
  arguments_: readonly Hir.HirArgument[]): ConversionResult<void> {
  const { raw, typeWork } = conversion;
  const selection = raw.types.candidates[call.candidates]?.candidates[0];
  if (selection === undefined || selection.arguments.kind !== "available")
    return fail("finite call transport requires the actual selected argument inventory");
  const rows = selection.arguments.value;
  for (let index = 0; index < call.parameters.length; index += 1) {
    const stop = admitTypePublicationStep(typeWork);
    if (stop !== null) return stop;
    const parameter = call.parameters[index];
    if (parameter === undefined) return fail("finite call transport requires the actual dense selected formals");
    if (parameter.kind === "rest") return { kind: "complete", value: undefined };
  }
  let effective = 0;
  for (let authored = 0; authored < arguments_.length; authored += 1) {
    const stop = admitTypePublicationStep(typeWork);
    if (stop !== null) return stop;
    const argument = arguments_[authored];
    const actual = selection.sourceArguments[authored];
    if (argument === undefined || actual === undefined) return fail("finite call transport requires every actual authored argument");
    if (argument.kind === "spread" && (argument.tuple.kind !== "available" || argument.tuple.value === null))
      return { kind: "complete", value: undefined };
    const count = argument.kind === "value" ? 1 : argument.tuple.kind === "available" ? argument.tuple.value?.length ?? 0 : 0;
    for (let slot = 0; slot < count; slot += 1, effective += 1) {
      const stop = admitTypePublicationStep(typeWork);
      if (stop !== null) return stop;
      const row = rows[effective];
      const component = argument.kind === "spread" ? slot : null;
      if (row?.sourceArgumentIndex !== authored || row.effectiveArgumentIndex !== effective || row.parameterIndex !== effective
        || row.parameterForm !== "parameter" || row.sourceForm !== (component === null ? "value" : "spread-element")
        || row.spreadElementIndex !== component || !sameSource(row.sourceArgument, actual.occurrence)
        || row.source.kind !== "available" || row.destination.kind !== "available")
        return fail("finite call transport differs from the actual selected argument and formal slots");
      const paid = admitTypePublicationStep(typeWork, 2);
      if (paid !== null) return paid;
      const source = raw.types.components[row.source.value];
      const destination = raw.types.components[row.destination.value];
      const from = source?.path;
      const to = destination?.path;
      if (from?.prefix !== null || from.step.kind !== "argument-place" || from.step.index !== effective
        || to?.prefix !== null || to.step.kind !== "parameter" || to.step.index !== effective || to.step.signature !== selection.application.signature
        || !sameSource(source?.root, call.invocation) || !sameSource(destination?.root, call.invocation))
        return fail("finite call transport must retain the actual argument and selected formal components");
    }
  }
  if (effective !== rows.length || effective > call.parameters.length)
    return fail("finite call transport must cover the actual selected effective rows");
  return { kind: "complete", value: undefined };
}

export function lowerCall(conversion: TypeConversion, node: Call, call: RawCall,
  contextual: Hir.CapturedFact<TyId | null>): ConversionResult<{
  readonly candidate: Hir.HirCandidate;
  readonly typeArguments: readonly TyId[];
}> {
  const { deps, raw } = conversion;
  const list = raw.types.candidates[call.candidates];
  const order = call.declarationOrder;
  if (order.kind !== "available" || order.value.length === 0 || list?.id !== call.candidates || list.candidates.length !== 1)
    return fail("an applicable call requires its declaration order and one actual selected candidate");
  const declarationOrdinal = call.declarationOrdinal;
  const originalId = Number.isSafeInteger(declarationOrdinal) && declarationOrdinal >= 0 && !Object.is(declarationOrdinal, -0)
    ? order.value[declarationOrdinal] : undefined;
  const [candidate] = list.candidates;
  const invocation = { module: raw.module, node: node.id };
  if (candidate === undefined || originalId === undefined || candidate.ordinal !== 0
    || !sameSource(call.invocation, invocation) || !sameSource(candidate.application.invocation, invocation)
    || !sameSource(candidate.application.callee, { module: raw.module, node: node.expression.id }))
    return fail("an applicable candidate must retain its actual selected invocation and callee");
  if (candidate.sourceArguments.length !== node.arguments.nodes.length)
    return fail("an applicable candidate must retain every actual authored argument");
  for (let index = 0; index < node.arguments.nodes.length; index += 1) {
    const stop = admitTypePublicationStep(deps.typeWork);
    if (stop !== null) return stop;
    const syntax = node.arguments.nodes[index];
    if (syntax === undefined) return fail("an applicable candidate must retain every actual authored argument");
    const authored = candidate.sourceArguments[index];
    const operand = syntax.kind === "SpreadElement" ? syntax.expression : syntax;
    if (authored?.kind !== (syntax.kind === "SpreadElement" ? "spread" : "value")
      || !sameSource(authored.occurrence, { module: raw.module, node: syntax.id })
      || !sameSource(authored.expression, { module: raw.module, node: operand.id }))
      return fail("an applicable candidate must retain the actual authored slot and operand");
  }
  const application = candidate.application;
  if (application.classArguments.length !== 0 || application.receiver !== null)
    return fail("nonempty call candidate binding conversion is not implemented");
  if (candidate.constraints.length !== 0 || candidate.diagnostics.length !== 0 || candidate.diagnosticCoverage.length !== 0)
    return fail("call candidate conditional failure conversion is not implemented");
  if (candidate.inferenceContributions.kind !== "available") return fail("call inference contributions require their actual selected inventory");
  const declared = raw.types.signatures[originalId];
  const applied = raw.types.signatures[application.signature];
  if (declared?.id !== originalId || declared.declaration === null || declared.typeParameters.kind !== "available"
    || applied?.id !== application.signature || !sameSource(applied.declaration, declared.declaration)
    || applied.typeParameters.kind !== "available" || applied.typeParameters.value.length !== 0
    || declared.kind !== "call" || applied.kind !== "call" || application.kind !== "call"
    || (declared.typeParameters.value.length === 0 ? applied.id !== originalId : applied.target !== originalId))
    return fail("a selected call must retain its actual declared and applied signature association");
  const original = declared.declaration;
  const definition = deps.definitionOf(original);
  const authored = node.typeArguments?.nodes ?? [];
  if (application.signatureArguments.length !== declared.typeParameters.value.length || authored.length > application.signatureArguments.length)
    return fail("selected bindings must cover the actual original signature binder inventory");
  const bindings: TypeBinding[] = [];
  const typeArguments: TyId[] = [];
  const binders = application.signatureArguments.length === 0 ? null : new Map<RawNodeRef["node"], TypeBinding["parameter"]>();
  for (let index = 0; index < application.signatureArguments.length; index += 1) {
    const binding = application.signatureArguments[index];
    const id = declared.typeParameters.value[index];
    if (binding === undefined || id === undefined || binding.defaultTypeNode !== null || binding.argument.kind !== "available")
      return fail("a selected signature binding requires its actual non-defaulted argument");
    const binder = rawSignatureParameter(raw, id).parameter;
    if (binder.module !== original.module || !sameSource(binding.parameter, binder) || !sameSource(binding.declaration, binder) || binding.scope !== "local"
      || binders?.has(binder.node) === true)
      return fail("a selected signature binding must retain its actual original parameter");
    const syntax = authored[index];
    const explicit = syntax === undefined ? null : { module: raw.module, node: syntax.id };
    const row = raw.types.types[binding.argument.value];
    const component = row === undefined ? undefined : raw.types.components[row.component];
    const selector = component?.path?.step;
    if (row?.id !== binding.argument.value || !sameSource(component?.root, invocation) || component?.path?.prefix !== null
      || selector?.kind !== "type-argument" || selector.index !== index || !sameSource(selector.declaration, binder)
      || (explicit === null ? row.authoredTypeNode !== null || binding.explicitTypeNode !== null
        : !sameSource(row.authoredTypeNode, explicit) || !sameSource(binding.explicitTypeNode, explicit)))
      return fail("a selected signature binding must retain its actual type argument component and authored node");
    const selected = typeOf(conversion, row.id);
    if (selected.kind !== "complete") return selected;
    const parameter = deps.definitionOf(binder);
    binders?.set(binder.node, parameter);
    bindings.push({ kind: "bound", parameter, type: selected.value });
    if (explicit !== null) typeArguments.push(selected.value);
  }
  const selected = signatureOf(conversion, applied.id);
  if (selected.kind !== "complete") return selected;
  const contributions: Hir.HirInferenceContribution[] = [];
  if (candidate.inferenceContributions.value.length !== 0) {
    const declaredSignature = signatureOf(conversion, originalId);
    if (declaredSignature.kind !== "complete") return declaredSignature;
    const originalSignature = readSignature(deps.types, declaredSignature.value);
    const qualifiedFormal = originalSignature?.owner;
    if (qualifiedFormal?.kind !== "item" || qualifiedFormal.value.owner !== definition || qualifiedFormal.value.node !== original.node)
      return fail("an inference contribution requires the actual declared signature's source occurrence");
    const parameters = candidate.arguments.kind === "available" ? candidate.arguments.value : [];
    for (const contribution of candidate.inferenceContributions.value) {
      const origin = contribution.origin;
      const declaration = contribution.declaration;
      const parameter = declaration?.module === original.module ? binders?.get(declaration.node) : undefined;
      const source = raw.types.types[contribution.source];
      const formal = raw.types.types[contribution.formal];
      const sourceComponent = source === undefined ? undefined : raw.types.components[source.component];
      const formalComponent = formal === undefined ? undefined : raw.types.components[formal.component];
      const rawSelector = formalComponent?.path?.step;
      if (parameter === undefined || declaration === null || source?.id !== contribution.source || sourceComponent === undefined
        || !sameSource(sourceComponent.root, origin.subject) || formal?.id !== contribution.formal || formalComponent === undefined
        || !sameSource(formalComponent.root, original) || formal.form.kind !== "available" || formal.form.value.kind !== "parameter"
        || !sameSource(formal.form.value.parameter, declaration))
        return fail("an inference contribution must retain its genuine source and original formal components");
      const qualifiedSource = sourceOccurrence(deps, origin.subject);
      if (qualifiedSource === null) return fail("an inference contribution requires its actual qualified source");
      if (sourceComponent.path !== null) {
        if (origin.kind !== "contextual-result" || !sameSource(origin.subject, invocation)
          || contextual.kind !== "available" || contextual.value === null || originalSignature === undefined)
          return fail("a projected inference contribution requires its actual contextual result");
        const path = contextualTuplePath(conversion, sourceComponent, formalComponent, originalId);
        if (path.kind !== "complete") return path;
        let sourceType = contextual.value;
        let formalType = originalSignature.result;
        for (const slot of path.value) {
          const stop = admitTypePublicationStep(deps.typeWork, 4);
          if (stop !== null) return stop;
          const sourceTuple = readType(deps.types, sourceType);
          const formalTuple = readType(deps.types, formalType);
          const sourceSlot = sourceTuple?.kind === "tuple" ? sourceTuple.elements[slot.index] : undefined;
          const formalSlot = formalTuple?.kind === "tuple" ? formalTuple.elements[slot.index] : undefined;
          if (sourceSlot?.kind !== "required" || formalSlot?.kind !== "required")
            return fail("a contextual tuple contribution must select actual required slots");
          sourceType = sourceSlot.type;
          formalType = formalSlot.type;
        }
        const stop = admitTypePublicationStep(deps.typeWork);
        if (stop !== null) return stop;
        const binder = readType(deps.types, formalType);
        const type = typeOf(conversion, contribution.source);
        if (type.kind !== "complete") return type;
        if (binder?.kind !== "param" || binder.parameter !== parameter || sourceType !== type.value)
          return fail("a contextual tuple contribution must name the actual contextual slot and formal binder");
        contributions.push({ parameter, role: "context", source: qualifiedSource.occurrence,
          component: { root: qualifiedFormal, path: [{ kind: "result", signature: declaredSignature.value }, ...path.value] },
          type: { kind: "available", value: sourceType } });
        continue;
      }
      if (formalComponent.path?.prefix !== null)
        return fail("an unprojected inference contribution must retain its direct original formal selector");
      let selector: ComponentSelector;
      let role: Hir.HirInferenceContribution["role"];
      let declaredFormal: RawTypeId | undefined;
      if (origin.kind === "argument") {
        const argument = parameters[origin.effectiveArgumentIndex];
        const syntax = argument === undefined ? undefined : node.arguments.nodes[argument.sourceArgumentIndex];
        if (argument?.parameterIndex !== origin.parameterIndex || !sameSource(argument.sourceArgument, origin.subject)
          || syntax === undefined || !sameSource(origin.subject, { module: raw.module, node: syntax.id })
          || rawSelector?.kind !== "parameter" || rawSelector.signature !== originalId || rawSelector.index !== origin.parameterIndex)
          return fail("an argument contribution must retain its actual argument and original parameter selector");
        selector = { kind: "parameter", signature: declaredSignature.value, index: origin.parameterIndex };
        role = "argument";
        declaredFormal = declared.parameters[origin.parameterIndex]?.type;
      } else {
        if (origin.kind !== "contextual-result" || !sameSource(origin.subject, invocation) || rawSelector?.kind !== "result"
          || rawSelector.signature !== originalId)
          return fail("a contextual contribution must retain its actual invocation and original result selector");
        selector = { kind: "result", signature: declaredSignature.value };
        role = "context";
        declaredFormal = declared.result.kind === "available" ? declared.result.value : undefined;
      }
      const actual = declaredFormal === undefined ? undefined : raw.types.types[declaredFormal]?.form;
      if (actual?.kind !== "available" || actual.value.kind !== "parameter" || !sameSource(actual.value.parameter, declaration))
        return fail("an inference contribution must name the actual original signature's formal binder");
      const type = typeOf(conversion, contribution.source);
      if (type.kind !== "complete") return type;
      contributions.push({ parameter, role, source: qualifiedSource.occurrence, component: { root: qualifiedFormal, path: [selector] },
        type: { kind: "available", value: type.value } });
    }
  }
  return { kind: "complete", value: { typeArguments, candidate: { ordinal: candidate.ordinal, declaration: definition,
    appliedSignature: { kind: "available", value: selected.value },
    bindings: { kind: "available", value: { classBindings: [], methodBindings: bindings, capturedBindings: [], selfBindings: [] } },
    conditionalFailure: { kind: "available", value: null }, contributions } } };
}
