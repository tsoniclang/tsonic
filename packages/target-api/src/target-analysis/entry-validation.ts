import type { SourceAnalysisProgram } from "./analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import { createSourceCallableValueQuery, sourceCallableValueExpression } from "../source-navigation/callable-values.js";
import { isSourceCallableSignatureDeclaration } from "../source-navigation/callable-boundaries.js";
import { sourceAnalysisArms, sourceAnalysisCallSignatures, sourceAnalysisValueType } from "./analysis-program.js";

export interface SourceBinaryEntryIssue {
  readonly code: "TSONIC_UNCALLED_BINARY_ENTRY_MAIN";
  readonly node: Node;
  readonly message: string;
  readonly evidence: readonly string[];
}

export function validateSourceBinaryEntry(
  source: SourceAnalysisProgram,
  entrySourceFile: SourceFile,
): readonly SourceBinaryEntryIssue[] {
  const exported = source.navigation.moduleExports(entrySourceFile)
    .find(candidate => candidate.exportName === "main");
  if (exported === undefined) return Object.freeze([]);
  if (!exportIsCallable(exported.declaration)) return Object.freeze([]);
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

  // The exported main is callable: a callable declaration, or a variable whose Host type carries call signatures.
  function exportIsCallable(declaration: Node): boolean {
    if (isSourceCallableSignatureDeclaration(source.ast, declaration)) return true;
    if (!source.ast.is.IsVariableDeclaration(declaration)) return false;
    const type = sourceAnalysisValueType(source, declaration);
    return type !== undefined && sourceAnalysisArms(type).some(arm => sourceAnalysisCallSignatures(arm).length !== 0);
  }

  function callableImplementation(declaration: Node): Node {
    const result = source.navigation.callableImplementation(declaration);
    return result.kind === "resolved" ? result.implementation.declaration : declaration;
  }
}
