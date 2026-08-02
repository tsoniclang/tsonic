import type {
  AstReader,
  Node,
  ReadonlySourceFactResolver,
  Type,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import {
  sourceTypeRelationship,
} from "./type-relationship.js";

export type SourceAuthoredTypeSelection =
  | {
      readonly kind: "authored-type";
      readonly node: Node;
    }
  | {
      readonly kind: "authored-union-members";
      readonly nodes: readonly Node[];
    }
  | { readonly kind: "ambiguous" }
  | { readonly kind: "unrelated" };

export function selectAuthoredSourceType(
  ast: AstReader,
  types: TypeShapeQueries,
  checker: TypeCheckerQueries,
  facts: ReadonlySourceFactResolver,
  authoredTypeNode: Node,
  selectedType: Type,
): SourceAuthoredTypeSelection {
  const authoredType = checker.getTypeFromTypeNode(authoredTypeNode);
  if (authoredType === undefined) {
    return { kind: "unrelated" };
  }
  const directRelationship = sourceTypeRelationship(
    types,
    checker,
    facts,
    authoredType,
    selectedType,
  );
  if (directRelationship !== "unrelated") {
    return { kind: "authored-type", node: authoredTypeNode };
  }
  const authoredMembers = authoredUnionMemberNodes(ast, authoredTypeNode);
  if (authoredMembers === undefined) {
    return { kind: "unrelated" };
  }
  const rawSelectedMembers = types.isUnion(selectedType)
    ? types.getUnionOrIntersectionTypes(selectedType)
    : [selectedType];
  if (rawSelectedMembers.some((member) => member === undefined)) {
    return { kind: "unrelated" };
  }
  const selectedMembers = rawSelectedMembers.filter(
    (member): member is Type => member !== undefined,
  );
  const selectedNodes: Node[] = [];
  for (const selectedMember of selectedMembers) {
    const candidates = authoredMembers.filter((authoredMember) => {
      const authoredMemberType = checker.getTypeFromTypeNode(authoredMember);
      return authoredMemberType !== undefined &&
        sourceTypeRelationship(
            types,
            checker,
            facts,
            authoredMemberType,
            selectedMember,
          ) !== "unrelated";
    });
    if (candidates.length === 0) {
      return { kind: "unrelated" };
    }
    if (candidates.length !== 1) {
      return { kind: "ambiguous" };
    }
    if (!selectedNodes.includes(candidates[0]!)) {
      selectedNodes.push(candidates[0]!);
    }
  }
  return {
    kind: "authored-union-members",
    nodes: Object.freeze(selectedNodes),
  };
}

function authoredUnionMemberNodes(
  ast: AstReader,
  node: Node,
): readonly Node[] | undefined {
  if (ast.is.IsUnionTypeNode(node)) {
    return Object.freeze(ast.children(node).filter(
      (child): child is Node => child !== undefined,
    ));
  }
  if (ast.is.IsParenthesizedTypeNode(node)) {
    const inner = ast.as.AsParenthesizedTypeNode(node)?.Type;
    return inner === undefined
      ? undefined
      : authoredUnionMemberNodes(ast, inner);
  }
  return undefined;
}
