import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "../../host-input/identities.js";
import type { SourceSignatureIdentity, SourceTypeBinding, SourceTypeDescriptorSignature, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceNodeNavigationFacts } from "../../source-model/navigation.js";
import { sourceOpenLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceSemanticRefusal, type SourceSemanticProduction } from "./semantic-production.js";
import type { SourceCallParameter } from "./argument-places.js";

export interface SourceCallableProduction extends SourceSemanticProduction {
  readonly navigation: SourceNodeNavigationFacts;
  value(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  place(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  parameter(component: SourceInputComponent, declaration: Node | undefined, signature: SourceSignatureIdentity, index: number,
    bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  completion(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  observeSignature(signature: SourceSignatureIdentity, result: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]): void;
}

export interface SourceProducedSignature {
  readonly identity: SourceSignatureIdentity;
  readonly receiver: { readonly declaration: Node | undefined; readonly value: SourceTypeEvidence } | undefined;
  readonly parameters: readonly SourceCallParameter[];
  readonly result: SourceTypeEvidence;
}

export function produceSourceCallableSignature(context: SourceCallableProduction, original: SourceInputSignature,
  bindings: readonly SourceTypeBinding[], constructedClass: Node | undefined): SourceProductionResult<SourceProducedSignature> {
  const { ast, input, builder, reader } = context;
  input.assertSignature(original);
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
    const component = input.signatureComponent(original, { kind: "parameter", index: parameter.index });
    const declaration = parameter.declaration ?? inheritedDeclaration(parameter.index);
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    const value = annotation === undefined ? context.parameter(component, declaration, identity, parameter.index, activeBindings)
      : reader.describeSyntax(annotation, activeBindings);
    if (value.kind !== "resolved") return value;
    parameters.push({ index: parameter.index, declaration, kind: parameter.rest ? "rest" : parameter.optional ? "optional" : "required", type: value.value });
  }
  let receiver: SourceProducedSignature["receiver"];
  if (shape.receiver !== undefined) {
    const declaration = shape.receiver.declaration ?? inheritedDeclaration("receiver");
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    const value = annotation === undefined ? context.place(input.signatureComponent(original, { kind: "receiver" }), activeBindings)
      : reader.describeSyntax(annotation, activeBindings);
    if (value.kind !== "resolved") return value;
    receiver = { declaration, value: value.value };
  }
  let result: SourceProductionResult<SourceTypeEvidence>;
  if (original.signatureKind === "construct" && constructedClass !== undefined) {
    const arguments_: SourceTypeEvidence[] = [];
    for (const declaration of ast.typeParameters(constructedClass)) {
      if (declaration === undefined) return sourceSemanticRefusal(constructedClass, "A constructed class requires its actual original binder vector.");
      const value = activeBindings.find(binding => binding.declaration === declaration)?.value;
      if (value === undefined) {
        const parameter = reader.describeSyntax(declaration, activeBindings);
        if (parameter.kind !== "resolved") return parameter;
        arguments_.push(parameter.value);
      } else arguments_.push(value);
    }
    const component = builder.componentIdentity(original.owner, [{ kind: "result", signature: identity }]);
    result = { kind: "resolved", value: builder.evidence({ type: builder.declared({ declaration: constructedClass,
      typeArguments: arguments_.map(value => value.type) }), component, category: { kind: "known", category: "object" },
    numeric: undefined, sum: undefined }, arguments_.map((value, index) => ({ selector: { kind: "type-argument" as const,
      declaration: constructedClass, index }, value })), undefined, sourceOpenLiteralDomain,
    { members: { kind: "definition" }, origins: { kind: "complete", nodes: [constructedClass] } }) };
  } else {
    const declaration = original.declaration ?? inheritedDeclaration("result");
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    result = annotation !== undefined ? reader.describeSyntax(annotation, activeBindings)
      : declaration === undefined ? context.place(input.signatureComponent(original, { kind: "result" }), activeBindings)
        : context.completion(declaration, activeBindings);
  }
  if (result.kind !== "resolved") return result;
  context.observeSignature(identity, result.value, bindings);
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

export function sourceProducedSignatureDescriptor(value: SourceProducedSignature): SourceTypeDescriptorSignature {
  return Object.freeze({ identity: value.identity, ...(value.receiver === undefined ? {} : { receiver: {
    ...(value.receiver.declaration === undefined ? {} : { declaration: value.receiver.declaration }), type: value.receiver.value.type } }),
  parameters: value.parameters.map(parameter => ({ kind: parameter.kind, type: parameter.type.type,
    ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) })), result: value.result.type });
}
