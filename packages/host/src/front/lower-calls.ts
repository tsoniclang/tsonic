import type { RawTypeId, TyId } from "../ids/contract.js";
import type * as Hir from "../ir-hir/contract.js";
import type { ComponentSelector, TypeBinding } from "../ir-types/contract.js";
import { admitTypePublicationStep, readSignature } from "../ir-types/index.js";
import type { RawCallSelection, RawNodeRef } from "./contract.js";
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

export function lowerCall(conversion: TypeConversion, node: Call, call: RawCall): ConversionResult<{
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
    const qualifiedFormal = readSignature(deps.types, declaredSignature.value)?.owner;
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
      if (parameter === undefined || declaration === null || source?.id !== contribution.source || !sameSource(sourceComponent?.root, origin.subject)
        || sourceComponent?.path !== null || formal?.id !== contribution.formal || !sameSource(formalComponent?.root, original)
        || formalComponent?.path?.prefix !== null || formal.form.kind !== "available" || formal.form.value.kind !== "parameter"
        || !sameSource(formal.form.value.parameter, declaration))
        return fail("an inference contribution must retain its genuine source and original formal components");
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
      const qualifiedSource = sourceOccurrence(deps, origin.subject);
      if (qualifiedSource === null) return fail("an inference contribution requires its actual qualified source");
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
