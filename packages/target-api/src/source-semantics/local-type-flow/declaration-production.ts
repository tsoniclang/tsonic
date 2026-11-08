import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceDeclaredSlot, SourceTypeBinding, SourceTypeEvidence, SourceUseDestination } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceCorrespondenceMember } from "../member-correspondence.js";
import { Node_Initializer } from "../../source-navigation/ast.js";
import { produceSourceHeritageBindings, type SourceCallableProduction } from "./callable-production.js";
import { sourceTypeFlowCallableReturns } from "./callable-returns.js";
import { sourceProductionValues, sourceSemanticRefusal } from "./semantic-production.js";
import { sourceStoredValueDomain } from "./value-production.js";
import type { SourceTypeFlowAnalysisContext } from "./types.js";
import { produceSourceBindingValue } from "./binding-production.js";

export interface SourceDeclarationProduction extends SourceCallableProduction {
  readonly context: SourceTypeFlowAnalysisContext;
  inferred(node: Node): SourceProductionResult<SourceTypeEvidence>;
  iteration(declaration: Node): SourceProductionResult<SourceTypeEvidence | undefined>;
  enumValue(component: SourceInputComponent, declaration: Node): SourceProductionResult<SourceTypeEvidence>;
}

export function produceSourceDeclaredSlot(production: SourceDeclarationProduction, declaration: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceDeclaredSlot> {
  const { ast, reader, input, context } = production;
  input.assertNode(declaration);
  const annotation = ast.typeNode(declaration);
  let value: SourceProductionResult<SourceTypeEvidence>;
  if (ast.is.IsFunctionDeclaration(declaration) || ast.is.IsFunctionExpression(declaration) || ast.is.IsArrowFunction(declaration) ||
    ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration) ||
    ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration)) {
    value = reader.describeComponent(input.syntax(declaration), bindings);
  } else if (ast.is.IsEnumDeclaration(declaration) || ast.is.IsEnumMember(declaration)) value = production.enumValue(input.syntax(declaration), declaration);
  else if (annotation !== undefined) value = reader.describeSyntax(annotation, bindings);
  else if (ast.is.IsBindingElement(declaration)) value = produceSourceBindingValue(production, declaration, bindings, true);
  else if (ast.is.IsParameterDeclaration(declaration)) {
    const selected = production.context.destination(declaration, bindings);
    if (selected.kind !== "resolved") return selected;
    value = selected.value.kind === "present" ? { kind: "resolved", value: selected.value.value.applied }
      : production.inferred(declaration);
  } else if (ast.is.IsGetAccessorDeclaration(declaration)) value = production.completion(declaration, bindings);
  else {
    const initializer = Node_Initializer(ast, declaration);
    const iteration = initializer === undefined ? production.iteration(declaration) : undefined;
    if (iteration !== undefined && iteration.kind !== "resolved") return iteration;
    value = initializer === undefined ? iteration?.kind === "resolved" && iteration.value !== undefined ? { kind: "resolved", value: iteration.value }
      : production.inferred(declaration) : context.value(initializer, bindings);
    if (value.kind === "resolved") {
      const mutable = ast.is.IsVariableDeclaration(declaration) ? ast.variableDeclarationKind(declaration) !== "const"
        : ast.is.IsPropertyDeclaration(declaration) && !ast.hasModifierKind(declaration, "readonly");
      value = sourceStoredValueDomain(production, value.value, declaration, mutable);
    }
  }
  if (value.kind !== "resolved") return value;
  return { kind: "resolved", value: Object.freeze({ origin: { kind: "declaration" as const, declaration }, type: value.value }) };
}

export function produceSourceDeclaredComponent(production: SourceDeclarationProduction, component: SourceInputComponent,
  declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
  const { ast, input, reader, context } = production;
  input.assertComponent(component);
  const last = component.path.at(-1);
  if (last?.kind === "result") return production.completion(declaration, bindings);
  if (last?.kind === "parameter" || last?.kind === "receiver") {
    const annotation = ast.typeNode(declaration);
    if (annotation !== undefined) return reader.describeSyntax(annotation, bindings);
    const selected = context.destination(declaration, bindings);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "present") return { kind: "resolved", value: selected.value.value.applied };
    const initializer = Node_Initializer(ast, declaration);
    if (initializer !== undefined) return context.value(initializer, bindings);
    return production.inferred(declaration);
  }
  if (ast.is.IsEnumDeclaration(declaration) || ast.is.IsEnumMember(declaration)) return production.enumValue(component, declaration);
  if (ast.is.IsGetAccessorDeclaration(declaration)) return production.completion(declaration, bindings);
  const slot = context.declared(declaration, bindings);
  return slot.kind !== "resolved" ? slot : { kind: "resolved", value: slot.value.type };
}

export function produceSourceCallableCompletion(production: SourceDeclarationProduction, declaration: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
  const { ast, builder, reader } = production;
  const annotation = ast.typeNode(declaration);
  if (annotation !== undefined) return reader.describeSyntax(annotation, bindings);
  if (ast.body(declaration) === undefined) return sourceSemanticRefusal(declaration,
    "An original bodyless callable requires its authored return component or an authenticated original target signature.", "TSONIC_LOCAL_TYPE_SIGNATURE");
  const returned = sourceTypeFlowCallableReturns(production.context.source, declaration);
  const values = sourceProductionValues(returned.returned.map(node => production.value(node, bindings)));
  if (values.kind !== "resolved") return values;
  const roles = [...values.value];
  if (returned.absent || returned.returned.length === 0) roles.push(builder.evidence({ type: builder.intrinsic("void"),
    component: builder.componentIdentity(declaration, []), category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined },
  [], undefined, { kind: "finite", values: [{ kind: "absence" }] },
  { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [declaration] } }));
  return builder.join(builder.componentIdentity(declaration, []), "inferred", roles, undefined);
}

export function produceSourceMemberDestination(production: SourceDeclarationProduction, occurrence: Node,
  receiver: SourceTypeEvidence, member: SourceCorrespondenceMember): SourceProductionResult<SourceUseDestination> {
  const { builder, ast } = production;
  builder.assertEvidence(receiver);
  const declarations = member.writeType === undefined ? member.readOrigins : member.writeOrigins;
  const originalDeclarations = [...new Set(declarations.flatMap(origin => origin.kind === "declared" ? [origin.declaration] : []))];
  if (originalDeclarations.length !== 1) return sourceSemanticRefusal(occurrence,
    "An original member destination requires one exact role-specific declaration, not a property name.");
  const declaration = originalDeclarations[0]!;
  const original = production.context.declared(declaration, []);
  if (original.kind !== "resolved") return original;
  const bindings: SourceTypeBinding[] = [];
  if (receiver.type.kind === "declared") {
    for (const [index, parameter] of ast.typeParameters(receiver.type.declaration).entries()) {
      if (parameter === undefined) throw new Error("An original declared receiver requires its complete class binder vector.");
      const value = builder.component(receiver, { kind: "type-argument", declaration: receiver.type.declaration, index });
      if (value.kind === "refused") return value;
      bindings.push({ declaration: parameter, value: value.value });
    }
    const inherited = produceSourceHeritageBindings(production, receiver.type.declaration, bindings);
    if (inherited.kind !== "resolved") return inherited;
    bindings.splice(0, bindings.length, ...inherited.value);
  }
  const applied = bindings.length === 0 ? { kind: "resolved" as const, value: original.value.type } : builder.substitute(original.value.type, bindings);
  if (applied.kind !== "resolved") return applied;
  const destination: SourceUseDestination = Object.freeze({ declaration: original.value, applied: applied.value,
    application: applied.value === original.value.type ? undefined : Object.freeze({ kind: "receiver", receiver, bindings: Object.freeze(bindings) }) });
  builder.assertDestination(destination);
  return { kind: "resolved", value: destination };
}

export function sourceUnresolvedDeclaration(production: SourceDeclarationProduction, declaration: Node): SourceProductionResult<SourceTypeEvidence> {
  const { input } = production;
  const facts = input.describe(input.syntax(declaration));
  if (facts.kind !== "unavailable") return production.reader.describeComponent(facts.component, []);
  return sourceSemanticRefusal(declaration,
    "This original declaration has neither an authored Source slot nor a solved initializer, parameter, or body result.", "TSONIC_LOCAL_TYPE_UNSUPPORTED");
}
