import type {
  ExtensionFactSubject,
  Node,
  Symbol,
  Type,
  TypeCheckerQueries,
} from "@tsonic/tsts";

export function sourceSelectedFactSubjects(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  declaration: Node | undefined,
): readonly ExtensionFactSubject[] {
  const subjects = new Set<ExtensionFactSubject>();
  if (symbol !== undefined) {
    subjects.add(symbol);
    for (const selectedDeclaration of checker.getSymbolDeclarations(symbol)) {
      if (selectedDeclaration !== undefined) {
        subjects.add(selectedDeclaration);
      }
    }
  }
  if (declaration !== undefined) {
    subjects.add(declaration);
  }
  return Object.freeze([...subjects]);
}

export function sourceTypeFactSubjects(
  checker: TypeCheckerQueries,
  type: Type,
): readonly ExtensionFactSubject[] {
  const symbols = [
    checker.getTypeAliasSymbol(type),
    checker.getTypeSymbol(type),
  ].filter((symbol) => symbol !== undefined);
  const subjects = new Set<ExtensionFactSubject>([type]);
  for (const symbol of symbols) {
    for (const subject of sourceSelectedFactSubjects(
      checker,
      symbol,
      undefined,
    )) {
      subjects.add(subject);
    }
  }
  return Object.freeze([...subjects]);
}
