import type { Node } from "@tsonic/tsts";
import { isAbsolute, relative } from "node:path";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceDiagnosticSpanReader } from "../../source-semantics/diagnostic-spans.js";

/** The source span and evidence lines of a generic adoption diagnostic, with file names relative to the project root. */
export function createSourceGenericAdoptionDiagnostics(source: TargetSourceProgram, projectRoot: string) {
  const { ast } = source;
  const readSpan = createSourceDiagnosticSpanReader(ast);
  const sourceSpanFor = (node: Node): TargetDiagnosticSourceSpan | undefined => {
    const file = ast.getSourceFile(node);
    if (file === undefined || !source.semantics.includes(file)) return undefined;
    const span = readSpan(file, ast.pos(node), ast.end(node));
    if (span === undefined) return undefined;
    const fileName = (isAbsolute(span.fileName) ? relative(projectRoot, span.fileName) : span.fileName)
      .split("\\").join("/");
    return Object.freeze({ ...span, fileName });
  };
  const formatDiagnostic = (site: Node, declaration: Node, operation: Node) => {
    const sourceSpan = sourceSpanFor(site);
    const declarationSpan = sourceSpanFor(declaration);
    const operationSpan = sourceSpanFor(operation);
    if (sourceSpan === undefined || declarationSpan === undefined || operationSpan === undefined) return undefined;
    return Object.freeze({ sourceSpan, evidence: Object.freeze([
      `declaration ${declarationSpan.fileName}:${declarationSpan.line}:${declarationSpan.column}`,
      `first-sensitive-operation ${operationSpan.fileName}:${operationSpan.line}:${operationSpan.column}`,
    ]) });
  };
  return formatDiagnostic;
}
