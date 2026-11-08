import type { Node } from "@tsonic/tsts";
import type { SourceDeclaredSlot, SourcePresence, SourceTypeBinding, SourceTypeEvidence, SourceUseDestination } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { Node_Initializer, sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import type { SourceTypeFlowAnalysisContext } from "./types.js";
import { sourceSemanticRefusal } from "./semantic-production.js";

export function createSourceTypeFlowDeclaredSlotReader(context: SourceTypeFlowAnalysisContext) {
  const { ast, input, navigation, descriptorBuilder: builder } = context.source;
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);
  const active = new Set<Node>();
  const present = (declaration: SourceDeclaredSlot, applied = declaration.type): SourceProductionResult<SourcePresence<SourceUseDestination>> =>
    ({ kind: "resolved", value: { kind: "present", value: { declaration, applied, application: undefined } } });

  function annotated(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourcePresence<SourceUseDestination>> {
    const annotation = ast.typeNode(declaration);
    if (annotation === undefined) return none;
    const original = context.reader.describeSyntax(annotation, []);
    if (original.kind !== "resolved") return original;
    const applied = bindings.length === 0 ? original : builder.substitute(original.value, bindings);
    if (applied.kind !== "resolved") return applied;
    return present({ origin: { kind: "declaration", declaration }, type: original.value }, applied.value);
  }

  function destination(node: Node, bindings: readonly SourceTypeBinding[] = []): SourceProductionResult<SourcePresence<SourceUseDestination>> {
    input.assertNode(node);
    if (active.has(node)) return none;
    active.add(node);
    try {
      if (ast.is.IsVariableDeclaration(node) || ast.is.IsPropertyDeclaration(node) || ast.is.IsParameterDeclaration(node) || ast.is.IsPropertySignatureDeclaration(node)) {
        return annotated(node, bindings);
      }
      let current = node;
      let parent = ast.parent(current);
      while (parent !== undefined && sourceTransparentExpressionOperand(ast, parent) === current &&
        !ast.is.IsAsExpression(parent) && !ast.is.IsTypeAssertion(parent)) {
        current = parent;
        parent = ast.parent(current);
      }
      if (parent === undefined) return none;
      if ((ast.is.IsVariableDeclaration(parent) || ast.is.IsPropertyDeclaration(parent) || ast.is.IsParameterDeclaration(parent)) &&
        Node_Initializer(ast, parent) === current) return annotated(parent, bindings);
      if (ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent) || ast.is.IsSatisfiesExpression(parent)) {
        const annotation = ast.typeNode(parent);
        if (annotation === undefined) return none;
        const value = context.reader.describeSyntax(annotation, bindings);
        return value.kind !== "resolved" ? value : present({ origin: { kind: "declaration", declaration: parent }, type: value.value });
      }
      if (ast.is.IsReturnStatement(parent) || navigation.callableRoles(parent).body && ast.body(parent) === current) {
        const owner = ast.is.IsReturnStatement(parent) ? navigation.enclosing(parent, "body") : parent;
        return owner === undefined ? none : annotated(owner, bindings);
      }
      if (ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindEqualsToken" &&
        ast.as.AsBinaryExpression(parent)?.Right === current) {
        const target = ast.as.AsBinaryExpression(parent)?.Left;
        if (target === undefined) return none;
        const declaration = navigation.sourceReferenceFor(target)?.declaration;
        return declaration === undefined ? context.destination(target, bindings) : annotated(declaration, bindings);
      }
      const invocation = ast.is.IsSpreadElement(parent) ? ast.parent(parent) : parent;
      if (invocation !== undefined && (ast.is.IsCallExpression(invocation) || ast.is.IsNewExpression(invocation))) {
        const application = context.application(invocation);
        if (application.kind !== "resolved") return application;
        const places = application.value.arguments.filter(argument => argument.effectiveArgument === node ||
          application.value.sourceArguments[argument.sourceArgumentIndex]?.operand.occurrence === current);
        if (places.length === 1) return { kind: "resolved", value: { kind: "present", value: places[0]!.destination } };
        if (places.length > 1 && places.every(place => place.destination.applied === places[0]!.destination.applied)) {
          return { kind: "resolved", value: { kind: "present", value: places[0]!.destination } };
        }
      }
      if (ast.is.IsIdentifier(node)) {
        const declaration = navigation.sourceReferenceFor(node)?.declaration;
        if (declaration !== undefined && declaration !== node) {
          const slot = context.declared(declaration, bindings);
          return slot.kind !== "resolved" ? slot : present(slot.value);
        }
      }
      return none;
    } finally { active.delete(node); }
  }

  function parameter(declaration: Node, bindings: readonly SourceTypeBinding[] = []): SourceProductionResult<SourcePresence<SourceTypeEvidence>> {
    if (!ast.is.IsParameterDeclaration(declaration)) throw new Error("A Source contextual parameter question requires an original parameter declaration.");
    const annotation = ast.typeNode(declaration);
    if (annotation !== undefined) {
      const value = context.reader.describeSyntax(annotation, bindings);
      return value.kind !== "resolved" ? value : { kind: "resolved", value: { kind: "present", value: value.value } };
    }
    const owner = ast.parent(declaration);
    if (owner === undefined) return none;
    const selected = destination(owner, bindings);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "none") return none;
    const definition = builder.produceDefinition(selected.value.value.applied);
    if (definition.kind !== "resolved") return definition;
    const type = definition.value.type;
    if (type.kind !== "shape" && type.kind !== "callable" || type.calls.length !== 1) return none;
    const signature = type.calls[0]!;
    const parameters = ast.parameters(owner).filter((parameter): parameter is Node => parameter !== undefined);
    const index = parameters.indexOf(declaration);
    if (index < 0) throw new Error("An original contextual parameter must occur in its owning syntax vector.");
    if (signature.parameters[index] === undefined) return sourceSemanticRefusal(declaration, "A contextual callable omits this original parameter slot.", "TSONIC_LOCAL_TYPE_SIGNATURE");
    const value = builder.component(definition.value, { kind: "parameter", signature: signature.identity, index });
    return value.kind === "refused" ? value : { kind: "resolved", value: { kind: "present", value: value.value } };
  }

  function returned(declaration: Node, bindings: readonly SourceTypeBinding[] = []): SourceProductionResult<SourcePresence<SourceTypeEvidence>> {
    const selected = annotated(declaration, bindings);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "none") return none;
    return { kind: "resolved", value: { kind: "present", value: selected.value.value.applied } };
  }

  return Object.freeze({ destination, parameter, returned });
}
