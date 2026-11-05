import type { Node, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../types.js";
import { sourceTypeFlowTypeDeclaration } from "./defaults.js";
import type { SourceTypeFlowSource } from "./types.js";

export function sourceTypeFlowHomomorphicInput(source: SourceTypeFlowSource, queries: SourceFileSemantics, type: Type,
  authoredTypeNode?: Node): Type | undefined {
  const { ast } = source;
  const application = queries.types.aliasApplication(type);
  const mappedNode = application?.kind === "direct" ? application.typeNode : authoredTypeNode;
  if (mappedNode === undefined || !ast.is.IsMappedTypeNode(mappedNode) || application !== undefined &&
    (application.kind !== "direct" || application.bindings.length !== 1 || !queries.types.isIdentical(application.result, type))) return undefined;
  const mapped = ast.as.AsMappedTypeNode(mappedNode);
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
  const owner = sourceTypeFlowTypeDeclaration(source, queries, selectedType);
  if (owner === undefined || owner !== sourceTypeFlowTypeDeclaration(source, queries, objectType) ||
    sourceTypeFlowTypeDeclaration(source, queries, indexType) !== parameter) return undefined;
  if (application === undefined) return selectedType;
  const binding = application.bindings[0]!;
  return binding.declaration === owner ? binding.argument : undefined;
}
