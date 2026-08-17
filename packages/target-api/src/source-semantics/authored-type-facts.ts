import type {
  AstReader,
  ExtensionFactSubject,
  Node,
  ReadonlySourceFactResolver,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import type {
  SourceProgramNavigation,
} from "../source-navigation/index.js";
import { sourceTypeFactSubjects } from "./fact-subjects.js";

export function authoredSourceTypeFactDependencies(
  ast: AstReader,
  navigation: SourceProgramNavigation,
  facts: ReadonlySourceFactResolver,
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
  navigation: SourceProgramNavigation,
  facts: ReadonlySourceFactResolver,
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
  navigation: SourceProgramNavigation,
  facts: ReadonlySourceFactResolver,
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
    if (facts.getFacts(current).length > 0) {
      subjects.push(current);
      nodes.push(current);
    }
    ast.forEachChild(current, visit);
    if (!ast.is.IsTypeReferenceNode(current)) {
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
      if (facts.getFacts(subject).length > 0 && !subjects.includes(subject)) {
        subjects.push(subject);
      }
    }
  }
  return Object.freeze({
    nodes: Object.freeze(nodes),
    subjects: Object.freeze(subjects),
  });
}
