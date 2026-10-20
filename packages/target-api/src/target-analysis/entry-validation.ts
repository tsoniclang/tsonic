import type { Node, SourceFile } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../source-semantics/types.js";
import { createSourceCallableValueQuery, sourceCallableValueExpression } from "../source-navigation/callable-values.js";

export interface SourceBinaryEntryIssue {
  readonly code: "TSONIC_UNCALLED_BINARY_ENTRY_MAIN";
  readonly node: Node;
  readonly message: string;
  readonly evidence: readonly string[];
}

export function validateSourceBinaryEntry(
  source: TargetSourceProgram,
  entrySourceFile: SourceFile,
): readonly SourceBinaryEntryIssue[] {
  const exported = source.navigation.moduleExports(entrySourceFile)
    .find(candidate => candidate.exportName === "main");
  if (exported === undefined) return Object.freeze([]);
  const semantics = source.semantics.forNode(exported.declaration);
  const type = semantics.types.typeOfSymbol(exported.symbol);
  if (type === undefined || semantics.types.callSignatures(type).length === 0) return Object.freeze([]);
  const options = { typeAssertions: "transparent", stopAtDeclaration: exported.declaration } as const;
  const selectValue = createSourceCallableValueQuery(source, options);
  const implementation = callableImplementation(exported.declaration);
  const matchesEntry = (declaration: Node): boolean => callableImplementation(declaration) === implementation;
  let called = false;
  const visit = (node: Node): void => {
    if (called) return;
    if (source.ast.is.IsCallExpression(node)) {
      const expression = sourceCallableValueExpression(source.ast, source.ast.as.AsCallExpression(node)?.Expression, options);
      const reference = source.navigation.sourceReferenceFor(expression);
      if (reference !== undefined && matchesEntry(reference.declaration)) {
        called = true;
        return;
      }
      const value = expression === undefined ? undefined : selectValue(expression);
      if (value !== undefined && matchesEntry(value.selectedDeclaration)) {
        called = true;
        return;
      }
    }
    source.ast.forEachChild(node, child => {
      if (child !== undefined) visit(child);
    });
  };
  visit(entrySourceFile);
  return Object.freeze(called ? [] : [Object.freeze({
    code: "TSONIC_UNCALLED_BINARY_ENTRY_MAIN" as const,
    node: exported.declaration,
    message: "Binary entry modules execute their top-level code. Explicitly call the exported main; it is not invoked automatically.",
    evidence: Object.freeze(["source.entry=top-level", "source.entry.export=main"]),
  })]);

  function callableImplementation(declaration: Node): Node {
    const result = source.navigation.callableImplementation(declaration);
    return result.kind === "resolved" ? result.implementation.declaration : declaration;
  }
}
