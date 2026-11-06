import type { Node, Type, TypeAliasApplicationInfo } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../types.js";
import { sourceTypeDescriptorStructure, sourceTypeDescriptorsEqual, sourceTypeDescriptorUnion } from "./terms.js";
import { sourceTypeDescriptorMemberKey, sourceTypeDescriptorMemberKeysEqual } from "./member-origins.js";
import type { SourceTypeDescriptor, SourceTypeFlowSource } from "./types.js";

type Bindings = ReadonlyMap<Node, SourceTypeDescriptor>;

export function sourceTypeDescriptorConditionalDefinition(
  source: SourceTypeFlowSource,
  queries: SourceFileSemantics,
  application: TypeAliasApplicationInfo,
  bindings: Bindings,
  read: (node: Node, bindings: Bindings, checked: ReadonlyMap<Node, Type>) => SourceTypeDescriptor | undefined,
): SourceTypeDescriptor | undefined {
  const { ast } = source;
  const results: SourceTypeDescriptor[] = [];
  const retained = new Map<Node, { readonly values: Bindings; readonly types: ReadonlyMap<Node, Type> }>();
  const original = { values: bindings, types: new Map(application.bindings.map(binding => [binding.declaration, binding.argument])) };
  for (const [index, step] of application.conditionalSteps.entries()) {
    if (step.branch === "deferred" || step.selectedNode === undefined || step.selectedType === undefined) return undefined;
    const base = retained.get(step.conditional) ?? original;
    const selected = new Map(base.values);
    const checked = new Map(base.types);
    const inferred = new Map<Node, SourceTypeDescriptor>();
    const conditional = ast.as.AsConditionalTypeNode(step.conditional);
    if (conditional?.CheckType === undefined || conditional.ExtendsType === undefined) return undefined;
    const input = read(conditional.CheckType, selected, checked);
    if (step.branch === "true" && input !== undefined && !project(conditional.ExtendsType, input, inferred)) return undefined;
    for (const binding of step.bindings) {
      if (step.branch === "false" && binding.declarations.every(declaration => {
        let selected = ast.parent(declaration);
        if (selected === undefined || !ast.is.IsInferTypeNode(selected)) return false;
        while (selected !== undefined && selected !== step.conditional) {
          if (selected === conditional.ExtendsType) return true;
          selected = ast.parent(selected);
        }
        return false;
      })) continue;
      const parameter = application.bindings.find(candidate => candidate.parameter === binding.applicationParameter);
      const checkedArgument = parameter === undefined ? undefined : base.types.get(parameter.declaration);
      const retainedArgument = parameter === undefined ? undefined : base.values.get(parameter.declaration);
      const argument = checkedArgument === undefined || retainedArgument === undefined ? undefined
        : selectedBinding(checkedArgument, retainedArgument, binding.argument);
      if (checkedArgument !== undefined && argument === undefined) return undefined;
      for (const declaration of binding.declarations) {
        const previous = checked.get(declaration);
        const retainedValue = selected.get(declaration);
        const value = argument ?? inferred.get(declaration) ?? (previous !== undefined && retainedValue !== undefined
          ? selectedBinding(previous, retainedValue, binding.argument) : undefined);
        if (value === undefined) return undefined;
        selected.set(declaration, value);
        checked.set(declaration, binding.argument);
      }
    }
    let selectedNode = step.selectedNode;
    while (ast.is.IsParenthesizedTypeNode(selectedNode)) {
      const inner = ast.as.AsParenthesizedTypeNode(selectedNode)?.Type;
      if (inner === undefined) return undefined;
      selectedNode = inner;
    }
    if (ast.is.IsConditionalTypeNode(selectedNode)) {
      retained.set(selectedNode, { values: selected, types: checked });
      continue;
    }
    if (ast.is.IsTypeReferenceNode(selectedNode) || ast.is.IsImportTypeNode(selectedNode)) {
      const reference = ast.is.IsTypeReferenceNode(selectedNode) ? ast.as.AsTypeReferenceNode(selectedNode)?.TypeName
        : ast.as.AsImportTypeNode(selectedNode)?.Qualifier;
      const declaration = source.navigation.sourceReferenceFor(reference)?.declaration;
      const body = declaration === undefined || !ast.is.IsTypeAliasDeclaration(declaration) ? undefined : ast.typeNode(declaration);
      const next = application.conditionalSteps[index + 1];
      if (body !== undefined && ast.is.IsConditionalTypeNode(body) && next?.conditional === body) {
        const parameters = ast.typeParameters(declaration);
        const arguments_ = ast.typeArguments(selectedNode);
        if (parameters.length !== arguments_.length) return undefined;
        const values = new Map(selected);
        const types = new Map(checked);
        for (const [argumentIndex, parameter] of parameters.entries()) {
          const argument = arguments_[argumentIndex];
          const value = argument === undefined ? undefined : read(argument, selected, checked);
          const binding = next.bindings.find(binding => parameter !== undefined && binding.declarations.includes(parameter));
          if (parameter === undefined || value === undefined || binding === undefined) return undefined;
          values.set(parameter, value);
          types.set(parameter, binding.argument);
        }
        retained.set(body, { values, types });
        continue;
      }
    }
    const result = read(step.selectedNode, selected, checked);
    if (result === undefined) return undefined;
    results.push(result);
  }
  const inhabited = results.filter(result => {
    const structure = sourceTypeDescriptorStructure(result);
    return structure.kind !== "intrinsic" || structure.intrinsic !== "never";
  });
  return results.length === 0 ? undefined : sourceTypeDescriptorUnion(inhabited.length === 0 ? results : inhabited);

  function selectedBinding(previous: Type, value: SourceTypeDescriptor, selected: Type): SourceTypeDescriptor | undefined {
    if (queries.types.isIdentical(previous, selected)) return value;
    const structure = sourceTypeDescriptorStructure(value);
    if (structure.kind !== "optional" || !queries.types.isUnion(previous)) return undefined;
    if (queries.types.isNullish(selected) && queries.types.unionOrIntersectionTypes(previous).some(member =>
      queries.types.isIdentical(member, selected))) return { kind: "intrinsic", intrinsic: "absence" };
    const present = queries.types.nonNullableType(previous);
    return present !== undefined && queries.types.isIdentical(present, selected) ? structure.value : undefined;
  }

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
    if (ast.is.IsIntersectionTypeNode(pattern)) {
      return ast.children(pattern).every(part => part !== undefined && project(part, actual, inferred));
    }
    let structure = sourceTypeDescriptorStructure(actual);
    if (ast.is.IsTypeLiteralNode(pattern)) {
      if (structure.kind !== "shape") return false;
      for (const property of ast.members(pattern)) {
        if (property === undefined) return false;
        const nameNode = ast.name(property);
        const name = nameNode === undefined ? undefined : queries.operations.propertyName(nameNode);
        const key = name === undefined ? undefined : sourceTypeDescriptorMemberKey(name.type, queries);
        if (key === undefined) return false;
        const matching = structure.members.filter(member => {
          const origin = member.origin;
          const selectedNode = origin.kind === "declared" ? ast.name(origin.declaration) : undefined;
          const selectedName = selectedNode === undefined ? undefined : queries.operations.propertyName(selectedNode);
          const selectedKey = origin.kind === "mapped" ? origin.key
            : selectedName === undefined ? undefined : sourceTypeDescriptorMemberKey(selectedName.type, queries);
          return selectedKey !== undefined && sourceTypeDescriptorMemberKeysEqual(key, selectedKey);
        });
        if (matching.length !== 1) return false;
        const member = matching[0]!;
        const annotation = ast.is.IsMethodSignatureDeclaration(property) ? property : ast.typeNode(property);
        if (annotation === undefined || !project(annotation, member.type, inferred)) return false;
      }
      return true;
    }
    if (ast.is.IsFunctionTypeNode(pattern) || ast.is.IsConstructorTypeNode(pattern) || ast.is.IsMethodSignatureDeclaration(pattern)) {
      while (structure.kind === "optional") structure = sourceTypeDescriptorStructure(structure.value);
      if (structure.kind !== "callable" && structure.kind !== "shape") return false;
      const signatures = ast.is.IsConstructorTypeNode(pattern) ? structure.constructs : structure.calls;
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
