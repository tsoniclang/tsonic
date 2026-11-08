import { sourceAnalysisIncludesFile } from "../analysis-program.js";
import { isAbsolute, relative } from "node:path";
import { createSourceDiagnosticSpanReader } from "../../source-semantics/diagnostic-spans.js";
export function sourceGenericAdoptionDiagnosticMessage(parameter, operand) {
    return `await of a value typed by the type parameter '${parameter}' needs its Promise form declared. Declare it as '${operand}: ${parameter} | Promise<${parameter}>'.`;
}
export function createSourceGenericAdoptionDiagnostics(source, projectRoot) {
    const { ast } = source;
    const readSpan = createSourceDiagnosticSpanReader(ast);
    const sourceSpanFor = (node) => {
        const file = ast.getSourceFile(node);
        if (file === undefined || !sourceAnalysisIncludesFile(source, file))
            return undefined;
        const span = readSpan(file, ast.pos(node), ast.end(node));
        if (span === undefined)
            return undefined;
        const fileName = (isAbsolute(span.fileName) ? relative(projectRoot, span.fileName) : span.fileName)
            .split("\\").join("/");
        return Object.freeze({ ...span, fileName });
    };
    const formatDiagnostic = (site, declaration, operation, parameter, operand) => {
        const sourceSpan = sourceSpanFor(site);
        const declarationSpan = sourceSpanFor(declaration);
        const operationSpan = sourceSpanFor(operation);
        const parameterName = ast.text(ast.name(parameter));
        const operandName = ast.is.IsIdentifier(operand) ? ast.text(operand) : "x";
        if (sourceSpan === undefined || declarationSpan === undefined || operationSpan === undefined ||
            parameterName === "" || operandName === "")
            return undefined;
        return Object.freeze({ sourceSpan, message: sourceGenericAdoptionDiagnosticMessage(parameterName, operandName),
            evidence: Object.freeze([
                `declaration ${declarationSpan.fileName}:${declarationSpan.line}:${declarationSpan.column}`,
                `first-sensitive-operation ${operationSpan.fileName}:${operationSpan.line}:${operationSpan.column}`,
            ]) });
    };
    return formatDiagnostic;
}
//# sourceMappingURL=generic-adoption-diagnostics.js.map