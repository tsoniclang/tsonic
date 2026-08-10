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
  const visited = new Set<Node>();
  const subjects: ExtensionFactSubject[] = [];
  const visit = (current: Node | undefined): void => {
    if (current === undefined || visited.has(current)) {
      return;
    }
    visited.add(current);
    if (facts.getFacts(current).length > 0) {
      subjects.push(current);
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
  return Object.freeze(subjects);
}
