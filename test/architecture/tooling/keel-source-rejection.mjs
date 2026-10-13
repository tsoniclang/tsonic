import { keelDigest } from "./keel-source-analysis.mjs";

export function keelSourceRejectionIdentity(observation, expectedCodes) {
  if (observation?.stage !== "source" || observation.nativeProgramCompilationInvoked !== false ||
    !Array.isArray(observation.publishedArtifacts) || observation.publishedArtifacts.length !== 0 ||
    !Array.isArray(observation.diagnostics) || observation.diagnostics.length === 0 ||
    !Array.isArray(expectedCodes) || expectedCodes.length === 0 ||
    expectedCodes.some(code => typeof code !== "string" || !/^TS[0-9]+$/u.test(code)) ||
    new Set(expectedCodes).size !== expectedCodes.length) {
    throw new Error("A source-rejection control requires exact checker diagnostics and no native invocation or publication.");
  }
  const diagnostics = observation.diagnostics.map(diagnostic => {
    if (diagnostic?.code !== "TSTS_DIAGNOSTIC" || diagnostic.category !== "error" ||
      typeof diagnostic.message !== "string" || diagnostic.message.length === 0 ||
      !Array.isArray(diagnostic.evidence) || diagnostic.evidence.some(value => typeof value !== "string")) {
      throw new Error("A source-rejection control cannot substitute target, native, warning or textual failure evidence.");
    }
    const codes = diagnostic.evidence.filter(value => /^tsts\.code=TS[0-9]+$/u.test(value));
    if (codes.length !== 1 || !expectedCodes.includes(codes[0].slice("tsts.code=".length))) {
      throw new Error("The checker diagnostic does not match the exact source-rejection control.");
    }
    const span = diagnostic.sourceSpan;
    if (span === null || typeof span !== "object" || typeof span.fileName !== "string" || span.fileName.length === 0 ||
      ["line", "column", "endLine", "endColumn"].some(field => !Number.isSafeInteger(span[field]) || span[field] < 0) ||
      span.endLine < span.line || span.endLine === span.line && span.endColumn < span.column) {
      throw new Error("The source-rejection diagnostic needs its complete checked source span.");
    }
    return { code: diagnostic.code, category: diagnostic.category, message: diagnostic.message,
      source: diagnostic.source, sourceSpan: { fileName: span.fileName, line: span.line, column: span.column,
        endLine: span.endLine, endColumn: span.endColumn }, evidence: [...diagnostic.evidence] };
  });
  for (const code of expectedCodes) {
    if (!diagnostics.some(diagnostic => diagnostic.evidence.includes(`tsts.code=${code}`))) {
      throw new Error("A required checker diagnostic is absent from the source-rejection control.");
    }
  }
  return keelDigest(JSON.stringify(diagnostics));
}
