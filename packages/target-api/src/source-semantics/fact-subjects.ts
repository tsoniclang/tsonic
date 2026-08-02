import type {
  ExtensionFactSubject,
  Node,
  Type,
  TypeCheckerQueries,
} from "@tsonic/tsts";

export function sourceTypeFactSubjects(
  checker: TypeCheckerQueries,
  type: Type,
): readonly ExtensionFactSubject[] {
  const symbols = [
    checker.getTypeAliasSymbol(type),
    checker.getTypeSymbol(type),
  ].filter((symbol) => symbol !== undefined);
  const subjects = new Set<ExtensionFactSubject>([type, ...symbols]);
  for (const symbol of symbols) {
    for (const declaration of checker.getSymbolDeclarations(symbol)) {
      if (declaration !== undefined) {
        subjects.add(declaration as Node);
      }
    }
  }
  return Object.freeze([...subjects]);
}
