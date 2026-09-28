import type {
  SourceAnalysisContext,
  ExtensionFactReader,
  SourceFileQueries,
} from "@tsonic/tsts";

export interface TsonicSourceFileFactContext extends SourceFileQueries {
  readonly facts: ExtensionFactReader;
  readonly factResolver: SourceAnalysisContext["factResolver"];
  readonly diagnostics: SourceAnalysisContext["diagnostics"];
}

export interface TsonicSourceFileAnalysisContext extends TsonicSourceFileFactContext {
  readonly facts: SourceAnalysisContext["facts"];
}

export function forEachTsonicSourceFile(
  context: SourceAnalysisContext,
  visitor: (context: TsonicSourceFileAnalysisContext) => void,
): void {
  for (const sourceFile of context.source.getSourceFiles()) {
    if (
      sourceFile === undefined ||
      context.source.ast.getFileName(sourceFile).endsWith(".d.ts")
    ) {
      continue;
    }
    const queries = context.source.getSourceFileQueries(sourceFile);
    visitor({
      ...queries,
      facts: context.facts,
      factResolver: context.factResolver,
      diagnostics: context.diagnostics,
    });
  }
}
