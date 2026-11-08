import type { Node } from "@tsonic/tsts";
import type {
  SourceInputApplication, SourceInputBackingConstraint, SourceInputCallCandidate, SourceInputDiagnosticIdentity, SourceInputTypeArgument,
} from "../../host-input/call-input.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type {
  SourceApplication, SourceApplicationIdentity, SourceApplicationReceiver, SourceArgumentPlace, SourceAuthoredArgument,
  SourceDeclaredSlot, SourceTypeBinding, SourceTypeEvidence,
} from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceObjectProduction } from "../member-use.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import { produceSourceCallableSignature, produceSourceReceiverBindings, type SourceCallableProduction } from "./callable-production.js";
import { produceSourceArgumentPlaces, produceSourceDeclaredParameterPlace } from "./argument-places.js";
import { sourceApplicationStaticReceiver } from "./application-references.js";
import type { SourceTypeFlowSource } from "./types.js";
import { selectSourceCallCandidate, type SourceCallCandidateEvaluation } from "./call-selection.js";
import { sourcePresenceLiteralDisposition } from "../../source-model/literals/domain.js";
import { produceSourceEvidenceDetails } from "./member-production.js";
import { produceSourceSerializationResult } from "./serialization-presence.js";

export interface SourceApplicationProduction extends SourceCallableProduction {
  readonly objects: SourceObjectProduction;
  readonly profile: SourceTypeFlowSource["profile"];
  component(component: SourceInputComponent, bindings: readonly SourceTypeBinding[], candidate: SourceInputCallCandidate): SourceProductionResult<SourceTypeEvidence>;
  admits(source: SourceTypeEvidence, destination: SourceTypeEvidence, site: Node): SourceProductionResult<boolean>;
  proves(constraint: SourceInputBackingConstraint, bindings: readonly SourceTypeBinding[], candidate: SourceInputCallCandidate): SourceProductionResult<boolean>;
}

export interface SourceProducedApplication {
  readonly application: SourceApplication;
  readonly original: SourceInputApplication;
  readonly diagnostics: readonly SourceInputDiagnosticIdentity[];
}

export function produceSourceApplication(context: SourceApplicationProduction, invocation: Node): SourceProductionResult<SourceProducedApplication> {
  const { builder, input, reader } = context;
  const selected = input.application(invocation);
  const refusal = (message: string) => sourceSemanticRefusal(invocation, message, "TSONIC_LOCAL_TYPE_GENERIC");
  if (selected.kind === "untyped") return refusal("This application has no original callable candidate to authenticate.");

  function candidate(value: SourceInputCallCandidate): SourceProductionResult<SourceCallCandidateEvaluation> {
    const original = value.application;
    if (original.invocation !== invocation || value.identity.invocation !== invocation) {
      throw new Error("A Source call candidate requires its identical original invocation.");
    }
    input.assertSignature(original.signature);
    const notApplicable = (site: Node, message: string): SourceProductionResult<SourceCallCandidateEvaluation> =>
      ({ kind: "resolved", value: { kind: "not-applicable", candidate: value, site, message } });
    const signature = builder.signature(original.signature.owner, original.signature.signatureKind, original.signature,
      original.signature.declaration, original.signature.typeParameters);
    if (original.signatureArguments.length !== signature.typeParameters.length ||
      original.signatureArguments.some((argument, index) => argument.declaration !== signature.typeParameters[index])) {
      return refusal("A Source application requires its complete original signature binder vector, separate from class arguments.");
    }
    const parameters = [...(original.class?.arguments ?? []), ...original.signatureArguments];
    const declarations = parameters.map(parameter => parameter.declaration);
    if (declarations.some(declaration => declaration === undefined) || new Set(declarations).size !== declarations.length) {
      return refusal("A Source application requires distinct paired original class and signature binder declarations.");
    }
    const bindings = new Map<Node, SourceTypeEvidence>();
    const ordered = (): readonly SourceTypeBinding[] => parameters.flatMap(parameter => {
      const declaration = parameter.declaration;
      const value = declaration === undefined ? undefined : bindings.get(declaration);
      return declaration === undefined || value === undefined ? [] : [{ declaration, value }];
    });

    function stated(parameter: SourceInputTypeArgument): SourceProductionResult<SourceTypeEvidence> | undefined {
      return parameter.explicitTypeNode === undefined ? undefined : reader.describeSyntax(parameter.explicitTypeNode, ordered());
    }

    for (const parameter of original.class?.arguments ?? []) {
      const value = stated(parameter);
      if (value === undefined) continue;
      if (value.kind !== "resolved") return value;
      bindings.set(parameter.declaration!, value.value);
    }
    let receiver: SourceApplicationReceiver = Object.freeze({ kind: "none" });
    const selectedReceiver = original.receiver;
    const staticReceiver = sourceApplicationStaticReceiver(context, original);
    if (selectedReceiver !== undefined) {
      if (staticReceiver !== undefined) receiver = Object.freeze({ kind: "type", declaration: staticReceiver });
      else if (selectedReceiver.role === "value") {
        const value = context.value(selectedReceiver.occurrence, ordered());
        if (value.kind !== "resolved") return value;
        receiver = Object.freeze({ kind: "value", occurrence: selectedReceiver.occurrence, value: value.value });
      } else {
        const facts = input.describe(selectedReceiver.component);
        if (facts.declaration === undefined) return refusal("A type receiver requires its original selected declaration.");
        receiver = Object.freeze({ kind: "type", declaration: facts.declaration });
      }
    }
    if (original.class !== undefined && original.class.arguments.some(argument => !bindings.has(argument.declaration!))) {
      const classValue = selectedReceiver?.role === "value" ? selectedReceiver : original.callee.role === "value" ? original.callee : undefined;
      if (classValue !== undefined) {
        const value = context.value(classValue.occurrence, ordered());
        if (value.kind !== "resolved") return value;
        if ((value.value.type.kind === "array" || value.value.type.kind === "tuple") && original.class.arguments.length === 1) {
          const argument = original.class.arguments[0]!;
          const elements = value.value.type.kind === "array" ? [builder.component(value.value, { kind: "array-element" })]
            : value.value.type.elements.map((_, index) => builder.component(value.value, { kind: "tuple-element", index }));
          const values: SourceTypeEvidence[] = [];
          for (const element of elements) {
            if (element.kind === "refused") return element;
            values.push(element.value);
          }
          const joined = builder.join(builder.componentIdentity(invocation, [{ kind: "type-argument", declaration: argument.declaration!, index: 0 }]),
            "inferred", values, undefined);
          if (joined.kind === "refused") return joined;
          bindings.set(argument.declaration!, joined.value);
        } else if (value.value.type.kind === "declared") {
          const inherited = produceSourceReceiverBindings(context, value.value, ordered());
          if (inherited.kind !== "resolved") return inherited;
          for (const argument of original.class.arguments) {
            const declaration = argument.declaration!;
            const binding = inherited.value.find(candidate => candidate.declaration === declaration);
            if (binding !== undefined && !bindings.has(declaration)) bindings.set(declaration, binding.value);
          }
        }
      }
    }

    const directCallee = context.navigation.sourceReferenceFor(original.callee.occurrence);
    const callee = directCallee === undefined && staticReceiver === undefined ? context.value(original.callee.occurrence, ordered())
      : context.component(original.callee.component, ordered(), value);
    if (callee.kind !== "resolved") return callee;
    const optionalCall = context.ast.is.IsCallExpression(invocation) &&
      context.ast.as.AsCallExpression(invocation)?.QuestionDotToken !== undefined;
    let argumentDisposition: SourceApplication["argumentDisposition"] = "evaluate";
    function guard(evidence: SourceTypeEvidence): SourceApplication["argumentDisposition"] {
      const presence = sourcePresenceLiteralDisposition(builder.domain(evidence));
      return presence === "absent" ? "skip" : presence === "dynamic" ? "dynamic" : "evaluate";
    }
    if (optionalCall) argumentDisposition = guard(callee.value);
    if (context.ast.is.IsPropertyAccessExpression(original.callee.occurrence) || context.ast.is.IsElementAccessExpression(original.callee.occurrence)) {
      const member = context.objects.use(original.callee.occurrence);
      if (member.kind !== "resolved") return member;
      if (member.value.optionalChain || member.value.chainContinuation) {
        const selected = guard(member.value.receiver.value);
        argumentDisposition = selected === "skip" || argumentDisposition === "skip" ? "skip"
          : selected === "dynamic" || argumentDisposition === "dynamic" ? "dynamic" : "evaluate";
      }
    }
    function authored(bindings: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceAuthoredArgument[]> {
      const arguments_: SourceAuthoredArgument[] = [];
      for (const argument of value.sourceArguments) {
        const source = context.value(argument.expression, bindings);
        if (source.kind === "pending") return source;
        if (source.kind === "refused" && (argumentDisposition !== "skip" || source.code !== "TSONIC_SOURCE_FORM_UNSUPPORTED")) return source;
        arguments_.push(Object.freeze({ occurrence: argument.occurrence, form: argument.form,
          operand: source.kind === "refused" ? source : Object.freeze({ kind: "resolved", value: Object.freeze({ occurrence: argument.expression, value: source.value }) }) }));
      }
      return { kind: "resolved", value: Object.freeze(arguments_) };
    }
    function absent(bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
      const details = produceSourceEvidenceDetails(context, invocation, bindings);
      return details.kind !== "resolved" ? details : { kind: "resolved", value: builder.evidence({ type: builder.intrinsic("absence"),
        component: builder.componentIdentity(invocation, []), category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined },
      [], input.syntax(invocation), { kind: "finite", values: [{ kind: "absence" }] }, details.value) };
    }
    if (argumentDisposition === "skip") {
      const classBindings = ordered();
      if (original.class?.arguments.some(argument => !classBindings.some(binding => binding.declaration === argument.declaration)))
        return refusal("A skipped Source call still requires its authentic receiver and class environment.");
      const sourceArguments = authored(classBindings);
      if (sourceArguments.kind !== "resolved") return sourceArguments;
      const result = absent(classBindings);
      if (result.kind !== "resolved") return result;
      const identity: SourceApplicationIdentity = Object.freeze({ invocation, signature,
        classBindings: Object.freeze(classBindings), signatureBindings: Object.freeze([]) });
      return { kind: "resolved", value: { kind: "applicable", candidate: value, proven: [], application: Object.freeze({ identity,
        kind: original.kind, optionalCall, argumentDisposition, callee: Object.freeze({ occurrence: original.callee.occurrence, value: callee.value }),
        receiver, sourceArguments: sourceArguments.value, arguments: Object.freeze([]), result: result.value }) } };
    }
    for (const parameter of original.signatureArguments) {
      const value = stated(parameter);
      if (value === undefined) continue;
      if (value.kind !== "resolved") return value;
      bindings.set(parameter.declaration!, value.value);
    }

    const supplied = new Set(bindings.keys());
    if (parameters.some(parameter => !bindings.has(parameter.declaration!))) {
      if (value.inferenceContributions.kind === "unavailable") {
        return refusal("This generic application has no complete original inference contribution vector.");
      }
      const contributionsByDeclaration = new Map<Node, typeof value.inferenceContributions.values[number][]>();
      for (const contribution of value.inferenceContributions.values) {
        const declaration = contribution.declaration;
        if (declaration === undefined) return refusal("An inference contribution requires its original binder declaration.");
        const formal = reader.describeComponent(contribution.formal, []);
        if (formal.kind !== "resolved") return formal;
        if (formal.value.type.kind !== "parameter" || formal.value.type.declaration !== declaration) {
          return refusal("An inference contribution must identify its exact original formal parameter component.");
        }
        if (!declarations.includes(declaration)) {
          return refusal("An inference contribution cannot bind a parameter outside this original application.");
        }
        if (supplied.has(declaration)) continue;
        let entries = contributionsByDeclaration.get(declaration);
        if (entries === undefined) { entries = []; contributionsByDeclaration.set(declaration, entries); }
        entries.push(contribution);
      }
      const pending = new Map<Node, Extract<SourceProductionResult<never>, { readonly kind: "pending" }>>();
      for (;;) {
        let progress = false;
        pending.clear();
        for (const [index, parameter] of parameters.entries()) {
          const declaration = parameter.declaration!;
          if (bindings.has(declaration)) continue;
          const entries = contributionsByDeclaration.get(declaration);
          if (entries === undefined || entries.length === 0) continue;
          const values: SourceTypeEvidence[] = [];
          const dependencies = new Set<Extract<SourceProductionResult<never>, { readonly kind: "pending" }>["dependencies"][number]>();
          for (const contribution of entries) {
            const source = context.component(contribution.source, ordered(), value);
            if (source.kind === "refused") return source;
            if (source.kind === "pending") for (const dependency of source.dependencies) dependencies.add(dependency);
            else values.push(source.value);
          }
          if (dependencies.size > 0) { pending.set(declaration, { kind: "pending", dependencies: [...dependencies] }); continue; }
          const inferred = builder.join(builder.componentIdentity(invocation,
            [{ kind: "type-argument", declaration, index }]), "inferred", values, undefined);
          if (inferred.kind === "refused") return inferred;
          bindings.set(declaration, inferred.value);
          progress = true;
        }
        if (!progress) break;
      }
      if (pending.size > 0) return { kind: "pending", dependencies: [...new Set([...pending.values()].flatMap(value => value.dependencies))] };
    }
    for (const parameter of parameters) {
      const declaration = parameter.declaration!;
      if (bindings.has(declaration)) continue;
      if (parameter.defaultTypeNode === undefined) return refusal("A Source application leaves an original generic parameter unbound.");
      const defaultType = reader.describeSyntax(parameter.defaultTypeNode, ordered());
      if (defaultType.kind !== "resolved") return defaultType;
      bindings.set(declaration, defaultType.value);
    }
    for (const parameter of parameters) {
      const described = reader.describeComponent(parameter.parameter, []);
      if (described.kind !== "resolved") return described;
      if (described.value.type.kind !== "parameter" || described.value.type.declaration !== parameter.declaration) {
        return refusal("A generic application requires the actual original parameter definition.");
      }
      const definition = builder.typeParameter(parameter.declaration!);
      const constraint = builder.constraint(definition);
      if (constraint.kind === "refused") return constraint;
      if (constraint.value.kind === "none") continue;
      const applied = builder.substitute(constraint.value.value, ordered());
      if (applied.kind === "refused") return applied;
      const admission = context.admits(bindings.get(parameter.declaration!)!, applied.value, invocation);
      if (admission.kind !== "resolved") return admission;
      if (!admission.value) return notApplicable(invocation, "An original Source generic argument does not satisfy its applied declared constraint.");
    }

    const classCount = original.class?.arguments.length ?? 0;
    const allBindings = ordered();
    const identity: SourceApplicationIdentity = Object.freeze({ invocation, signature,
      classBindings: Object.freeze(allBindings.slice(0, classCount)),
      signatureBindings: Object.freeze(allBindings.slice(classCount)) });
    const authoredArguments = authored(allBindings);
    if (authoredArguments.kind !== "resolved") return authoredArguments;
    const sourceArguments = authoredArguments.value;
    const arguments_: SourceArgumentPlace[] = [];
    const declaredSignature = produceSourceCallableSignature(context, original.signature, [], original.class?.declaration, invocation);
    if (declaredSignature.kind !== "resolved") return declaredSignature;
    const appliedSignature = produceSourceCallableSignature(context, original.signature, allBindings, original.class?.declaration, invocation);
    if (appliedSignature.kind !== "resolved") return appliedSignature;
    const places = produceSourceArgumentPlaces({ builder, invocation, sourceArguments, parameters: appliedSignature.value.parameters });
    if (places.kind !== "resolved") return places;
    if (places.value.kind === "not-applicable") return notApplicable(places.value.site, places.value.message);
    for (const argument of places.value.values) {
      const parameter = declaredSignature.value.parameters[argument.parameter.index];
      if (parameter === undefined || parameter.index !== argument.parameter.index) throw new Error("An applied Source parameter requires its original authored declaration slot.");
      const declaredPlace = produceSourceDeclaredParameterPlace(builder, parameter, argument.parameterPath);
      if (declaredPlace.kind !== "resolved") return declaredPlace;
      const slot: SourceDeclaredSlot = Object.freeze({ origin: Object.freeze({ kind: "parameter", signature,
        index: parameter.index, ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) }), type: declaredPlace.value });
      const admission = context.admits(argument.source, argument.destination, argument.effectiveArgument);
      if (admission.kind !== "resolved") return admission;
      if (!admission.value) return notApplicable(argument.effectiveArgument, "A Source argument does not fit its exact applied parameter destination.");
      arguments_.push(Object.freeze({ sourceArgument: argument.sourceArgument, sourceArgumentIndex: argument.sourceArgumentIndex,
        effectiveArgument: argument.effectiveArgument, effectiveArgumentIndex: argument.effectiveArgumentIndex,
        sourceForm: argument.sourceForm, spreadElementIndex: argument.spreadElementIndex,
        parameter: Object.freeze({ signature, index: parameter.index,
          ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }), form: argument.parameterForm }),
        source: argument.source, destination: Object.freeze({ declaration: slot, applied: argument.destination,
          application: Object.freeze({ kind: "call", identity }) }) }));
    }
    if (value.arguments.kind === "available") {
      for (const observed of value.arguments.values) {
        const place = arguments_.find(argument => argument.effectiveArgumentIndex === observed.effectiveArgumentIndex);
        if (place === undefined || place.sourceArgumentIndex !== observed.sourceArgumentIndex || place.sourceArgument !== observed.sourceArgument ||
          place.parameter.index !== observed.parameterIndex || place.spreadElementIndex !== observed.spreadElementIndex ||
          place.sourceForm !== observed.sourceForm || place.parameter.form !== observed.parameterForm) {
          throw new Error("An observed checker place must authenticate the same original Source argument and formal ordinals, never choose them.");
        }
      }
    }
    const proven: SourceInputBackingConstraint[] = [];
    for (const constraint of value.constraints) {
      const proof = context.proves(constraint, allBindings, value);
      if (proof.kind !== "resolved") return proof;
      if (!proof.value) return notApplicable(constraint.site, "An original checker backing constraint is not satisfied by this Source application.");
      proven.push(constraint);
    }
    let result = appliedSignature.value.result;
    const profileMember = original.signature.declaration === undefined || context.profile.kind === "none"
      ? undefined : context.profile.value.member(original.signature.declaration);
    if (profileMember?.resultPresence.kind === "serialization") {
      const selected = produceSourceSerializationResult(context, profileMember.resultPresence, invocation, arguments_, result);
      if (selected.kind !== "resolved") return selected;
      result = selected.value;
    }
    if (argumentDisposition === "dynamic") {
      const absence = absent(allBindings);
      if (absence.kind !== "resolved") return absence;
      const selected = builder.join(builder.componentIdentity(invocation, []), "inferred", [result, absence.value], input.syntax(invocation));
      if (selected.kind === "refused") return selected;
      result = selected.value;
    }
    const observedResult = selected.kind === "applicable" && selected.selection === value ? selected.selection.result : undefined;
    const occurrenceResult = builder.join(builder.componentIdentity(invocation, []), "inferred", [result], observedResult);
    if (occurrenceResult.kind === "refused") return occurrenceResult;
    result = occurrenceResult.value;
    return { kind: "resolved", value: Object.freeze({ kind: "applicable", candidate: value, proven: Object.freeze(proven),
      application: Object.freeze({ identity,
      kind: original.kind, optionalCall, argumentDisposition, callee: Object.freeze({ occurrence: original.callee.occurrence, value: callee.value }),
      receiver, sourceArguments: Object.freeze(sourceArguments), arguments: Object.freeze(arguments_), result }),
    }) };
  }

  return selectSourceCallCandidate(selected, invocation, candidate);
}
