import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../../host-input/descriptor-input.js";
import type { SourcePresence, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceNodeNavigationFacts } from "../../source-model/navigation.js";
import { sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { sourceReceiverOwner } from "../../source-navigation/receiver-owner.js";
import type { SourceDescriptorBuilder, SourceDescriptorReader, SourceProducedReceiver } from "../descriptor-contracts.js";
import { sourceOriginalTypeParameterCaptures } from "./type-parameter-captures.js";

export interface SourceReceiverProduction {
  readonly ast: AstReader;
  readonly input: SourceDescriptorInput;
  readonly builder: SourceDescriptorBuilder;
  readonly reader: SourceDescriptorReader;
  readonly navigation: SourceNodeNavigationFacts;
  value(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
}

export function produceSourceConstructionReference(context: SourceReceiverProduction, occurrence: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
  const { ast, input, builder, reader, navigation } = context;
  input.assertNode(occurrence);
  if (!ast.is.IsObjectLiteralExpression(occurrence)) throw new Error("An anonymous Source receiver requires its actual original object literal.");
  const ordered = sourceOriginalTypeParameterCaptures({ ast, navigation }, occurrence);
  const values: SourceTypeEvidence[] = [];
  for (const declaration of ordered) {
    const parameter = reader.describeSyntax(declaration, []);
    if (parameter.kind !== "resolved") return parameter;
    const selected = bindings.find(binding => binding.declaration === declaration)?.value ?? parameter.value;
    builder.assertEvidence(selected);
    values.push(selected);
  }
  const definition = builder.constructionDefinition(occurrence, ordered);
  builder.define({ kind: "construction", definition }, ordered,
    () => context.value(occurrence, []), () => builder.construction(occurrence));
  return { kind: "resolved", value: builder.evidence({ type: builder.constructionReference(definition, values.map(value => value.type)),
    component: builder.componentIdentity(occurrence, []), category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined },
  values.map((value, index) => ({ selector: { kind: "construction-argument" as const, definition, index }, value })), input.syntax(occurrence),
  sourcePresentLiteralDomain, { members: { kind: "definition" }, origins: { kind: "complete", nodes: [occurrence] } }) };
}

export function produceSourceReceiver(context: SourceReceiverProduction, declaration: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourcePresence<SourceProducedReceiver>> {
  const { ast, input, builder, reader } = context;
  input.assertNode(declaration);
  const none = { kind: "resolved", value: { kind: "none" } } as const;
  if (ast.is.IsArrowFunction(declaration)) {
    const enclosing = sourceReceiverOwner(declaration, ast, "lexical-capture");
    if (enclosing === undefined || ast.is.IsSourceFile(enclosing)) return none;
    const inherited = produceSourceReceiver(context, enclosing, bindings);
    if (inherited.kind !== "resolved" || inherited.value.kind === "none") return inherited;
    if (ast.is.IsPropertyDeclaration(enclosing) || ast.is.IsClassStaticBlockDeclaration(enclosing)) return inherited;
    const original = input.signatureForDeclaration(enclosing);
    if (original.kind === "none") throw new Error("A lexical callable receiver requires its genuine original API signature.");
    for (const parameter of original.value.typeParameters) {
      const registered = reader.describeSyntax(parameter, []);
      if (registered.kind !== "resolved") return registered;
    }
    const signature = builder.signature(original.value.owner, original.value.signatureKind, original.value,
      original.value.declaration, original.value.typeParameters);
    return { kind: "resolved", value: { kind: "present", value: { declaration: undefined, value: inherited.value.value.value,
      origin: { kind: "lexical", owner: enclosing, signature } } } };
  }
  if (context.navigation.callableRoles(declaration).signature) {
    const original = input.signatureForDeclaration(declaration);
    if (original.kind !== "none") {
      const receiver = input.describeSignature(original.value).receiver;
      if (receiver !== undefined) {
        if (receiver.declaration === undefined) throw new Error("An explicit Source receiver requires its original this parameter, not an implicit checked symbol.");
        const annotation = ast.typeNode(receiver.declaration);
        const value = annotation === undefined
          ? reader.describeComponent(input.signatureComponent(original.value, declaration, { kind: "receiver" }), bindings)
          : reader.describeSyntax(annotation, bindings);
        return value.kind !== "resolved" ? value : { kind: "resolved", value: { kind: "present", value: {
          declaration: receiver.declaration, origin: { kind: "explicit", declaration: receiver.declaration }, value: value.value } } };
      }
    }
  }
  const parent = ast.parent(declaration);
  if (parent !== undefined && (ast.is.IsClassDeclaration(parent) || ast.is.IsClassExpression(parent))) {
    const isStatic = ast.is.IsClassStaticBlockDeclaration(declaration) || ast.hasModifierKind(declaration, "static");
    const value = reader.describeComponent(input.classFacets(parent)[isStatic ? "value" : "instance"], bindings);
    return value.kind !== "resolved" ? value : { kind: "resolved", value: { kind: "present", value: {
      declaration: undefined, origin: { kind: isStatic ? "static" : "instance", owner: parent }, value: value.value } } };
  }
  if (parent !== undefined && ast.is.IsObjectLiteralExpression(parent) && (ast.is.IsMethodDeclaration(declaration) ||
    ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration))) {
    const value = produceSourceConstructionReference(context, parent, bindings);
    if (value.kind !== "resolved") return value;
    if (value.value.type.kind !== "construction-reference") throw new Error("An object receiver requires its authentic construction reference.");
    return { kind: "resolved", value: { kind: "present", value: { declaration: undefined,
      origin: { kind: "object", definition: value.value.type.definition }, value: value.value } } };
  }
  return none;
}

export function produceSourceReceiverUse(context: SourceReceiverProduction, occurrence: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourcePresence<SourceProducedReceiver>> {
  context.input.assertNode(occurrence);
  const owner = sourceReceiverOwner(occurrence, context.ast, "lexical-capture");
  if (owner === undefined || context.ast.is.IsSourceFile(owner)) return { kind: "resolved", value: { kind: "none" } };
  return produceSourceReceiver(context, owner, bindings);
}
