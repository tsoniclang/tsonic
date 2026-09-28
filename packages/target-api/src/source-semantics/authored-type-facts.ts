import type {
  AstReader,
  ExtensionFactSubject,
  Node,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import { sourcePrimitiveFactKey } from "@tsonic/tsts";
import type {
  SourceReferenceNavigation,
} from "../source-navigation/index.js";
import { sourceTypeFactSubjects } from "./fact-subjects.js";
import type { SourceSemanticFactQueries } from "./types.js";

export function authoredSourceTypeFactDependencies(
  ast: AstReader,
  navigation: Pick<SourceReferenceNavigation, "referenceFor">,
  facts: SourceSemanticFactQueries,
  checker: TypeCheckerQueries,
  node: Node,
): readonly ExtensionFactSubject[] {
  return collectAuthoredSourceTypeFactDependencies(
    ast,
    navigation,
    facts,
    checker,
    node,
  ).subjects;
}

export function authoredSourceTypeFactNodes(
  ast: AstReader,
  navigation: Pick<SourceReferenceNavigation, "referenceFor">,
  facts: SourceSemanticFactQueries,
  checker: TypeCheckerQueries,
  node: Node,
): readonly Node[] {
  return collectAuthoredSourceTypeFactDependencies(
    ast,
    navigation,
    facts,
    checker,
    node,
  ).nodes;
}

interface AuthoredSourceTypeFactDependencies {
  readonly nodes: readonly Node[];
  readonly subjects: readonly ExtensionFactSubject[];
}

function collectAuthoredSourceTypeFactDependencies(
  ast: AstReader,
  navigation: Pick<SourceReferenceNavigation, "referenceFor">,
  facts: SourceSemanticFactQueries,
  checker: TypeCheckerQueries,
  node: Node,
): AuthoredSourceTypeFactDependencies {
  const visited = new Set<Node>();
  const nodes: Node[] = [];
  const subjects: ExtensionFactSubject[] = [];
  const visit = (current: Node | undefined): void => {
    if (current === undefined || visited.has(current)) {
      return;
    }
    visited.add(current);
    const primitive = ast.is.IsTypeReferenceNode(current)
      ? facts.getFact(current, sourcePrimitiveFactKey)
      : undefined;
    const hasFacts = facts.hasFacts(current);
    if (hasFacts) {
      subjects.push(current);
    }
    if (hasFacts || ast.is.IsKeywordTypeNode(current) || ast.is.IsIndexedAccessTypeNode(current)) {
      nodes.push(current);
    }
    ast.forEachChild(current, visit);
    if (!ast.is.IsTypeReferenceNode(current) || primitive !== undefined) {
      return;
    }
    const typeName = ast.as.AsTypeReferenceNode(current)?.TypeName;
    const reference = navigation.referenceFor(typeName);
    if (
      reference !== undefined &&
      ast.is.IsTypeAliasDeclaration(reference.declaration)
    ) {
      visit(ast.as.AsTypeAliasDeclaration(reference.declaration)?.Type);
    }
  };
  visit(node);
  const type = checker.getTypeFromTypeNode(node);
  if (type !== undefined) {
    for (const subject of sourceTypeFactSubjects(checker, type)) {
      if (facts.hasFacts(subject) && !subjects.includes(subject)) {
        subjects.push(subject);
      }
    }
  }
  return Object.freeze({
    nodes: Object.freeze(nodes),
    subjects: Object.freeze(subjects),
  });
}
