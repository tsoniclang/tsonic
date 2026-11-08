import type { Node } from "@tsonic/tsts";
import type {
  SourceInputBackingConstraint, SourceInputCallCandidate, SourceInputDiagnosticIdentity, SourceInputTypeArgument,
} from "../../host-input/call-input.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type {
  SourceApplication, SourceApplicationIdentity, SourceApplicationReceiver, SourceArgumentPlace, SourceAuthoredArgument,
  SourceDeclaredSlot, SourceTypeBinding, SourceTypeEvidence,
} from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import { produceSourceCallableSignature, produceSourceHeritageBindings, type SourceCallableProduction } from "./callable-production.js";
import { produceSourceArgumentPlaces } from "./argument-places.js";

export interface SourceApplicationProduction extends SourceCallableProduction {
  component(component: SourceInputComponent, bindings: readonly SourceTypeBinding[], candidate: SourceInputCallCandidate): SourceProductionResult<SourceTypeEvidence>;
  admits(source: SourceTypeEvidence, destination: SourceTypeEvidence, site: Node): SourceProductionResult<boolean>;
  proves(constraint: SourceInputBackingConstraint, bindings: readonly SourceTypeBinding[], candidate: SourceInputCallCandidate): SourceProductionResult<boolean>;
}

export interface SourceProducedApplication {
  readonly application: SourceApplication;
  readonly diagnostics: readonly SourceInputDiagnosticIdentity[];
}

export function produceSourceApplication(context: SourceApplicationProduction, invocation: Node): SourceProductionResult<SourceProducedApplication> {
  const { builder, input, reader } = context;
  const selected = input.application(invocation);
  const refusal = (message: string) => sourceSemanticRefusal(invocation, message, "TSONIC_LOCAL_TYPE_GENERIC");
  if (selected.kind === "untyped") return refusal("This application has no original callable candidate to authenticate.");

  function candidate(value: SourceInputCallCandidate): SourceProductionResult<SourceProducedApplication> {
    const original = value.application;
    if (original.invocation !== invocation || value.identity.invocation !== invocation) {
      throw new Error("A Source call candidate requires its identical original invocation.");
    }
    input.assertSignature(original.signature);
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

    for (const parameter of parameters) {
      const value = stated(parameter);
      if (value === undefined) continue;
      if (value.kind !== "resolved") return value;
      bindings.set(parameter.declaration!, value.value);
    }
    let receiver: SourceApplicationReceiver = Object.freeze({ kind: "none" });
    const selectedReceiver = original.receiver;
    if (selectedReceiver !== undefined) {
      if (selectedReceiver.role === "value") {
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
        if (value.value.type.kind === "declared") {
          const receiverBindings: SourceTypeBinding[] = [];
          for (const [index, declaration] of context.ast.typeParameters(value.value.type.declaration).entries()) {
            if (declaration === undefined) return refusal("A receiver application requires its actual original class binder vector.");
            const argument = builder.component(value.value, { kind: "type-argument", declaration: value.value.type.declaration, index });
            if (argument.kind === "refused") return argument;
            receiverBindings.push({ declaration, value: argument.value });
          }
          const inherited = produceSourceHeritageBindings(context, value.value.type.declaration, [...ordered(), ...receiverBindings]);
          if (inherited.kind !== "resolved") return inherited;
          for (const argument of original.class.arguments) {
            const declaration = argument.declaration!;
            const binding = inherited.value.find(candidate => candidate.declaration === declaration);
            if (binding !== undefined && !bindings.has(declaration)) bindings.set(declaration, binding.value);
          }
        }
      }
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
      if (!admission.value) return refusal("An original Source generic argument does not satisfy its applied declared constraint.");
    }

    const classCount = original.class?.arguments.length ?? 0;
    const allBindings = ordered();
    const identity: SourceApplicationIdentity = Object.freeze({ invocation, signature,
      classBindings: Object.freeze(allBindings.slice(0, classCount)),
      signatureBindings: Object.freeze(allBindings.slice(classCount)) });
    const sourceArguments: SourceAuthoredArgument[] = [];
    for (const argument of value.sourceArguments) {
      const source = context.value(argument.expression, allBindings);
      if (source.kind !== "resolved") return source;
      sourceArguments.push(Object.freeze({ occurrence: argument.occurrence, form: argument.form,
        operand: Object.freeze({ occurrence: argument.expression, value: source.value }) }));
    }
    const arguments_: SourceArgumentPlace[] = [];
    const declaredSignature = produceSourceCallableSignature(context, original.signature, [], original.class?.declaration);
    if (declaredSignature.kind !== "resolved") return declaredSignature;
    const appliedSignature = produceSourceCallableSignature(context, original.signature, allBindings, original.class?.declaration);
    if (appliedSignature.kind !== "resolved") return appliedSignature;
    const places = produceSourceArgumentPlaces({ builder, invocation, sourceArguments, parameters: appliedSignature.value.parameters });
    if (places.kind !== "resolved") return places;
    for (const argument of places.value) {
      const parameter = declaredSignature.value.parameters[argument.parameter.index];
      if (parameter === undefined || parameter.index !== argument.parameter.index) throw new Error("An applied Source parameter requires its original authored declaration slot.");
      const slot: SourceDeclaredSlot = Object.freeze({ origin: Object.freeze({ kind: "parameter", signature,
        index: parameter.index, ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) }), type: parameter.type });
      const admission = context.admits(argument.source, argument.destination, argument.effectiveArgument);
      if (admission.kind !== "resolved") return admission;
      if (!admission.value) return refusal("A Source argument does not fit its exact applied parameter destination.");
      arguments_.push(Object.freeze({ sourceArgument: argument.sourceArgument, sourceArgumentIndex: argument.sourceArgumentIndex,
        effectiveArgument: argument.effectiveArgument, effectiveArgumentIndex: argument.effectiveArgumentIndex,
        sourceForm: argument.sourceForm, spreadElementIndex: argument.spreadElementIndex,
        parameter: Object.freeze({ signature, index: parameter.index,
          ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }), form: argument.parameterForm }),
        source: argument.source, destination: Object.freeze({ declaration: slot, applied: argument.destination, application: identity }) }));
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
    const diagnostics = new Set<SourceInputDiagnosticIdentity>();
    for (const constraint of value.constraints) {
      const proof = context.proves(constraint, allBindings, value);
      if (proof.kind !== "resolved") return proof;
      if (!proof.value) return refusal("An original checker backing constraint has no authenticated Source proof.");
      diagnostics.add(constraint.diagnostic);
    }
    if (value.diagnostics.some(diagnostic => !diagnostics.has(diagnostic))) {
      return refusal("An original callable candidate retains a checker diagnostic not covered by its exact Source constraints.");
    }
    return { kind: "resolved", value: Object.freeze({ application: Object.freeze({ identity,
      kind: original.kind, receiver, sourceArguments: Object.freeze(sourceArguments), arguments: Object.freeze(arguments_), result: appliedSignature.value.result }),
    diagnostics: Object.freeze([...diagnostics]) }) };
  }

  if (selected.kind === "applicable") return candidate(selected.selection);
  const candidates = selected.candidates.map(candidate);
  const pending = candidates.filter(value => value.kind === "pending");
  if (pending.length > 0) return { kind: "pending", dependencies: Object.freeze([...new Set(pending.flatMap(value => value.dependencies))]) };
  const admitted = candidates.filter(value => value.kind === "resolved");
  if (admitted.length === 0) return candidates.find(value => value.kind === "refused") ?? refusal("No original conditional call candidate has an authenticated Source application.");
  if (admitted.length !== 1) return refusal("Several original conditional call candidates remain admitted without one canonical Source selection.");
  const result = admitted[0]!;
  const discharged = new Set(result.value.diagnostics);
  if (selected.diagnostics.some(diagnostic => !discharged.has(diagnostic))) {
    return refusal("This conditional call retains an unrelated original checker diagnostic.");
  }
  return result;
}
