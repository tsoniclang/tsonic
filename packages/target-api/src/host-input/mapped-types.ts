import type { Node, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";
import { sourceHostTypeDeclaration } from "./queries.js";
import type { SourceTypeFlowSource } from "../source-semantics/local-type-flow/types.js";

export function sourceTypeFlowHomomorphicInput(source: SourceTypeFlowSource, queries: SourceFileSemantics, type: Type,
  authoredTypeNode?: Node): Type | undefined {
  const { ast } = source;
  type Bindings = ReadonlyMap<Node, Type>;
  const visited = new Set<Node>();

  function argument(node: Node, bindings: Bindings): Type | undefined {
    const selected = queries.types.authoredType(node);
    if (selected === undefined) return undefined;
    const declaration = sourceHostTypeDeclaration(source.ast, queries, selected, node);
    if (declaration !== undefined && bindings.has(declaration)) return bindings.get(declaration);
    return selected;
  }

  function mappedInput(node: Node, bindings: Bindings, alias?: Node): Type | undefined {
    const mapped = ast.as.AsMappedTypeNode(node);
    const parameter = mapped?.TypeParameter;
    const constraint = parameter === undefined ? undefined : ast.as.AsTypeParameterDeclaration(parameter)?.Constraint;
    if (mapped === undefined || parameter === undefined || constraint === undefined || mapped.NameType !== undefined ||
      mapped.Members !== undefined && mapped.Members.Nodes.length > 0 || !ast.is.IsTypeOperatorNode(constraint) ||
      ast.operatorKindName(constraint) !== "KindKeyOfKeyword") return undefined;
    const selected = ast.as.AsTypeOperatorNode(constraint)?.Type;
    const indexed = mapped.Type === undefined || !ast.is.IsIndexedAccessTypeNode(mapped.Type)
      ? undefined : ast.as.AsIndexedAccessTypeNode(mapped.Type);
    if (selected === undefined || indexed?.ObjectType === undefined || indexed.IndexType === undefined) return undefined;
    const selectedType = queries.types.authoredType(selected);
    const objectType = queries.types.authoredType(indexed.ObjectType);
    const indexType = queries.types.authoredType(indexed.IndexType);
    if (selectedType === undefined || objectType === undefined || indexType === undefined) return undefined;
    const owner = sourceHostTypeDeclaration(source.ast, queries, selectedType, selected);
    if (owner === undefined || !ast.is.IsTypeParameterDeclaration(owner) ||
      alias !== undefined && !ast.typeParameters(alias).includes(owner) ||
      owner !== sourceHostTypeDeclaration(source.ast, queries, objectType, indexed.ObjectType) ||
      sourceHostTypeDeclaration(source.ast, queries, indexType, indexed.IndexType) !== parameter) return undefined;
    return argument(selected, bindings);
  }

  function authored(node: Node, bindings: Bindings): Type | undefined {
    if (ast.is.IsParenthesizedTypeNode(node)) {
      const inner = ast.as.AsParenthesizedTypeNode(node)?.Type;
      return inner === undefined ? undefined : authored(inner, bindings);
    }
    if (ast.is.IsMappedTypeNode(node)) return mappedInput(node, bindings);
    const reference = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName
      : ast.is.IsImportTypeNode(node) ? ast.as.AsImportTypeNode(node)?.Qualifier : undefined;
    const declaration = reference === undefined ? undefined : source.navigation.sourceReferenceFor(reference)?.declaration;
    if (declaration === undefined || !ast.is.IsTypeAliasDeclaration(declaration) || visited.has(declaration)) return undefined;
    visited.add(declaration);
    const arguments_: Type[] = [];
    for (const child of ast.typeArguments(node)) {
      const selected = child === undefined ? undefined : argument(child, bindings);
      if (selected === undefined) return undefined;
      arguments_.push(selected);
    }
    const application = queries.types.instantiateAlias(declaration, arguments_);
    if (application?.kind !== "direct" || application.declaration !== declaration) return undefined;
    const instantiated = new Map(application.bindings.map(binding => [binding.declaration, binding.argument]));
    return ast.is.IsMappedTypeNode(application.typeNode)
      ? mappedInput(application.typeNode, instantiated, declaration) : authored(application.typeNode, instantiated);
  }

  let selected: Type | undefined;
  if (authoredTypeNode !== undefined) selected = authored(authoredTypeNode, new Map());
  else {
    const application = queries.types.aliasApplication(type);
    if (application?.kind !== "direct" || !queries.types.isIdentical(application.result, type)) return undefined;
    const bindings = new Map(application.bindings.map(binding => [binding.declaration, binding.argument]));
    selected = ast.is.IsMappedTypeNode(application.typeNode)
      ? mappedInput(application.typeNode, bindings, application.declaration) : authored(application.typeNode, bindings);
  }
  return selected === undefined || queries.types.isAny(selected) || queries.types.isUnknown(selected) ? undefined : selected;
}
