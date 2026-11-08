import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "../../host-input/identities.js";
import type { SourceSignatureIdentity, SourceTypeBinding, SourceTypeDescriptorSignature, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceEvidenceComponent, SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceNodeNavigationFacts } from "../../source-model/navigation.js";
import { sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceSemanticRefusal, type SourceSemanticProduction } from "./semantic-production.js";
import type { SourceCallParameter } from "./argument-places.js";
import { produceSourceDefinitionParameters } from "./definition-parameters.js";

export interface SourceCallableProduction extends SourceSemanticProduction {
  readonly navigation: SourceNodeNavigationFacts;
  value(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  place(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  parameter(component: SourceInputComponent, declaration: Node | undefined, signature: SourceSignatureIdentity, index: number,
    bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  completion(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  observeSignature(signature: SourceSignatureIdentity, result: SourceTypeEvidence, bindings: readonly SourceTypeBinding[], root: Node): void;
}

export interface SourceProducedSignature {
  readonly identity: SourceSignatureIdentity;
  readonly receiver: { readonly declaration: Node | undefined; readonly value: SourceTypeEvidence } | undefined;
  readonly parameters: readonly SourceCallParameter[];
  readonly result: SourceTypeEvidence;
}

export function produceSourceParameterPresence(context: Pick<SourceSemanticProduction, "builder" | "reader">,
  component: SourceInputComponent, value: SourceTypeEvidence, optional: boolean): SourceProductionResult<SourceTypeEvidence> {
  if (!optional) return { kind: "resolved", value };
  const { builder, reader } = context;
  const identity = reader.componentIdentity(component);
  if (value.type.kind === "optional" || value.sum?.arms.some(arm => arm.type.kind === "intrinsic" &&
    (arm.type.intrinsic === "absence" || arm.type.intrinsic === "void")) || value.type.kind === "intrinsic" &&
    (value.type.intrinsic === "absence" || value.type.intrinsic === "void")) return builder.join(identity, "authored", [value], component);
  const absence = builder.evidence({ type: builder.intrinsic("absence"), component: identity,
    category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
  { kind: "finite", values: [{ kind: "absence" }] },
  { members: { kind: "unavailable" }, origins: builder.sourceOriginSubjects(value) });
  return builder.join(identity, "authored", [value, absence], component);
}

export function produceSourceCallableSignature(context: SourceCallableProduction, original: SourceInputSignature,
  bindings: readonly SourceTypeBinding[], constructedClass: Node | undefined, root: Node): SourceProductionResult<SourceProducedSignature> {
  const { ast, input, builder, reader } = context;
  input.assertSignature(original);
  input.assertNode(root);
  const shape = input.describeSignature(original);
  if (shape.identity !== original) throw new Error("A Source callable shape requires its exact original signature witness.");
  for (const declaration of original.typeParameters) {
    const parameter = reader.describeSyntax(declaration, []);
    if (parameter.kind !== "resolved") return parameter;
    if (parameter.value.type.kind !== "parameter" || parameter.value.type.declaration !== declaration) {
      throw new Error("A Source callable binder must be its original canonical parameter descriptor.");
    }
  }
  const identity = builder.signature(original.owner, original.signatureKind, original, original.declaration, original.typeParameters);
  const inherited = constructedClass === undefined ? { kind: "resolved" as const, value: bindings }
    : produceSourceHeritageBindings(context, constructedClass, bindings);
  if (inherited.kind !== "resolved") return inherited;
  const activeBindings = inherited.value;
  function inheritedDeclaration(index: number | "receiver" | "result"): Node | undefined {
    const seen = new Set<SourceInputSignature>([original]);
    let current = shape.target;
    while (current !== undefined) {
      if (seen.has(current)) throw new Error("An original signature target relation cannot contain a cycle.");
      seen.add(current);
      const target = input.describeSignature(current);
      const declaration = index === "result" ? current.declaration : index === "receiver" ? target.receiver?.declaration
        : target.parameters[index]?.declaration;
      if (declaration !== undefined) return declaration;
      current = target.target;
    }
    return undefined;
  }
  const parameters: SourceCallParameter[] = [];
  for (const parameter of shape.parameters) {
    if (parameter.index !== parameters.length) throw new Error("A Source signature requires its original complete formal ordinal vector.");
    const component = input.signatureComponent(original, root, { kind: "parameter", index: parameter.index });
    const declaration = parameter.declaration ?? inheritedDeclaration(parameter.index);
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    const value = annotation === undefined ? context.parameter(component, declaration, identity, parameter.index, activeBindings)
      : reader.describeSyntax(annotation, activeBindings);
    if (value.kind !== "resolved") return value;
    const present = produceSourceParameterPresence(context, component, value.value, parameter.optional && !parameter.rest);
    if (present.kind !== "resolved") return present;
    parameters.push({ index: parameter.index, declaration, kind: parameter.rest ? "rest" : parameter.optional ? "optional" : "required", type: present.value });
  }
  let receiver: SourceProducedSignature["receiver"];
  if (shape.receiver !== undefined) {
    const declaration = shape.receiver.declaration ?? inheritedDeclaration("receiver");
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    const value = annotation === undefined ? context.place(input.signatureComponent(original, root, { kind: "receiver" }), activeBindings)
      : reader.describeSyntax(annotation, activeBindings);
    if (value.kind !== "resolved") return value;
    receiver = { declaration, value: value.value };
  }
  let result: SourceProductionResult<SourceTypeEvidence>;
  if (original.signatureKind === "construct" && constructedClass !== undefined) {
    const arguments_: SourceTypeEvidence[] = [];
    const parameters = produceSourceDefinitionParameters(context, constructedClass);
    if (parameters.kind !== "resolved") return parameters;
    for (const declaration of parameters.value) {
      const value = activeBindings.find(binding => binding.declaration === declaration)?.value;
      if (value === undefined) {
        const parameter = reader.describeSyntax(declaration, activeBindings);
        if (parameter.kind !== "resolved") return parameter;
        arguments_.push(parameter.value);
      } else arguments_.push(value);
    }
    const component = builder.componentIdentity(root, [{ kind: "result", signature: identity }]);
    result = { kind: "resolved", value: builder.evidence({ type: builder.declared({ declaration: constructedClass,
      typeArguments: arguments_.map(value => value.type) }), component, category: { kind: "known", category: "object" },
    numeric: undefined, sum: undefined }, arguments_.map((value, index) => ({ selector: { kind: "type-argument" as const,
      declaration: constructedClass, index }, value })), input.syntax(constructedClass), sourcePresentLiteralDomain,
    { members: { kind: "definition" }, origins: { kind: "complete", nodes: [constructedClass] } }) };
  } else {
    const declaration = original.declaration ?? inheritedDeclaration("result");
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    result = annotation !== undefined ? reader.describeSyntax(annotation, activeBindings)
      : declaration === undefined ? context.place(input.signatureComponent(original, root, { kind: "result" }), activeBindings)
        : context.completion(declaration, activeBindings);
  }
  if (result.kind !== "resolved") return result;
  context.observeSignature(identity, result.value, bindings, root);
  return { kind: "resolved", value: Object.freeze({ identity, receiver, parameters: Object.freeze(parameters), result: result.value }) };
}

export function produceSourceHeritageBindings(context: SourceCallableProduction, declaration: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceTypeBinding[]> {
  const { ast, reader, navigation } = context;
  const values = new Map(bindings.map(binding => [binding.declaration, binding.value]));
  const active = new Set<Node>();
  function visit(owner: Node): SourceProductionResult<readonly SourceTypeBinding[]> {
    if (active.has(owner)) return sourceSemanticRefusal(owner, "An original class heritage application depends on itself.", "TSONIC_LOCAL_TYPE_SELF_REFERENCE");
    active.add(owner);
    const selected = ast.is.IsClassDeclaration(owner) ? ast.as.AsClassDeclaration(owner)
      : ast.is.IsClassExpression(owner) ? ast.as.AsClassExpression(owner)
      : ast.is.IsInterfaceDeclaration(owner) ? ast.as.AsInterfaceDeclaration(owner) : undefined;
    for (const clause of selected?.HeritageClauses?.Nodes ?? []) {
      if (clause === undefined || !ast.is.IsHeritageClause(clause)) return sourceSemanticRefusal(owner, "An original heritage clause is missing.");
      const heritage = ast.as.AsHeritageClause(clause);
      for (const reference of heritage?.Types?.Nodes ?? []) {
        if (reference === undefined || !ast.is.IsExpressionWithTypeArguments(reference)) return sourceSemanticRefusal(clause, "An original heritage application is missing.");
        const expression = ast.as.AsExpressionWithTypeArguments(reference)?.Expression;
        const base = navigation.sourceReferenceFor(expression)?.declaration;
        if (base === undefined) return sourceSemanticRefusal(reference, "An original heritage application requires its actual selected declaration.");
        const arguments_ = ast.typeArguments(reference), parameters = ast.typeParameters(base);
        if (arguments_.length > parameters.length) return sourceSemanticRefusal(reference, "An original heritage application has an invalid binder vector.");
        for (const [index, parameter] of parameters.entries()) {
          if (parameter === undefined) return sourceSemanticRefusal(base, "An original base binder is missing.");
          const ordered = [...values].map(([declaration, value]) => ({ declaration, value }));
          const syntax = arguments_[index] ?? (ast.is.IsTypeParameterDeclaration(parameter) ? ast.as.AsTypeParameterDeclaration(parameter)?.DefaultType : undefined);
          if (syntax === undefined) return sourceSemanticRefusal(reference, "An original base application leaves its class binder unbound.", "TSONIC_LOCAL_TYPE_GENERIC");
          const value = reader.describeSyntax(syntax, ordered);
          if (value.kind !== "resolved") return value;
          values.set(parameter, value.value);
        }
        const nested = visit(base);
        if (nested.kind !== "resolved") return nested;
      }
    }
    active.delete(owner);
    return { kind: "resolved", value: Object.freeze([...values].map(([declaration, value]) => ({ declaration, value }))) };
  }
  return visit(declaration);
}

export function produceSourceReceiverBindings(context: SourceCallableProduction, receiver: SourceTypeEvidence,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceTypeBinding[]> {
  const { ast, builder, reader } = context;
  builder.assertEvidence(receiver);
  if (receiver.type.kind !== "declared") return { kind: "resolved", value: bindings };
  const declaration = receiver.type.declaration;
  const parameters = produceSourceDefinitionParameters(context, declaration);
  if (parameters.kind !== "resolved") return parameters;
  if (parameters.value.length !== receiver.type.typeArguments.length) throw new Error("A declared receiver must retain its complete registered definition argument vector.");
  const selected = new Map(bindings.map(binding => [binding.declaration, binding.value]));
  for (const [index, parameter] of parameters.value.entries()) {
    const value = builder.component(receiver, { kind: "type-argument", declaration, index });
    if (value.kind === "refused") return value;
    selected.set(parameter, value.value);
  }
  const environment = [...selected].map(([declaration, value]) => ({ declaration, value }));
  if (ast.is.IsTypeAliasDeclaration(declaration)) {
    const body = ast.typeNode(declaration);
    if (body === undefined) throw new Error("An original type alias requires its authored definition body.");
    const value = reader.describeSyntax(body, environment);
    if (value.kind !== "resolved") return value;
    if (value.value.type.kind === "declared" && value.value.type.declaration === declaration) return sourceSemanticRefusal(declaration,
      "An original receiver alias depends on its own unexpanded application.", "TSONIC_LOCAL_TYPE_SELF_REFERENCE");
    return produceSourceReceiverBindings(context, value.value, environment);
  }
  return produceSourceHeritageBindings(context, declaration, environment);
}

export function sourceProducedSignatureDescriptor(value: SourceProducedSignature): SourceTypeDescriptorSignature {
  return Object.freeze({ identity: value.identity, ...(value.receiver === undefined ? {} : { receiver: {
    ...(value.receiver.declaration === undefined ? {} : { declaration: value.receiver.declaration }), type: value.receiver.value.type } }),
  parameters: value.parameters.map(parameter => ({ kind: parameter.kind, type: parameter.type.type,
    ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) })), result: value.result.type });
}

export function produceSourceBodyCallable(context: SourceCallableProduction, declaration: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
  const { ast, input, builder } = context;
  input.assertNode(declaration);
  const original = input.signatureForDeclaration(declaration);
  if (original.kind === "none") return sourceSemanticRefusal(declaration,
    "An original callable body requires its authentic implementation signature.", "TSONIC_LOCAL_TYPE_SIGNATURE");
  const owner = ast.is.IsConstructorDeclaration(declaration) ? ast.parent(declaration) : undefined;
  if (owner !== undefined && !ast.is.IsClassDeclaration(owner) && !ast.is.IsClassExpression(owner))
    throw new Error("An original constructor implementation requires its actual class owner.");
  const produced = produceSourceCallableSignature(context, original.value, bindings, owner, declaration);
  if (produced.kind !== "resolved") return produced;
  const signature = produced.value;
  if (signature.identity.declaration !== declaration)
    throw new Error("A body callable must retain its original API-domain implementation declaration.");
  const children: SourceEvidenceComponent[] = signature.parameters.map(parameter => ({
    selector: { kind: "parameter", signature: signature.identity, index: parameter.index }, value: parameter.type }));
  if (signature.receiver !== undefined) children.push({ selector: { kind: "receiver", signature: signature.identity }, value: signature.receiver.value });
  children.push({ selector: { kind: "result", signature: signature.identity }, value: signature.result });
  const descriptor = sourceProducedSignatureDescriptor(signature);
  return { kind: "resolved", value: builder.evidence({ type: builder.callable({
    calls: signature.identity.kind === "call" ? [descriptor] : [], constructs: signature.identity.kind === "construct" ? [descriptor] : [] }),
  component: builder.componentIdentity(declaration, []), category: { kind: "known", category: "function" }, numeric: undefined, sum: undefined },
  children, undefined, sourcePresentLiteralDomain,
  { members: { kind: "complete", members: [], indexes: [] }, origins: { kind: "complete", nodes: [declaration] } }) };
}
