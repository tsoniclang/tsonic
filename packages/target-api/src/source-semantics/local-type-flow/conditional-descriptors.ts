import type { Node, Type, TypeAliasApplicationInfo } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../types.js";
import { sourceTypeDescriptorStructure, sourceTypeDescriptorsEqual, sourceTypeDescriptorUnion } from "./terms.js";
import type { SourceTypeDescriptor, SourceTypeFlowSource } from "./types.js";

type Bindings = ReadonlyMap<Node, SourceTypeDescriptor>;

export function sourceTypeDescriptorConditionalDefinition(
  source: SourceTypeFlowSource,
  queries: SourceFileSemantics,
  application: TypeAliasApplicationInfo,
  bindings: Bindings,
  read: (node: Node, bindings: Bindings) => SourceTypeDescriptor | undefined,
): SourceTypeDescriptor | undefined {
  const { ast } = source;
  const results: SourceTypeDescriptor[] = [];
  const retained = new Map<Node, { readonly values: Bindings; readonly types: ReadonlyMap<Node, Type> }>();
  const original = { values: bindings, types: new Map(application.bindings.map(binding => [binding.declaration, binding.argument])) };
  for (const step of application.conditionalSteps) {
    if (step.branch === "deferred" || step.selectedNode === undefined || step.selectedType === undefined) return undefined;
    const base = retained.get(step.conditional) ?? original;
    const selected = new Map(base.values);
    const checked = new Map(base.types);
    const inferred = new Map<Node, SourceTypeDescriptor>();
    const conditional = ast.as.AsConditionalTypeNode(step.conditional);
    if (conditional?.CheckType === undefined || conditional.ExtendsType === undefined) return undefined;
    const input = read(conditional.CheckType, selected);
    if (input !== undefined && !project(conditional.ExtendsType, input, inferred)) return undefined;
    for (const binding of step.bindings) {
      const parameter = application.bindings.find(candidate => candidate.parameter === binding.applicationParameter);
      if (parameter !== undefined && !queries.types.isIdentical(parameter.argument, binding.argument)) return undefined;
      const argument = parameter === undefined ? undefined : bindings.get(parameter.declaration);
      for (const declaration of binding.declarations) {
        const previous = checked.get(declaration);
        const value = argument ?? inferred.get(declaration) ?? (previous !== undefined &&
          queries.types.isIdentical(previous, binding.argument) ? selected.get(declaration) : undefined);
        if (value === undefined) return undefined;
        selected.set(declaration, value);
        checked.set(declaration, binding.argument);
      }
    }
    if (ast.is.IsConditionalTypeNode(step.selectedNode)) {
      retained.set(step.selectedNode, { values: selected, types: checked });
      continue;
    }
    const result = read(step.selectedNode, selected);
    if (result === undefined) return undefined;
    results.push(result);
  }
  return results.length === 0 ? undefined : sourceTypeDescriptorUnion(results);

  function project(pattern: Node, actual: SourceTypeDescriptor, inferred: Map<Node, SourceTypeDescriptor>): boolean {
    if (ast.is.IsInferTypeNode(pattern)) {
      const declaration = ast.as.AsInferTypeNode(pattern)?.TypeParameter;
      if (declaration === undefined) return false;
      const previous = inferred.get(declaration);
      if (previous !== undefined && !sourceTypeDescriptorsEqual(previous, actual)) return false;
      inferred.set(declaration, actual);
      return true;
    }
    if (ast.is.IsParenthesizedTypeNode(pattern)) {
      const inner = ast.as.AsParenthesizedTypeNode(pattern)?.Type;
      return inner !== undefined && project(inner, actual, inferred);
    }
    const structure = sourceTypeDescriptorStructure(actual);
    if (ast.is.IsFunctionTypeNode(pattern) || ast.is.IsConstructorTypeNode(pattern)) {
      if (structure.kind !== "callable" && structure.kind !== "shape") return true;
      const signatures = ast.is.IsFunctionTypeNode(pattern) ? structure.calls : structure.constructs;
      if (signatures.length !== 1) return false;
      const signature = signatures[0]!;
      for (const [index, parameter] of ast.parameters(pattern).entries()) {
        if (parameter === undefined) return false;
        const annotation = ast.typeNode(parameter);
        if (annotation === undefined) return false;
        const rest = ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined;
        const remaining = signature.parameters.slice(index);
        const value: SourceTypeDescriptor | undefined = rest
          ? remaining.length === 1 && remaining[0]!.kind === "rest" ? remaining[0]!.type
            : { kind: "tuple", readonly: false, elements: remaining.map(parameter => parameter.kind !== "optional" ||
              parameter.type.kind === "optional" ? parameter : { ...parameter, type: { kind: "optional", value: parameter.type } }) }
          : signature.parameters[index]?.type;
        if (value === undefined || !project(annotation, value, inferred)) return false;
      }
      const result = ast.typeNode(pattern);
      return result !== undefined && project(result, signature.result, inferred);
    }
    if (ast.is.IsArrayTypeNode(pattern)) {
      const element = ast.as.AsArrayTypeNode(pattern)?.ElementType;
      if (element === undefined) return false;
      if (structure.kind === "array") return project(element, structure.element, inferred);
      return structure.kind !== "tuple" || structure.elements.every(selected => project(element, selected.type, inferred));
    }
    if (ast.is.IsTupleTypeNode(pattern) && structure.kind === "tuple") {
      for (const [index, member] of ast.elements(pattern).entries()) {
        if (member === undefined) return false;
        const annotation = ast.is.IsNamedTupleMember(member) ? ast.as.AsNamedTupleMember(member)?.Type : member;
        if (annotation === undefined) return false;
        const rest = ast.is.IsRestTypeNode(annotation) ? ast.as.AsRestTypeNode(annotation)?.Type : undefined;
        const selected = structure.elements[index];
        if (rest !== undefined) return project(rest,
          { kind: "tuple", readonly: structure.readonly, elements: structure.elements.slice(index) }, inferred);
        const value = ast.is.IsOptionalTypeNode(annotation) ? ast.as.AsOptionalTypeNode(annotation)?.Type : annotation;
        if (value === undefined || selected === undefined || !project(value, selected.type, inferred)) return false;
      }
    }
    if (ast.is.IsTypeReferenceNode(pattern) && actual.kind === "declared") {
      const reference = ast.as.AsTypeReferenceNode(pattern)?.TypeName;
      if (source.navigation.sourceReferenceFor(reference)?.declaration !== actual.declaration) return true;
      const arguments_ = ast.typeArguments(pattern);
      if (arguments_.length !== actual.typeArguments.length) return false;
      return arguments_.every((argument, index) => argument !== undefined && project(argument, actual.typeArguments[index]!, inferred));
    }
    return true;
  }
}
