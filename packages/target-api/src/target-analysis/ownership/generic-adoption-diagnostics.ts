import type { Node } from "@tsonic/tsts";
import { isAbsolute, relative } from "node:path";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceDiagnosticSpanReader } from "../../source-semantics/diagnostic-spans.js";

export function sourceGenericAdoptionDiagnosticMessage(parameter: string, operand: string): string {
  return `await of a value typed by the type parameter '${parameter}' needs its Promise form declared. Declare it as '${operand}: ${parameter} | Promise<${parameter}>'.`;
}

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
  const formatDiagnostic = (site: Node, declaration: Node, operation: Node, parameter: Node, operand: Node) => {
    const sourceSpan = sourceSpanFor(site);
    const declarationSpan = sourceSpanFor(declaration);
    const operationSpan = sourceSpanFor(operation);
    const parameterName = ast.text(ast.name(parameter));
    const operandName = ast.is.IsIdentifier(operand) ? ast.text(operand) : "x";
    if (sourceSpan === undefined || declarationSpan === undefined || operationSpan === undefined ||
      parameterName === "" || operandName === "") return undefined;
    return Object.freeze({ sourceSpan, message: sourceGenericAdoptionDiagnosticMessage(parameterName, operandName),
      evidence: Object.freeze([
        `declaration ${declarationSpan.fileName}:${declarationSpan.line}:${declarationSpan.column}`,
        `first-sensitive-operation ${operationSpan.fileName}:${operationSpan.line}:${operationSpan.column}`,
      ]) });
  };
  return formatDiagnostic;
}
